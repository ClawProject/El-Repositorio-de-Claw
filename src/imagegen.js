// Image generation — EXPERIMENTAL.
//
// PAY ATTENTION TO THIS, it is the important part:
//   1. It is OFF by default (IMAGE_GEN_ENABLED=false).
//   2. The bot NEVER generates an image on its own: not if someone asks for one
//      in normal conversation, nor with "claw hazme una imagen". It only
//      generates when someone types the command by hand ("!claw imagen ...")
//      AND the "imagenes" setting is on (which only the owner/admins can change).
//   3. Everything stays local: the image AI runs on your computer.
//
// There are three engines (IMAGE_GEN_BACKEND):
//   - "auto" (default): uses the Python service (diffusers) when it is up and,
//     otherwise, falls back to the "cli" engine.
//   - "python": local Python service (python/server.py, diffusers).
//   - "cli": calls sd-cli.exe (stable-diffusion.cpp) as a standalone process.
//     No server needs to be open.
//   - "http": asks a server compatible with OpenAI Images for the picture
//     (for example stable-diffusion.cpp's sd-server).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { config, rootDir } from './config.js';
import { tempFilePath } from './media.js';
import { liberarVram } from './ollama.js';
import { log } from './logger.js';
import { mejorarPrompt, prepararPromptImagen } from './promptmagic.js';
import * as pythonAi from './python-ai.js';

/** Is image generation switched on? */
export function imagenesActivas() {
  return Boolean(config.imageGenEnabled);
}

/** Is an image being requested in the "!claw imagen ..." shape? */
export function esPedidoDeImagen(sub) {
  return [
    'imagen',
    'imagenes',
    'dibuja',
    'dibujar',
    'dibujo',
    'pinta',
    'pintar',
    'disena',
    'disenar',
    'ilustra',
    'ilustrar'
  ].includes(String(sub || '').toLowerCase());
}

/** Identifies the image type from its first bytes. */
export function sniffMime(buf) {
  if (!buf || buf.length < 4) return 'image/png';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'image/webp';
  return 'image/png';
}

function decodificarBase64(txt) {
  const limpio = String(txt || '')
    .replace(/^data:[^,]+,/, '')
    .replace(/\s+/g, '');
  try {
    return Buffer.from(limpio, 'base64');
  } catch {
    return Buffer.alloc(0);
  }
}

/**
 * Pulls the image out of a server response.
 * It accepts the most common formats: OpenAI (`data[].b64_json` or `data[].url`),
 * Ollama (`images[]`) and bare ones (`b64_json` / `image` / `url`).
 * @returns {{buffer?:Buffer, url?:string}|null}
 */
export function parsearImagen(data) {
  if (!data || typeof data !== 'object') return null;

  const candidatos = [];
  if (Array.isArray(data.data)) candidatos.push(...data.data);
  if (Array.isArray(data.images)) {
    candidatos.push(...data.images.map((i) => (typeof i === 'string' ? { b64_json: i } : i)));
  }
  if (typeof data.b64_json === 'string') candidatos.push({ b64_json: data.b64_json });
  if (typeof data.image === 'string') candidatos.push({ b64_json: data.image });
  if (typeof data.url === 'string') candidatos.push({ url: data.url });

  for (const c of candidatos) {
    if (!c) continue;
    if (typeof c === 'string') {
      const b = decodificarBase64(c);
      if (b.length) return { buffer: b };
      continue;
    }
    if (c.b64_json) {
      const b = decodificarBase64(c.b64_json);
      if (b.length) return { buffer: b };
    }
    if (c.url && /^https?:\/\//i.test(c.url)) return { url: c.url };
  }
  return null;
}

// ----------------------------------------------------------- "cli" engine

/** Turns a .env path into an absolute one (relative paths hang off the project). */
function rutaAbsoluta(valor, porDefecto) {
  const texto = String(valor || '').trim() || porDefecto;
  return path.isAbsolute(texto) ? texto : path.join(rootDir, texto);
}

/** Where the stable-diffusion.cpp executable is (sd-cli.exe). */
export function binCli() {
  return rutaAbsoluta(config.imageGenBin, path.join('sdserver', 'sd-cli.exe'));
}

/** Where the image model is (.gguf or .safetensors file). */
export function modeloCli() {
  return rutaAbsoluta(config.imageGenModelPath, path.join('sdserver', 'models', 'v1-5-pruned_Q4_K.gguf'));
}

/** The arguments for sd-cli (it is spawned without a shell, so the prompt cannot sneak commands in). */
export function argsCli({ prompt, out, steps, width, height, negative, seed, cfgScale, sampler, scheduler } = {}) {
  const args = [
    '-m',
    modeloCli(),
    '-p',
    String(prompt || ''),
    '-o',
    String(out || ''),
    '-W',
    String(width || config.imageGenWidth),
    '-H',
    String(height || config.imageGenHeight),
    '--steps',
    String(steps || config.imageGenSteps)
  ];
  const neg = negative !== undefined ? negative : config.imageGenNegative;
  if (neg) args.push('-n', String(neg));
  // Seed: a fixed number always gives the same image; -1 = random.
  const s = seed !== undefined && seed !== null ? seed : config.imageGenSeed;
  if (s !== undefined && s !== null && s !== '') args.push('-s', String(s));
  // CFG, sampler, scheduler (SD 1.5)
  const cfg = cfgScale !== undefined ? cfgScale : config.imageGenCfg;
  if (cfg !== undefined && cfg !== null && cfg !== '') args.push('--cfg-scale', String(cfg));
  const samp = sampler !== undefined ? sampler : config.imageGenSampler;
  if (samp) args.push('--sampling-method', String(samp));
  const sched = scheduler !== undefined ? scheduler : config.imageGenScheduler;
  if (sched) args.push('--scheduler', String(sched));
  return args;
}

/**
 * Extracts the most useful line from what the engine printed, so something
 * decent can be said. It used to keep the LAST line, which is often a generic
 * one ("generate failed") that does not tell the real reason (out of memory,
 * bad file, etc.).
 */
export function pistaDeError(ruido, code) {
  const lineas = String(ruido || '')
    // The progress bar uses \r, so we split on that too.
    .split(/\r?\n|\r/)
    .map((l) => l.trim())
    .filter(Boolean)
    // Drop the progress bar ("=====>  8/20 - 2.86s/it").
    .filter((l) => !/^[|=<>.\s]*-?\d+\/\d+/.test(l) && !/s\/it\b/.test(l));

  const conChicha = lineas.filter((l) =>
    /error|failed|fall[oa]|out of memory|no memory|not enough|cannot|unable|invalid|unsupported|missing|no such/i.test(l)
  );
  const elegidas = (conChicha.length ? conChicha : lineas).slice(-2);
  const texto = elegidas.join(' | ').trim();
  return texto ? texto.slice(0, 200) : `código ${code}`;
}

/**
 * Really kills the engine process. On Windows `child.kill()` does not always
 * end a native executable, so taskkill is needed with /T (whole tree) and /F
 * (forced). Otherwise processes are left hanging, eating CPU and VRAM (which is
 * exactly what happened).
 */
export function matarProceso(child) {
  if (!child || !child.pid) return;
  try {
    if (process.platform === 'win32') {
      const t = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore'
      });
      t.on('error', () => {});
    } else {
      child.kill('SIGKILL');
    }
  } catch {
    /* try kill() anyway */
  }
  try {
    child.kill();
  } catch {
    /* does not matter */
  }
}

/**
 * Generates with sd-cli.exe. It never throws: returns {ok, filePath, mime, buffer}
 * or {ok:false, error}.
 * @param {{out:string, timeoutMs?:number}} opciones
 */
export async function generarImagenCli(prompt, { out, timeoutMs, promptMejorado } = {}) {
  const salida = out || tempFilePath('gen', 'png');
  const bin = binCli();
  const modelo = modeloCli();

  if (!fs.existsSync(bin)) {
    return {
      ok: false,
      error: `no encuentro el motor de imágenes (${path.relative(rootDir, bin) || bin})`
    };
  }
  if (!fs.existsSync(modelo)) {
    return {
      ok: false,
      error: `no encuentro el modelo de imágenes (${path.relative(rootDir, modelo) || modelo})`
    };
  }

  // A 4 GB GPU cannot hold the text model (Ollama) and the image model at the
  // same time: when Ollama has its own loaded, drawing runs out of memory and
  // fails ("unet segment failed during workspace capacity check"). So the text
  // model is released first; Ollama reloads it by itself when needed. If Ollama
  // does not respond, we carry on anyway and try to draw.
  if (config.imageGenFreeVram) {
    await liberarVram();
  }

  return new Promise((resolve) => {
    let child;
    try {
      const promptFinal = promptMejorado !== undefined && String(promptMejorado).trim() ? promptMejorado : prompt;
      child = spawn(bin, argsCli({ prompt: promptFinal, out: salida }), {
        cwd: path.dirname(bin),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (err) {
      return resolve({ ok: false, error: err.message });
    }

    // Keep the END of what the engine prints (that is where the errors are).
    // It used to keep the first 4000 characters, so a long progress bar could
    // eat the real error message.
    let ruido = '';
    child.stdout?.on('data', () => {});
    child.stderr?.on('data', (d) => {
      ruido = (ruido + d.toString()).slice(-8000);
    });

    const ms = timeoutMs ?? Math.max(5000, Number(config.imageGenTimeout || 300) * 1000);
    let terminado = false;
    const timer = setTimeout(() => {
      terminado = true;
      matarProceso(child);
      resolve({ ok: false, error: `se pasó de tiempo (${Math.round(ms / 1000)}s) dibujando` });
    }, ms);

    const acabar = (resultado) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(timer);
      resolve(resultado);
    };

    child.on('error', (err) => acabar({ ok: false, error: err.message }));
    child.on('close', (code) => {
      if (code !== 0) {
        return acabar({ ok: false, error: `el motor de imágenes falló (${pistaDeError(ruido, code)})` });
      }
      let buffer;
      try {
        buffer = fs.readFileSync(salida);
      } catch {
        return acabar({ ok: false, error: 'el motor de imágenes no escribió ninguna imagen' });
      }
      acabar({ ok: true, filePath: salida, mime: sniffMime(buffer), buffer });
    });
  });
}

// ----------------------------------------------------------- "http" engine

/** Asks a server compatible with OpenAI Images for the picture. */
export async function generarImagenHttp(prompt, { timeoutMs } = {}) {
  const endpoint = String(config.imageGenEndpoint || '').trim();
  if (!endpoint) return { ok: false, error: 'No hay ningún endpoint de imágenes configurado.' };

  const ms = timeoutMs ?? Math.max(1000, Number(config.imageGenTimeout || 300) * 1000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const headers = { 'content-type': 'application/json' };
    if (config.imageGenApiKey) headers.authorization = `Bearer ${config.imageGenApiKey}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.imageGenModel || undefined,
        prompt,
        n: 1,
        size: `${config.imageGenWidth}x${config.imageGenHeight}`,
        steps: config.imageGenSteps,
        response_format: 'b64_json'
      }),
      signal: ctrl.signal
    });

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '');
      return {
        ok: false,
        error: `el servidor devolvió HTTP ${res.status}${cuerpo ? `: ${cuerpo.slice(0, 160)}` : ''}`
      };
    }

    const data = await res.json().catch(() => null);
    const encontrada = parsearImagen(data);
    if (!encontrada) return { ok: false, error: 'la respuesta no traía ninguna imagen' };

    if (encontrada.buffer) {
      return { ok: true, buffer: encontrada.buffer, mime: sniffMime(encontrada.buffer) };
    }

    const img = await fetch(encontrada.url, { signal: ctrl.signal });
    if (!img.ok) return { ok: false, error: `no se pudo descargar la imagen (HTTP ${img.status})` };
    const buf = Buffer.from(await img.arrayBuffer());
    return { ok: true, buffer: buf, mime: sniffMime(buf) };
  } catch (err) {
    const motivo =
      err?.name === 'AbortError' ? `se pasó de tiempo (${Math.round(ms / 1000)}s)` : err.message;
    log.debug(`Generación de imágenes fallida: ${motivo}`);
    return { ok: false, error: motivo };
  } finally {
    clearTimeout(timer);
  }
}

// --------------------------------------------------------- "python" engine

/** Generates with the Python service (diffusers). It never throws. */
export async function generarImagenPython(prompt, opciones = {}) {
  return pythonAi.generarImagen(prompt, opciones);
}

// ----------------------------------------------------------- facade

// The GPU has 4 GB: running TWO sd-cli at once runs out of memory and both fail
// (it happened to us: two "!claw imagen" in a row). So generations go one at a
// time: the second waits for the first to finish. If too many people are already
// waiting, they are told to try later.
const MAX_ESPERANDO = 1; // besides the one being drawn right now
let dibujando = 0; // running generations + those waiting for their turn
let cola = Promise.resolve();

/** Asks for a turn to draw. Returns the function that releases it, or null when the queue is full. */
export async function pedirTurno() {
  if (dibujando > MAX_ESPERANDO) return null;
  dibujando++;
  const previo = cola;
  let soltar;
  cola = new Promise((r) => {
    soltar = r;
  });
  await previo;
  return () => {
    dibujando--;
    soltar();
  };
}

/**
 * Generates an image with the configured engine.
 * It never throws: returns {ok:true, filePath?|buffer, mime} or {ok:false, error, off?}.
 *
 * When generation is off it returns {ok:false, off:true} without doing anything
 * (so it is impossible for the bot to generate an image by accident).
 */
export async function generarImagen(prompt, opciones = {}) {
  const texto = String(prompt || '').trim();
  if (!texto) return { ok: false, error: 'No has dicho qué quieres dibujar.' };

  // The safety barrier: off = nothing is generated, even if asked for.
  if (!config.imageGenEnabled && !opciones.forzar) {
    return { ok: false, off: true, error: 'La generación de imágenes está apagada.' };
  }

  const soltar = await pedirTurno();
  if (!soltar) {
    return {
      ok: false,
      busy: true,
      error: 'ya estoy dibujando otra imagen; prueba otra vez en un minuto (voy de una en una)'
    };
  }

  try {
    const textoTraducido = config.imageGenEnhance ? await mejorarPrompt(texto) : texto;
    const textoFinal = prepararPromptImagen(textoTraducido);
    const motor = String(config.imageGenBackend || 'auto').toLowerCase();

    if (motor === 'python' || motor === 'auto') {
      if (await pythonAi.imagenDisponible()) {
        // On a small GPU, release Ollama's text model first.
        if (config.imageGenFreeVram) await liberarVram();
        return await generarImagenPython(textoFinal, opciones);
      }
      if (motor === 'python') {
        return {
          ok: false,
          error:
            'el servicio Python de imágenes no está disponible. Arranca python/server.py e instala python/requirements-images.txt'
        };
      }
      log.debug('Servicio Python de imágenes no disponible; uso el motor de respaldo.');
    }

    if (motor === 'http') return await generarImagenHttp(textoFinal, opciones);
    return await generarImagenCli(texto, { ...opciones, promptMejorado: textoFinal });
  } finally {
    soltar();
  }
}
