// Minimal client for Ollama (local AI). No dependencies: it uses fetch.
import { config } from './config.js';
import { log } from './logger.js';

export class OllamaUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'OllamaUnavailable';
  }
}

async function request(pathname, { method = 'GET', body, timeoutMs = config.ollamaTimeoutMs } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(config.ollamaUrl + pathname, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // A 400 may mean the model does not support the requested JSON schema.
      const err = new Error(`Ollama respondio ${res.status}: ${detail.slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new OllamaUnavailable(`Ollama tardo mas de ${Math.round(timeoutMs / 1000)}s en responder.`);
    }
    if (err?.status) throw err;
    throw new OllamaUnavailable('No puedo conectar con Ollama. Comprueba que la aplicacion Ollama esta abierta.');
  } finally {
    clearTimeout(timer);
  }
}

export async function ping() {
  try {
    const data = await request('/api/tags', { timeoutMs: 5000 });
    return { ok: true, models: (data.models || []).map((m) => m.name) };
  } catch (err) {
    return { ok: false, error: err.message, models: [] };
  }
}

/** Which text models Ollama has loaded right now (in GPU memory). */
export async function cargados() {
  try {
    const data = await request('/api/ps', { timeoutMs: 5000 });
    return (data.models || []).map((m) => m.name);
  } catch {
    return [];
  }
}

/**
 * Releases the text models from GPU memory (VRAM).
 *
 * It is needed because a small GPU (4 GB) cannot hold the text model and the
 * image model at the same time: when Ollama has its own loaded, the image engine
 * runs out of memory and fails. Ollama reloads it by itself (a couple of seconds)
 * the next time it is asked something, so nothing is lost.
 *
 * It never throws: if Ollama does not respond, drawing is still attempted.
 * @returns {Promise<boolean>} true when no model is left loaded.
 */
export async function liberarVram(
  modelos = [
    config.ollamaModel,
    config.ollamaBrainModel,
    config.ollamaPrimaryModel,
    config.ollamaFallbackModel
  ]
) {
  const lista = [...new Set((modelos || []).filter(Boolean))];
  for (const modelo of lista) {
    try {
      await request('/api/generate', {
        method: 'POST',
        body: { model: modelo, keep_alive: 0 },
        timeoutMs: 15000
      });
    } catch (err) {
      log.debug(`No pude soltar el modelo "${modelo}" de Ollama: ${err.message}`);
    }
  }

  // Wait (about 6s at most) for Ollama to confirm nothing is left loaded.
  if (!lista.length) return true;
  for (let intento = 0; intento < 12; intento++) {
    if (!(await cargados()).length) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  log.warn('Ollama sigue con el modelo cargado; lo intentaré dibujar igualmente.');
  return false;
}

/**
 * Conversation with the local model.
 * @param {Array<{role:string, content:string}>} messages
 * @param {{format?: string|object, temperature?: number, numPredict?: number, numCtx?: number}} options
 */
export async function chat(messages, options = {}) {
  const {
    format,
    temperature = 0.2,
    numPredict = 400,
    numCtx = 4096,
    // It uses the primary model by default; each task can ask for another one.
    model = config.ollamaModel,
    timeoutMs
  } = options;

  const payload = {
    model,
    messages,
    stream: false,
    keep_alive: config.ollamaKeepAlive,
    options: {
      temperature,
      num_predict: numPredict,
      num_ctx: numCtx
    }
  };
  // Qwen3 allows disabling the reasoning mode in recent Ollama versions. Older
  // versions ignore this field; their reasoning tags are filtered out of the
  // reply further down so the user never sees them.
  if (/^qwen3(?::|$)/i.test(model)) payload.think = false;
  if (format) payload.format = format;

  let data;
  try {
    data = await request('/api/chat', { method: 'POST', body: payload, timeoutMs });
  } catch (err) {
    // If the model does not like the JSON schema, retry without it.
    if (err?.status === 400 && format && typeof format === 'object') {
      log.warn('Ollama rechazo el esquema JSON, reintentando en modo json simple');
      delete payload.format;
      payload.format = 'json';
      data = await request('/api/chat', { method: 'POST', body: payload, timeoutMs });
    } else {
      throw err;
    }
  }

  if (/^qwen3(?::|$)/i.test(model) && data?.done_reason === 'length') {
    log.warn(`Qwen3 agotó el límite de salida para "${model}" antes de terminar la respuesta.`);
    return '';
  }

  let answer = String(data?.message?.content ?? '');
  const closingThink = answer.match(/<\/think\s*>/gi);
  if (closingThink?.length) {
    const end = answer.toLowerCase().lastIndexOf('</think');
    const closeEnd = answer.indexOf('>', end);
    answer = answer.slice(closeEnd + 1);
  } else if (/<think\b[^>]*>/i.test(answer)) {
    return '';
  }
  return answer.trim();
}
