// Configuration loading. Reads the .env file without external dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Data folder: `data/` by default, or `PICKLEBRAIN_DATA_DIR` when set. */
function resolverDataDir() {
  const raw = String(process.env.PICKLEBRAIN_DATA_DIR || '').trim();
  return raw ? path.resolve(rootDir, raw) : path.join(rootDir, 'data');
}

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

// The data folder can also have its own .env, which takes precedence.
export const dataDir = resolverDataDir();
loadEnvFile(path.join(dataDir, '.env'));

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return /^(1|true|si|sí|yes|on)$/i.test(String(value).trim());
}

function num(value, fallback) {
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : fallback;
}

/** Normalises the private-chat mode: 'dueno' | 'admins' | 'todos' | 'nadie'. */
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

/** "34600111222" or "34600111222:83@s.whatsapp.net" -> "34600111222@s.whatsapp.net" */
export function normalizarJid(value, dominio = 's.whatsapp.net') {
  const limpio = String(value || '').trim();
  if (!limpio) return null;
  const parte = limpio.includes('@') ? limpio : `${limpio}@${dominio}`;
  const [izq, der] = parte.split('@');
  const numero = izq.split(':')[0].replace(/[^0-9]/g, '');
  if (!numero) return null;
  return `${numero}@${der || dominio}`;
}

/** The bot's own account number, taken from the saved session. */
export function jidDeLaCuenta() {
  try {
    const texto = fs.readFileSync(path.join(dataDir, 'auth', 'creds.json'), 'utf8');
    return normalizarJid(JSON.parse(texto)?.me?.id);
  } catch {
    return null;
  }
}

/** The "@lid" identifier of the account itself. WhatsApp sends many messages
 *  (especially your own) in this format instead of the phone number, so it has
 *  to be known in order to recognise yourself. */
export function jidLidDeLaCuenta() {
  try {
    const texto = fs.readFileSync(path.join(dataDir, 'auth', 'creds.json'), 'utf8');
    return normalizarJid(JSON.parse(texto)?.me?.lid, 'lid');
  } catch {
    return null;
  }
}

/** Comma-separated list -> list of clean numbers. */
export function listaDeJids(value) {
  return String(value || '')
    .split(/[,;\s]+/)
    .map((t) => normalizarJid(t))
    .filter(Boolean);
}

export const config = {
  rootDir,
  dataDir,
  authDir: path.join(dataDir, 'auth'),
  dbPath: process.env.PICKLEBRAIN_DB || path.join(dataDir, 'picklebrain.db'),

  // --- Local AI ---
  ollamaUrl: (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, ''),
  // Qwen3 4B Q4 gives better conversation without exceeding the machine's total
  // memory; Ollama can split the work between the GTX 1650 and the CPU if needed.
  ollamaPrimaryModel: (process.env.OLLAMA_MODEL || 'qwen3:4b').trim(),
  ollamaFallbackModel: (process.env.OLLAMA_MODEL_FALLBACK || 'qwen2.5:3b').trim(),
  ollamaModel: (process.env.OLLAMA_MODEL || 'qwen3:4b').trim(),
  // Model used by the "brain" (recording homework and exams). It is meant to be a
  // small, fast model: its job is following format instructions, not thinking hard.
  // If unset, it uses the same one as the primary model.
  ollamaBrainModel: (process.env.OLLAMA_MODEL_BRAIN || 'qwen2.5:3b').trim(),
  ollamaTimeoutMs: num(process.env.OLLAMA_TIMEOUT_MS, 120000),
  // how long Ollama keeps the model loaded in memory
  ollamaKeepAlive: process.env.OLLAMA_KEEP_ALIVE || '30m',

  // --- Local Python service (voice and images) ---
  // Node keeps doing the rest; this service only transcribes audio and draws.
  // If it is not running, the legacy engines are used (transformers.js/sd-cli).
  pythonAiEnabled: bool(process.env.PYTHON_AI_ENABLED, true),
  pythonAiUrl: (process.env.PYTHON_AI_URL || 'http://127.0.0.1:5050').replace(/\/+$/, ''),
  pythonAiTimeoutMs: num(process.env.PYTHON_AI_TIMEOUT_MS, 120000),
  pythonAiHealthTimeoutMs: num(process.env.PYTHON_AI_HEALTH_TIMEOUT_MS, 2500),
  // If the Python service fails halfway, do we try the legacy engine?
  pythonAiFallback: bool(process.env.PYTHON_AI_FALLBACK, true),

  // --- Time zone ---
  timezone: process.env.TZ || 'Europe/Madrid',

  // --- Language ---
  // The language is chosen the first time it starts (web /setup) and stored in
  // the database. CLAW_LANGUAGE fixes it in advance and skips that initial
  // setup (useful for tests and for fixed installations).
  idioma: (process.env.CLAW_LANGUAGE || '').trim().toLowerCase() || null,

  // --- Group ---
  // One or several groups can be fixed at once, separated by commas:
  //   WHATSAPP_GROUP_JID=120363...@g.us,120363...@g.us
  groupJid: (process.env.WHATSAPP_GROUP_JID || '').trim().split(',')[0]?.trim() || null,
  groupJids: (process.env.WHATSAPP_GROUP_JID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // The group is set by identifier (WHATSAPP_GROUP_JID) or by typing
  // "!claw aqui". Never by name: two groups can be called the same and
  // anyone can rename it, so the name cannot decide where to talk.

  // --- Owner and administrators ---
  // The owner is really in charge: the only one who can change the settings and
  // appoint administrators. Empty = the bot's own account number.
  ownerJid: normalizarJid(process.env.WHATSAPP_OWNER_JID) || jidDeLaCuenta(),
  // Startup administrators (added later from WhatsApp). Comma-separated.
  adminJids: listaDeJids(process.env.WHATSAPP_ADMINS),
  // People banned at startup: they cannot use Claw (neither talk to it nor run commands).
  blockedJids: listaDeJids(process.env.WHATSAPP_BLOCKED),
  // Words that trigger the commands: "!claw aqui", "!pickle aqui"...
  commandNames: ['claw', 'pickle'],
  // Who can message it privately (direct messages):
  //   'dueno'  = only the owner (default)
  //   'admins' = the owner and the administrators
  //   'todos'  = anyone
  //   'nadie'  = nobody (ignores every private message)
  // It can be changed from WhatsApp: "!claw ajustes privado <value>".
  privateMode: modoPrivado(process.env.PRIVATE_MODE || process.env.PRIVATE_CHAT, 'dueno'),
  // Reply when mentioned directly in the group
  replyToMentions: bool(process.env.REPLY_TO_MENTIONS, true),
  // Keep count of the group's swear words (for "!claw palabrotas")
  countSwears: bool(process.env.COUNT_SWEARS, true),
  // Show the ranking right away when someone swears
  swearAlert: bool(process.env.SWEAR_ALERT, true),
  // Minimum seconds between swear notices in the same group (to avoid spam)
  swearCooldown: num(process.env.SWEAR_COOLDOWN, 30),
  // --- Image generation (experimental) ---
  // IMPORTANT: off by default. The bot NEVER generates images on its own; only
  // when someone types "!claw imagen ..." by hand AND the setting is enabled.
  imageGenEnabled: bool(process.env.IMAGE_GEN_ENABLED, false),
  // Engine: 'auto' (Python when available; otherwise cli), 'python' (diffusers),
  // 'cli' (local sd-cli.exe) or 'http' (an OpenAI Images style server).
  imageGenBackend: String(process.env.IMAGE_GEN_BACKEND || 'auto').toLowerCase(),
  // Paths for the "cli" engine (when relative, they hang from the project folder)
  imageGenBin: process.env.IMAGE_GEN_BIN || '',
  imageGenModelPath: process.env.IMAGE_GEN_MODEL_PATH || '',
  // How many steps to take and at what size (512x512 works even with a small GPU).
  // 28 is where DPM++ 2M + Karras stops improving on SD 1.5: with fewer steps
  // the image comes out soft and faces turn to mush.
  imageGenSteps: num(process.env.IMAGE_GEN_STEPS, 28),
  imageGenWidth: num(process.env.IMAGE_GEN_WIDTH, 512),
  imageGenHeight: num(process.env.IMAGE_GEN_HEIGHT, 512),
  // What we do NOT want to appear in the image
  imageGenNegative:
    process.env.IMAGE_GEN_NEGATIVE ||
    'blurry, low quality, worst quality, low resolution, jpeg artifacts, duplicate objects, text, watermark, signature, deformed, bad anatomy, poorly drawn hands, extra fingers, missing fingers, extra limbs, disfigured',
  // Sampling settings to improve quality (SD1.5)
  imageGenCfg: num(process.env.IMAGE_GEN_CFG, 7),
  imageGenSampler: process.env.IMAGE_GEN_SAMPLER || 'dpm++2m',
  imageGenScheduler: process.env.IMAGE_GEN_SCHEDULER || 'karras',
  imageGenSeed: process.env.IMAGE_GEN_SEED === undefined || process.env.IMAGE_GEN_SEED === '' ? -1 : num(process.env.IMAGE_GEN_SEED, -1),
  // Translate and improve the prompt into English (recommended)
  imageGenEnhance: bool(process.env.IMAGE_GEN_ENHANCE, true),
  // --- "http" engine (optional) ---
  imageGenModel: process.env.IMAGE_GEN_MODEL || '',
  imageGenEndpoint: process.env.IMAGE_GEN_ENDPOINT || 'http://127.0.0.1:1234/v1/images/generations',
  imageGenApiKey: process.env.IMAGE_GEN_API_KEY || '',
  // Seconds it waits for the response before giving up (drawing locally takes a while)
  imageGenTimeout: num(process.env.IMAGE_GEN_TIMEOUT, 300),
  // On a small card (4 GB) the Ollama text model and the image model do not fit
  // at the same time: before drawing, the text model is released to make room
  // (Ollama reloads it by itself when needed). With a large card, set it to
  // `false` to avoid reloading the text model every time.
  imageGenFreeVram: bool(process.env.IMAGE_GEN_FREE_VRAM, true),
  // --- Chess ---
  // How long Claw thinks per move (milliseconds). More = better play but it
  // blocks the bot for a moment. 1200 is more than enough for a class group.
  chessThinkMs: num(process.env.CHESS_THINK_MS, 1200),
  // --- Exam reminders ---
  reminderEnabled: bool(process.env.REMINDER_ENABLED, true),
  // time of the notice the evening before
  reminderHour: num(process.env.REMINDER_HOUR, 20),
  // time of the notice on the morning of the exam
  reminderMorningHour: num(process.env.REMINDER_MORNING_HOUR, 8),
  // days in advance for the extra exam notice (0 or 1 = do not warn early)
  reminderAdvanceDays: num(process.env.REMINDER_ADVANCE_DAYS, 3),

  // --- Summaries ---
  summaryEnabled: bool(process.env.SUMMARY_ENABLED, true),
  // day of the week for the summary (0 = Sunday)
  summaryDay: num(process.env.SUMMARY_DAY, 0),
  summaryHour: num(process.env.SUMMARY_HOUR, 19),
  // store what is talked about in the group so summaries can be made
  storeMessages: bool(process.env.STORE_MESSAGES, true),
  storeMessagesDays: num(process.env.STORE_MESSAGES_DAYS, 45),
  // maximum messages passed to the AI for a summary
  summaryMaxMessages: num(process.env.SUMMARY_MAX_MESSAGES, 200),
  // --- Changelog notices ---
  // Tell the group what has been added to the bot, once per change.
  changelogNotify: bool(process.env.CHANGELOG_NOTIFY, true),

  // --- Documents (PDFs, syllabi, worksheets) ---
  docsEnabled: bool(process.env.DOCS_ENABLED, true),

  // --- Chess mode ---
  chessEnabled: bool(process.env.CHESS_ENABLED, true),

  // --- Welcome message ---
  // The first time it starts, the bot introduces itself in the group. Only once.
  welcomeEnabled: bool(process.env.WELCOME_ENABLED, true),
  // true = introduce itself on every start (usually annoying; leave it at false)
  welcomeAlways: bool(process.env.WELCOME_ALWAYS, false),
  // Custom welcome text. Empty = the usual message.
  welcomeMessage: (process.env.WELCOME_MESSAGE || '').trim(),

  // --- Claw ---
  clawTrigger: (process.env.CLAW_TRIGGER || 'claw').trim(),
  clawMaxPerMinute: num(process.env.CLAW_MAX_PER_MINUTE, 6),
  // Mark assistant replies with a "🪝 Claw" header so they can be told apart at
  // a glance from the homework/exam notices.
  clawSignature: bool(process.env.CLAW_SIGNATURE, true),
  // When enabled, ANYONE in the group can use "!claw apunta ..." to add or
  // correct homework/exams with the date by hand. If set to "no", it is
  // restricted to the owner and the administrators.
  apuntaLibre: bool(process.env.APUNTA_LIBRE, true),

  // --- Power ---
  // While the bot is open, it prevents the computer from sleeping or hibernating
  // (otherwise the WhatsApp connection drops). It changes nothing in the system:
  // the lock is released by itself when the bot closes.
  preventSleep: bool(process.env.PREVENT_SLEEP, true),
  // Besides not sleeping, should it also keep the display on? (no by default)
  keepDisplay: bool(process.env.KEEP_DISPLAY, false),

  // --- Web search (DuckDuckGo) ---
  // When enabled, Claw looks on the internet if the question asks for current
  // information (news, prices, results...) or if it is forced with
  // "!claw busca ...". CAREFUL: at that moment the question leaves to the internet.
  webSearchEnabled: bool(process.env.WEB_SEARCH, true),
  webAllowedOrigins: String(process.env.WEB_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  ngrokEnabled: bool(process.env.NGROK_ENABLED, true),
  // Fixed domain for the PickleBrain tunnel. It can be overridden with
  // NGROK_DOMAIN, but by default it is always this one.
  ngrokDomain: String(process.env.NGROK_DOMAIN || 'dawn-greeter-grazing.ngrok-free.dev').trim(),
  // Short debug code for the owner: opens a session with full access from the
  // login screen. Empty = disabled.
  debugCode: String(process.env.WEB_DEBUG_CODE === undefined ? '0912' : process.env.WEB_DEBUG_CODE).trim(),
  smtpHost: String(process.env.SMTP_HOST || '').trim(),
  smtpPort: num(process.env.SMTP_PORT, 465),
  smtpSecure: bool(process.env.SMTP_SECURE, true),
  smtpUser: String(process.env.SMTP_USER || '').trim(),
  smtpPassword: String(process.env.SMTP_PASSWORD || ''),
  smtpFrom: String(process.env.SMTP_FROM || 'ClawBot <clawbot@astermail.org>').trim(),

  // --- Images and files ---
  mediaEnabled: bool(process.env.MEDIA_ENABLED, true),
  mediaDir: process.env.MEDIA_DIR || path.join(dataDir, 'media'),
  // 'contexto' = only when related to homework/exams | 'todo' | 'nada'
  mediaMode: (process.env.MEDIA_MODE || 'contexto').trim().toLowerCase(),
  // do not download files larger than this (MB)
  mediaMaxMb: num(process.env.MEDIA_MAX_MB, 12),
  // if the disk has less than these MB left, nothing is downloaded
  mediaMinFreeMb: num(process.env.MEDIA_MIN_FREE_MB, 800),
  // total cap for the media folder (MB). If exceeded, it deletes the oldest
  mediaMaxTotalMb: num(process.env.MEDIA_MAX_TOTAL_MB, 2048),
  // days an image without an associated date is kept
  mediaRetentionDays: num(process.env.MEDIA_RETENTION_DAYS, 14),
  // how many photos at most are forwarded at once when asked
  mediaSendMax: num(process.env.MEDIA_SEND_MAX, 3),

  // --- Automatic cleanup ---
  // grace days after an exam before deleting its photos and forgetting it
  cleanupExamGraceDays: num(process.env.CLEANUP_EXAM_GRACE_DAYS, 3),
  // also delete the exam text, not only the photos
  cleanupRemoveEntries: bool(process.env.CLEANUP_REMOVE_ENTRIES, true),
  cleanupIntervalMinutes: num(process.env.CLEANUP_INTERVAL_MINUTES, 60),

  // --- Voice notes ---
  transcribeEnabled: bool(process.env.TRANSCRIBE_ENABLED, true),
  // 'todo' = transcribe all | 'contexto' = pending questions and the Claw trigger | 'nada'
  transcribeMode: (process.env.TRANSCRIBE_MODE || 'todo').trim().toLowerCase(),
  // do not transcribe audio longer than this (seconds)
  transcribeMaxSeconds: num(process.env.TRANSCRIBE_MAX_SECONDS, 180),
  whisperModel: process.env.WHISPER_MODEL || 'Xenova/whisper-base',
  whisperDtype: process.env.WHISPER_DTYPE || 'q8',
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  // show in the group what it understood from each voice note (no by default)
  showTranscriptions: bool(process.env.SHOW_TRANSCRIPTIONS, false),

  // --- Behaviour ---
  answerWindowMinutes: num(process.env.ANSWER_WINDOW_MINUTES, 15),
  contextMessages: num(process.env.CONTEXT_MESSAGES, 6),
  ackSaves: bool(process.env.ACK_SAVES, false),
  minSecondsBetweenReplies: num(process.env.MIN_SECONDS_BETWEEN_REPLIES, 30),
  // also learn from the messages you write yourself (only useful with your own number)
  learnFromOwnMessages: bool(process.env.LEARN_FROM_OWN_MESSAGES, false),

  // --- Maintenance ---
  // With this enabled the bot goes silent: it does not reply, does not record
  // homework or exams and does not forward files. Only the administrators can
  // still give "!claw ..." orders (for example, to remove it). Changed from WhatsApp.
  maintenance: bool(process.env.MAINTENANCE, false),

  logLevel: process.env.LOG_LEVEL || 'info'
};
