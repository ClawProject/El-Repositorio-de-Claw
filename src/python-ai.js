// Cliente del servicio Python local (voz e imágenes).
//
// El servicio vive en `python/server.py` y escucha solo en 127.0.0.1. Aquí no
// importamos nada pesado: solo hablamos HTTP con él. Si no está arrancado,
// `estaDisponible()` devuelve false y los módulos que lo usan pueden seguir con
// sus motores antiguos.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { log } from './logger.js';

let cacheSalud = null; // { at, url, data }

function baseUrl() {
  return String(config.pythonAiUrl || '').replace(/\/+$/, '');
}

function conTimeout(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1, ms));
  return { signal: ctrl.signal, cancelar: () => clearTimeout(timer) };
}

function motivo(err, ms) {
  if (err?.name === 'AbortError') return `se pasó de tiempo (${Math.round(ms / 1000)}s)`;
  return err?.message || String(err);
}

/**
 * Estado del servicio Python. Se cachea unos segundos para no preguntar en
 * cada mensaje. Devuelve `null` si está desactivado o no responde.
 * @param {{force?:boolean}} opciones
 */
export async function salud({ force = false } = {}) {
  if (!config.pythonAiEnabled) return null;

  const url = baseUrl();
  const ahora = Date.now();
  const vigente = cacheSalud && cacheSalud.url === url && ahora - cacheSalud.at < 15000;
  if (!force && vigente) return cacheSalud.data;

  const ms = Math.min(2500, Math.max(500, config.pythonAiHealthTimeoutMs || 2500));
  const { signal, cancelar } = conTimeout(ms);
  try {
    const res = await fetch(`${url}/health`, { signal });
    const data = await res.json().catch(() => null);
    const estado = res.ok && data?.ok ? data : null;
    cacheSalud = { at: ahora, url, data: estado };
    return estado;
  } catch {
    cacheSalud = { at: ahora, url, data: null };
    return null;
  } finally {
    cancelar();
  }
}

/** ¿Hay servicio Python en general? */
export async function estaDisponible(opciones) {
  return Boolean(await salud(opciones));
}

/** ¿El servicio puede transcribir voz (faster-whisper instalado)? */
export async function vozDisponible(opciones) {
  const estado = await salud(opciones);
  return Boolean(estado?.voice?.available);
}

/** ¿El servicio puede generar imágenes (torch + diffusers instalados)? */
export async function imagenDisponible(opciones) {
  const estado = await salud(opciones);
  return Boolean(estado?.images?.available);
}

/**
 * Transcribe un audio con el servicio Python.
 * @param {string} filePath
 * @param {{timeoutMs?:number}} opciones
 * @returns {Promise<{text:string, seconds:number, ms:number}>}
 */
export async function transcribir(filePath, { timeoutMs } = {}) {
  const ms = timeoutMs ?? config.pythonAiTimeoutMs;
  const { signal, cancelar } = conTimeout(ms);
  try {
    const datos = fs.readFileSync(filePath);
    const formulario = new FormData();
    formulario.append('file', new Blob([datos]), path.basename(filePath));
    formulario.append('language', 'es');
    formulario.append('vad', 'true');

    const res = await fetch(`${baseUrl()}/transcribe`, {
      method: 'POST',
      body: formulario,
      signal
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || `el servicio de voz devolvió HTTP ${res.status}`);
    }
    return {
      text: String(data?.text || '').replace(/\s+/g, ' ').trim(),
      seconds: Number(data?.seconds || 0),
      ms: Number(data?.ms || 0)
    };
  } catch (err) {
    throw new Error(motivo(err, ms));
  } finally {
    cancelar();
  }
}

/**
 * Genera una imagen con el servicio Python.
 * Nunca lanza: devuelve `{ok:true, buffer, mime}` o `{ok:false, error}`.
 */
export async function generarImagen(prompt, opciones = {}) {
  const ms = opciones.timeoutMs ?? Math.max(1000, Number(config.imageGenTimeout || 300) * 1000);
  const { signal, cancelar } = conTimeout(ms);
  try {
    const res = await fetch(`${baseUrl()}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt,
        negative_prompt: opciones.negative ?? config.imageGenNegative,
        steps: opciones.steps ?? config.imageGenSteps,
        width: opciones.width ?? config.imageGenWidth,
        height: opciones.height ?? config.imageGenHeight,
        seed: opciones.seed ?? config.imageGenSeed,
        cfg: opciones.cfgScale ?? config.imageGenCfg,
        sampler: opciones.sampler ?? config.imageGenSampler,
        scheduler: opciones.scheduler ?? config.imageGenScheduler
      }),
      signal
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return {
        ok: false,
        error: data?.error || `el servicio de imágenes devolvió HTTP ${res.status}`
      };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const mime = String(res.headers.get('content-type') || 'image/png').split(';')[0].trim();
    if (!buffer.length) return { ok: false, error: 'el servicio de imágenes no devolvió nada' };
    return { ok: true, buffer, mime: mime || 'image/png' };
  } catch (err) {
    const texto = motivo(err, ms);
    log.debug(`Generación de imágenes con Python fallida: ${texto}`);
    return { ok: false, error: texto };
  } finally {
    cancelar();
  }
}

/** Precarga el modelo de voz para que la primera nota no tarde de más. */
export async function warmupVoz() {
  const ms = config.pythonAiTimeoutMs;
  const { signal, cancelar } = conTimeout(ms);
  try {
    const res = await fetch(`${baseUrl()}/warmup?target=voice`, { method: 'POST', signal });
    return res.ok;
  } catch (err) {
    log.debug(`No pude precargar la voz de Python: ${motivo(err, ms)}`);
    return false;
  } finally {
    cancelar();
  }
}

/** Olvida el estado cacheado (útil en pruebas y al cambiar de URL). */
export function olvidarEstado() {
  cacheSalud = null;
}
