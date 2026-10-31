// Conexion con WhatsApp usando Baileys (WhatsApp Web multi-dispositivo).
import fs from 'node:fs';
import { config } from './config.js';
import { log } from './logger.js';
import * as memory from './memory.js';
import { sameGroupName } from './groups.js';
import { welcomeText } from './replies.js';
import * as ajustes from './settings.js';
import * as admins from './admins.js';
import * as presence from './presence.js';
import { handleMessage, rememberBotMessage, boundGroups, gruposFijos, nombreDeGrupoConfigurado } from './router.js';

let baileys = null;
let sock = null;
let reconnectAttempts = 0;
let reconnectTimer = null;
let stopping = false;
let conectado = false;
const alConectar = [];
const groupNameCache = new Map();

/** ¿Está la conexión con WhatsApp abierta ahora mismo? */
export function estaConectado() {
  return Boolean(sock && conectado);
}

/**
 * Registra algo que hacer cuando se abra la conexión. Si ya está abierta, se
 * ejecuta al momento (así no se pierde nada por una carrera de tiempos).
 */
export function cuandoConecte(cb) {
  if (typeof cb !== 'function') return;
  if (estaConectado()) {
    try {
      cb();
    } catch (err) {
      log.debug(`Fallo al ejecutar el aviso de conexión: ${err.message}`);
    }
    return;
  }
  alConectar.push(cb);
}

/**
 * Cierra de verdad el socket actual antes de crear otro. Si no lo hacemos, el
 * socket viejo sigue medio vivo y, al reconectar, habría DOS conexiones con la
 * misma sesión: WhatsApp las considera un reemplazo mutuo y devuelve el error
 * 440 en bucle ("Connection Replaced").
 */
function closeSocket() {
  presence.usarEnvio(null); // deja de mandar "escribiendo…" (y para los latidos)
  if (!sock) return;
  try {
    sock.ev?.removeAllListeners?.();
  } catch {
    /* ignorar */
  }
  try {
    sock.ws?.close?.();
  } catch {
    /* ignorar */
  }
  try {
    sock.end?.(undefined);
  } catch {
    /* ignorar */
  }
  conectado = false;
  sock = null;
}

// Baileys usa pino internamente; lo silenciamos para no ensuciar la consola.
const silence = {
  level: 'silent',
  fatal: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
  trace: () => {},
  child: () => silence
};

async function loadBaileys() {
  if (baileys) return baileys;
  const mod = await import('@whiskeysockets/baileys');
  baileys = {
    makeWASocket: mod.default ?? mod.makeWASocket,
    useMultiFileAuthState: mod.useMultiFileAuthState,
    DisconnectReason: mod.DisconnectReason,
    fetchLatestBaileysVersion: mod.fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore: mod.makeCacheableSignalKeyStore,
    downloadMediaMessage: mod.downloadMediaMessage
  };
  if (!baileys.makeWASocket || !baileys.useMultiFileAuthState) {
    throw new Error('Baileys no se ha cargado correctamente. Prueba a borrar node_modules y ejecutar npm install.');
  }
  return baileys;
}

/** Quita los envoltorios (temporal, ver una vez...) y deja el mensaje de verdad. */
export function unwrapMessage(message, depth = 0) {
  if (!message || depth > 4) return null;
  if (message.ephemeralMessage?.message) return unwrapMessage(message.ephemeralMessage.message, depth + 1);
  if (message.viewOnceMessage?.message) return unwrapMessage(message.viewOnceMessage.message, depth + 1);
  if (message.viewOnceMessageV2?.message) return unwrapMessage(message.viewOnceMessageV2.message, depth + 1);
  if (message.viewOnceMessageV2Extension?.message) {
    return unwrapMessage(message.viewOnceMessageV2Extension.message, depth + 1);
  }
  if (message.documentWithCaptionMessage?.message) {
    return unwrapMessage(message.documentWithCaptionMessage.message, depth + 1);
  }
  return message;
}

/** Extrae el texto de un mensaje, desenvuelto si viene "envuelto" (temporal, ver una vez...). */
export function extractText(message, depth = 0) {
  const m = unwrapMessage(message, depth);
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ''
  );
}

/** Describe el archivo que trae el mensaje (foto o nota de voz), si trae alguno. */
export function describeMedia(message) {
  const m = unwrapMessage(message);
  if (!m) return null;

  const image = m.imageMessage;
  if (image) {
    return {
      kind: 'image',
      mime: image.mimetype || 'image/jpeg',
      size: Number(image.fileLength || image.fileSize || 0) || 0,
      seconds: 0,
      viewOnce: Boolean(m.viewOnceMessage || m.viewOnceMessageV2 || m.viewOnceMessageV2Extension)
    };
  }

  const document = m.documentMessage;
  if (document && (config.docsEnabled ?? true)) {
    return {
      kind: 'document',
      mime: document.mimetype || 'application/octet-stream',
      size: Number(document.fileLength || document.fileSize || 0) || 0,
      seconds: 0,
      fileName: document.fileName || ''
    };
  }

  const audio = m.audioMessage;
  if (audio) {
    return {
      kind: 'audio',
      mime: audio.mimetype || 'audio/ogg',
      size: Number(audio.fileLength || 0) || 0,
      seconds: Number(audio.seconds || 0) || 0,
      viewOnce: Boolean(m.viewOnceMessage || m.viewOnceMessageV2 || m.viewOnceMessageV2Extension)
    };
  }

  return null;
}

/** JIDs mencionados en el mensaje (para saber si nos han llamado por @). */
export function mentionedJids(message, depth = 0) {
  if (!message || depth > 4) return [];
  if (message.ephemeralMessage?.message) return mentionedJids(message.ephemeralMessage.message, depth + 1);
  if (message.viewOnceMessage?.message) return mentionedJids(message.viewOnceMessage.message, depth + 1);
  if (message.viewOnceMessageV2?.message) return mentionedJids(message.viewOnceMessageV2.message, depth + 1);
  const ctx =
    message.extendedTextMessage?.contextInfo ||
    message.imageMessage?.contextInfo ||
    message.videoMessage?.contextInfo ||
    message.conversation?.contextInfo;
  return ctx?.mentionedJid || [];
}

async function groupName(jid) {
  if (groupNameCache.has(jid)) return groupNameCache.get(jid);
  try {
    const meta = await sock.groupMetadata(jid);
    groupNameCache.set(jid, meta.subject || '');
    return meta.subject || '';
  } catch {
    return '';
  }
}

/** ¿A qué grupo le mando la bienvenida? Los ya asignados; si no, los que se llamen como en el .env. */
async function resolveWelcomeTargets() {
  const asignados = boundGroups();
  if (asignados.length) {
    return asignados.map((g) => ({ jid: g.jid, nombre: g.name || '' }));
  }
  const fijos = gruposFijos();
  if (fijos.length) return fijos.map((jid) => ({ jid, nombre: '' }));
  const nombres = config.groupNames?.length ? config.groupNames : config.groupName ? [config.groupName] : [];
  if (!nombres.length) return null;
  try {
    const todos = await sock.groupFetchAllParticipating();
    const encontrados = Object.values(todos || {}).filter((g) =>
      nombres.some((n) => sameGroupName(g.subject, n))
    );
    return encontrados.length ? encontrados.map((g) => ({ jid: g.id, nombre: g.subject })) : null;
  } catch (err) {
    log.debug(`No pude mirar los grupos: ${err.message}`);
    return null;
  }
}

/** JIDs de todos los participantes de un grupo (para mencionar a todo el mundo). */
async function groupMentions(jid) {
  try {
    const meta = await sock.groupMetadata(jid);
    return (meta.participants || []).map((p) => p.id).filter(Boolean);
  } catch (err) {
    log.debug(`No pude sacar los participantes de ${jid}: ${err.message}`);
    return undefined;
  }
}

/** Se presenta en los grupos la primera vez que se arranca. Una vez por grupo
 *  (o siempre, si WELCOME_ALWAYS). */
export async function sendWelcome({ force = false } = {}) {
  if (!config.welcomeEnabled) return false;
  if (!force && !config.welcomeAlways && memory.getSetting('welcome_sent')) return false;

  const yaSaludado = (jid) => Boolean(memory.getSetting(`welcome_sent:${jid}`));

  // Recien conectado, la lista de grupos puede tardar un momento en estar lista.
  const porNombre = !boundGroups().length && nombreDeGrupoConfigurado?.length !== undefined;
  const nombres = config.groupNames?.length ? config.groupNames : config.groupName ? [config.groupName] : [];
  const esperandoPorNombre = !boundGroups().length && !gruposFijos().length && nombres.length > 0;
  const intentos = esperandoPorNombre ? 5 : 1;
  for (let i = 0; i < intentos; i++) {
    const destinos = await resolveWelcomeTargets();
    if (destinos?.length) {
      let mandadas = 0;
      for (const d of destinos) {
        if (!force && !config.welcomeAlways && yaSaludado(d.jid)) continue;
        try {
          const menciones = await groupMentions(d.jid);
          const sent = await sock.sendMessage(d.jid, {
            text: welcomeText(config.welcomeMessage),
            ...(menciones?.length ? { mentions: menciones } : {})
          });
          if (sent?.key?.id) rememberBotMessage(sent.key.id);
          memory.setSetting(`welcome_sent:${d.jid}`, new Date().toISOString());
          memory.setSetting('welcome_sent', new Date().toISOString());
          log.info(`Mensaje de bienvenida enviado a "${d.nombre || d.jid}".`);
          mandadas++;
        } catch (err) {
          log.warn(`No pude mandar la bienvenida a ${d.jid}: ${err.message}`);
        }
      }
      if (mandadas) return true;
      return false;
    }
    if (i < intentos - 1) await new Promise((r) => setTimeout(r, 3000));
  }

  log.info(
    esperandoPorNombre
      ? `Todavía no encuentro el grupo "${nombres[0]}": me presentaré en cuanto escriba alguien.`
      : 'Todavía no sé en qué grupo saludar: lo haré en cuanto me vincule a uno.'
  );
  return false;
}

/** Envia las respuestas y registra los ids para no contestarnos a nosotros mismos.
 *  Devuelve `true` solo si TODO se envió bien (si no hay conexión, `false`). */
export async function sendReplies(chatJid, texts, quotedMessage = null, mediaList = []) {
  const options = quotedMessage ? { quoted: quotedMessage } : undefined;
  let todoOk = true;

  if (!sock || !conectado) {
    log.warn(`No hay conexión con WhatsApp: no puedo escribir en ${chatJid} todavía.`);
    return false;
  }

  for (const text of texts) {
    if (!text) continue;
    try {
      const sent = await sock.sendMessage(chatJid, { text }, options);
      if (sent?.key?.id) rememberBotMessage(sent.key.id);
      log.info(`-> ${chatJid}: ${String(text).split('\n')[0].slice(0, 80)}`);
      // Pequeña pausa para que WhatsApp no lo tome por spam
      await new Promise((r) => setTimeout(r, 700));
    } catch (err) {
      todoOk = false;
      log.error('No se pudo enviar el mensaje:', err.message);
    }
  }

  for (const item of mediaList) {
    if (!item?.filePath) continue;
    try {
      const buffer = fs.readFileSync(item.filePath);
      const payload =
        item.kind === 'audio'
          ? { audio: buffer, mimetype: item.mime || 'audio/ogg', ptt: true }
          : item.kind === 'document'
          ? { document: buffer, mimetype: item.mime || 'application/pdf', fileName: item.filename || 'documento' }
          : { image: buffer, mimetype: item.mime || 'image/jpeg', caption: item.caption || undefined };
      const sent = await sock.sendMessage(chatJid, payload, options);
      if (sent?.key?.id) rememberBotMessage(sent.key.id);
      log.info(`-> ${chatJid}: [${item.kind === 'audio' ? 'audio' : item.kind === 'document' ? 'documento' : 'foto'}] ${item.caption || item.filename || ''}`);
      await new Promise((r) => setTimeout(r, 700));
    } catch (err) {
      todoOk = false;
      log.error('No se pudo enviar el archivo:', err.message);
    }
  }

  return todoOk;
}

async function onMessagesUpsert({ messages, type }) {
  if (type !== 'notify') return;

  for (const msg of messages) {
    try {
      await onSingleMessage(msg);
    } catch (err) {
      log.error('Error procesando mensaje:', err.message);
      log.debug(err.stack);
    }
  }
}

async function onSingleMessage(msg) {
  if (!msg?.message || !msg.key) return;

  const remoteJid = msg.key.remoteJid || '';
  if (!remoteJid || remoteJid === 'status@broadcast') return;

  const isGroup = remoteJid.endsWith('@g.us');
  const fromMe = Boolean(msg.key.fromMe);
  const selfJid = admins.duenoJid();
  const isSelfChat = !isGroup && Boolean(selfJid && admins.sonIguales(remoteJid, selfJid));

  const senderJid = isGroup ? msg.key.participant || msg.participant || null : remoteJid;
  // Alternativa "de verdad": Baileys pone el numero de telefono en participantPn
  // (y el @lid en participantLid). Antes leiamos participantAlt, que no existe.
  const senderJidAlt = isGroup
    ? msg.key.participantPn || msg.key.participantLid || msg.key.participantAlt || msg.participantAlt || null
    : remoteJid;
  const senderName = msg.pushName || (senderJid ? senderJid.split('@')[0] : 'alguien');

  // Los mensajes que manda el propio número del bot son "mios". Nos interesan en
  // el chat con uno mismo (el panel del dueño) y cuando los manda un
  // administrador (para que pueda dar órdenes en el grupo desde su móvil).
  // El bot no se contesta a sí mismo porque apunta los ids de lo que envía.
  const propioDeAdmin = fromMe && admins.esAdmin(senderJid, senderJidAlt);
  if (fromMe && !isSelfChat && !propioDeAdmin && !config.learnFromOwnMessages) return;
  if (msg.key.id && msg.key.id.startsWith('PICKLEBOT')) return;

  // Descartamos mensajes viejos (history sync, reintentos) de mas de 3 minutos.
  const ts = Number(msg.messageTimestamp || 0) * 1000;
  if (ts && Date.now() - ts > 3 * 60000) return;

  const text = extractText(msg.message).trim();
  const mediaInfo = describeMedia(msg.message);
  if (!text && !mediaInfo) return;

  const botJid = sock.user?.id;
  const botNumber = botJid ? botJid.split(':')[0].split('@')[0] : null;
  const mentions = mentionedJids(msg.message);
  const mentionedBot =
    Boolean(botNumber) &&
    mentions.some((jid) => String(jid).split(':')[0].split('@')[0] === botNumber) === true;

  const result = await handleMessage({
    chatJid: remoteJid,
    chatName: isGroup ? await groupName(remoteJid) : null,
    isGroup,
    text,
    senderName,
    senderJid,
    senderJidAlt,
    msgId: msg.key.id,
    mentionedBot,
    fromMe,
    esPrivado: !isGroup,
    esChatPropio: isSelfChat,
    // La descarga es perezosa: solo bajamos el archivo si el router decide guardarlo.
    media: mediaInfo ? { ...mediaInfo, download: () => downloadMedia(msg) } : null
  });

  const texts = [...(result.replies || []), ...(result.notices || [])];
  if (texts.length || result.media?.length) {
    await sendReplies(remoteJid, texts, msg, result.media || []);
  }
}

/** Descarga el archivo de un mensaje (foto o audio). */
async function downloadMedia(msg) {
  const { downloadMediaMessage } = await loadBaileys();
  return downloadMediaMessage(msg, 'buffer', {}, { logger: silence, reuploadRequest: sock?.updateMediaMessage });
}

function printQr(qr) {
  log.info('Escanea este codigo QR con WhatsApp (Dispositivos vinculados):');
  import('qrcode-terminal')
    .then(({ default: qrcode }) => {
      qrcode.generate(qr, { small: true });
    })
    .catch(() => {
      log.warn('No tengo qrcode-terminal. Aqui esta el texto crudo del QR:');
      console.log(qr);
    });
}

export async function start() {
  const {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
  } = await loadBaileys();

  if (stopping) return;

  // Red de seguridad: si por lo que sea queda un socket abierto, lo cerramos
  // antes de crear el nuevo (dos sesiones a la vez = error 440).
  closeSocket();

  fs.mkdirSync(config.authDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);

  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    version = undefined;
  }

  // Baileys usa pino internamente; lo silenciamos para no ensuciar la consola (arriba).
  sock = makeWASocket({
    version,
    logger: silence,
    printQRInTerminal: false,
    browser: ['PickleBrain', 'Chrome', '1.0.0'],
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, silence)
    },
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    getMessage: async () => undefined
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', onMessagesUpsert);

  // Le decimos al módulo de avisos cómo mandar el "escribiendo…".
  presence.usarEnvio((jid, estado) => sock?.sendPresenceUpdate?.(estado, jid));

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) printQr(qr);

    if (connection === 'open') {
      reconnectAttempts = 0;
      conectado = true;
      log.info(`Conectado a WhatsApp como ${sock.user?.id || 'desconocido'}`);
      const bound = config.groupJid || null;
      if (bound) log.info(`Grupo fijado por configuracion: ${bound}`);
      else if (config.groupName)
        log.info(`Mirando por el grupo "${config.groupName}": me vincularé solo a él.`);
      else log.info('Sin grupo vinculado todavia. Escribe "!pickle aqui" en el grupo del instituto.');

      // Avisos que esperaban a que hubiera conexión (novedades, recordatorios…).
      const pendientes = alConectar.splice(0, alConectar.length);
      for (const cb of pendientes) {
        try {
          cb();
        } catch (err) {
          log.debug(`Fallo al ejecutar el aviso de conexión: ${err.message}`);
        }
      }

      sendWelcome().catch((err) => log.debug(`No pude mandar la bienvenida: ${err.message}`));
    }

    if (connection === 'close') {
      conectado = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason?.loggedOut;
      if (stopping) return;

      // Nos aseguramos de cerrar el socket que acaba de caer antes de abrir otro.
      closeSocket();

      if (loggedOut) {
        log.error('Sesion cerrada desde el movil. Borra la carpeta data/auth y vuelve a vincular.');
        return;
      }
      // Si ya hay una reconexión programada, no lanzamos otra (evita sockets
      // solapados, que es lo que provoca el bucle de error 440).
      if (reconnectTimer) return;
      reconnectAttempts += 1;
      const delay = Math.min(30000, 2000 * reconnectAttempts);
      log.warn(`Conexion perdida (codigo ${statusCode ?? '?'}). Reintentando en ${delay / 1000}s...`);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (stopping) return;
        start().catch((err) => log.error('Fallo al reconectar:', err.message));
      }, delay);
    }
  });

  return sock;
}

export function stop() {
  stopping = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  closeSocket();
}

export function getSocket() {
  return sock;
}
