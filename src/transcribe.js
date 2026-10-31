// Transcripcion de notas de voz con Whisper, en local.
//
// Tuberia:  audio (ogg/opus de WhatsApp)  ->  ffmpeg  ->  PCM 16 kHz mono
//           ->  Whisper (transformers.js / ONNX)  ->  texto
//
// No sale nada a internet salvo la primera descarga del modelo.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from './config.js';
import { log } from './logger.js';

const execFileAsync = promisify(execFile);

let pipelinePromise = null;
let transcriber = null;

export class TranscribeUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'TranscribeUnavailable';
  }
}

/** Comprueba que ffmpeg existe y responde. */
export async function ffmpegAvailable() {
  try {
    await execFileAsync(config.ffmpegPath, ['-version'], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

/** Carga (una sola vez) el modelo de Whisper. */
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
      // Que no llene la consola con avisos de descarga.
      try {
        transformers.env.logLevel = 'error';
      } catch {
        /* ignorar */
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

/** Pasa cualquier audio a PCM mono 16 bits 16 kHz usando ffmpeg. */
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

/** Convierte PCM 16-bit little endian a Float32 en el rango [-1, 1]. */
function pcmToFloat32(buffer) {
  const samples = Math.floor(buffer.length / 2);
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) {
    out[i] = buffer.readInt16LE(i * 2) / 32768;
  }
  return out;
}

/**
 * Transcribe un archivo de audio (nota de voz, audio, video...).
 * @param {string} filePath
 * @returns {Promise<{text:string, seconds:number, ms:number}>}
 */
export async function transcribeFile(filePath, { localFilesOnly = false } = {}) {
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

/** Precalienta el modelo (util al arrancar para la primera nota de voz). */
export async function warmup() {
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
