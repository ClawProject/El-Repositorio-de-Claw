// WhatsApp connection using Baileys (multi-device WhatsApp Web).
import fs from 'node:fs';
import { config } from './config.js';
import { log } from './logger.js';
import * as memory from './memory.js';
import { welcomeText } from './replies.js';
import * as ajustes from './settings.js';
import * as admins from './admins.js';
import { recordarAlias, tieneTelefono } from './identities.js';
import * as presence from './presence.js';
import { handleMessage, rememberBotMessage, boundGroups, gruposFijos } from './router.js';

let baileys = null;
let sock = null;
let reconnectAttempts = 0;
let reconnectTimer = null;
let stopping = false;
let conectado = false;
const alConectar = [];
const groupNameCache = new Map();
const aliasSyncAt = new Map();

/** Is the WhatsApp connection open right now? */
export function estaConectado() {
  return Boolean(sock && conectado);
}

/**
 * Registers something to run when the connection opens. If it is already open,
 * it runs right away (so nothing is lost to a timing race).
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
 * Really closes the current socket before creating another one. Otherwise the
 * old socket stays half alive and, on reconnect, there would be TWO connections
 * with the same session: WhatsApp treats them as replacing each other and keeps
 * returning error 440 ("Connection Replaced").
 */
function closeSocket() {
  presence.usarEnvio(null); // stop sending "typing…" (and stop the heartbeats)
  presence.usarEnvioTexto(null); // and stop sending loose notices
  if (!sock) return;
  try {
    sock.ev?.removeAllListeners?.();
  } catch {
    /* ignore */
  }
  try {
    sock.ws?.close?.();
  } catch {
    /* ignore */
  }
  try {
    sock.end?.(undefined);
  } catch {
    /* ignore */
  }
  conectado = false;
  sock = null;
}

// Baileys uses pino internally; we silence it to keep the console clean.
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

/** Strips the wrappers (ephemeral, view once...) and leaves the real message. */
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

/** Extracts the text of a message, unwrapped when it comes "wrapped" (ephemeral, view once...). */
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

/** Describes the file the message carries (photo or voice note), if it carries one. */
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

/** JIDs mentioned in the message (to know whether we were called with @). */
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

/** Which group gets the welcome? The assigned ones, or the ones fixed by JID. */
async function resolveWelcomeTargets() {
  const asignados = boundGroups();
  if (asignados.length) {
    return asignados.map((g) => ({ jid: g.jid, nombre: '' }));
  }
  const fijos = gruposFijos();
  if (fijos.length) return fijos.map((jid) => ({ jid, nombre: '' }));
  return null;
}

/** JIDs of every participant in a group (to mention everybody). */
async function groupMentions(jid) {
  try {
    const meta = await sock.groupMetadata(jid);
    return (meta.participants || []).map((p) => p.id).filter(Boolean);
  } catch (err) {
    log.debug(`No pude sacar los participantes de ${jid}: ${err.message}`);
    return undefined;
  }
}

/** Learns which @lid belongs to each phone number by looking at the group
 *  participants. WhatsApp sends many messages with only the @lid; without this
 *  table, banning a number would not apply to those messages. */
async function sincronizarIdentidades(jid) {
  if (!jid || !sock) return;
  const ahora = Date.now();
  if (ahora - (aliasSyncAt.get(jid) || 0) < 60000) return;
  aliasSyncAt.set(jid, ahora);
  try {
    const meta = await sock.groupMetadata(jid);
    for (const p of meta.participants || []) {
      recordarAlias(p.id, p.lid, p.jid, p.phoneNumber);
    }
    log.debug(`Identificadores de "${jid}" sincronizados.`);
  } catch (err) {
    log.debug(`No pude leer los participantes de ${jid}: ${err.message}`);
  }
}

/** Introduces itself in the groups the first time it starts. Once per group
 *  (or always, with WELCOME_ALWAYS). */
export async function sendWelcome({ force = false } = {}) {
  if (!config.welcomeEnabled) return false;
  if (!force && !config.welcomeAlways && memory.getSetting('welcome_sent')) return false;

  const yaSaludado = (jid) => Boolean(memory.getSetting(`welcome_sent:${jid}`));

  // With no assigned groups there is nobody to introduce itself to: it happens on linking.
  const intentos = 1;
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

/** Sends the replies and records the ids so we do not answer ourselves.
 *  Returns `true` only when EVERYTHING was sent fine (with no connection, `false`). */
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
      // Small pause so WhatsApp does not take it for spam
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
  // WhatsApp identifies the same person in two ways: phone number
  // (@s.whatsapp.net) and anonymous identifier (@lid). Baileys puts the number
  // in participantPn and the @lid in participantLid (it used to read
  // participantAlt, which does not exist).
  const senderJidAlt = isGroup
    ? msg.key.participantPn || msg.key.participantLid || msg.key.participantAlt || msg.participantAlt || null
    : (!fromMe ? msg.key.senderPn || msg.key.senderLid : null) || remoteJid;

  // The number <-> @lid equivalence is stored as soon as it is seen. That is
  // what makes a ban by number apply also to messages that arrive with only the
  // @lid (and the other way round).
  if (isGroup) {
    if (senderJid) recordarAlias(senderJid, senderJidAlt, msg.key.participantPn, msg.key.participantLid);
  } else if (!fromMe) {
    recordarAlias(senderJid, msg.key.senderPn, msg.key.senderLid);
  }

  // If the message only carries the @lid and its number is still unknown, the
  // group participants are checked (at most once a minute per group).
  if (isGroup && senderJid && senderJid.endsWith('@lid') && !tieneTelefono(senderJid)) {
    await sincronizarIdentidades(remoteJid);
  }

  const senderName = msg.pushName || (senderJid ? senderJid.split('@')[0] : 'alguien');

  // Messages sent by the bot's own number are "ours". They matter in the chat
  // with yourself (the owner panel) and when an administrator sends them (so
  // they can give orders in the group from their phone).
  // The bot does not answer itself because it records the ids of what it sends.
  const propioDeAdmin = fromMe && admins.esAdmin(senderJid, senderJidAlt);
  if (fromMe && !isSelfChat && !propioDeAdmin && !config.learnFromOwnMessages) return;
  if (msg.key.id && msg.key.id.startsWith('PICKLEBOT')) return;

  // Discard old messages (history sync, retries) older than 3 minutes.
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
    // The download is lazy: the file is only fetched if the router decides to save it.
    media: mediaInfo ? { ...mediaInfo, download: () => downloadMedia(msg) } : null
  });

  const texts = [...(result.replies || []), ...(result.notices || [])];
  if (texts.length || result.media?.length) {
    await sendReplies(remoteJid, texts, msg, result.media || []);
  }
}

/** Downloads the file of a message (photo or audio). */
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

  // Safety net: if for whatever reason a socket is left open, close it before
  // creating the new one (two sessions at once = error 440).
  closeSocket();

  fs.mkdirSync(config.authDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);

  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    version = undefined;
  }

  // Baileys uses pino internally; we silence it to keep the console clean (above).
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

  // Tell the notices module how to send "typing…" and the loose notices.
  presence.usarEnvio((jid, estado) => sock?.sendPresenceUpdate?.(estado, jid));
  presence.usarEnvioTexto((jid, texto) => sendReplies(jid, [texto]));

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) printQr(qr);

    if (connection === 'open') {
      reconnectAttempts = 0;
      conectado = true;
      log.info(`Conectado a WhatsApp como ${sock.user?.id || 'desconocido'}`);
      const bound = config.groupJid || null;
      if (bound) log.info(`Grupo fijado por configuracion: ${bound}`);
      else log.info('Sin grupo vinculado todavia. Escribe "!claw aqui" en el grupo del instituto.');

      // Notices that were waiting for a connection (changelog, reminders…).
      const pendientes = alConectar.splice(0, alConectar.length);
      for (const cb of pendientes) {
        try {
          cb();
        } catch (err) {
          log.debug(`Fallo al ejecutar el aviso de conexión: ${err.message}`);
        }
      }

      sendWelcome().catch((err) => log.debug(`No pude mandar la bienvenida: ${err.message}`));

      // Learn the number <-> @lid equivalences of the already linked groups so a
      // ban by number works from the very first message.
      for (const g of boundGroups()) {
        sincronizarIdentidades(g.jid).catch(() => {});
      }
    }

    if (connection === 'close') {
      conectado = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason?.loggedOut;
      if (stopping) return;

      // Make sure the socket that just dropped is closed before opening another.
      closeSocket();

      if (loggedOut) {
        log.error('Sesion cerrada desde el movil. Borra la carpeta data/auth y vuelve a vincular.');
        return;
      }
      // If a reconnect is already scheduled, do not launch another (it avoids
      // overlapping sockets, which is what causes the error 440 loop).
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
