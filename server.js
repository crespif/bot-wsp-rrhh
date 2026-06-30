const express = require("express");
const path = require("path");
const QRCode = require("qrcode");
const { activarModoHumano, desactivarModoHumano, isHasConsulta, getConsultas } = require("./estadoBot");
const { horario, cambiarHorario } = require("./data/horario");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Estado de conexión ──────────────────────────────────────
let qrActual = null;
let conectado = false;
let numeroConectado = null;
const sseClients = new Set();

// ── Store de chats (in-memory) ───────────────────────────────
// Map<numero, { nombre, empleado, mensajes: [{role, content, ts, visto}] }>
const chatsStore = new Map();

// Callback para enviar mensajes WA (lo registra bot-ia.js)
let sendWACallback = null;

// ── Funciones exportadas a bot-ia.js ────────────────────────
function setQR(qr) {
  qrActual = qr;
  conectado = false;
  emitirEvento("qr");
}

function setConectado(numero) {
  conectado = true;
  qrActual = null;
  numeroConectado = numero || null;
  emitirEvento("conectado");
}

function estaConectado() {
  return conectado;
}

function registrarCallback(fn) {
  sendWACallback = fn;
}

function registrarMensaje(numero, nombre, empleado, role, content) {
  if (!chatsStore.has(numero)) {
    chatsStore.set(numero, { nombre, empleado, mensajes: [] });
  }
  const chat = chatsStore.get(numero);
  chat.nombre = nombre;
  if (empleado) chat.empleado = empleado;
  chat.mensajes.push({ role, content, ts: Date.now(), visto: role !== "user" });
  console.log(`[store] ${numero} | role=${role} | total=${chat.mensajes.length}`);
  emitirEvento("mensaje", { numero });
}

// SSE
function emitirEvento(tipo, datos = {}) {
  const payload = `data: ${JSON.stringify({ tipo, ...datos })}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (_) { sseClients.delete(res); }
  }
}

// ── API ──────────────────────────────────────────────────────

app.get("/api/estado", async (req, res) => {
  let qrPng = null;
  if (qrActual) {
    try { qrPng = await QRCode.toDataURL(qrActual, { width: 280, margin: 2 }); } catch (_) {}
  }
  const consultas = getConsultas();
  res.json({
    conectado,
    qrPng,
    numero: numeroConectado,
    consultasCount: consultas ? consultas.length : 0,
    botName: process.env.BOT_NAME || 'IA',
  });
});

app.get("/api/chats", (req, res) => {
  const result = [];
  for (const [numero, data] of chatsStore.entries()) {
    const msgs = data.mensajes;
    const ultimo = msgs[msgs.length - 1] || null;
    const noLeidos = msgs.filter(m => m.role === "user" && !m.visto).length;
    result.push({
      numero,
      nombre: data.nombre,
      esHumano: isHasConsulta(numero),
      ultimoMensaje: ultimo ? { content: ultimo.content, role: ultimo.role, ts: ultimo.ts } : null,
      noLeidos,
    });
  }
  result.sort((a, b) => (b.ultimoMensaje?.ts || 0) - (a.ultimoMensaje?.ts || 0));
  res.json(result);
});

app.get("/api/chats/:numero/mensajes", (req, res) => {
  const { numero } = req.params;
  const data = chatsStore.get(numero);
  if (!data) return res.json({ nombre: numero, mensajes: [], esHumano: false });
  // Marcar mensajes de usuario como vistos
  data.mensajes.forEach(m => { if (m.role === "user") m.visto = true; });
  res.json({ nombre: data.nombre, mensajes: data.mensajes, esHumano: isHasConsulta(numero) });
});

app.post("/api/chats/:numero/enviar", async (req, res) => {
  const { numero } = req.params;
  const { texto } = req.body;
  if (!texto?.trim()) return res.status(400).json({ error: "Texto requerido" });
  if (!sendWACallback) return res.status(503).json({ error: "Bot no conectado" });
  try {
    await sendWACallback(numero, texto.trim());
    const data = chatsStore.get(numero);
    registrarMensaje(numero, data?.nombre || numero, data?.empleado, "human", texto.trim());
    res.json({ ok: true });
  } catch (e) {
    console.error("[server] Error enviando mensaje:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/chats/:numero/modo", (req, res) => {
  const { numero } = req.params;
  const { modo } = req.body;
  const data = chatsStore.get(numero);
  if (modo === "HUMAN") {
    activarModoHumano(numero, data?.empleado || { nombre: data?.nombre || numero });
  } else {
    desactivarModoHumano(numero);
  }
  emitirEvento("modo", { numero, modo });
  res.json({ ok: true, modo });
});

app.get("/api/horario", (req, res) => res.json(horario));
app.post("/api/horario", (req, res) => {
  const { inicio, fin } = req.body;
  if (inicio && fin) cambiarHorario(inicio, fin);
  res.json({ ok: true, horario });
});

// Legacy
app.post("/api/desactivar", (req, res) => {
  const { numero } = req.query;
  desactivarModoHumano(numero);
  emitirEvento("modo", { numero, modo: "AI" });
  res.json({ success: true });
});

app.get("/api/eventos", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const heartbeat = setInterval(() => {
    try { res.write(": ping\n\n"); } catch (_) { clearInterval(heartbeat); }
  }, 30000);
  sseClients.add(res);
  req.on("close", () => { clearInterval(heartbeat); sseClients.delete(res); });
});

app.listen(3010, () => console.log("Panel en http://localhost:3010"));

module.exports = { setQR, setConectado, estaConectado, emitirEvento, registrarCallback, registrarMensaje };
