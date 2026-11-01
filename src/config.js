// Carga de configuracion. Lee el archivo .env sin dependencias externas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(rootDir, '.env'));

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return /^(1|true|si|sí|yes|on)$/i.test(String(value).trim());
}

function num(value, fallback) {
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : fallback;
}

/** Normaliza el modo de privados: 'dueno' | 'admins' | 'todos' | 'nadie'. */
export function modoPrivado(value, fallback = 'dueno') {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return fallback;
  if (/^(true|si|sí|s|1|on)$/.test(v)) return 'dueno';
  if (/^(false|no|n|0)$/.test(v)) return 'admins';
  const alias = {
    dueno: 'dueno',
    dueño: 'dueno',
    owner: 'dueno',
    yo: 'dueno',
    mi: 'dueno',
    solo: 'dueno',
    solo_dueno: 'dueno',
    admin: 'admins',
    admins: 'admins',
    administrador: 'admins',
    administradores: 'admins',
    todos: 'todos',
    cualquiera: 'todos',
    all: 'todos',
    nadie: 'nadie',
    ninguno: 'nadie',
    nobody: 'nadie'
  };
  return alias[v] || fallback;
}

/** "34600111222" o "34600111222:83@s.whatsapp.net" -> "34600111222@s.whatsapp.net" */
export function normalizarJid(value, dominio = 's.whatsapp.net') {
  const limpio = String(value || '').trim();
  if (!limpio) return null;
  const parte = limpio.includes('@') ? limpio : `${limpio}@${dominio}`;
  const [izq, der] = parte.split('@');
  const numero = izq.split(':')[0].replace(/[^0-9]/g, '');
  if (!numero) return null;
  return `${numero}@${der || dominio}`;
}

/** El numero de la propia cuenta del bot, sacado de la sesion guardada. */
export function jidDeLaCuenta() {
  try {
    const texto = fs.readFileSync(path.join(rootDir, 'data', 'auth', 'creds.json'), 'utf8');
    return normalizarJid(JSON.parse(texto)?.me?.id);
  } catch {
    return null;
  }
}

/** El identificador "@lid" de la propia cuenta. WhatsApp manda muchos mensajes
 *  (sobre todo los tuyos) con este formato en vez del numero de telefono, asi
 *  que hay que conocerlo para reconocerte a ti mismo. */
export function jidLidDeLaCuenta() {
  try {
    const texto = fs.readFileSync(path.join(rootDir, 'data', 'auth', 'creds.json'), 'utf8');
    return normalizarJid(JSON.parse(texto)?.me?.lid, 'lid');
  } catch {
    return null;
  }
}

/** Lista separada por comas -> lista de numeros limpios. */
export function listaDeJids(value) {
  return String(value || '')
    .split(/[,;\s]+/)
    .map((t) => normalizarJid(t))
    .filter(Boolean);
}

export const config = {
  rootDir,
  dataDir: path.join(rootDir, 'data'),
  authDir: path.join(rootDir, 'data', 'auth'),
  dbPath: process.env.PICKLEBRAIN_DB || path.join(rootDir, 'data', 'picklebrain.db'),

  // --- IA local ---
  ollamaUrl: (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, ''),
  // Qwen3 4B Q4 da mejor conversación sin exceder la memoria total del equipo;
  // Ollama puede repartir trabajo entre la GTX 1650 y la CPU si hace falta.
  ollamaPrimaryModel: (process.env.OLLAMA_MODEL || 'qwen3:4b').trim(),
  ollamaFallbackModel: (process.env.OLLAMA_MODEL_FALLBACK || 'qwen2.5:3b').trim(),
  ollamaModel: (process.env.OLLAMA_MODEL || 'qwen3:4b').trim(),
  // Modelo que usa el "cerebro" (apuntar deberes y examenes). Va a ser un modelo
  // chico y rapido: su chiste es seguir instrucciones de formato, no pensar mucho.
  // Si no se configura, usa el mismo que el principal.
  ollamaBrainModel: (process.env.OLLAMA_MODEL_BRAIN || 'qwen2.5:3b').trim(),
  ollamaTimeoutMs: num(process.env.OLLAMA_TIMEOUT_MS, 120000),
  // cuanto tiempo mantiene Ollama el modelo cargado en memoria
  ollamaKeepAlive: process.env.OLLAMA_KEEP_ALIVE || '30m',

  // --- Servicio Python local (voz e imágenes) ---
  // Node sigue haciendo el resto; este servicio solo transcribe audio y dibuja.
  // Si no está arrancado, se usan los motores antiguos (transformers.js/sd-cli).
  pythonAiEnabled: bool(process.env.PYTHON_AI_ENABLED, true),
  pythonAiUrl: (process.env.PYTHON_AI_URL || 'http://127.0.0.1:5050').replace(/\/+$/, ''),
  pythonAiTimeoutMs: num(process.env.PYTHON_AI_TIMEOUT_MS, 120000),
  pythonAiHealthTimeoutMs: num(process.env.PYTHON_AI_HEALTH_TIMEOUT_MS, 2500),
  // Si el servicio Python falla a mitad, ¿probamos el motor antiguo?
  pythonAiFallback: bool(process.env.PYTHON_AI_FALLBACK, true),

  // --- Zona horaria ---
  timezone: process.env.TZ || 'Europe/Madrid',

  // --- Grupo ---
  // Se puede fijar uno varios grupos a la vez, separados por comas:
  //   WHATSAPP_GROUP_JID=120363...@g.us,120363...@g.us
  groupJid: (process.env.WHATSAPP_GROUP_JID || '').trim().split(',')[0]?.trim() || null,
  groupJids: (process.env.WHATSAPP_GROUP_JID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Nombre del grupo: si se pone, el bot se vincula solo a ese grupo
  // sin tener que escribir "!pickle aqui" dentro. Tambien admite varios, por comas.
  groupName: (process.env.WHATSAPP_GROUP_NAME || '').trim() || null,
  groupNames: (process.env.WHATSAPP_GROUP_NAME || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // --- Dueno y administradores ---
  // El dueno es quien manda de verdad: es el unico que puede tocar los ajustes
  // y nombrar administradores. Vacio = el numero de la propia cuenta del bot.
  ownerJid: normalizarJid(process.env.WHATSAPP_OWNER_JID) || jidDeLaCuenta(),
  // Administradores de arranque (luego se anaden desde WhatsApp). Separados por comas.
  adminJids: listaDeJids(process.env.WHATSAPP_ADMINS),
  // Gente vetada de arranque: no pueden usar a Claw (ni hablarle ni comandos).
  blockedJids: listaDeJids(process.env.WHATSAPP_BLOCKED),
  // Palabras que activan los comandos: "!claw aqui", "!pickle aqui"...
  commandNames: ['claw', 'pickle'],
  // Quién puede escribirle por privado (mensajes directos):
  //   'dueno'  = solo el dueño (por defecto)
  //   'admins' = el dueño y los administradores
  //   'todos'  = cualquiera
  //   'nadie'  = nadie (ignora todos los privados)
  // Se puede cambiar desde WhatsApp: "!claw ajustes privado <valor>".
  privateMode: modoPrivado(process.env.PRIVATE_MODE || process.env.PRIVATE_CHAT, 'dueno'),
  // Contestar cuando le mencionan directamente en el grupo
  replyToMentions: bool(process.env.REPLY_TO_MENTIONS, true),
  // Llevar la cuenta de las palabrotas del grupo (para "!claw palabrotas")
  countSwears: bool(process.env.COUNT_SWEARS, true),
  // Sacar el ranking enseguida cuando alguien suelta una palabrota
  swearAlert: bool(process.env.SWEAR_ALERT, true),
  // Segundos minimos entre avisos de palabrotas en el mismo grupo (para no spamear)
  swearCooldown: num(process.env.SWEAR_COOLDOWN, 30),
  // --- Generación de imágenes (experimental) ---
  // IMPORTANTE: por defecto apagada. El bot NUNCA genera imágenes por su cuenta;
  // solo cuando alguien escribe "!claw imagen ..." a mano Y el ajuste está activo.
  imageGenEnabled: bool(process.env.IMAGE_GEN_ENABLED, false),
  // Motor: 'auto' (Python si está disponible; si no, cli), 'python' (diffusers),
  // 'cli' (sd-cli.exe local) o 'http' (servidor tipo OpenAI Images).
  imageGenBackend: String(process.env.IMAGE_GEN_BACKEND || 'auto').toLowerCase(),
  // Rutas del motor "cli" (si son relativas, cuelgan de la carpeta del proyecto)
  imageGenBin: process.env.IMAGE_GEN_BIN || '',
  imageGenModelPath: process.env.IMAGE_GEN_MODEL_PATH || '',
  // Cuántos pasos dar y en qué tamaño (512x512 va bien incluso con poca GPU)
  imageGenSteps: num(process.env.IMAGE_GEN_STEPS, 20),
  imageGenWidth: num(process.env.IMAGE_GEN_WIDTH, 512),
  imageGenHeight: num(process.env.IMAGE_GEN_HEIGHT, 512),
  // Lo que NO queremos que salga en la imagen
  imageGenNegative:
    process.env.IMAGE_GEN_NEGATIVE ||
    'blurry, low quality, worst quality, low resolution, jpeg artifacts, duplicate objects, text, watermark, signature, deformed, bad anatomy, poorly drawn hands, extra fingers, missing fingers, extra limbs, disfigured',
  // Ajustes de muestreo para mejorar calidad (SD1.5)
  imageGenCfg: num(process.env.IMAGE_GEN_CFG, 7),
  imageGenSampler: process.env.IMAGE_GEN_SAMPLER || 'dpm++2m',
  imageGenScheduler: process.env.IMAGE_GEN_SCHEDULER || 'karras',
  imageGenSeed: process.env.IMAGE_GEN_SEED === undefined || process.env.IMAGE_GEN_SEED === '' ? -1 : num(process.env.IMAGE_GEN_SEED, -1),
  // Traducir y mejorar el prompt a inglés (recomendado)
  imageGenEnhance: bool(process.env.IMAGE_GEN_ENHANCE, true),
  // --- motor "http" (opcional) ---
  imageGenModel: process.env.IMAGE_GEN_MODEL || '',
  imageGenEndpoint: process.env.IMAGE_GEN_ENDPOINT || 'http://127.0.0.1:1234/v1/images/generations',
  imageGenApiKey: process.env.IMAGE_GEN_API_KEY || '',
  // Segundos que espera la respuesta antes de rendirse (dibujar en local tarda)
  imageGenTimeout: num(process.env.IMAGE_GEN_TIMEOUT, 300),
  // En una gráfica pequeña (4 GB) no caben a la vez el modelo de texto de Ollama
  // y el de imágenes: antes de dibujar se suelta el de texto para dejar sitio
  // (Ollama lo recarga solo cuando haga falta). Con una gráfica grande, ponlo en
  // `false` para no recargar el modelo de texto cada vez.
  imageGenFreeVram: bool(process.env.IMAGE_GEN_FREE_VRAM, true),
  // --- Ajedrez ---
  // Cuánto piensa Claw cada jugada (milisegundos). Más = juega mejor pero
  // bloquea al bot un momento. 1200 va sobrado para un grupo de clase.
  chessThinkMs: num(process.env.CHESS_THINK_MS, 1200),
  // --- Recordatorios de examenes ---
  reminderEnabled: bool(process.env.REMINDER_ENABLED, true),
  // hora del aviso la tarde anterior
  reminderHour: num(process.env.REMINDER_HOUR, 20),
  // hora del aviso la manana del examen
  reminderMorningHour: num(process.env.REMINDER_MORNING_HOUR, 8),
  // dias de antelacion del aviso previo de examenes (0 o 1 = no avisar antes)
  reminderAdvanceDays: num(process.env.REMINDER_ADVANCE_DAYS, 3),

  // --- Resumenes ---
  summaryEnabled: bool(process.env.SUMMARY_ENABLED, true),
  // dia de la semana del resumen (0 = domingo)
  summaryDay: num(process.env.SUMMARY_DAY, 0),
  summaryHour: num(process.env.SUMMARY_HOUR, 19),
  // guardar de que se habla en el grupo para poder hacer resumenes
  storeMessages: bool(process.env.STORE_MESSAGES, true),
  storeMessagesDays: num(process.env.STORE_MESSAGES_DAYS, 45),
  // mensajes que como mucho se le pasan a la IA para un resumen
  summaryMaxMessages: num(process.env.SUMMARY_MAX_MESSAGES, 200),
  // --- Novedades (changelog) ---
  // Contarle al grupo lo que se ha añadido al bot, una sola vez por novedad.
  changelogNotify: bool(process.env.CHANGELOG_NOTIFY, true),

  // --- Documentos (PDF, temarios, fichas) ---
  docsEnabled: bool(process.env.DOCS_ENABLED, true),

  // --- Modo ajedrez ---
  chessEnabled: bool(process.env.CHESS_ENABLED, true),

  // --- Mensaje de bienvenida ---
  // La primera vez que se arranca, el bot se presenta en el grupo. Solo una vez.
  welcomeEnabled: bool(process.env.WELCOME_ENABLED, true),
  // true = se presenta cada vez que arranca (normalmente molesto; dejalo en false)
  welcomeAlways: bool(process.env.WELCOME_ALWAYS, false),
  // Texto propio para la bienvenida. Vacio = el mensaje de siempre.
  welcomeMessage: (process.env.WELCOME_MESSAGE || '').trim(),

  // --- Claw ---
  clawTrigger: (process.env.CLAW_TRIGGER || 'claw').trim(),
  clawMaxPerMinute: num(process.env.CLAW_MAX_PER_MINUTE, 6),
  // Marcar las respuestas del asistente con una cabecera "🪝 Claw" para poder
  // distinguirlas de un vistazo de los avisos de deberes/exámenes.
  clawSignature: bool(process.env.CLAW_SIGNATURE, true),
  // Si está activo, CUALQUIERA del grupo puede usar "!claw apunta ..." para
  // añadir o corregir deberes/exámenes con su fecha a mano. Si se pone en
  // "no", queda solo para el dueño y los administradores.
  apuntaLibre: bool(process.env.APUNTA_LIBRE, true),

  // --- Energía ---
  // Mientras el bot está abierto, evita que el ordenador se duerma o se hiberne
  // (así no se cae la conexión con WhatsApp). No cambia nada del sistema: el
  // candado se suelta solo al cerrar el bot.
  preventSleep: bool(process.env.PREVENT_SLEEP, true),
  // Además de no dormirse, ¿tampoco apagar la pantalla? (por defecto no)
  keepDisplay: bool(process.env.KEEP_DISPLAY, false),

  // --- Búsqueda en internet (DuckDuckGo) ---
  // Cuando está activo, Claw mira en internet si la pregunta pide información
  // actual (noticias, precios, resultados...) o si se lo piden a la fuerza con
  // "!claw busca ...". OJO: en ese momento la pregunta sale a internet.
  webSearchEnabled: bool(process.env.WEB_SEARCH, true),
  webAllowedOrigins: String(process.env.WEB_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  ngrokEnabled: bool(process.env.NGROK_ENABLED, true),
  // Dominio fijo del tunel de PickleBrain. Se puede sobreescribir con
  // NGROK_DOMAIN, pero por defecto siempre es este.
  ngrokDomain: String(process.env.NGROK_DOMAIN || 'dawn-greeter-grazing.ngrok-free.dev').trim(),
  // Código corto de depuración para el dueño: abre una sesión con acceso total
  // desde la pantalla de acceso. Vacío = desactivado.
  debugCode: String(process.env.WEB_DEBUG_CODE === undefined ? '0912' : process.env.WEB_DEBUG_CODE).trim(),
  smtpHost: String(process.env.SMTP_HOST || '').trim(),
  smtpPort: num(process.env.SMTP_PORT, 465),
  smtpSecure: bool(process.env.SMTP_SECURE, true),
  smtpUser: String(process.env.SMTP_USER || '').trim(),
  smtpPassword: String(process.env.SMTP_PASSWORD || ''),
  smtpFrom: String(process.env.SMTP_FROM || 'ClawBot <clawbot@astermail.org>').trim(),

  // --- Imagenes y archivos ---
  mediaEnabled: bool(process.env.MEDIA_ENABLED, true),
  mediaDir: process.env.MEDIA_DIR || path.join(rootDir, 'data', 'media'),
  // 'contexto' = solo si tienen que ver con deberes/examenes | 'todo' | 'nada'
  mediaMode: (process.env.MEDIA_MODE || 'contexto').trim().toLowerCase(),
  // no descargar archivos mas grandes que esto (MB)
  mediaMaxMb: num(process.env.MEDIA_MAX_MB, 12),
  // si al disco le quedan menos de estos MB, no descargamos nada
  mediaMinFreeMb: num(process.env.MEDIA_MIN_FREE_MB, 800),
  // tope total de la carpeta de medios (MB). Si se supera, borra lo mas antiguo
  mediaMaxTotalMb: num(process.env.MEDIA_MAX_TOTAL_MB, 2048),
  // dias que se guarda una imagen sin fecha asociada
  mediaRetentionDays: num(process.env.MEDIA_RETENTION_DAYS, 14),
  // cuantas fotos como mucho se reenvian de golpe al preguntar
  mediaSendMax: num(process.env.MEDIA_SEND_MAX, 3),

  // --- Limpieza automatica ---
  // dias de margen tras un examen antes de borrar sus fotos y olvidarlo
  cleanupExamGraceDays: num(process.env.CLEANUP_EXAM_GRACE_DAYS, 3),
  // tambien borrar el texto del examen, no solo las fotos
  cleanupRemoveEntries: bool(process.env.CLEANUP_REMOVE_ENTRIES, true),
  cleanupIntervalMinutes: num(process.env.CLEANUP_INTERVAL_MINUTES, 60),

  // --- Notas de voz ---
  transcribeEnabled: bool(process.env.TRANSCRIBE_ENABLED, true),
  // 'todo' = transcribir todas | 'contexto' = preguntas abiertas y trigger Claw | 'nada'
  transcribeMode: (process.env.TRANSCRIBE_MODE || 'todo').trim().toLowerCase(),
  // no transcribir audios mas largos que esto (segundos)
  transcribeMaxSeconds: num(process.env.TRANSCRIBE_MAX_SECONDS, 180),
  whisperModel: process.env.WHISPER_MODEL || 'Xenova/whisper-base',
  whisperDtype: process.env.WHISPER_DTYPE || 'q8',
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  // mostrar en el grupo lo que ha entendido de cada nota de voz (por defecto no)
  showTranscriptions: bool(process.env.SHOW_TRANSCRIPTIONS, false),

  // --- Comportamiento ---
  answerWindowMinutes: num(process.env.ANSWER_WINDOW_MINUTES, 15),
  contextMessages: num(process.env.CONTEXT_MESSAGES, 6),
  ackSaves: bool(process.env.ACK_SAVES, false),
  minSecondsBetweenReplies: num(process.env.MIN_SECONDS_BETWEEN_REPLIES, 30),
  // aprender tambien de los mensajes que escribes tu mismo (solo util con numero propio)
  learnFromOwnMessages: bool(process.env.LEARN_FROM_OWN_MESSAGES, false),

  // --- Mantenimiento ---
  // Con esto activo el bot se queda callado: no contesta, no apunta deberes ni
  // examenes y no reenvia archivos. Solo los administradores pueden seguir dando
  // ordenes "!claw ..." (por ejemplo, para quitarlo). Se cambia desde WhatsApp.
  maintenance: bool(process.env.MAINTENANCE, false),

  logLevel: process.env.LOG_LEVEL || 'info'
};
