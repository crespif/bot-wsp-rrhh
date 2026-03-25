const express = require("express");
const QRCode = require("qrcode");
const { getConsultas, desactivarModoHumano } = require("./estadoBot");
const { horario, cambiarHorario } = require("./data/horario");

const app = express();

let qrActual = null;
let conectado = false;
let ultimasConsultasCount = 0;

// Clientes SSE conectados
const sseClients = new Set();

// Emitir evento a todos los clientes SSE abiertos
function emitirEvento(tipo, datos = {}) {
  const payload = `data: ${JSON.stringify({ tipo, ...datos })}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (_) { sseClients.delete(res); }
  }
}

function setConectado() {
  console.log("SET_CONECTADO: true");
  conectado = true;
  qrActual = null;
  emitirEvento('actualizar');
}

function setQR(qr) {
  console.log("SET_QR: (actualizado)");
  qrActual = qr;
  conectado = false;
  emitirEvento('actualizar');
}

function estaConectado() {
  return conectado
}

// Endpoint API para detectar cambios en estado
app.get("/api/estado", (req, res) => {
  const consultas = getConsultas();
  res.json({
    conectado,
    qrActual,
    consultasCount: consultas ? consultas.length : 0,
    consultas: consultas || []
  });
});

// Endpoint para desactivar modo humano desde el panel
app.post("/api/desactivar", (req, res) => {
  const { numero } = req.query;
  desactivarModoHumano(numero);
  emitirEvento('actualizar');
  res.json({ success: true });
});

// Endpoint SSE — el navegador se suscribe aquí y recibe eventos en tiempo real
app.get("/api/eventos", (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Heartbeat cada 30s para mantener la conexión viva
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) { clearInterval(heartbeat); }
  }, 30000);

  sseClients.add(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// Función helper para generar HTML completo bien estructurado
function generarHTML(contenido) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bot RRHH - WhatsApp</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #b5eecbff 0%, #1a693eff 100%);
      min-height: 100vh;
    }
    .container { 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      justify-content: center; 
      min-height: 100vh;
      padding: 20px;
    }
    .content { 
      background: white; 
      padding: 40px; 
      border-radius: 15px; 
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      text-align: center; 
      max-width: 600px;
      width: 100%;
    }
    h2 { 
      color: #333; 
      margin-bottom: 30px; 
      font-size: 28px;
      font-weight: 600;
    }
    .spinner { 
      border: 4px solid #f3f3f3; 
      border-top: 4px solid #3498db; 
      border-radius: 50%; 
      width: 50px; 
      height: 50px; 
      animation: spin 1s linear infinite; 
      margin: 20px auto;
    }
    @keyframes spin { 
      0% { transform: rotate(0deg); } 
      100% { transform: rotate(360deg); } 
    }
    .status { 
      color: #999; 
      margin: 20px 0; 
      font-size: 14px;
    }
    .success { 
      color: #27ae60; 
      background: #d5f4e6; 
      padding: 15px; 
      border-radius: 8px; 
      margin: 20px 0;
      border-left: 4px solid #27ae60;
    }
    .success h3 {
      font-size: 20px;
      margin-bottom: 10px;
    }
    .warning { 
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px; 
      border-radius: 8px; 
      margin: 20px 0;
      color: #856404;
    }
    .warning h4 {
      margin-bottom: 10px;
      font-size: 16px;
    }
    .warning ul {
      list-style: none;
      text-align: left;
    }
    .warning li {
      padding: 5px 0;
      font-size: 14px;
    }
    img { 
      max-width: 250px;
      margin: 20px auto; 
      display: block;
    }
    .error { 
      color: #c0392b; 
      background: #fadbd8; 
      padding: 15px; 
      border-radius: 8px;
      border-left: 4px solid #e74c3c;
    }
    svg {
      width: 100px;
      height: 100px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      ${contenido}
      <script>
        // Suscripción SSE — recibe eventos del servidor en tiempo real
        function conectarSSE() {
          const source = new EventSource('/api/eventos');

          source.onmessage = (e) => {
            try {
              const data = JSON.parse(e.data);
              if (data.tipo === 'actualizar' || data.tipo === 'consulta') {
                location.reload();
              }
            } catch (_) {}
          };

          source.onerror = () => {
            // Si se cae la conexión SSE, reintenta en 5 segundos
            source.close();
            setTimeout(conectarSSE, 5000);
          };
        }
        conectarSSE();
      </script>
    </div>
  </div>
</body>
</html>`;
}

app.get("/", async (req, res) => {

  // Estado: WhatsApp conectado, mostrando consultas activas
  if (conectado && !qrActual) {
    const consultas = getConsultas();

    let contenido = `
      <h2>Bot RRHH</h2>
      <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 48 48">
        <path fill="#40c351" d="M35.2,12.8c-3-3-6.9-4.6-11.2-4.6C15.3,8.2,8.2,15.3,8.2,24c0,3,0.8,5.9,2.4,8.4L11,33l-1.6,5.8l6-1.6l0.6,0.3c2.4,1.4,5.2,2.2,8,2.2h0c8.7,0,15.8-7.1,15.8-15.8C39.8,19.8,38.2,15.8,35.2,12.8z"></path>
        <path fill="#fff" fill-rule="evenodd" d="M19.3,16c-0.4-0.8-0.7-0.8-1.1-0.8c-0.3,0-0.6,0-0.9,0s-0.8,0.1-1.3,0.6c-0.4,0.5-1.7,1.6-1.7,4s1.7,4.6,1.9,4.9s3.3,5.3,8.1,7.2c4,1.6,4.8,1.3,5.7,1.2c0.9-0.1,2.8-1.1,3.2-2.3c0.4-1.1,0.4-2.1,0.3-2.3c-0.1-0.2-0.4-0.3-0.9-0.6s-2.8-1.4-3.2-1.5c-0.4-0.2-0.8-0.2-1.1,0.2c-0.3,0.5-1.2,1.5-1.5,1.9c-0.3,0.3-0.6,0.4-1,0.1c-0.5-0.2-2-0.7-3.8-2.4c-1.4-1.3-2.4-2.8-2.6-3.3c-0.3-0.5,0-0.7,0.2-1c0.2-0.2,0.5-0.6,0.7-0.8c0.2-0.3,0.3-0.5,0.5-0.8c0.2-0.3,0.1-0.6,0-0.8C20.6,19.3,19.7,17,19.3,16z" clip-rule="evenodd"></path>
      </svg>
      <div class="success">
        <h3>✅ WhatsApp ya conectado</h3>
      </div>
    `;

    if (consultas && consultas.length > 0) {
      contenido += `
        <div class="warning">
          <h4>📱 ${consultas.length} Consulta${consultas.length > 1 ? 's' : ''} Activa${consultas.length > 1 ? 's' : ''}:</h4>
          <ul>
      `;
      consultas.forEach(([numero, empleado]) => {
        contenido += `<li style="display: flex; align-items: center; justify-content: space-between; padding: 5px 0;">
          <span>👤 <strong>${empleado.nombre}</strong> (${numero}) </span>
          <div style="display: flex; gap: 10px;">
            <a 
              href="https://wa.me/+${numero}" 
              style="padding: 5px 10px; background: #40c351; color: white; border: none; border-radius: 5px; cursor: pointer; text-decoration: none;" 
              target="_blank"
              onClick="alert('Abriendo WhatsApp para contactar a ${empleado.nombre}');"
            >
              Contactar
            </a>
            <button 
              style="padding: 5px 10px; background: white; color: #c0392b; border: 1px solid #c0392b; border-radius: 5px; cursor: pointer;" 
              onClick="fetch('/api/desactivar?numero=${numero}', { method: 'POST' }).then(() => alert('Modo humano desactivado para ${empleado.nombre}')).catch(() => alert('Error al desactivar modo humano para ${empleado.nombre}'));">
              ❌ Cerrar
            </button>
          </div>
        </li>`;
      });
      contenido += `</ul></div>`;
    }

    return res.send(generarHTML(contenido));
  }

  // Estado: Esperando que se genere el QR
  if (!qrActual) {
    const contenido = `
      <h2>Bot RRHH</h2>
      <p style="color: #666; margin: 20px 0; font-size: 16px;">Iniciando bot...</p>
      <div class="spinner"></div>
      <p class="status">Se detectarán automáticamente cambios de estado...</p>
    `;
    return res.send(generarHTML(contenido));
  }

  // Estado: Mostrando QR para escanear
  try {
    const qrImage = await QRCode.toDataURL(qrActual);

    const contenido = `
      <h2>Bot RRHH</h2>
      <p style="color: #666; margin: 10px 0; font-size: 16px;">📱 Escaneá el QR con WhatsApp</p>
      <img src="${qrImage}" alt="QR Code para WhatsApp" />
      <p class="status">Se recargará automáticamente cuando confirmes la conexión...</p>
    `;

    res.send(generarHTML(contenido));
  } catch (error) {
    console.error("Error generando QR:", error.message);

    const contenido = `
      <h2>Bot RRHH</h2>
      <div class="error">
        <p>❌ Error en la generación del código QR</p>
        <p style="font-size: 12px; margin-top: 10px;">Se intentará de nuevo automáticamente...</p>
      </div>
    `;

    res.send(generarHTML(contenido));
  }

});

app.listen(3010, () => {
  console.log("Panel en http://localhost:3010");
});

module.exports = { setQR, setConectado, estaConectado, emitirEvento };