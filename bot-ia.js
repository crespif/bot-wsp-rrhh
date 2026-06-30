require('dotenv').config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { setQR, setConectado, emitirEvento, registrarCallback, registrarMensaje } = require("./server");

const { buscarEmpleado, cargarEmpleados } = require("./empleadosService");
const { obtenerFrancos } = require("./francosService");
const { obtenerLicencias } = require("./licenciasService");
const { generarRespuesta } = require("./aiService");
const { obtenerInasistencias, cargarInasistencias } = require("./inasistenciasServices");
const { activarModoHumano, isHasConsulta } = require("./estadoBot");
const { estaFueraDeHorario, horario } = require("./data/horario");

const contactosDesconocidos = new Set();

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-extensions",
    ],
  },
});

client.on("qr", (qr) => {
  console.log("QR recibido: ", qr);
  qrcode.generate(qr, { small: true });
  setQR(qr);
});

client.on("authenticated", () => {
  console.log("AUTENTICADO");
  setConectado();
});

client.on("auth_failure", (msg) => {
  console.error("ERROR DE AUTENTICACION", msg);
});

client.on("ready", () => {
  console.log("BOT ACTIVO");

  cargarEmpleados();
  cargarInasistencias();

  const numero = client.info?.wid?.user || null;
  setConectado(numero);

  // Registrar callback para enviar mensajes desde el dashboard
  registrarCallback(async (dest, texto) => {
    await client.sendMessage(`${dest}@c.us`, texto);
  });
});

client.on("message", async (msg) => {
  try {
    if (msg.isStatus || msg.from === "status@broadcast") return;

    const chat = await msg.getChat();
    if (chat.isGroup) return;

    const contact = await msg.getContact();
    const numero = contact.number;
    const texto = msg.body;

    if (!texto?.trim()) return;

    const empleado = buscarEmpleado(numero);

    if (!empleado) {
      if (isHasConsulta(numero)) return;
      const mockEmpleado = { nombre: `+${numero}`, telefono: numero, empleado_id: null, sector: null };
      registrarMensaje(numero, mockEmpleado.nombre, mockEmpleado, "user", texto);
      const confirma = /\bsi\b|\bsí\b|quiero|dale|ok|claro|sip/.test(texto.toLowerCase());
      if (contactosDesconocidos.has(numero) && confirma) {
        activarModoHumano(numero, mockEmpleado);
        emitirEvento("consulta");
        const resp = "Perfecto, en breve alguien de RRHH se va a comunicar con vos.";
        await msg.reply(resp);
        registrarMensaje(numero, mockEmpleado.nombre, mockEmpleado, "assistant", resp);
      } else {
        contactosDesconocidos.add(numero);
        const resp = "Hola, no te encontré como contacto registrado en el sistema. ¿Querés que te ponga en contacto con alguien de RRHH?";
        await msg.reply(resp);
        registrarMensaje(numero, mockEmpleado.nombre, mockEmpleado, "assistant", resp);
      }
      return;
    }

    console.log(`[bot] <- ${empleado.nombre} (${numero}): "${texto}"`);
    registrarMensaje(numero, empleado.nombre, empleado, "user", texto);

    if (isHasConsulta(numero)) return;

    // Pre-fetch de datos del empleado para dar contexto al LLM
    let francos = null;
    let vacaciones = null;
    let inasistencias = null;

    try {
      const todosFrancos = obtenerFrancos(empleado.sector);
      francos = todosFrancos.filter((f) => f.LEGAJO == empleado.empleado_id);
    } catch (e) {
      console.error("[bot] Error obteniendo francos:", e.message);
    }

    try {
      const todasLicencias = await obtenerLicencias();
      vacaciones = todasLicencias.filter((l) => l.Legajo == empleado.empleado_id);
    } catch (e) {
      console.error("[bot] Error obteniendo licencias:", e.message);
    }

    try {
      const todasInasistencias = obtenerInasistencias();
      inasistencias = todasInasistencias.filter((i) => i.Legajo == empleado.empleado_id);
    } catch (e) {
      console.error("[bot] Error obteniendo inasistencias:", e.message);
    }

    await chat.sendStateTyping();

    const { respuesta, derivar } = await generarRespuesta(
      empleado,
      texto,
      { francos, vacaciones, inasistencias }
    );

    console.log(`[bot] -> respuesta para ${empleado.nombre}: "${respuesta}"`);
    registrarMensaje(numero, empleado.nombre, empleado, "assistant", respuesta);

    if (derivar) {
      await chat.markUnread();
      activarModoHumano(numero, empleado);
      emitirEvento("consulta");

      const fueraDeHorario = estaFueraDeHorario();
      if (fueraDeHorario) {
        await msg.reply(
          `${respuesta}\n\nNuestro horario de atención es de ${horario.inicio} a ${horario.fin} hs.`
        );
      } else {
        await msg.reply(respuesta);
      }
      return;
    }

    await msg.reply(respuesta);
  } catch (error) {
    console.error("[bot] Error procesando mensaje:", error.message);
    if (error.message.includes("Execution context was destroyed")) {
      console.log("⚠️ Página recargada. El bot se reiniciará automáticamente.");
    } else {
      try {
        msg.reply("Tuve un problema técnico. Intentá de nuevo en un momento.");
      } catch (replyError) {
        console.error("[bot] No se pudo enviar mensaje de error:", replyError.message);
      }
    }
  }
});

client.on("error", (error) => {
  console.error("Error del cliente WhatsApp:", error.message);
});

client.on("disconnected", () => {
  console.log("Cliente desconectado. Reiniciando...");
  setTimeout(() => {
    client.initialize();
  }, 5000);
});

async function iniciarBot() {
  try {
    await client.initialize();
  } catch (error) {
    if (
      error.message &&
      (error.message.includes("Execution context was destroyed") ||
        error.message.includes("Protocol error"))
    ) {
      console.log("⚠️  Error de contexto durante la inicialización. Reintentando en 10s...");
      setTimeout(iniciarBot, 10000);
    } else {
      console.error("❌ Error fatal al inicializar el bot:", error.message);
      process.exit(1);
    }
  }
}

iniciarBot();