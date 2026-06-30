const config = require("./config");

// Historial de conversaciones: Map<phone, Array<{role, content}>>
const historialConversaciones = new Map();
const MAX_HISTORY = 10;

function obtenerHistorial(numero) {
  if (!historialConversaciones.has(numero)) {
    historialConversaciones.set(numero, []);
  }
  return historialConversaciones.get(numero);
}

function agregarAlHistorial(numero, role, content) {
  const historial = obtenerHistorial(numero);
  historial.push({ role, content });
  if (historial.length > MAX_HISTORY) {
    historial.splice(0, historial.length - MAX_HISTORY);
  }
}

function limpiarHistorial(numero) {
  historialConversaciones.delete(numero);
}

function construirContextoEmpleado(empleado, datos) {
  const { francos, vacaciones, inasistencias } = datos;

  let ctx = `Datos del empleado con quien estás hablando:
- Nombre: ${empleado.nombre}
- Legajo: ${empleado.empleado_id}
- Sector: ${empleado.sector}
`;

  if (francos !== null) {
    if (francos.length === 0) {
      ctx += `\nFrancos: No tiene francos asignados actualmente.`;
    } else {
      const totalHoras = francos.reduce((sum, f) => sum + (f.HORAS || 0), 0);
      ctx += `\nFrancos acumulados: ${totalHoras.toFixed(2)} horas.`;
    }
  } else {
    ctx += `\nFrancos: No se pudieron obtener los datos.`;
  }

  if (vacaciones !== null) {
    if (vacaciones.length === 0) {
      ctx += `\nVacaciones: No se encontraron registros.`;
    } else {
      const v = vacaciones[0];
      ctx += `\nVacaciones: ${v.TOTALDIAS} días totales.`;
      if (v.DIAS1) {
        ctx += ` Período 1: ${v.DIAS1} días, del ${new Date(v.DESDE1).toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })} al ${new Date(v.HASTA1).toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })}.`;
      } else {
        ctx += ` Aún no tiene fechas asignadas.`;
      }
      if (v.DIAS2) {
        ctx += ` Período 2: ${v.DIAS2} días, del ${new Date(v.DESDE2).toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })} al ${new Date(v.HASTA2).toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })}.`;
      }
      if (v.DIAS3) {
        ctx += ` Período 3: ${v.DIAS3} días, del ${new Date(v.DESDE3).toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })} al ${new Date(v.HASTA3).toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })}.`;
      }
    }
  } else {
    ctx += `\nVacaciones: No se pudieron obtener los datos.`;
  }

  if (inasistencias !== null) {
    if (inasistencias.length === 0) {
      ctx += `\nInasistencias: No se encontraron registros.`;
    } else {
      const i = inasistencias[0];
      ctx += `\nInasistencias acumuladas: ${i.Acumulado}. Le quedan: ${i.Restan}.`;
    }
  } else {
    ctx += `\nInasistencias: No se pudieron obtener los datos.`;
  }

  return ctx;
}

async function generarRespuesta(empleado, texto, datos) {
  const numero = String(empleado.telefono);

  const contextoEmpleado = construirContextoEmpleado(empleado, datos);

  const systemPrompt = `Sos ${process.env.BOT_NAME || 'IA'} un asistente virtual del área de Recursos Humanos de Celta.
Respondés SIEMPRE en español rioplatense. Nunca uses palabras en otro idioma.
Hablás de manera amable y natural, usando tuteo informal ("dale", etc.).
Tus respuestas son breves: máximo 3 líneas. No uses emojis. No uses listas con guiones.
La jornada laboral es de 7 horas. Cuando conviertas horas a días, usá siempre 7 horas por día.
Solo respondés consultas sobre: francos, vacaciones, inasistencias y recibos de sueldo.
Para recibos de sueldo, indicá que deben ingresar al portal: ${config.PORTAL_RRHH}. El portal es ÚNICAMENTE para ver recibos de sueldo, no sirve para ninguna otra gestión.
Sobre vacaciones, podés informar los días disponibles y las fechas asignadas si las hay, pero NO podés tramitarlas ni modificarlas. Si el empleado quiere gestionar sus vacaciones, decile que hable directamente con RRHH.
Si te preguntan algo fuera de esos temas, o si no tenés los datos para responder, preguntale al empleado si quiere que lo comuniques con alguien de RRHH.
Si el empleado confirma que quiere hablar con alguien de RRHH, escribí al inicio de tu respuesta la marca [DERIVAR] y luego avisale de forma natural que alguien del equipo se va a comunicar.
Nunca inventes datos. Usá solo la información que te dan a continuación.

${contextoEmpleado}`;

  const historial = obtenerHistorial(numero);

  // Agregar el mensaje actual al historial antes de llamar
  agregarAlHistorial(numero, "user", texto);

  // Armar los mensajes para la API: historial previo (sin el último que acabamos de agregar)
  const mensajesPrevios = historial.slice(0, -1);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "minimax-m2.5:cloud",
        messages: [
          { role: "system", content: systemPrompt },
          ...mensajesPrevios,
          { role: "user", content: texto },
        ],
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[IA] Error HTTP: ${response.status}`);
      return { respuesta: "Tuve un problema técnico. Intentá de nuevo en un momento.", derivar: false };
    }

    const data = await response.json();
    let respuesta = data.message?.content?.trim() ?? "";

    // Si la respuesta tiene caracteres no latinos (cirílico, chino, árabe, etc.), reintentar
    if (/[Ѐ-ӿ一-鿿぀-ヿ؀-ۿ]/.test(respuesta)) {
      console.warn("[IA] Respuesta con idioma incorrecto, reintentando...");
      const retryResponse = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || "minimax-m2.5:cloud",
          messages: [
            { role: "system", content: systemPrompt },
            ...mensajesPrevios,
            { role: "user", content: texto },
            { role: "assistant", content: respuesta },
            { role: "user", content: "Reescribí tu respuesta anterior completamente en español rioplatense. Sin palabras en otros idiomas." },
          ],
          stream: false,
        }),
      });
      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        respuesta = retryData.message?.content?.trim() || respuesta;
      }
    }

    const derivar = respuesta.includes("[DERIVAR]");
    const respuestaLimpia = respuesta.replace("[DERIVAR]", "").trim();

    // Guardar la respuesta en el historial
    agregarAlHistorial(numero, "assistant", respuestaLimpia);

    return { respuesta: respuestaLimpia, derivar };
  } catch (error) {
    console.error("[IA] Error en generarRespuesta:", error.message);
    return { respuesta: "Tuve un problema técnico. Intentá de nuevo en un momento.", derivar: false };
  }
}

module.exports = { generarRespuesta, limpiarHistorial };
