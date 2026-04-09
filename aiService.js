/* const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey:
});
 async function interpretarMensaje(texto) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `Sos Gabriela, una asistente de RRHH.

Debes detectar la intención del usuario.

Responde SOLO con una de estas palabras:

FRANCOS
VACACIONES
CONSULTA
MENU`,
      },
      {
        role: "user",
        content: texto,
      },
    ],
  });

  return completion.choices[0].message.content.trim();
}
 */

function detectarComandoRapido(texto) {

  const t = texto.toLowerCase().normalize("NFD") // separa letras de acentos
    .replace(/[\u0300-\u036f]/g, "") // elimina acentos
    .replace(/[^\w\s]/gi, "") // elimina signos (?,!,.)
    .replace(/\s+/g, " ") // elimina espacios dobles
    .trim();

  if (/hola|buen dia|buenas|menu|ayuda/.test(t)) return "MENU"

  if (/franco|francos/.test(t)) return "FRANCOS"

  if (/vacacion|vacaciones/.test(t)) return "VACACIONES"

  if (/inasistencia|inasistencias|faltas/.test(t)) return "INASISTENCIAS"

  if (/consulta|hablar|persona|rrhh/.test(t)) return "CONSULTA"

  if (/recibo|recibos/.test(t)) return "RECIBOS"

  return null
}

async function interpretarConIA(texto) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 200000); // 200 segundos timeout */

    const response = await fetch("http://host.docker.internal:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3",
        prompt: `
Sos Gabriela, una asistente de RRHH.

Detectá la intención del mensaje.

Los empleados escriben mensajes con dudas sobre sus recibos de sueldo, vacaciones, francos, cantidad de inasistencias o consultas generales.
Si un empleado saluda o dice palabras como 'Hola', 'Buen día', etc., respondé con "MENU".

Responde SOLO con una de estas palabras:

RECIBOS
FRANCOS
VACACIONES
INASISTENCIAS
CONSULTA
MENU



Mensaje: ${texto}
`,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Error IA: ${response.status}`);
      return "MENU";
    }

    const data = await response.json();
    return data.response.trim();
  } catch (error) {
    console.error("Error en interpretarMensaje:", error.message);
    return "MENU"; // Fallback a MENU si falla la IA
  }
}

async function interpretarMensaje(texto) {

  const rapido = detectarComandoRapido(texto)

  if (rapido) {
    //console.log("Comando rapido detectado:", rapido)
    return rapido
  }

  // si no se detecta → usar IA
  return interpretarConIA(texto)
}

module.exports = { interpretarMensaje };
