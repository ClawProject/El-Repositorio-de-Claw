// Client for the local Python service (voice and images).
//
// The service lives in `python/server.py` and listens only on 127.0.0.1. Nothing
// heavy is imported here: we only talk HTTP to it. If it is not running,
// `estaDisponible()` returns false and the modules using it can fall back to
// their legacy engines.
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
 * Python service status. It is cached for a few seconds so it is not asked on
 * every message. Returns `null` when disabled or not responding.
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

/** Is there a Python service at all? */
export async function estaDisponible(opciones) {
  return Boolean(await salud(opciones));
}

/** Can the service transcribe voice (faster-whisper installed)? */
export async function vozDisponible(opciones) {
  const estado = await salud(opciones);
  return Boolean(estado?.voice?.available);
}

/** Can the service generate images (torch + diffusers installed)? */
export async function imagenDisponible(opciones) {
  const estado = await salud(opciones);
  return Boolean(estado?.images?.available);
}

/**
 * Transcribes audio with the Python service.
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
 * Generates an image with the Python service.
 * It never throws: returns `{ok:true, buffer, mime}` or `{ok:false, error}`.
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

/** Preloads the voice model so the first note is not too slow. */
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

/** Forgets the cached status (useful in tests and when the URL changes). */
export function olvidarEstado() {
  cacheSalud = null;
}
