require('dotenv').config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { setQR, setConectado, emitirEvento } = require("./server");

const { buscarEmpleado, cargarEmpleados } = require("./empleadosService");
const { obtenerFrancos } = require("./francosService");
const { obtenerLicencias } = require("./licenciasService");
const { interpretarMensaje, generarRespuesta } = require("./aiService");
const { obtenerInasistencias, cargarInasistencias } = require("./inasistenciasServices");
const config = require("./config");
const { activarModoHumano, isHasConsulta } = require("./estadoBot");
const { estaFueraDeHorario, horario } = require("./data/horario");
/* const chatsHumanos = new Set(); */

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

  setConectado();
});

/* client.on("message_create", async (msg) => {
  if (msg.fromMe && !msg.body.startsWith("/bot")) {
    const chat = await msg.getChat();
    const contact = await chat.getContact();
    const numero = contact.number;
    chatsHumanos.add(numero);
    console.log("Modo humano activado en chat:", numero);
  }
});
 */
client.on("message", async (msg) => {
  try {
    // Ignorar mensajes que vienen de estados (Stories) o de broadcasts
    if (msg.isStatus || msg.from === 'status@broadcast') {
      return;
    }

    const texto = msg.body;
    const chat = await msg.getChat();
    if (chat.isGroup) {
      return;
    }
    const contact = await msg.getContact();
    const numero = contact.number;

    const empleado = buscarEmpleado(numero);

    if (!empleado) {
      //msg.reply("Número no registrado.");
      return;
    }

    console.log(`Mensaje recibido de (${numero}): ${texto}`);

    // Si tiene modo humano activo, no procesar con IA
    if (isHasConsulta(numero)) {
      //console.log("Modo humano activo, no respondo automáticamente a:", numero);
      return;
    }

    // IA interpreta la intención
    const comando = await interpretarMensaje(texto);

    console.log(`${empleado.nombre} - ${numero} / Intención: ${comando}`);

    // MENU
    if (comando === "MENU") {
      await chat.sendStateTyping();
      const contexto = `El empleado saluda o pide información. Saludalo por su nombre y contale que puede consultarte sobre sus francos, vacaciones, inasistencias, recibos de sueldo (portal web), o derivarte a un compañero de RRHH para otras consultas.`;
      msg.reply(await generarRespuesta(texto, empleado, contexto));
      return;
    }

    // RECIBOS
    if (comando === "RECIBOS") {
      await chat.sendStateTyping();
      const contexto = `El empleado consulta por sus recibos de sueldo. Contale que puede acceder al portal de RRHH: ${config.PORTAL_RRHH}`;
      msg.reply(await generarRespuesta(texto, empleado, contexto));
      return;
    }

    // FRANCOS
    if (comando === "FRANCOS") {
      await chat.sendStateTyping();
      let contexto;
      try {
        const francos = obtenerFrancos(empleado.sector);
        const misFrancos = francos.filter((f) => f.LEGAJO == empleado.empleado_id);
        contexto = misFrancos.length > 0
          ? "Francos del empleado:\n" + misFrancos.map((f) => `- ${(f.HORAS).toFixed(2)} horas`).join("\n")
          : "El empleado no tiene francos asignados.";
      } catch (e) {
        contexto = "No se pudo obtener la información de francos en este momento.";
      }
      msg.reply(await generarRespuesta(texto, empleado, contexto));
      return;
    }

    // VACACIONES
    if (comando === "VACACIONES") {
      await chat.sendStateTyping();
      let contexto;
      try {
        const licencias = await obtenerLicencias();
        const misVacaciones = licencias.filter((l) => l.Legajo == empleado.empleado_id);
        if (misVacaciones.length > 0) {
          const v = misVacaciones[0];
          contexto = `Vacaciones disponibles: ${v.TOTALDIAS} días en total.`;
          if (v.DIAS1) contexto += `\nPeriodo 1: ${v.DIAS1} días, del ${new Date(v.DESDE1).toLocaleDateString("es-AR")} al ${new Date(v.HASTA1).toLocaleDateString("es-AR")}.`;
          else contexto += "\nAún no tiene fechas definidas para el periodo 1.";
          if (v.DIAS2) contexto += `\nPeriodo 2: ${v.DIAS2} días, del ${new Date(v.DESDE2).toLocaleDateString("es-AR")} al ${new Date(v.HASTA2).toLocaleDateString("es-AR")}.`;
          if (v.DIAS3) contexto += `\nPeriodo 3: ${v.DIAS3} días, del ${new Date(v.DESDE3).toLocaleDateString("es-AR")} al ${new Date(v.HASTA3).toLocaleDateString("es-AR")}.`;
        } else {
          contexto = "El empleado no tiene vacaciones registradas.";
        }
      } catch (e) {
        contexto = "No se pudo obtener la información de vacaciones en este momento.";
      }
      msg.reply(await generarRespuesta(texto, empleado, contexto));
      return;
    }

    // INASISTENCIAS
    if (comando === "INASISTENCIAS") {
      await chat.sendStateTyping();
      let contexto;
      try {
        const inasistencias = await obtenerInasistencias();
        const misInasistencias = inasistencias.filter((i) => i.Legajo == empleado.empleado_id);
        contexto = misInasistencias.length > 0
          ? `Inasistencias acumuladas: ${misInasistencias.map((i) => i.Acumulado).join(", ")}. Días que le restan: ${misInasistencias.map((i) => i.Restan).join(", ")}.`
          : "El empleado no tiene inasistencias registradas.";
      } catch (e) {
        contexto = "No se pudo obtener la información de inasistencias en este momento.";
      }
      msg.reply(await generarRespuesta(texto, empleado, contexto));
      return;
    }

    // CONSULTA — activa modo humano (sin IA, el equipo toma el chat)
    if (comando === "CONSULTA") {
      chat.markUnread();
      const fueraDeHorario = estaFueraDeHorario();
      activarModoHumano(numero, empleado);
      emitirEvento('consulta');
      if (!fueraDeHorario) {
        msg.reply(`Entendido, alguien del equipo de RRHH se va a contactar con vos a la brevedad.`);
      } else {
        msg.reply(`Nuestro horario de atención es de ${horario.inicio} a ${horario.fin} hs. Dejá tu consulta y te respondemos cuando estemos disponibles.`);
      }
      return;
    }

    // fallback
    await chat.sendStateTyping();
    const contextoFallback = "El empleado envió un mensaje que no pudiste entender. Decile de forma amable que no entendiste y que puede consultarte sobre francos, vacaciones, inasistencias, recibos, o escribir 'consulta' para hablar con alguien del equipo.";
    msg.reply(await generarRespuesta(texto, empleado, contextoFallback));
  } catch (error) {
    console.error("Error procesando mensaje:", error.message);
    if (error.message.includes("Execution context was destroyed")) {
      console.log("⚠️ Página recargada. El bot se reiniciará automáticamente.");
    } else {
      try {
        msg.reply("Ocurrió un error procesando tu mensaje. Intentá de nuevo.");
      } catch (replyError) {
        console.error("No se pudo enviar mensaje de error:", replyError.message);
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

async function precalentarOllama() {
  const OLLAMA_URL = process.env.OLLAMA_URL || "http://host.docker.internal:11434";
  try {
    console.log("Precalentando modelo Ollama...");
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama3", prompt: "hola", stream: false }),
      signal: AbortSignal.timeout(120000),
    });
    if (res.ok) console.log("Modelo listo.");
    else console.warn("Ollama respondió con error:", res.status);
  } catch (e) {
    console.warn("No se pudo precalentar Ollama:", e.message);
  }
}

precalentarOllama().then(iniciarBot);