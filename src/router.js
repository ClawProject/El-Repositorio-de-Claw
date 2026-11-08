// The router decides what to do with each group message:
//   - ignore it (the usual case)
//   - save homework/exams that someone mentions
//   - answer when someone asks
//   - switch on Claw mode as a general assistant
//
// It is independent from WhatsApp: it takes text and returns the replies to send.
// That way the simulator (npm run sim) uses exactly the same logic as the real bot.
import { config, listaDeJids } from './config.js';
import { log } from './logger.js';
import * as memory from './memory.js';
import * as media from './media.js';
import { analyze } from './brain.js';
import { todayISO, extractDatePhrase, fold } from './dates.js';
import { looksRelevant, fastRoute, clawMatch, clawQuestion, detectKind, isQuestion } from './signals.js';
import { detectSubject } from './subjects.js';
import * as ajustes from './settings.js';
import * as admins from './admins.js';
import { resumenDeDias } from './summary.js';
import fs from 'node:fs';
import path from 'node:path';
import { contarPalabrotas } from './swears.js';
import { transcribeFile } from './transcribe.js';
import { clawAnswer, clawGreeting } from './claw.js';
import { buscarWeb } from './search.js';
import { generarImagen, esPedidoDeImagen } from './imagegen.js';
import * as presence from './presence.js';
import { textoNovedades } from './changelog.js';
import * as ajedrez from './chess.js';
import * as replies from './replies.js';
import * as i18n from './i18n.js';
import { ping as ollamaPing } from './ollama.js';

// ---------------------------------------------------------------- state

const lastReplyAt = new Map(); // key -> timestamp
const lastReplySignature = new Map(); // key -> signature of the data sent
const clawCalls = new Map(); // chatJid -> [timestamps]
const clawHistory = new Map(); // chatJid -> [{role, content}]
const lastSwearAlertAt = new Map(); // chatJid -> timestamp of the last swear notice
const botMessageIds = new Set();
const warnedUnbound = new Set(); // foreign groups we already warned about in the log

export function rememberBotMessage(msgId) {
  if (!msgId) return;
  botMessageIds.add(msgId);
  if (botMessageIds.size > 1000) {
    for (const id of [...botMessageIds].slice(0, 500)) botMessageIds.delete(id);
  }
}

/** Signature of the content sent: when it changes, it is worth answering again. */
function entriesSignature(entries) {
  return entries.map((e) => `${e.id}:${e.updatedAt || e.createdAt}`).join('|');
}

function replyAllowed(chatJid, key, signature = null) {
  const composite = `${chatJid}::${key}`;
  const now = Date.now();
  const last = lastReplyAt.get(composite) ?? 0;
  const previous = lastReplySignature.get(composite);
  // If the data changed since last time, we answer even if it is too soon.
  const dataChanged = signature !== null && previous !== undefined && previous !== signature;
  if (!dataChanged && now - last < config.minSecondsBetweenReplies * 1000) {
    log.debug(`Silencio preventivo (${key}) en ${chatJid}`);
    return false;
  }
  lastReplyAt.set(composite, now);
  if (signature !== null) lastReplySignature.set(composite, signature);
  return true;
}

function clawAllowed(chatJid) {
  const now = Date.now();
  const calls = (clawCalls.get(chatJid) || []).filter((t) => now - t < 60000);
  if (calls.length >= config.clawMaxPerMinute) {
    log.debug(`Limite de Claw alcanzado en ${chatJid}`);
    return false;
  }
  calls.push(now);
  clawCalls.set(chatJid, calls);
  return true;
}

// ---------------------------------------------------------------- binding

/**
 * Groups the bot is assigned to.
 *  - If the .env fixes groups (WHATSAPP_GROUP_JID), those are the only ones.
 *  - Otherwise they are saved with "!claw aqui" (and removed with "!claw fuera").
 */
export function boundGroups() {
  const fijos = (config.groupJids || []).filter(Boolean);
  if (fijos.length) return fijos.map((jid) => ({ jid, name: null }));

  const raw = memory.getSetting('group_jids');
  let guardados = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) guardados = parsed.filter((g) => g && g.jid);
    } catch {
      /* old format: we ignore it and look at group_jid below */
    }
  }
  // Compatibility with the database from when there was only one group.
  if (!guardados.length) {
    const uno = memory.getSetting('group_jid');
    if (uno) guardados = [{ jid: uno, name: memory.getSetting('group_name') || null }];
  }

  const vistos = new Set();
  const lista = [];
  for (const g of guardados) {
    if (vistos.has(g.jid)) continue;
    vistos.add(g.jid);
    lista.push({ jid: g.jid, name: null });
  }
  return lista;
}

export function boundGroupJid() {
  return boundGroups()[0]?.jid || null;
}

export function boundGroupJids() {
  return boundGroups().map((g) => g.jid);
}

/** Is this chat in the list of assigned groups? */
export function groupAllowed(chatJid) {
  if (!chatJid) return false;
  return boundGroups().some((g) => g.jid === chatJid);
}

/** Are the groups fixed from the .env (so they cannot be changed from WhatsApp)? */
export function gruposFijos() {
  return (config.groupJids || []).filter(Boolean);
}

/** Adds a group to the list (when the .env does not fix it). */
export function bindGroup(chatJid) {
  const fijos = gruposFijos();
  if (fijos.length) return fijos.map((jid) => ({ jid, name: null }));
  const lista = boundGroups();
  if (lista.some((g) => g.jid === chatJid)) return lista;
  lista.push({ jid: chatJid, name: null });
  guardarGrupos(lista);
  return lista;
}

/** Removes a group from the list (impossible when the .env fixes it). */
export function unbindGroup(chatJid) {
  if (gruposFijos().length) return boundGroups();
  const lista = boundGroups().filter((g) => g.jid !== chatJid);
  guardarGrupos(lista);
  return lista;
}

function guardarGrupos(lista) {
  // Only the identifier is stored. The name is no longer used and is not
  // recorded: it is data of the group, not of the bot.
  const limpia = lista.map((g) => ({ jid: g.jid, name: null }));
  memory.setSetting('group_jids', JSON.stringify(limpia));
  // The first group is still kept "by hand" in case some code expects group_jid.
  memory.setSetting('group_jid', limpia[0]?.jid || null);
  memory.setSetting('group_name', null);
}

// ---------------------------------------------------------------- main

/** Can this person write to it privately, according to the "privado" setting? */
function puedeEscribirPrivado(...jids) {
  switch (config.privateMode) {
    case 'todos':
      return true;
    case 'nadie':
      return false;
    case 'admins':
      return admins.esAdmin(...jids);
    default:
      return admins.esDueno(...jids); // 'dueno'
  }
}

/**
 * @param {{chatJid:string, chatName?:string, isGroup:boolean, text:string,
 *          senderName?:string, senderJid?:string, msgId?:string,
 *          mentionedBot?:boolean, fromMe?:boolean,
 *          media?:{kind:'image'|'audio', download:()=>Promise<Buffer>,
 *                  mime?:string, seconds?:number, size?:number}|null}} input
 * @param {{transcribe?:(filePath:string)=>Promise<{text:string,ms:number}>}} dependencies
 * @returns {Promise<{replies:string[], media:object[], action:string, analysis?:object|null,
 *                    saved?:object|null, savedMedia?:object|null, transcript?:string|null}>}
 */
export async function handleMessage(
  input,
  { transcribe = transcribeFile, listModels = ollamaPing } = {}
) {
  const {
    chatJid: convJid,
    chatName = null,
    isGroup,
    senderName = 'alguien',
    senderJid = null,
    senderJidAlt = null,
    msgId = null,
    mentionedBot = false,
    esChatPropio = false,
    media: incoming = null
  } = input;

  // Where homework and exams are stored and read. In the group, the group itself.
  // In a private message (direct or the chat with yourself) it is the assigned
  // group: that way you can leave homework/exams privately and ask about them, and
  // they are noted in the group. With no group, the private chat is used.
  const chatJid = !isGroup ? boundGroupJid() || convJid : convJid;

  const out = {
    replies: [],
    notices: [],
    media: [],
    action: 'silencio',
    analysis: null,
    saved: null,
    savedMedia: null,
    transcript: null
  };

  let text = String(input.text || '').trim();
  if (msgId && botMessageIds.has(msgId)) return out; // it is one of our messages

  // --- Commands: "!claw ..." (and "!pickle ...", which still works) ---
  const comando = parseCommand(text);

  // --- Maintenance mode ---
  // The bot goes mute: it does not answer, does not note anything down and does
  // not forward files. Only an administrator's commands get through, so it can
  // be switched off.
  if (config.maintenance && !(comando && admins.esAdmin(senderJid, senderJidAlt))) {
    out.action = 'mantenimiento';
    return out;
  }

  // Private messages (DM): who may write is decided by the "privado" setting
  // (the owner only, by default). The owner's own chat always counts.
  // This comes before the commands so a stranger cannot use "!claw ..." privately.
  if (!isGroup && !esChatPropio && !puedeEscribirPrivado(senderJid, senderJidAlt)) {
    log.debug(`Mensaje privado ignorado (ajuste "privado" = ${config.privateMode}): ${senderName}`);
    return out;
  }

  // --- Banned: they cannot use Claw (no commands, no talking to it; nothing is learned from them either) ---
  if (admins.esVetado(senderJid, senderJidAlt)) {
    out.action = 'vetado';
    log.debug(`Mensaje de ${senderName} ignorado (está vetado).`);
    return out;
  }

  if (comando) return await handleCommand({ comando, input: { ...input, chatJid }, out, listModels });

  // From here on we only act in the assigned groups.
  if (isGroup && !groupAllowed(chatJid)) {
    if (!warnedUnbound.has(chatJid)) {
      warnedUnbound.add(chatJid);
      const fijos = gruposFijos();
      if (fijos.length) {
        log.info(
          `Este bot está fijado desde el .env a ${fijos.length} grupo(s) y no responde en "${chatName || chatJid}".`
        );
      } else {
        log.info(
          `Mensaje en grupo no asignado "${chatName || chatJid}". Para activarme ahí, escribe: !claw aqui`
        );
      }
    }
    return out;
  }

  // --- 0. Files and voice notes ---
  if (incoming?.kind === 'audio') {
    const transcript = await handleIncomingAudio({ incoming, chatJid, senderName, out, transcribe });
    if (transcript) text = transcript;
    if (!text) return out;
  } else if (incoming?.kind === 'image' || incoming?.kind === 'document') {
    await handleIncomingImage({ incoming, chatJid, senderName, senderJid, msgId, out, text });
    // A file caption usually describes it ("esto entra en el examen..."): we only
    // go on when it really is a question or when Claw is addressed.
    if (!text) return out;
    if (!isQuestion(text) && !clawMatch(text)) return out;
  }

  if (!text) return out;
  memory.logMessage({ chatJid: convJid, msgId, author: senderName, authorJid: senderJid, text });

  // Swear counter: it counts them for the "!claw palabrotas" ranking and, when
  // due, posts the ranking on the spot (with a margin so it does not spam).
  if (isGroup && config.countSwears) {
    const cuenta = contarPalabrotas(text);
    if (cuenta.total) {
      memory.addSwears({
        chatJid,
        authorKey: senderJid || senderName,
        author: senderName,
        byWord: cuenta.byWord
      });

      if (config.swearAlert) {
        const ahora = Date.now();
        const ultimo = lastSwearAlertAt.get(chatJid) || 0;
        if (ahora - ultimo >= config.swearCooldown * 1000) {
          lastSwearAlertAt.set(chatJid, ahora);
          out.notices.push(
            replies.palabrotasReply({
              ranking: memory.swearRanking(chatJid, 10),
              total: memory.swearTotal(chatJid),
              topWord: memory.swearTopWord(chatJid),
              aviso: true
            })
          );
          if (out.action === 'silencio') out.action = 'palabrota-ranking';
        }
      }
    }
  }

  // --- 1. Claw mode ---
  if (clawMatch(text) || (mentionedBot && !looksRelevant(text))) {
    return handleClaw({ chatJid, senderName, text, mentionedBot, out });
  }

  // In private we treat it as if it were the group: if you say a homework item or
  // an exam, it is noted in the group; if you ask about them, you get the group's.
  // To chat with Claw about anything, write "claw ...". In the chat with yourself
  // (your owner panel), whatever is not about homework/exams are your notes: there
  // the bot stays quiet.
  if (!isGroup && esChatPropio && !looksRelevant(text)) return out;

  // --- 2. Fast route: typical homework/exam question ---
  const fast = fastRoute(text);
  if (fast) {
    const entries = memory.findPending({ kind: fast.kind, subjectKey: fast.subjectKey, chatJid });
    const stored = storedMedia(fast.kind, fast.subjectKey, chatJid);
    const key = `${fast.kind}:${fast.subjectKey || '*'}`;
    if (entries.length || stored.length) {
      if (replyAllowed(chatJid, `fast:${key}`, contentSignature(entries, stored))) {
        out.action = 'respuesta-rapida';
        out.replies = [
          entries.length ? buildReply(fast, entries) : replies.mediaOnlyReply({ kind: fast.kind, subject: fast.subjectLabel })
        ];
        attachMedia(out, { rows: stored, kind: fast.kind, subject: fast.subjectLabel });
        memory.openQuestion({
          chatJid,
          kind: fast.kind,
          subject: fast.subjectLabel,
          askedBy: senderName,
          msgId
        });
        log.info(`Respuesta rápida (${key}) en ${chatName || chatJid}`);
      }
      return out;
    }
    // We know nothing yet: the question is opened and the AI confirms below.
  }

  // --- 3. AI analysis ---
  const pending = memory.getPendingQuestion(chatJid, config.answerWindowMinutes);
  const recent = memory.recentMessages(convJid, config.contextMessages);
  const relevant = looksRelevant(text) || Boolean(pending) || Boolean(fast);
  if (!relevant) {
    // In private, whatever is not about homework/exams is a chat with Claw.
    if (!isGroup && !esChatPropio) return handleClaw({ chatJid, senderName, text, mentionedBot, out });
    return out;
  }

  const analysis = await analyze({ text, pending, recent, senderName });
  out.analysis = analysis;

  if (analysis.tipo === 'pregunta_deberes' || analysis.tipo === 'pregunta_examen') {
    const kind = analysis.tipo === 'pregunta_examen' ? 'examen' : 'deberes';
    const subjectKeyValue = analysis.subjectKey || (fast ? fast.subjectKey : null);
    const entries = memory.findPending({ kind, subjectKey: subjectKeyValue, chatJid });
    const stored = storedMedia(kind, subjectKeyValue, chatJid);
    memory.openQuestion({
      chatJid,
      kind,
      subject: analysis.subject || (fast ? fast.subjectLabel : null),
      askedBy: senderName,
      msgId
    });
    const label = analysis.subject || (fast ? fast.subjectLabel : null);
    if (entries.length || stored.length) {
      if (replyAllowed(chatJid, `${kind}:${subjectKeyValue || '*'}`, contentSignature(entries, stored))) {
        out.action = 'respuesta-ia';
        out.replies = [entries.length ? buildReply({ kind, subjectLabel: label }, entries) : replies.mediaOnlyReply({ kind, subject: label })];
        attachMedia(out, { rows: stored, kind, subject: label });
      }
    } else if (kind === 'examen' && subjectKeyValue) {
      const past = memory.findLastExam(subjectKeyValue, chatJid);
      if (past.length && replyAllowed(chatJid, `past:${subjectKeyValue}`, entriesSignature(past))) {
        out.action = 'respuesta-ia';
        out.replies = [replies.pastExamReply(past, { subject: analysis.subject })];
      } else if (replyAllowed(chatJid, `${kind}:${subjectKeyValue}:vacio`)) {
        out.action = 'respuesta-ia';
        out.replies = [replies.nothingFound({ kind, subject: analysis.subject })];
      }
    } else if (replyAllowed(chatJid, `${kind}:*:vacio`)) {
      out.action = 'respuesta-ia';
      out.replies = [replies.nothingFound({ kind, subject: analysis.subject })];
    }
    return out;
  }

  if (analysis.tipo === 'dato_deberes' || analysis.tipo === 'dato_examen') {
    const kind = analysis.tipo === 'dato_examen' ? 'examen' : 'deberes';
    // If it came with a photo or a PDF, the caption only describes it ("esto entra en...").
    // It is not noted as a standalone fact: the file is already stored and linked.
    if (input.media?.kind === 'image' || input.media?.kind === 'document') {
      log.debug('El pie de archivo no se apunta por separado.');
      return out;
    }
    if (analysis.confidence < 0.45 || !analysis.content) {
      log.debug(`Dato descartado por baja confianza (${analysis.confidence})`);
      return out;
    }
    const saved = memory.saveEntry({
      kind,
      subject: analysis.subject,
      content: analysis.content,
      fecha: analysis.fecha,
      fechaTexto: analysis.fechaTexto,
      rawText: text,
      author: senderName,
      authorJid: senderJid,
      msgId,
      chatJid,
      confidence: analysis.confidence,
      correction: analysis.correction
    });
    out.saved = saved;

    if (pending) {
      memory.resolveQuestion(pending.id);
    }

    if (saved.status === 'nuevo' || saved.status === 'reemplaza') {
      log.info(
        `Apuntado ${kind}${analysis.subject ? ` de ${analysis.subject}` : ''}: "${analysis.content}"${
          analysis.fecha ? ` (${analysis.fecha})` : ''
        }`
      );
      // By default we do NOT confirm: the bot only speaks when asked.
      if (config.ackSaves && replyAllowed(chatJid, `ack:${saved.entry.id}`)) {
        out.action = 'guardado';
        out.replies = [replies.savedAck(saved.entry)];
      } else {
        out.action = 'guardado-silencio';
      }
    } else {
      out.action = 'guardado-duplicado';
    }
    return out;
  }

  out.action = 'ignorado';
  // In private, anything that is not a fact nor a homework or exam question is a
  // normal conversation with Claw.
  if (!isGroup && !esChatPropio) {
    return handleClaw({ chatJid, senderName, text, mentionedBot, out });
  }
  return out;
}

// ---------------------------------------------------------------- files

/** Signature of the content sent (text + files): when it changes, we answer again. */
function contentSignature(entries, stored) {
  return `${entriesSignature(entries)}|${(stored || []).map((m) => m.id).join(',')}`;
}

function storedMedia(kind, subjectKey, chatJid = null) {
  if (!config.mediaEnabled || config.mediaMode === 'nada') return [];
  return memory.listMedia({ kind, subjectKey, limit: config.mediaSendMax, chatJid });
}

/** Attaches the stored files to the reply that is about to be sent. */
function attachMedia(out, { rows, kind, subject }) {
  if (!config.mediaEnabled || !rows?.length) return;
  const caption = replies.mediaCaption({ kind, subject, count: rows.length });
  for (const m of rows) out.media.push(media.asOutgoing(m, caption));
}

/** Voice notes: we listen to them and carry on as if they were text. */
async function handleIncomingAudio({ incoming, chatJid, senderName, out, transcribe }) {
  if (!config.transcribeEnabled || config.transcribeMode === 'nada') return '';
  const seconds = Number(incoming.seconds || 0);

  const hasPendingContext =
    config.transcribeMode !== 'contexto' ||
    Boolean(memory.getPendingQuestion(chatJid, config.answerWindowMinutes));
  if (seconds && seconds > config.transcribeMaxSeconds) {
    log.info(`Nota de voz de ${Math.round(seconds)}s: es muy larga, no la escucho.`);
    return '';
  }
  let tempPath = null;
  try {
    const buffer = await incoming.download();
    if (!buffer?.length) return '';
    tempPath = media.saveTempAudio(buffer, incoming.mime);
    const { text, ms } = await transcribe(tempPath);
    if (!text) {
      log.info(`🎧 Nota de voz de ${senderName}: (no he entendido nada)`);
      return '';
    }
    // In context mode we also listen, to detect the spoken trigger, but we still
    // discard notes without an open question that do not say it.
    if (!hasPendingContext && !clawMatch(text)) {
      log.debug('Nota de voz ignorada (modo contexto, sin pregunta abierta ni trigger Claw)');
      return '';
    }
    log.info(`🎧 Nota de voz de ${senderName} (${(ms / 1000).toFixed(1)}s): "${text.slice(0, 120)}"`);
    out.transcript = text;
    if (config.showTranscriptions && replyAllowed(chatJid, 'transcripcion')) {
      out.notices.push(replies.transcriptNote(text));
    }
    return text;
  } catch (err) {
    log.warn(`No pude entender la nota de voz: ${err.message}`);
    return '';
  } finally {
    if (tempPath) media.removeFile(tempPath);
  }
}

/** Photos and documents: only saved when they are about homework/exams, and only if they fit on disk. */
async function handleIncomingImage({ incoming, chatJid, senderName, senderJid, msgId, out, text }) {
  if (!config.mediaEnabled || config.mediaMode === 'nada') return;
  const esDocumento = incoming.kind === 'document';
  if (esDocumento && !(config.docsEnabled ?? true)) {
    log.debug('Documento ignorado (los PDFs estan desactivados)');
    return;
  }

  const pending = memory.getPendingQuestion(chatJid, config.answerWindowMinutes);
  const kindFromText = detectKind(text);
  const subjectFromText = detectSubject(text);
  const hasContext =
    config.mediaMode === 'todo' || Boolean(pending) || Boolean(kindFromText) || Boolean(subjectFromText);
  if (!hasContext) {
    log.debug(esDocumento ? 'Documento ignorado (no tiene que ver con deberes ni exámenes)' : 'Foto ignorada (no tiene que ver con deberes ni exámenes)');
    return;
  }

  const kind = kindFromText || pending?.kind || null;
  const subjectKey = subjectFromText?.key || pending?.subjectKey || null;
  const subject = subjectFromText?.label || pending?.subject || null;
  const cosa = esDocumento ? 'el archivo' : 'la foto';

  // 1. Does it fit on disk? If not, we warn (the user asked for that).
  const check = media.canStore(incoming.size || 0);
  if (!check.ok) {
    log.warn(`No guardo ${cosa}: ${check.reason} (libre ${check.freeMb} MB, necesita ${check.needMb} MB)`);
    if (check.reason === 'no-space' && replyAllowed(chatJid, 'media:sin-espacio')) {
      out.notices.push(replies.noSpaceReply());
      if (out.action === 'silencio') out.action = 'sin-espacio';
    } else if (check.reason === 'too-big' && replyAllowed(chatJid, `media:grande:${check.needMb}`)) {
      out.notices.push(replies.tooBigReply(check.needMb));
      if (out.action === 'silencio') out.action = 'foto-grande';
    }
    return;
  }

  // 2. Download it.
  let buffer;
  try {
    buffer = await incoming.download();
  } catch (err) {
    log.warn(`No pude descargar ${cosa}: ${err.message}`);
    return;
  }
  if (!buffer?.length) return;

  // 3. Hang it off the latest thing we know for that subject (to know when to delete it).
  const entry = kind ? memory.findLatestEntry({ kind, subjectKey, chatJid }) : null;
  const saved = media.saveImage({
    buffer,
    mime: incoming.mime || (esDocumento ? 'application/pdf' : 'image/jpeg'),
    fileName: incoming.fileName || null,
    caption: text || null,
    kind,
    subject,
    subjectKey,
    chatJid,
    msgId,
    author: senderName,
    authorJid: senderJid,
    expiresAt: media.computeExpiry({ fecha: entry?.fecha || null }),
    entryId: entry?.id ?? null
  });

  if (!saved.ok) {
    // The real size can be larger than the announced one.
    log.warn(`No pude guardar ${cosa}: ${saved.reason}`);
    if (saved.reason === 'no-space' && replyAllowed(chatJid, 'media:sin-espacio')) {
      out.notices.push(replies.noSpaceReply());
      if (out.action === 'silencio') out.action = 'sin-espacio';
    }
    return;
  }

  out.savedMedia = saved.media;
  // If someone was asking, the photo (with its caption) counts as the answer.
  if (pending) memory.resolveQuestion(pending.id);
  if (out.action === 'silencio') out.action = 'foto-guardada';
  if (config.ackSaves && replyAllowed(chatJid, `media-ack:${saved.media.id}`)) {
    out.notices.push(`📎 Guardada la foto${subject ? ` de ${subject}` : ''}.`);
  }
}

function buildReply(fast, entries) {
  if (fast.kind === 'examen') {
    return replies.examenesReply(entries, { subject: fast.subjectLabel });
  }
  return replies.deberesReply(entries, { subject: fast.subjectLabel });
}

/** Removes the first appearance of `frag` in `texto` (comparing without accents). */
function quitarFragmento(texto, frag) {
  if (!texto || !frag) return texto;
  const idx = fold(texto).indexOf(fold(frag));
  if (idx === -1) return texto;
  return texto.slice(0, idx) + ' ' + texto.slice(idx + frag.length);
}

/** Cleans the leftovers when the subject and the date are removed from the content. */
function limpiarContenido(s) {
  const SOLO_CONECTORES = /^(?:(?:para|antes de|antes del|de|del|el|la|los|las|que|entrega|entregar|sobre)\s*)+$/i;
  const recorta = (x) => x.replace(/^[\s:;,\-–—./]+/, '').replace(/[\s:;,\-–—./]+$/, '').trim();
  let c = recorta(String(s || '').replace(/\s+/g, ' '));
  if (SOLO_CONECTORES.test(c)) return '';
  for (let i = 0; i < 4; i++) {
    const antes = c;
    c = c.replace(/^(?:para|antes de|antes del|de|del|que|entrega|entregar|sobre)\s+/i, '');
    c = c.replace(/\s+(?:para|antes de|antes del|de|del|el|la|los|las|que|entrega|entregar|sobre)$/i, '');
    c = recorta(c);
    if (SOLO_CONECTORES.test(c)) return '';
    if (c === antes) break;
  }
  return c;
}

/**
 * Parses "!claw apunta <deberes|examen> <asignatura> <contenido> [para <fecha>]".
 * The subject and the date are detected inside the text; the rest is the content.
 */
function parseApunte(cola) {
  let rest = String(cola || '').trim();
  let kind = 'deberes';
  const mKind = rest.match(/^(deberes|deber|tareas?|examen|examenes|controles?)\b/i);
  if (mKind) {
    const w = sinAcentos(mKind[1].toLowerCase());
    kind = w.startsWith('examen') || w.startsWith('control') ? 'examen' : 'deberes';
    rest = rest.slice(mKind[0].length).trim();
  }
  const subj = detectSubject(rest);
  const dateInfo = extractDatePhrase(rest);

  let content = rest;
  if (dateInfo?.phrase) content = quitarFragmento(content, dateInfo.phrase);
  if (subj?.matched) content = quitarFragmento(content, subj.matched);
  content = limpiarContenido(content);

  return {
    kind,
    subject: subj?.label || null,
    content: content || null,
    fecha: dateInfo?.iso || null,
    fechaTexto: dateInfo?.phrase ? dateInfo.phrase.trim() : null
  };
}

async function handleClaw({ chatJid, senderName, text, mentionedBot, out }) {
  if (mentionedBot && !clawMatch(text)) {
    out.action = 'mencion';
    out.replies = [
      '🪝 ¿Me llamabas? Pregúntame lo que quieras, o escribe *Claw* + tu pregunta.'
    ];
    return out;
  }

  const question = clawQuestion(text);
  if (!question || question.length < 2) {
    out.action = 'claw-saludo';
    out.replies = [clawGreeting()];
    return out;
  }

  // If a position (FEN) is pasted, we analyse it like a grandmaster.
  if (config.chessEnabled) {
    const fen = ajedrez.extraeFen(question);
    if (fen) {
      out.action = 'claw-ajedrez';
      out.replies = [ajedrez.analiza(fen)];
      return out;
    }
  }

  // If the Claw question is about homework or exams and we already know it,
  // we answer with the database's own format (and without spending AI).
  const fast = fastRoute(question);
  if (fast) {
    const entries = memory.findPending({ kind: fast.kind, subjectKey: fast.subjectKey, chatJid });
    const stored = storedMedia(fast.kind, fast.subjectKey, chatJid);
    if (
      (entries.length || stored.length) &&
      replyAllowed(chatJid, `claw-fast:${fast.kind}:${fast.subjectKey || '*'}`, contentSignature(entries, stored))
    ) {
      out.action = 'claw-deberes';
      out.replies = [
        entries.length ? buildReply(fast, entries) : replies.mediaOnlyReply({ kind: fast.kind, subject: fast.subjectLabel })
      ];
      attachMedia(out, { rows: stored, kind: fast.kind, subject: fast.subjectLabel });
      return out;
    }
  }

  if (!clawAllowed(chatJid)) {
    out.action = 'claw-limitado';
    return out;
  }

  log.info(`Modo Claw de ${senderName}: "${question}"`);
  const history = clawHistory.get(chatJid) || [];
  const persona = config.chessEnabled && ajedrez.mencionaAjedrez(question) ? 'ajedrez' : 'normal';
  const answer = await clawAnswer({ question, history, persona, chatJid });

  history.push({ role: 'user', content: question });
  history.push({ role: 'assistant', content: answer });
  clawHistory.set(chatJid, history.slice(-12));

  out.action = 'claw';
  out.replies = [replies.firmaClaw(answer)];
  return out;
}

/** Used on startup so questions from before are not carried over. */
export function resetTransientState() {
  lastReplyAt.clear();
  lastReplySignature.clear();
  clawCalls.clear();
  clawHistory.clear();
  warnedUnbound.clear();
  memory.closeStaleQuestions(0);
}

export { todayISO };

// ---------------------------------------------------------------- commands

const COMANDO_RE = /^\s*[!./]\s*([a-zA-Z]+)\b\s*([\s\S]*)$/;

/** Lowercase and accent-free, to compare what people type. */
function sinAcentos(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Recognises "!claw ..." (or "!pickle ...", which still works). */
export function parseCommand(text) {
  const m = COMANDO_RE.exec(String(text || ''));
  if (!m) return null;
  const orden = sinAcentos(m[1]);
  if (!config.commandNames.includes(orden)) return null;
  return { orden, resto: (m[2] || '').trim() };
}

/** Finds a settings catalog key even when written with accents or capitals. */
function claveDeAjuste(texto) {
  const q = sinAcentos(texto);
  if (!q) return null;
  return Object.keys(ajustes.CATALOGO).find((k) => sinAcentos(k) === q) || null;
}

/**
 * Every "!claw ..." command: queries, settings and binding.
 * Returns `out` already filled in.
 */
async function handleCommand({ comando, input, out, listModels }) {
  const {
    chatJid,
    chatName = null,
    isGroup,
    senderJid = null,
    senderJidAlt = null,
    senderName = 'alguien',
    mentionedBot = false
  } = input;

  const palabras = comando.resto.split(/\s+/).filter(Boolean);
  const sub = sinAcentos(palabras[0] || '');
  const cola = comando.resto.slice(palabras[0]?.length || 0).trim();
  const esAdmin = admins.esAdmin(senderJid, senderJidAlt);
  const esDueno = admins.esDueno(senderJid, senderJidAlt);
  out.action = 'comando';

  // --- Status / help ---
  if (!sub || sub === 'ayuda' || sub === 'help' || sub === 'estado') {
    out.action = 'estado';
    out.replies = [
      replies.helpReply({
        boundGroup: boundGroupJid(),
        groupName: memory.getSetting('group_name'),
        model: config.ollamaModel,
        stats: memory.stats(chatJid)
      })
    ];
    // Settings are only shown in private: in the group everybody would read them.
    if (esAdmin && !isGroup) out.replies.push(ajustes.formato());
    else if (esAdmin && isGroup) {
      out.replies.push('⚙️ Tus ajustes los ves por privado: escríbeme _!claw ajustes_ en el chat contigo mismo.');
    }
    if (sub === 'ayuda' || sub === 'help') out.replies = [replies.ayudita()].concat(out.replies.slice(1));
    return out;
  }

  // --- Ollama chat model and going back to the primary model ---
  if (sub === 'ia' || sub === 'modelo') {
    if (!esAdmin) {
      out.replies = [replies.noPermitido()];
      return out;
    }

    const estado = await listModels();
    if (!estado?.ok) {
      out.replies = [`⚠️ No puedo consultar los modelos de Ollama: ${estado?.error || 'error desconocido'}`];
      return out;
    }

    const modelos = (estado.models || []).map((m) => (typeof m === 'string' ? m : m?.name)).filter(Boolean);
    if (!cola) {
      out.action = 'ia-modelo';
      out.replies = [
        `🧠 Modelo conversacional: *${config.ollamaModel}*\n` +
          `Principal: *${config.ollamaPrimaryModel}* · respaldo: *${config.ollamaFallbackModel}*\n` +
          `Instalados: ${modelos.length ? modelos.join(', ') : 'ninguno'}\n\n` +
          `Cambiar: _!claw ia <modelo instalado>_\n` +
          `Usar respaldo: _!claw ia fallback_\n` +
          `Volver al principal: _!claw ia principal_`
      ];
      return out;
    }

    const seleccion = sinAcentos(cola);
    const volverAlPrincipal = ['principal', 'default', 'por defecto'].includes(seleccion);
    const objetivo =
      ['fallback', 'respaldo', 'anterior'].includes(seleccion)
        ? config.ollamaFallbackModel
        : volverAlPrincipal
        ? config.ollamaPrimaryModel
        : cola;
    const encontrado =
      modelos.find((m) => m.toLowerCase() === objetivo.toLowerCase()) ||
      (!objetivo.includes(':')
        ? modelos.find((m) => m.toLowerCase().startsWith(`${objetivo.toLowerCase()}:`))
        : null);

    if (!encontrado) {
      out.action = 'ia-modelo-no-disponible';
      out.replies = [
        `⚠️ El modelo *${objetivo}* no está instalado en Ollama.\n` +
          `Instálalo localmente con _ollama pull ${objetivo}_ y vuelve a intentarlo.`
      ];
      return out;
    }

    if (volverAlPrincipal) ajustes.restaurarModeloPrincipal();
    else ajustes.usarModelo(encontrado);
    out.action = 'ia-modelo';
    out.replies = [
      `✅ Claw usará *${encontrado}* para conversar. ` +
        (encontrado === config.ollamaFallbackModel
          ? 'Para volver al modelo principal: _!claw ia principal_.'
          : `Para cambiar al respaldo: _!claw ia fallback_.`)
    ];
    log.info(`Modelo conversacional cambiado por ${senderName}: ${config.ollamaModel}`);
    return out;
  }

  // --- Linking / unlinking (several groups at once) ---
  if (sub === 'aqui') {
    if (!esAdmin) {
      out.replies = [replies.noPermitido()];
      return out;
    }
    if (!isGroup) {
      out.replies = ['📍 Escríbeme *!claw aqui* dentro del grupo al que quieras que me una.'];
      return out;
    }
    if (gruposFijos().length) {
      out.replies = ['🔒 Este bot está fijado a un grupo concreto desde la configuración.'];
      return out;
    }
    const yaEstaba = groupAllowed(chatJid);
    bindGroup(chatJid);
    const grupos = boundGroups();
    log.info(`Grupo ${yaEstaba ? 'actualizado' : 'vinculado'}: ${chatName || ''} (${chatJid}) — en total ${grupos.length}`);
    out.action = 'vinculado';
    out.replies = [
      `✅ Perfecto, me quedo aquí${chatName ? ` en *${chatName}*` : ''}.` +
        (grupos.length > 1 ? ` (Estoy en ${grupos.length} grupos.)` : '') +
        '\n\nIré apuntando los deberes y los exámenes que se digan. Solo hablaré si me preguntáis.'
    ];
    return out;
  }

  if (sub === 'fuera') {
    if (!esAdmin) {
      out.replies = [replies.noPermitido()];
      return out;
    }
    if (!isGroup) {
      out.replies = ['👋 Eso mejor desde dentro del grupo: escríbeme *!claw fuera* allí.'];
      return out;
    }
    if (!groupAllowed(chatJid)) {
      out.replies = ['🤔 No estoy vinculado a este grupo.'];
      return out;
    }
    if (gruposFijos().length) {
      out.replies = ['🔒 Este bot está fijado a un grupo desde la configuración del .env: no me puedo desvincular desde aquí.'];
      return out;
    }
    unbindGroup(chatJid);
    log.info(`Grupo desvinculado: ${chatName || ''} (${chatJid}) — quedan ${boundGroups().length}`);
    out.action = 'desvinculado';
    out.replies = ['👋 Vale, me quito de este grupo. No volveré a hablar ni a apuntar nada aquí.'];
    return out;
  }

  // --- Settings ---
  if (sub === 'ajustes' || sub === 'ajuste' || sub === 'config') {
    if (!esAdmin) {
      out.replies = [replies.noPermitido()];
      return out;
    }
    // "!claw ajustes" -> list
    if (!palabras[1]) {
      out.replies = [ajustes.formato()];
      return out;
    }
    // "!claw ajustes reset <clave>" -> back to the factory value
    if (sinAcentos(palabras[1]) === 'reset' || sinAcentos(palabras[1]) === 'reiniciar') {
      const clave = claveDeAjuste(palabras[2]);
      if (!clave) {
        out.replies = ['Dime qué ajuste reinicio: _!claw ajustes reset ventana_'];
        return out;
      }
      const r = ajustes.reset(clave);
      out.replies = [`↩️ *${clave}* vuelve a su valor de fábrica (*${ajustes.bonito(r.valor)}*).`];
      return out;
    }
    const clave = claveDeAjuste(palabras[1]);
    if (!clave) {
      out.replies = [`No conozco el ajuste *${palabras[1]}*. Mira la lista con *!claw ajustes*.`];
      return out;
    }
    const valor = palabras.slice(2).join(' ').trim();
    // No value: just say how it is.
    if (!valor) {
      out.replies = [
        `*${clave}* está en *${ajustes.bonito(ajustes.get(clave))}*\n_${ajustes.CATALOGO[clave].etiqueta}_`
      ];
      return out;
    }
    // Only the owner touches the administrator list.
    if (clave === 'admins' && !esDueno) {
      out.replies = ['🔒 Solo el dueño puede cambiar la lista de administradores.'];
      return out;
    }
    const r = ajustes.setDesdeTexto(clave, valor);
    out.replies = [r.ok ? `✅ *${clave}* ahora está en *${ajustes.bonito(r.valor)}*.` : `⚠️ ${r.error}`];
    if (r.ok) log.info(`Ajuste cambiado por ${senderName}: ${clave} = ${ajustes.bonito(r.valor)}`);
    return out;
  }

  // --- Bot language ---
  const IDIOMA = ['idioma', 'language', 'lang', 'llengua', 'langue', 'sprache', 'lingua', 'idiomas', 'languages'];
  if (IDIOMA.includes(sub)) {
    out.action = 'comando-idioma';
    if (!cola) {
      const actual = i18n.infoIdioma();
      const lineas = [
        i18n.t('languageListTitle'),
        '',
        i18n.t('languageCurrent', { name: actual.name }),
        '',
        ...i18n.SOPORTADOS.map((code) => {
          const info = i18n.infoIdioma(code);
          return i18n.t('languageListLine', { code, name: info.name });
        }),
        '',
        i18n.t('languageMore'),
        '',
        i18n.t('languageUsage')
      ];
      out.replies = [lineas.join('\n')];
      return out;
    }
    if (!esAdmin) {
      out.replies = [replies.noPermitido()];
      return out;
    }
    const codigo = i18n.normalizarIdioma(cola);
    if (!codigo) {
      out.replies = [i18n.t('languageUnknown')];
      return out;
    }
    i18n.guardarIdioma(codigo);
    log.info(`Idioma cambiado por ${senderName}: ${codigo}`);
    out.replies = [i18n.t('languageChanged', { name: i18n.infoIdioma(codigo).name })];
    return out;
  }

  // --- Administrators (shortcut for "!claw ajustes admins") ---
  if (sub === 'admins' || sub === 'admin') {
    if (!esAdmin) {
      out.replies = [replies.noPermitido()];
      return out;
    }
    if (!cola) {
      out.replies = [replies.adminsReply({ dueno: admins.duenoJid(), lista: admins.admins() })];
      return out;
    }
    if (!esDueno) {
      out.replies = ['🔒 Solo el dueño puede cambiar la lista de administradores.'];
      return out;
    }
    const r = ajustes.setDesdeTexto('admins', cola);
    out.replies = r.ok
      ? [`✅ Administradores: *${ajustes.bonito(r.valor)}*`]
      : [`⚠️ ${r.error}`];
    return out;
  }

  // --- Banned: forbid/allow someone to use Claw ---
  const PROHIBIR = ['prohibir', 'prohibe', 'veta', 'vetar', 'banea', 'banear', 'bloquea', 'bloquear'];
  const PERMITIR = ['permitir', 'permite', 'desvetar', 'desveta', 'desbloquear', 'desbloquea', 'desbanear'];
  if (PROHIBIR.includes(sub) || PERMITIR.includes(sub)) {
    if (!esAdmin) {
      out.replies = [replies.noPermitido()];
      return out;
    }
    const perdonar = PERMITIR.includes(sub);
    if (!cola) {
      out.action = 'comando-vetados';
      out.replies = [replies.vetadosReply({ lista: admins.vetados() })];
      return out;
    }
    const objetivo = listaDeJids(cola);
    if (!objetivo.length) {
      out.replies = [`Dime a quién: _!claw ${perdonar ? 'permitir' : 'prohibir'} +600111222_`];
      return out;
    }
    if (!perdonar && objetivo.some((j) => admins.esAdmin(j))) {
      out.replies = ['🔒 No puedo vetar al dueño ni a un administrador.'];
      return out;
    }
    let cambios = 0;
    for (const jid of objetivo) {
      if (perdonar ? admins.removeVetado(jid) : admins.addVetado(jid)) cambios += 1;
    }
    out.action = perdonar ? 'comando-permitir' : 'comando-prohibir';
    out.replies = [
      cambios
        ? `${perdonar ? '✅ Ya puede usar a Claw' : '🚫 Vetado (no podrá usar a Claw)'}.\n${replies.vetadosReply({ lista: admins.vetados() })}`
        : `ℹ️ No ha cambiado nada.\n${replies.vetadosReply({ lista: admins.vetados() })}`
    ];
    if (cambios) log.info(`${senderName} ${perdonar ? 'permitió' : 'prohibió'} el uso de Claw a: ${objetivo.join(', ')}`);
    return out;
  }

  // --- Show the banned list ---
  if (['vetados', 'prohibidos', 'bloqueados', 'veto'].includes(sub)) {
    if (!esAdmin) {
      out.replies = [replies.noPermitido()];
      return out;
    }
    out.action = 'comando-vetados';
    out.replies = [replies.vetadosReply({ lista: admins.vetados() })];
    return out;
  }

  // --- Maintenance mode (shortcut for "!claw ajustes mantenimiento") ---
  if (sub === 'mantenimiento' || sub === 'manten' || sub === 'parar' || sub === 'pausa') {
    if (!esAdmin) {
      out.replies = [replies.noPermitido()];
      return out;
    }
    if (!cola) {
      const activo = ajustes.get('mantenimiento');
      out.action = 'mantenimiento-estado';
      out.replies = [
        activo
          ? '🛠️ El *modo mantenimiento* está *activado*: no contesto ni apunto nada. Para quitarlo: _!claw mantenimiento no_'
          : '🛠️ El *modo mantenimiento* está *desactivado*. Activarlo: _!claw mantenimiento si_'
      ];
      return out;
    }
    const r = ajustes.setDesdeTexto('mantenimiento', cola);
    out.action = r.ok && r.valor ? 'mantenimiento-on' : 'mantenimiento-off';
    out.replies = [
      r.ok
        ? r.valor
          ? '🛠️ *Modo mantenimiento activado.* Me quedo callado y no apunto nada. Cuando quieras seguir, escribe _!claw mantenimiento no_.'
          : '✅ *Modo mantenimiento desactivado.* Ya vuelvo a estar disponible.'
        : `⚠️ ${r.error}`
    ];
    if (r.ok) log.info(`Modo mantenimiento ${r.valor ? 'ACTIVADO' : 'desactivado'} por ${senderName}`);
    return out;
  }

  // --- Show everything noted down (homework and exams) ---
  if (['apuntes', 'apunte', 'ver', 'guardado', 'memoria', 'todo'].includes(sub)) {
    const entries = memory.listEntries(100000, chatJid);
    out.action = 'comando-apuntes';
    out.replies = [replies.apuntesReply(entries)];
    return out;
  }

  // --- Swear counter ---
  if (['palabrotas', 'palabrota', 'tacos', 'taco', 'insultos', 'insulto', 'groserias', 'groserías', 'swear'].includes(sub)) {
    const sub2 = sinAcentos(palabras[1] || '');
    if (sub2 === 'reset' || sub2 === 'reiniciar' || sub2 === 'borrar' || sub2 === 'cero') {
      if (!esAdmin) {
        out.replies = [replies.noPermitido()];
        return out;
      }
      memory.resetSwears(chatJid);
      out.action = 'comando-palabrotas-reset';
      out.replies = ['🧼 Contador de palabrotas puesto a cero.'];
      return out;
    }
    out.action = 'comando-palabrotas';
    out.replies = [
      replies.palabrotasReply({
        ranking: memory.swearRanking(chatJid, 10),
        total: memory.swearTotal(chatJid),
        topWord: memory.swearTopWord(chatJid)
      })
    ];
    return out;
  }

  // --- Note down/edit a homework item or exam by hand (with its deadline) ---
  if (['apunta', 'apuntar', 'pon', 'poner', 'fija', 'fijar', 'anade', 'añade', 'edita', 'editar', 'modifica', 'modificar'].includes(sub)) {
    if (!esAdmin && !config.apuntaLibre) {
      out.replies = [replies.noPermitido()];
      return out;
    }
    out.action = 'comando-apunta';
    const parsed = parseApunte(cola);
    if (!parsed.subject) {
      out.replies = [replies.apuntaAyuda()];
      return out;
    }
    const saved = memory.upsertManual({
      kind: parsed.kind,
      subject: parsed.subject,
      content: parsed.content,
      fecha: parsed.fecha,
      fechaTexto: parsed.fechaTexto,
      chatJid
    });
    out.replies = [
      saved.entry ? replies.apunteManual(saved.entry, { creado: saved.status === 'creado' }) : replies.apuntaAyuda()
    ];
    if (saved.entry) log.info(`Apunte a mano (${saved.status}) por ${senderName}: ${parsed.kind} ${parsed.subject}`);
    return out;
  }

  // --- Homework and exam queries ---
  if (sub === 'deberes' || sub === 'deber' || sub === 'tareas') {
    const s = cola ? detectSubject(cola) : null;
    const entries = memory.findPending({ kind: 'deberes', subjectKey: s?.key || null, chatJid });
    out.action = 'comando-deberes';
    out.replies = [
      entries.length
        ? replies.deberesReply(entries, { subject: s?.label || null })
        : replies.nothingFound({ kind: 'deberes', subject: s?.label || null })
    ];
    attachMedia(out, { rows: storedMedia('deberes', s?.key, chatJid), kind: 'deberes', subject: s?.label });
    return out;
  }

  if (sub === 'examenes' || sub === 'examen' || sub === 'controles') {
    const s = cola ? detectSubject(cola) : null;
    const entries = memory.findPending({ kind: 'examen', subjectKey: s?.key || null, chatJid });
    out.action = 'comando-examenes';
    out.replies = [
      entries.length
        ? replies.examenesReply(entries, { subject: s?.label || null })
        : replies.nothingFound({ kind: 'examen', subject: s?.label || null })
    ];
    attachMedia(out, { rows: storedMedia('examen', s?.key, chatJid), kind: 'examen', subject: s?.label });
    return out;
  }

  if (sub === 'proximo' || sub === 'proxima' || sub === 'siguiente') {
    const entries = memory.findPending({ kind: 'examen', chatJid });
    out.action = 'comando-proximo';
    out.replies = [replies.proximoReply(entries)];
    if (entries.length) attachMedia(out, { rows: storedMedia('examen', entries[0].subjectKey, chatJid), kind: 'examen', subject: entries[0].subject });
    return out;
  }

  if (sub === 'calendario' || sub === 'agenda' || sub === 'ics' || sub === 'calendar') {
    const entries = memory.findPending({ kind: 'examen', chatJid });
    out.action = 'comando-calendario';
    if (!entries.length) {
      out.replies = [replies.nothingFound({ kind: 'examen' })];
      return out;
    }
    try {
      const { buildIcs } = await import('./ics.js');
      const ics = buildIcs(entries);
      const buf = Buffer.from(ics, 'utf-8');
      const tmp = path.join(config.dataDir, 'tmp');
      try { fs.mkdirSync(tmp, { recursive: true }); } catch {}
      const f = path.join(tmp, `calendario-examenes-${todayISO().replace(/-/g, '')}-${Date.now()}.ics`);
      fs.writeFileSync(f, buf);
      out.replies = ['📆 Aquí tienes el calendario de los próximos exámenes en formato .ics (se puede importar a Google, Outlook, etc.):'];
      out.media.push({ filePath: f, mime: 'text/calendar', caption: 'examenes.ics', kind: 'document', filename: 'examenes.ics' });
    } catch (err) {
      log.warn(`No pude generar el calendario: ${err.message}`);
      out.replies = ['Ups, no he podido generar el .ics de los exámenes.'];
    }
    return out;
  }

  // --- Delete a wrong entry ---
  if (sub === 'olvida' || sub === 'olvidar' || sub === 'borra') {
    if (!esAdmin) {
      out.replies = [replies.noPermitido()];
      return out;
    }
    if (!cola) {
      out.replies = ['Dime qué olvido: _!claw olvida historia_  ·  O todo: _!claw olvida todo_'];
      return out;
    }
    const todo = /^(todo|todos|todas|todo el grupo|everything)$/i.test(cola.trim());
    const n = todo ? memory.forgetAll(chatJid) : memory.forgetMatches(cola, chatJid);
    out.action = 'comando-olvida';
    out.replies = [todo ? replies.olvidaTodoOk(n) : n ? replies.olvidaOk(n) : replies.olvidaNada(cola)];
    if (n) log.info(`Apuntes borrados por ${senderName}: "${todo ? 'TODO' : cola}" (${n})`);
    return out;
  }

  // --- Mark homework or exams as done ---
  if (sub === 'hecho' || sub === 'hechos' || sub === 'entregado' || sub === 'terminado') {
    const pendientes = [
      ...memory.findPending({ kind: 'deberes', chatJid }),
      ...memory.findPending({ kind: 'examen', chatJid })
    ];
    if (!pendientes.length) {
      out.action = 'comando-hecho';
      out.replies = ['✅ No tengo nada pendiente: ¡está todo al día!'];
      return out;
    }
    if (!cola) {
      out.action = 'comando-hecho';
      out.replies = [replies.hechoAyuda(pendientes)];
      return out;
    }

    const normaliza = (s) => fold(String(s || ''));
    const busca = normaliza(cola);
    const subj = detectSubject(cola);
    const coinciden = pendientes.filter((e) => {
      if (subj && e.subject === subj.key) return true;
      return normaliza(e.content).includes(busca) || normaliza(e.subject).includes(busca);
    });

    out.action = 'comando-hecho';
    if (!coinciden.length) {
      out.replies = [replies.hechoNada(cola)];
      return out;
    }
    for (const e of coinciden) memory.deactivateEntry(e.id);
    out.replies = [replies.hechoOk(coinciden)];
    log.info(`${senderName} marcó como hecho "${cola}" (${coinciden.length})`);
    return out;
  }

  // --- Summary of what has been talked about ---
  if (sub === 'resumen' || sub === 'resumenes') {
    const dias = /hoy/.test(cola) ? 1 : /semana|7/.test(cola) ? 7 : 3;
    const texto = await resumenDeDias(chatJid, dias);
    out.action = 'comando-resumen';
    out.replies = [texto || '🤔 Aún no tengo suficiente de qué hablar para hacer un resumen.'];
    return out;
  }

  // --- What is new (bot changelog) ---
  if (sub === 'novedades' || sub === 'novedad' || sub === 'changelog') {
    out.action = 'comando-novedades';
    const texto = textoNovedades();
    out.replies = [texto || '📌 No hay novedades pendientes: ya te lo he contado todo.'];
    return out;
  }

  // --- Web search (DuckDuckGo) ---
  if (sub === 'busca' || sub === 'buscar' || sub === 'buscarweb' || sub === 'googlea' || sub === 'internet') {
    if (!config.webSearchEnabled) {
      out.action = 'comando-busca';
      out.replies = ['🔎 La búsqueda en internet está desactivada. Actívala con: _!claw ajustes buscar si_'];
      return out;
    }
    if (!cola) {
      out.action = 'comando-busca';
      out.replies = [
        '🔎 Dime qué busco. Ejemplo:\n_!claw busca quién ganó el partido del Real Madrid_\n_Claw, busca el tiempo que hará mañana en Murcia_'
      ];
      return out;
    }
    out.action = 'comando-busca';
    const resultados = await buscarWeb(cola, { max: 5 });
    if (!resultados.length) {
      out.replies = ['🔎 No he encontrado nada en internet (o ahora mismo no tengo conexión). Prueba a preguntármelo de otra forma.'];
      return out;
    }
    log.info(`Búsqueda en internet de ${senderName}: "${cola}" -> ${resultados.length} resultados`);
    const respuesta = await clawAnswer({ question: cola, history: [], persona: 'normal', chatJid, internet: resultados });
    const fuentes = resultados
      .map((r) => r.url)
      .filter(Boolean)
      .slice(0, 3);
    out.replies = [replies.firmaClaw(respuesta + (fuentes.length ? `\n\n🔗 Fuentes:\n${fuentes.join('\n')}` : ''))];
    return out;
  }

  // --- Generate an image (EXPERIMENTAL) ---
  // The ONLY place in the whole bot where an image is generated, and only if
  // someone types it by hand. An image is never generated just by talking about
  // it: the barrier is the "imagenes" setting (off from the factory), which only
  // the owner/admins can open.
  if (esPedidoDeImagen(sub)) {
    out.action = 'comando-imagen';
    if (!config.imageGenEnabled) {
      out.replies = [replies.imagenApagadaReply()];
      return out;
    }
    if (!cola) {
      out.replies = ['🎨 Dime qué dibujo. Ejemplo: _!claw imagen un pingüino con gafas de sol_'];
      return out;
    }
    // Drawing takes close to a minute: we announce it is going on so it does not
    // look hung (and it is removed at the end, no matter what).
    presence.escribiendo(chatJid, true);
    // Immediate notice without depending on whatsapp.js (the router does not
    // import it, to avoid a cycle): whatsapp.js leaves its way of sending here.
    if (!presence.avisarTexto(chatJid, '🎨 Generando, por favor espera...')) {
      log.debug('No pude mandar el aviso de generación (sin conexión).');
    }
    let r;
    try {
      r = await generarImagen(cola);
    } finally {
      presence.escribiendo(chatJid, false);
    }
    if (!r.ok || (!r.buffer && !r.filePath)) {
      // "Busy" is not a failure: it is drawing another one. Say it plainly.
      if (r.busy) {
        out.replies = [replies.imagenOcupadaReply()];
        return out;
      }
      // The full reason is left in the log (the group message only carries a
      // summary) so it can be diagnosed without relying on what is visible.
      log.warn(`No pude generar la imagen "${cola}": ${r.error}`);
      out.replies = [replies.imagenErrorReply(r.error)];
      return out;
    }
    const filePath = r.filePath || media.saveTempImage(r.buffer, r.mime);
    out.media.push(media.asOutgoing({ filePath, mime: r.mime }, `🎨 ${cola}`));
    log.info(`Imagen generada para ${senderName}: "${cola}" (${r.mime})`);
    return out;
  }

  // --- Chess mode: play, analyse and talk like a grandmaster ---
  if (sub === 'ajedrez' || sub === 'chess' || sub === 'ajedrez') {
    if (!config.chessEnabled) {
      out.action = 'comando-ajedrez';
      out.replies = ['♟ El modo ajedrez está desactivado. Actívalo con: _!claw ajustes ajedrez si_'];
      return out;
    }
    return manejaAjedrez({ chatJid, senderName, cola, out });
  }

  if (sub === 'analiza' || sub === 'analizar' || sub === 'fen') {
    if (!config.chessEnabled) {
      out.action = 'comando-ajedrez';
      out.replies = ['♟ El modo ajedrez está desactivado. Actívalo con: _!claw ajustes ajedrez si_'];
      return out;
    }
    const fen = ajedrez.extraeFen(cola) || (ajedrez.partida(chatJid) ? ajedrez.partida(chatJid).game.fen() : null);
    out.action = 'comando-ajedrez';
    out.replies = [
      fen
        ? ajedrez.analiza(fen)
        : 'Mándame una posición en formato FEN y la analizo. Ejemplo:\n_!claw analiza rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1_'
    ];
    return out;
  }

  // --- Anything else: it is a question for Claw ---
  return handleClaw({ chatJid, senderName, text: comando.resto, mentionedBot, out });
}

/** Everything chess mode does: start, move, resign and comment. */
async function manejaAjedrez({ chatJid, senderName, cola, out }) {
  const t = sinAcentos(cola);
  out.action = 'comando-ajedrez';

  // Start a game (or show the board when one is already running).
  const quiereNueva = ['', 'nueva', 'nuevo', 'nuevo', 'reset', 'reiniciar', 'empezar', 'jugar'].includes(t);
  const quiereNegras = ['negras', 'black', 'b', 'con negras'].includes(t);
  const quiereBlancas = ['blancas', 'white', 'w', 'con blancas'].includes(t);

  if (quiereNueva || quiereNegras || quiereBlancas) {
    const existente = ajedrez.partida(chatJid);
    if (quiereNueva && !quiereNegras && !quiereBlancas && existente && !existente.game.isGameOver()) {
      out.replies = [
        '♟ Hay una partida en marcha:',
        '',
        ajedrez.tableroTexto(existente.game),
        '',
        '▶️ Dime tu jugada: _!claw ajedrez e4_  ·  Para empezar de cero: _!claw ajedrez nueva_'
      ];
      return out;
    }
    const color = quiereNegras ? 'b' : 'w';
    ajedrez.empieza(chatJid, { colorUsuario: color });
    const estado = ajedrez.partida(chatJid);
    const lineas = [
      '♟ *¡Nueva partida!*',
      '',
      ajedrez.tableroTexto(estado.game),
      '',
      color === 'w'
        ? 'Juegas con *blancas*. ▶️ Dime tu jugada: _!claw ajedrez e4_'
        : 'Juegas con *negras*. Claw ya ha abierto; te toca.'
    ];
    out.replies = [lineas.join('\n')];
    return out;
  }

  if (['rendirse', 'rendir', 'tablas', 'fin', 'terminar', 'abandonar'].includes(t)) {
    const estado = ajedrez.partida(chatJid);
    if (!estado) {
      out.replies = ['No hay ninguna partida en marcha. Empieza con: _!claw ajedrez_'];
      return out;
    }
    ajedrez.borraPartida(chatJid);
    out.replies = ['🤝 Partida terminada. Cuando quieras, otra: _!claw ajedrez_'];
    return out;
  }

  if (['comentario', 'comenta', 'analiza', 'analizar'].includes(t.split(' ')[0])) {
    const comentario = await ajedrez.comentarioGM(chatJid);
    out.replies = [comentario ? replies.firmaClaw(comentario) : 'La partida todavía no tiene mucho que comentar. ¡A jugar!'];
    return out;
  }

  // Is it a move?
  if (ajedrez.esJugada(cola)) {
    let estado = ajedrez.partida(chatJid);
    if (!estado) {
      ajedrez.empieza(chatJid, { colorUsuario: 'w' });
      estado = ajedrez.partida(chatJid);
    }
    if (estado.game.isGameOver()) {
      out.replies = [`La partida ya terminó. Otra con: _!claw ajedrez nueva_`];
      return out;
    }
    if (estado.game.turn() !== estado.colorUsuario) {
      out.replies = ['⏳ Espera, que le toca a Claw. Empieza de nuevo si algo no cuadra: _!claw ajedrez nueva_'];
      return out;
    }
    const r = ajedrez.mueve(chatJid, cola);
    if (!r.ok) {
      out.replies = [
        r.error === 'jugada-ilegal'
          ? '🤨 Esa jugada no es legal. Mírate el tablero y prueba otra.'
          : 'No he podido hacer esa jugada. Dime algo como: _!claw ajedrez e4_'
      ];
      return out;
    }
    const partes = [r.texto];
    // If it is not over, Claw replies.
    if (!r.gameOver) {
      const bot = await ajedrez.jugadaDelBot(chatJid);
      if (bot.ok) partes.push('', bot.texto);
    }
    out.replies = [partes.join('\n')];
    return out;
  }

  // If it is not a move: we talk about chess like a grandmaster (or analyse a FEN).
  const fen = ajedrez.extraeFen(cola);
  if (fen) {
    out.replies = [ajedrez.analiza(fen)];
    return out;
  }
  if (!cola) {
    out.replies = ['♟ Dime si quieres jugar (_!claw ajedrez_), analizar una posición o preguntarme algo de ajedrez.'];
    return out;
  }
  const history = clawHistory.get(chatJid) || [];
  const answer = await clawAnswer({ question: cola, history, persona: 'ajedrez', chatJid });
  history.push({ role: 'user', content: cola });
  history.push({ role: 'assistant', content: answer });
  clawHistory.set(chatJid, history.slice(-12));
  out.replies = [replies.firmaClaw(answer)];
  return out;
}
