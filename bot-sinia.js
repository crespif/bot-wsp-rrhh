const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const { buscarEmpleado } = require("./empleadosService");
const { obtenerFrancos } = require("./francosService");
const { obtenerLicencias } = require("./licenciasService");
const { interpretarMensaje, generarRespuesta } = require("./aiService");

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
  const texto = msg.body;
  const contact = await msg.getContact();
  const numero = contact.number;
  const empleado = buscarEmpleado(numero);

  if (!empleado) {
    msg.reply("Número no registrado.");
    return;
  }

  const intencion = await interpretarMensaje(texto);
  let contexto = "";

  if (intencion === "FRANCOS") {
    try {
      const francos = obtenerFrancos(empleado.sector);
      const misFrancos = francos.filter((f) => f.LEGAJO == empleado.empleado_id);
      contexto = misFrancos.length > 0
        ? "Francos del empleado:\n" + misFrancos.map((f) => `- ${f.HORAS} horas`).join("\n")
        : "El empleado no tiene francos asignados.";
    } catch (e) {
      contexto = "No se pudo obtener la información de francos en este momento.";
    }
  } else if (intencion === "VACACIONES") {
    try {
      const licencias = await obtenerLicencias();
      const misVacaciones = licencias.filter((l) => l.Legajo == empleado.empleado_id);
      if (misVacaciones.length > 0) {
        const v = misVacaciones[0];
        contexto = `Vacaciones disponibles: ${v.TOTALDIAS} días en total.`;
        if (v.DIAS1) contexto += `\nPeriodo 1: ${v.DIAS1} días, del ${new Date(v.DESDE1).toLocaleDateString("es-AR")} al ${new Date(v.HASTA1).toLocaleDateString("es-AR")}.`;
        if (v.DIAS2) contexto += `\nPeriodo 2: ${v.DIAS2} días, del ${new Date(v.DESDE2).toLocaleDateString("es-AR")} al ${new Date(v.HASTA2).toLocaleDateString("es-AR")}.`;
        if (v.DIAS3) contexto += `\nPeriodo 3: ${v.DIAS3} días, del ${new Date(v.DESDE3).toLocaleDateString("es-AR")} al ${new Date(v.HASTA3).toLocaleDateString("es-AR")}.`;
      } else {
        contexto = "El empleado no tiene vacaciones registradas.";
      }
    } catch (e) {
      contexto = "No se pudo obtener la información de vacaciones en este momento.";
    }
  } else if (intencion === "MENU") {
    contexto = "El empleado está saludando o pidiendo información. Saludalo por su nombre y contale que puede consultarte sobre francos, vacaciones, inasistencias o derivarte consultas generales a un compañero.";
  } else {
    contexto = "La consulta no corresponde a información que podés resolver. Decile al empleado que vas a derivar su consulta a un compañero de RRHH.";
  }

  const respuesta = await generarRespuesta(texto, empleado, contexto);
  msg.reply(respuesta);
});

client.initialize();
