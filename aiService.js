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

const OLLAMA_URL = process.env.OLLAMA_URL || "http://host.docker.internal:11434";

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

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
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
  const rapido = detectarComandoRapido(texto);
  if (rapido) return rapido;
  return interpretarConIA(texto);
}

async function generarRespuesta(mensaje, empleado, contexto) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 200000);

    const systemPrompt = `Sos Gabriela, asistente virtual de RRHH de la empresa.
Respondés siempre en español rioplatense, de forma cordial y natural, como si fuera una conversación de WhatsApp.
El empleado que te escribe se llama ${empleado.nombre}${empleado.sector ? ` y trabaja en el sector ${empleado.sector}` : ""}.
No menciones que sos una IA ni que usás un sistema. Si no tenés información suficiente, decí que derivás la consulta a un compañero de RRHH.`;

    const promptFinal = contexto
      ? `Información disponible:\n${contexto}\n\nMensaje del empleado: ${mensaje}`
      : `Mensaje del empleado: ${mensaje}`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3",
        system: systemPrompt,
        prompt: promptFinal,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Error IA generarRespuesta: ${response.status}`);
      return "En este momento no puedo procesar tu consulta. Te derivo con un compañero de RRHH.";
    }

    const data = await response.json();
    return data.response.trim();
  } catch (error) {
    console.error("Error en generarRespuesta:", error.message);
    return "En este momento no puedo procesar tu consulta. Te derivo con un compañero de RRHH.";
  }
}

module.exports = { interpretarMensaje, generarRespuesta };
