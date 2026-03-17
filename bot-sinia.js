const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const { buscarEmpleado } = require("./empleadosService");
const { obtenerFrancos } = require("./francosService");
const { obtenerLicencias } = require("./licenciasService");

const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("BOT ACTIVO");
});

client.on("message", async (msg) => {
  const texto = msg.body.toLowerCase();
  //const numero = msg.from.replace("@c.us", "");
  const contact = await msg.getContact();

  const numero = contact.number;

  const empleado = buscarEmpleado(numero);

  if (!empleado) {
    msg.reply("Número no registrado.");
    return;
  }
  if (texto === "hola" || texto === "menu") {
    msg.reply(
      `👋 Bienvenido al sistema de *RRHH*

Podés consultar:

📅 *FRANCOS*
🏖️ *VACACIONES*
💬 *CONSULTA*

Escribí el comando que necesites.`,
    );
  }

  if (texto.includes("francos")) {
    const francos = obtenerFrancos();
    
    const misFrancos = francos.filter((f) => f.LEGAJO == empleado.empleado_id);
    
    if (misFrancos.length === 0) {
      msg.reply("No tenés francos asignados.");
      return;
    }
    let msgFrancos = "Tus francos:\n";

    const lista = misFrancos.map((f) => f.HORAS).join("\n");

    msgFrancos += `${lista} horas.\n\n`;
    msgFrancos += `Si tenés otra consulta escribí *MENU*`;

    msg.reply(msgFrancos);

  }

  if (texto.includes("vacacion")) {
    const licencias = await obtenerLicencias();

    const misVacaciones = licencias.filter(
      (l) => l.Legajo == empleado.empleado_id,
    );

    if (misVacaciones.length === 0) {
      msg.reply("No encontramos vacaciones.");
      return;
    }

    const v = misVacaciones[0];

    let mensaje = `👋 Hola *${empleado.nombre}*\n\n`;
    mensaje += `🏖️ *Vacaciones disponibles: ${v.TOTALDIAS} días*\n\n`;

    if (v.DIAS1) {
      mensaje += `📅 *Periodo 1* - ${v.DIAS1} días\n`;
      mensaje += `Desde: ${new Date(v.DESDE1).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
      mensaje += `Hasta: ${new Date(v.HASTA1).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
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
    /* const lista = misVacaciones
      .map((v) => `${v.fecha_inicio} - ${v.fecha_fin}`)
      .join("\n"); */

    /* msg.reply(`Tus vacaciones: \n ${lista}`); */
  }
});

client.initialize();
