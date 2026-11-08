// Voice note transcription, locally.
//
// Main path: Python service (python/server.py) with faster-whisper.
// Fallback:  audio -> ffmpeg -> 16 kHz PCM -> transformers.js (ONNX).
//
// Nothing goes to the internet except the first model download.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from './config.js';
import { log } from './logger.js';
import * as pythonAi from './python-ai.js';

const execFileAsync = promisify(execFile);

let pipelinePromise = null;
let transcriber = null;

export class TranscribeUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'TranscribeUnavailable';
  }
}

/** Checks that ffmpeg exists and responds. */
export async function ffmpegAvailable() {
  try {
    await execFileAsync(config.ffmpegPath, ['-version'], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Which voice engine would be used right now: 'python', 'node' or null if none
 * is available. With Python, ffmpeg is not needed (faster-whisper decodes the
 * audio by itself).
 */
export async function voiceEngine() {
  if (config.pythonAiEnabled && (await pythonAi.vozDisponible())) return 'python';
  if (await ffmpegAvailable()) return 'node';
  return null;
}

/** Can we transcribe with any engine? */
export async function voiceAvailable() {
  return (await voiceEngine()) !== null;
}

/** Loads the Whisper model (only once). */
async function getTranscriber({ localFilesOnly = false } = {}) {
  if (transcriber) return transcriber;
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      let transformers;
      try {
        transformers = await import('@huggingface/transformers');
      } catch (err) {
        throw new TranscribeUnavailable(
          'Falta el paquete de transcripcion. Ejecuta:  npm install @huggingface/transformers'
        );
      }
      // Keep it from flooding the console with download warnings.
      try {
        transformers.env.logLevel = 'error';
      } catch {
        /* ignore */
      }

      log.info(
        localFilesOnly
          ? `Cargando el modelo de voz "${config.whisperModel}" solo desde la caché local...`
          : `Cargando el modelo de voz "${config.whisperModel}" (la primera vez se descarga)...`
      );
      const t0 = Date.now();
      const asr = await transformers.pipeline('automatic-speech-recognition', config.whisperModel, {
        dtype: config.whisperDtype,
        local_files_only: localFilesOnly
      });
      log.info(`Modelo de voz listo en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      return asr;
    })().catch((err) => {
      pipelinePromise = null; // permite reintentar
      throw err;
    });
  }
  transcriber = await pipelinePromise;
  return transcriber;
}

/** Converts any audio to 16-bit mono 16 kHz PCM using ffmpeg. */
async function decodeToPcm(inputPath) {
  try {
    const { stdout } = await execFileAsync(
      config.ffmpegPath,
      [
        '-hide_banner',
        '-loglevel', 'error',
        '-nostdin',
        '-i', inputPath,
        '-map', '0:a:0',
        '-vn',
        '-af', 'highpass=f=80,lowpass=f=7600,dynaudnorm=f=150:g=5,apad=pad_dur=0.5',
        '-f', 's16le',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        '-'
      ],
      { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, timeout: 120000 }
    );
    return stdout;
  } catch (err) {
    const detail = err?.stderr ? String(err.stderr).slice(0, 300) : err.message;
    if (/ENOENT/i.test(err.message)) {
      throw new TranscribeUnavailable(
        `No encuentro ffmpeg ("${config.ffmpegPath}"). Instalalo con:  winget install Gyan.FFmpeg`
      );
    }
    throw new Error(`ffmpeg no pudo leer el audio: ${detail}`);
  }
}

/** Converts 16-bit little-endian PCM to Float32 in the [-1, 1] range. */
function pcmToFloat32(buffer) {
  const samples = Math.floor(buffer.length / 2);
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) {
    out[i] = buffer.readInt16LE(i * 2) / 32768;
  }
  return out;
}

/**
 * Transcribes an audio file (voice note, audio, video...).
 * @param {string} filePath
 * @returns {Promise<{text:string, seconds:number, ms:number}>}
 */
export async function transcribeFile(filePath, { localFilesOnly = false } = {}) {
  // First the Python service (faster-whisper): it needs no ffmpeg and is usually
  // faster. If it fails and fallback is allowed, we continue with Node.
  if (config.pythonAiEnabled && (await pythonAi.vozDisponible())) {
    try {
      return await pythonAi.transcribir(filePath);
    } catch (err) {
      if (!config.pythonAiFallback) {
        throw new TranscribeUnavailable(`El servicio Python de voz falló: ${err.message}`);
      }
      log.warn(`El servicio Python de voz falló (${err.message}); uso Whisper en Node.`);
    }
  }

  const t0 = Date.now();

  const pcm = await decodeToPcm(filePath);
  const seconds = pcm.length / 2 / 16000;

  if (seconds < 0.35) {
    return { text: '', seconds, ms: Date.now() - t0 };
  }

  const asr = await getTranscriber({ localFilesOnly });
  const audio = pcmToFloat32(pcm);

  const result = await asr(audio, {
    language: 'spanish',
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5
  });

  const text = (Array.isArray(result) ? result.map((r) => r.text).join(' ') : result?.text || '')
    .replace(/\s+/g, ' ')
    .trim();

  return { text, seconds, ms: Date.now() - t0 };
}

/** Warms up the model (useful at startup for the first voice note). */
export async function warmup() {
  if (config.pythonAiEnabled && (await pythonAi.vozDisponible())) {
    const listo = await pythonAi.warmupVoz();
    if (listo) {
      log.info('Modelo de voz de Python precargado.');
      return true;
    }
    log.warn('No pude precargar el modelo de voz de Python.');
    return false;
  }

  try {
    await getTranscriber();
    return true;
  } catch (err) {
    log.warn(`No se pudo preparar la transcripcion: ${err.message}`);
    return false;
  }
}

export function isLoaded() {
  return Boolean(transcriber);
}
