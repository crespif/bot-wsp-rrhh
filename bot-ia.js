const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { setQR, setConectado, emitirEvento } = require("./server");

const { buscarEmpleado, cargarEmpleados } = require("./empleadosService");
const { obtenerFrancos } = require("./francosService");
const { obtenerLicencias } = require("./licenciasService");
const { interpretarMensaje } = require("./aiService");
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
    const texto = msg.body;
    const chat = await msg.getChat();
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
      msg.reply(
        //`👋 Bienvenido al sistema de *RRHH*
        `Hola *${empleado.nombre}* 👋
Podés consultar de manera automatica:
  
📄 *RECIBOS* - Para obtener tus recibos de sueldo
📅 *FRANCOS*
🏖️ *VACACIONES*
📊 *INASISTENCIAS*

💬 Ingresa *CONSULTA* - Para otras consultas

Escribí lo que necesites.`
      );
      return;
    }

    // RECIBOS
    if (comando === "RECIBOS") {
      await chat.sendStateTyping();

      msg.reply(`📄 Para consultar tus recibos de sueldo, ingresá al portal de RRHH:

    ${config.PORTAL_RRHH}`)
      return;
    }

    // FRANCOS
    if (comando === "FRANCOS") {
      await chat.sendStateTyping();

      const francos = obtenerFrancos(empleado.sector);

      const misFrancos = francos.filter(
        (f) => f.LEGAJO == empleado.empleado_id
      );

      if (misFrancos.length === 0) {
        msg.reply("No tenés francos asignados.");
        return;
      }

      const lista = misFrancos.map((f) => (f.HORAS).toFixed(2)).join("\n");

      msg.reply(
        `📅 Tus francos registrados son:

*${lista} horas* 

Si tenés otra consulta escribí *MENU*`
      );

      return;
    }

    // VACACIONES
    if (comando === "VACACIONES") {
      await chat.sendStateTyping();

      const licencias = await obtenerLicencias();

      const misVacaciones = licencias.filter(
        (l) => l.Legajo == empleado.empleado_id
      );

      if (misVacaciones.length === 0) {
        msg.reply("No encontramos vacaciones.");
        return;
      }

      const v = misVacaciones[0];

      let mensaje = `🏖️ *Vacaciones disponibles: ${v.TOTALDIAS} días*\n\n`;

      if (v.DIAS1) {
        mensaje += `📅 *Periodo 1* - ${v.DIAS1} días\n`;
        mensaje += `Desde: ${new Date(v.DESDE1).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
        mensaje += `Hasta: ${new Date(v.HASTA1).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
      } else {
        mensaje += "Aun no tenés fechas definidas.\n\n";
      }

      if (v.DIAS2) {
        mensaje += `📅 *Periodo 2* - ${v.DIAS2} días\n`;
        mensaje += `Desde: ${new Date(v.DESDE2).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
        mensaje += `Hasta: ${new Date(v.HASTA2).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
      }

      if (v.DIAS3) {
        mensaje += `📅 *Periodo 3* - ${v.DIAS3} días\n`;
        mensaje += `Desde: ${new Date(v.DESDE3).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
        mensaje += `Hasta: ${new Date(v.HASTA3).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
      }

      mensaje += `Si tenés otra consulta escribí *MENU*`;

      msg.reply(mensaje);

      return;
    }

    // INASISTENCIAS
    if (comando === "INASISTENCIAS") {
      await chat.sendStateTyping();

      const inasistencias = await obtenerInasistencias();

      const misInasistencias = inasistencias.filter(
        (i) => i.Legajo == empleado.empleado_id
      );
      if (misInasistencias.length === 0) {
        msg.reply("No encontramos inasistencias.");
        return;
      }

      const lista = misInasistencias
        .map((i) => i.Acumulado).join("\n");

      const resto = misInasistencias
        .map((i) => i.Restan).join("\n");


      msg.reply(`📊 Tus inasistencias registradas son: *${lista}* \n\n te quedan: *${resto}*`);
      return;
    }


    // CONSULTA
    if (comando === "CONSULTA") {
      /* chatsHumanos.add(numero); */
      await chat.markUnread();
      const fueraDeHorario = estaFueraDeHorario();

      activarModoHumano(numero, empleado);
      emitirEvento('consulta');

      if (!fueraDeHorario) {
        msg.reply(
          `💬 Alguien del equipo se contactará contigo a la brevedad.`
        );
      } else {
        msg.reply(
          `⏰ Nuestro horario de atención es de ${horario.inicio} a ${horario.fin} hs.

Dejá tu consulta y te responderemos a la brevedad.`
        );
      }
      return;
    }

    // fallback
    msg.reply(
      `No entendí tu consulta.

Escribí *MENU* para ver las opciones disponibles.`
    );
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

iniciarBot();