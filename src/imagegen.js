// Generación de imágenes — EXPERIMENTAL.
//
// OJO CON ESTO, que es lo importante:
//   1. Está APAGADA por defecto (IMAGE_GEN_ENABLED=false).
//   2. El bot NUNCA genera una imagen por su cuenta: ni si alguien le pide una
//      hablando con normalidad, ni con "claw hazme una imagen". Únicamente se
//      genera cuando alguien escribe el comando a mano ("!claw imagen ...")
//      Y el ajuste "imagenes" está activo (que solo el dueño/admins puede poner).
//   3. Todo sigue en local: la IA de imágenes vive en tu ordenador.
//
// Hay dos motores (IMAGE_GEN_BACKEND):
//   - "cli"  (por defecto): llama a sd-cli.exe (stable-diffusion.cpp) como un
//     proceso suelto. No hace falta tener ningún servidor abierto. Es lo que
//     mejor funciona en un ordenador normal con poca VRAM.
//   - "http": pide la imagen a un servidor compatible con OpenAI Images
//     (por ejemplo sd-server de stable-diffusion.cpp).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { config, rootDir } from './config.js';
import { tempFilePath } from './media.js';
import { liberarVram } from './ollama.js';
import { log } from './logger.js';
import { mejorarPrompt, prepararPromptImagen } from './promptmagic.js';

/** ¿Está encendida la generación de imágenes? */
export function imagenesActivas() {
  return Boolean(config.imageGenEnabled);
}

/** ¿Se está pidiendo una imagen con la forma de "!claw imagen ..."? */
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

/** Identifica el tipo de imagen a partir de sus primeros bytes. */
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
 * Saca la imagen de la respuesta de un servidor.
 * Acepta los formatos más habituales: OpenAI (`data[].b64_json` o `data[].url`),
 * Ollama (`images[]`) y suelto (`b64_json` / `image` / `url`).
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

// ----------------------------------------------------------- motor "cli"

/** Convierte una ruta del .env en absoluta (las relativas cuelgan del proyecto). */
function rutaAbsoluta(valor, porDefecto) {
  const texto = String(valor || '').trim() || porDefecto;
  return path.isAbsolute(texto) ? texto : path.join(rootDir, texto);
}

/** Dónde está el ejecutable de stable-diffusion.cpp (sd-cli.exe). */
export function binCli() {
  return rutaAbsoluta(config.imageGenBin, path.join('sdserver', 'sd-cli.exe'));
}

/** Dónde está el modelo de imágenes (fichero .gguf o .safetensors). */
export function modeloCli() {
  return rutaAbsoluta(config.imageGenModelPath, path.join('sdserver', 'models', 'v1-5-pruned_Q4_K.gguf'));
}

/** Los argumentos para sd-cli (se lanza sin shell, así el prompt no puede colar comandos). */
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
  // Semilla: un número fijo da siempre la misma imagen; -1 = aleatoria.
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
 * Extrae la línea más útil de lo que soltó el motor, para poder decir algo
 * decente. Antes nos quedábamos con la ÚLTIMA línea, que muchas veces es un
 * genérico ("generate failed") y no cuenta la razón de verdad (falta de
 * memoria, fichero mal, etc.).
 */
export function pistaDeError(ruido, code) {
  const lineas = String(ruido || '')
    // La barra de progreso usa \r, así que partimos también por ahí.
    .split(/\r?\n|\r/)
    .map((l) => l.trim())
    .filter(Boolean)
    // Fuera la barra de progreso ("=====>  8/20 - 2.86s/it").
    .filter((l) => !/^[|=<>.\s]*-?\d+\/\d+/.test(l) && !/s\/it\b/.test(l));

  const conChicha = lineas.filter((l) =>
    /error|failed|fall[oa]|out of memory|no memory|not enough|cannot|unable|invalid|unsupported|missing|no such/i.test(l)
  );
  const elegidas = (conChicha.length ? conChicha : lineas).slice(-2);
  const texto = elegidas.join(' | ').trim();
  return texto ? texto.slice(0, 200) : `código ${code}`;
}

/**
 * Mata de verdad el proceso del motor. En Windows `child.kill()` no siempre
 * termina un ejecutable nativo, así que hay que usar taskkill con /T (árbol
 * entero) y /F (a la fuerza). Si no, quedan procesos colgados comiendo CPU y
 * VRAM (justo lo que pasó).
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
    /* lo intentamos igualmente con kill() */
  }
  try {
    child.kill();
  } catch {
    /* da igual */
  }
}

/**
 * Genera con sd-cli.exe. Nunca lanza: devuelve {ok, filePath, mime, buffer} o
 * {ok:false, error}.
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

  // En una gráfica de 4 GB no caben a la vez el modelo de texto (Ollama) y el de
  // imágenes: si Ollama tiene el suyo cargado, al dibujar le falta memoria y falla
  // ("unet segment failed during workspace capacity check"). Así que soltamos el
  // de texto primero; Ollama lo recarga solo cuando haga falta. Si Ollama no
  // responde, seguimos igualmente e intentamos dibujar.
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

    // Guardamos el FINAL de lo que suelta el motor (donde están los errores).
    // Antes nos quedábamos con los primeros 4000 caracteres, así que una barra
    // de progreso larga podía comerse el mensaje de error de verdad.
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

// ----------------------------------------------------------- motor "http"

/** Pide la imagen a un servidor compatible con OpenAI Images. */
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

// ----------------------------------------------------------- fachada

// La tarjeta gráfica tiene 4 GB: si se lanzan DOS sd-cli a la vez se quedan sin
// memoria y fallan los dos (nos pasó: dos "!claw imagen" seguidos). Así que las
// generaciones van de una en una: la segunda espera a que acabe la primera.
// Si ya hay demasiada gente esperando, se le dice que pruebe luego.
const MAX_ESPERANDO = 1; // además de la que se está dibujando ahora mismo
let dibujando = 0; // generaciones en marcha + esperando turno
let cola = Promise.resolve();

/** Pide turno para dibujar. Devuelve la función para soltarlo, o null si hay cola. */
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
 * Genera una imagen con el motor configurado.
 * Nunca lanza: devuelve {ok:true, filePath?|buffer, mime} o {ok:false, error, off?}.
 *
 * Si la generación está apagada, devuelve {ok:false, off:true} sin hacer nada
 * (así es imposible que el bot genere una imagen por accidente).
 */
export async function generarImagen(prompt, opciones = {}) {
  const texto = String(prompt || '').trim();
  if (!texto) return { ok: false, error: 'No has dicho qué quieres dibujar.' };

  // La barrera de seguridad: apagada = no se genera nada, ni aunque lo pidan.
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
    const motor = String(config.imageGenBackend || 'cli').toLowerCase();
    if (motor === 'http') return await generarImagenHttp(textoFinal, opciones);
    return await generarImagenCli(texto, { ...opciones, promptMejorado: textoFinal });
  } finally {
    soltar();
  }
}
