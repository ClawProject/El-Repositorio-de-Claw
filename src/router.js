// El router decide que hacer con cada mensaje del grupo:
//   - ignorarlo (lo normal)
//   - guardar deberes/examenes que alguien menciona
//   - responder cuando alguien pregunta
//   - activar el modo Claw como asistente general
//
// Es independiente de WhatsApp: recibe texto y devuelve las respuestas a enviar.
// Asi el simulador (npm run sim) usa exactamente la misma logica que el bot real.
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
import { sameGroupName } from './groups.js';
import { contarPalabrotas } from './swears.js';
import { transcribeFile } from './transcribe.js';
import { clawAnswer, clawGreeting } from './claw.js';
import { buscarWeb } from './search.js';
import { generarImagen, esPedidoDeImagen } from './imagegen.js';
import * as presence from './presence.js';
import { textoNovedades } from './changelog.js';
import * as ajedrez from './chess.js';
import * as replies from './replies.js';
import { ping as ollamaPing } from './ollama.js';

// ---------------------------------------------------------------- estado

const lastReplyAt = new Map(); // clave -> timestamp
const lastReplySignature = new Map(); // clave -> firma de los datos enviados
const clawCalls = new Map(); // chatJid -> [timestamps]
const clawHistory = new Map(); // chatJid -> [{role, content}]
const lastSwearAlertAt = new Map(); // chatJid -> timestamp del último aviso de palabrotas
const botMessageIds = new Set();
const warnedUnbound = new Set(); // grupos ajenos de los que ya avisamos en el log

export function rememberBotMessage(msgId) {
  if (!msgId) return;
  botMessageIds.add(msgId);
  if (botMessageIds.size > 1000) {
    for (const id of [...botMessageIds].slice(0, 500)) botMessageIds.delete(id);
  }
}

/** Firma del contenido enviado: si cambia, merece la pena volver a responder. */
function entriesSignature(entries) {
  return entries.map((e) => `${e.id}:${e.updatedAt || e.createdAt}`).join('|');
}

function replyAllowed(chatJid, key, signature = null) {
  const composite = `${chatJid}::${key}`;
  const now = Date.now();
  const last = lastReplyAt.get(composite) ?? 0;
  const previous = lastReplySignature.get(composite);
  // Si los datos han cambiado desde la ultima vez, respondemos aunque sea pronto.
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

// ---------------------------------------------------------------- vinculacion

export { sameGroupName };

/**
 * Grupos a los que está asignado el bot.
 *  - Si el .env fija grupos (WHATSAPP_GROUP_JID), esos son los únicos.
 *  - Si no, se van guardando con "!claw aqui" (y se quitan con "!claw fuera").
 */
export function boundGroups() {
  const fijos = (config.groupJids || []).filter(Boolean);
  if (fijos.length) return fijos.map((jid) => ({ jid, name: config.groupNames?.[0] || null }));

  const raw = memory.getSetting('group_jids');
  let guardados = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) guardados = parsed.filter((g) => g && g.jid);
    } catch {
      /* formato antiguo: lo ignoramos y abajo miramos group_jid */
    }
  }
  // Compatibilidad con la base de datos de cuando solo había un grupo.
  if (!guardados.length) {
    const uno = memory.getSetting('group_jid');
    if (uno) guardados = [{ jid: uno, name: memory.getSetting('group_name') || null }];
  }

  const vistos = new Set();
  const lista = [];
  for (const g of guardados) {
    if (vistos.has(g.jid)) continue;
    vistos.add(g.jid);
    lista.push({ jid: g.jid, name: g.name || null });
  }
  return lista;
}

export function boundGroupJid() {
  return boundGroups()[0]?.jid || null;
}

export function boundGroupJids() {
  return boundGroups().map((g) => g.jid);
}

/** ¿Este chat está en la lista de grupos asignados? */
export function groupAllowed(chatJid) {
  if (!chatJid) return false;
  return boundGroups().some((g) => g.jid === chatJid);
}

/** ¿Este nombre es alguno de los grupos que he puesto en la configuración? */
export function nombreDeGrupoConfigurado(chatName) {
  const nombres = config.groupNames?.length ? config.groupNames : config.groupName ? [config.groupName] : [];
  return nombres.some((n) => sameGroupName(chatName, n));
}

/** El primer nombre de grupo configurado (para mensajes). */
function primerNombreConfigurado() {
  return config.groupNames?.[0] || config.groupName || null;
}

/** ¿Tengo los grupos fijados desde el .env (no se pueden cambiar de WhatsApp)? */
export function gruposFijos() {
  return (config.groupJids || []).filter(Boolean);
}

/** Añade un grupo a la lista (si el .env no lo tiene fijado). */
export function bindGroup(chatJid, name) {
  const fijos = gruposFijos();
  if (fijos.length) return fijos.map((jid) => ({ jid, name: config.groupNames?.[0] || null }));
  const lista = boundGroups();
  const existente = lista.find((g) => g.jid === chatJid);
  if (existente) {
    if (name && existente.name !== name) existente.name = name;
    else return lista;
  } else {
    lista.push({ jid: chatJid, name: name || null });
  }
  guardarGrupos(lista);
  return lista;
}

/** Quita un grupo de la lista (no se puede si el .env lo fija). */
export function unbindGroup(chatJid) {
  if (gruposFijos().length) return boundGroups();
  const lista = boundGroups().filter((g) => g.jid !== chatJid);
  guardarGrupos(lista);
  return lista;
}

function guardarGrupos(lista) {
  memory.setSetting('group_jids', JSON.stringify(lista));
  // El primer grupo sigue "a mano" por si algún código espera group_jid.
  memory.setSetting('group_jid', lista[0]?.jid || null);
  memory.setSetting('group_name', lista[0]?.name || null);
}

// ---------------------------------------------------------------- principal

/** ¿Puede esta persona escribirle por privado, según el ajuste "privado"? */
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

  // Dónde se guardan y se leen los deberes y los exámenes. En el grupo, el propio
  // grupo. En un mensaje privado (directo o el chat contigo mismo) es el grupo
  // asignado: así puedes dejar deberes/exámenes por privado y preguntar por ellos,
  // y quedan apuntados en el grupo. Si no hay ningún grupo, se usa el chat privado.
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
  if (msgId && botMessageIds.has(msgId)) return out; // es un mensaje nuestro

  // --- Comandos: "!claw ..." (y "!pickle ...", que sigue funcionando) ---
  const comando = parseCommand(text);

  // --- Modo mantenimiento ---
  // El bot se queda mudo: no contesta, no apunta nada y no reenvia archivos.
  // Solo dejamos pasar los comandos de un administrador, para poder quitarlo.
  if (config.maintenance && !(comando && admins.esAdmin(senderJid, senderJidAlt))) {
    out.action = 'mantenimiento';
    return out;
  }

  // Mensajes privados (DM): quién puede escribirle lo decide el ajuste
  // "privado" (por defecto, solo el dueño). El chat propio del dueño siempre vale.
  // Va antes de los comandos para que un desconocido no pueda usar "!claw ..." por privado.
  if (!isGroup && !esChatPropio && !puedeEscribirPrivado(senderJid, senderJidAlt)) {
    log.debug(`Mensaje privado ignorado (ajuste "privado" = ${config.privateMode}): ${senderName}`);
    return out;
  }

  // --- Vetados: no pueden usar a Claw (ni comandos, ni hablarle; tampoco se aprende de ellos) ---
  if (admins.esVetado(senderJid, senderJidAlt)) {
    out.action = 'vetado';
    log.debug(`Mensaje de ${senderName} ignorado (está vetado).`);
    return out;
  }

  if (comando) return await handleCommand({ comando, input: { ...input, chatJid }, out, listModels });

  // Comodidad: si en la configuracion hay un nombre de grupo, se vincula solo
  // al verlo, sin que nadie tenga que escribir "!pickle aqui". Acepta varios
  // nombres (separados por comas en el .env), así que sirve para varios grupos.
  if (isGroup && chatName && !groupAllowed(chatJid) && nombreDeGrupoConfigurado(chatName)) {
    bindGroup(chatJid, chatName);
    log.info(`Grupo vinculado automáticamente por su nombre: "${chatName}" (${chatJid})`);
    // Si al arrancar no pude presentarme (todavia no sabia el grupo), me presento ahora.
    // Va en "notices" porque una respuesta normal reemplaza a replies y se perderia.
    if (config.welcomeEnabled && (config.welcomeAlways || !memory.getSetting('welcome_sent'))) {
      const cuerpo = replies.welcomeText(config.welcomeMessage);
      out.notices.push(cuerpo);
      memory.setSetting('welcome_sent', new Date().toISOString());
      log.info(`Mensaje de bienvenida enviado a "${chatName}".`);
    }
  }

  // A partir de aqui solo actuamos en los grupos asignados.
  if (isGroup && !groupAllowed(chatJid)) {
    if (!warnedUnbound.has(chatJid)) {
      warnedUnbound.add(chatJid);
      const fijos = gruposFijos();
      const esperando = primerNombreConfigurado();
      if (fijos.length) {
        log.info(
          `Este bot está fijado desde el .env a ${fijos.length} grupo(s) y no responde en "${chatName || chatJid}".`
        );
      } else if (esperando) {
        log.info(
          `Estoy puesto para el grupo "${esperando}", y este se llama "${chatName || chatJid}". ` +
            'Si te has equivocado de nombre, cámbialo en el .env (WHATSAPP_GROUP_NAME).'
        );
      } else {
        log.info(
          `Mensaje en grupo no asignado "${chatName || chatJid}". Para activarme ahí, escribe: !claw aqui`
        );
      }
    }
    return out;
  }

  // --- 0. Archivos y notas de voz ---
  if (incoming?.kind === 'audio') {
    const transcript = await handleIncomingAudio({ incoming, chatJid, senderName, out, transcribe });
    if (transcript) text = transcript;
    if (!text) return out;
  } else if (incoming?.kind === 'image' || incoming?.kind === 'document') {
    await handleIncomingImage({ incoming, chatJid, senderName, senderJid, msgId, out, text });
    // El pie de un archivo normalmente lo describe ("esto entra en el examen..."):
    // solo seguimos si de verdad es una pregunta o si le hablan a Claw.
    if (!text) return out;
    if (!isQuestion(text) && !clawMatch(text)) return out;
  }

  if (!text) return out;
  memory.logMessage({ chatJid: convJid, msgId, author: senderName, authorJid: senderJid, text });

  // Contador de palabrotas: las cuenta para el ranking de "!claw palabrotas" y,
  // si toca, saca el ranking en el momento (con un margen para no spamear).
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

  // --- 1. Modo Claw ---
  if (clawMatch(text) || (mentionedBot && !looksRelevant(text))) {
    return handleClaw({ chatJid, senderName, text, mentionedBot, out });
  }

  // En privado lo tratamos como si fuera el grupo: si dices un deber o un examen,
  // se apunta en el grupo; si preguntas por ellos, te contesto con lo del grupo.
  // Para charlar con Claw de cualquier cosa, escribe "claw ...". En el chat contigo
  // mismo (tu panel del dueño), lo que no va de deberes/exámenes son tus notas: ahí
  // me callo.
  if (!isGroup && esChatPropio && !looksRelevant(text)) return out;

  // --- 2. Ruta rapida: pregunta tipica de deberes/examen ---
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
    // No sabemos nada todavia: abrimos la pregunta y lo confirma la IA abajo.
  }

  // --- 3. Analisis con IA ---
  const pending = memory.getPendingQuestion(chatJid, config.answerWindowMinutes);
  const recent = memory.recentMessages(convJid, config.contextMessages);
  const relevant = looksRelevant(text) || Boolean(pending) || Boolean(fast);
  if (!relevant) {
    // En privado, lo que no va de deberes/exámenes es una charla con Claw.
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
    // Si venía con una foto o un PDF, el pie solo lo describe ("esto entra en...").
    // No lo apuntamos como dato suelto: el archivo ya está guardado y enlazado.
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
      // Por defecto NO confirmamos: el bot solo habla si le preguntan.
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
  // En privado, cualquier cosa que no sea un dato ni una pregunta de deberes o
  // exámenes es una conversación normal con Claw.
  if (!isGroup && !esChatPropio) {
    return handleClaw({ chatJid, senderName, text, mentionedBot, out });
  }
  return out;
}

// ---------------------------------------------------------------- archivos

/** Firma del contenido enviado (texto + archivos): si cambia, volvemos a responder. */
function contentSignature(entries, stored) {
  return `${entriesSignature(entries)}|${(stored || []).map((m) => m.id).join(',')}`;
}

function storedMedia(kind, subjectKey, chatJid = null) {
  if (!config.mediaEnabled || config.mediaMode === 'nada') return [];
  return memory.listMedia({ kind, subjectKey, limit: config.mediaSendMax, chatJid });
}

/** Engancha los archivos guardados a la respuesta que se va a enviar. */
function attachMedia(out, { rows, kind, subject }) {
  if (!config.mediaEnabled || !rows?.length) return;
  const caption = replies.mediaCaption({ kind, subject, count: rows.length });
  for (const m of rows) out.media.push(media.asOutgoing(m, caption));
}

/** Notas de voz: las escuchamos y seguimos como si fueran texto. */
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
    // En modo contexto también escuchamos para detectar el trigger hablado,
    // pero seguimos descartando las notas sin pregunta abierta que no lo digan.
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

/** Fotos y documentos: solo los guardamos si van de deberes/examenes, y solo si caben en el disco. */
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

  // 1. ¿Cabe en el disco? Si no, avisamos (nos lo ha pedido el usuario).
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

  // 2. La descargamos.
  let buffer;
  try {
    buffer = await incoming.download();
  } catch (err) {
    log.warn(`No pude descargar ${cosa}: ${err.message}`);
    return;
  }
  if (!buffer?.length) return;

  // 3. La colgamos de lo ultimo que sepamos de esa asignatura (para saber cuando borrarla).
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
    // El tamaño real puede ser mayor que el anunciado.
    log.warn(`No pude guardar ${cosa}: ${saved.reason}`);
    if (saved.reason === 'no-space' && replyAllowed(chatJid, 'media:sin-espacio')) {
      out.notices.push(replies.noSpaceReply());
      if (out.action === 'silencio') out.action = 'sin-espacio';
    }
    return;
  }

  out.savedMedia = saved.media;
  // Si alguien estaba preguntando, la foto (con su pie) vale como respuesta.
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

/** Quita la primera aparición de `frag` en `texto` (comparando sin acentos). */
function quitarFragmento(texto, frag) {
  if (!texto || !frag) return texto;
  const idx = fold(texto).indexOf(fold(frag));
  if (idx === -1) return texto;
  return texto.slice(0, idx) + ' ' + texto.slice(idx + frag.length);
}

/** Limpia coletillas que quedan al quitar la asignatura y la fecha del contenido. */
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
 * Interpreta "!claw apunta <deberes|examen> <asignatura> <contenido> [para <fecha>]".
 * La asignatura y la fecha se detectan dentro del texto; el resto es el contenido.
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

  // Si pegan una posición (FEN), la analizamos como gran maestro.
  if (config.chessEnabled) {
    const fen = ajedrez.extraeFen(question);
    if (fen) {
      out.action = 'claw-ajedrez';
      out.replies = [ajedrez.analiza(fen)];
      return out;
    }
  }

  // Si la pregunta de Claw va de deberes o examenes y ya lo sabemos,
  // contestamos con el formato bueno de la base de datos (y sin gastar IA).
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

/** Se usa al arrancar para no arrastrar preguntas de antes. */
export function resetTransientState() {
  lastReplyAt.clear();
  lastReplySignature.clear();
  clawCalls.clear();
  clawHistory.clear();
  warnedUnbound.clear();
  memory.closeStaleQuestions(0);
}

export { todayISO };

// ---------------------------------------------------------------- comandos

const COMANDO_RE = /^\s*[!./]\s*([a-zA-Z]+)\b\s*([\s\S]*)$/;

/** Minúsculas y sin acentos, para comparar lo que escribe la gente. */
function sinAcentos(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Reconoce "!claw ..." (o "!pickle ...", que sigue funcionando). */
export function parseCommand(text) {
  const m = COMANDO_RE.exec(String(text || ''));
  if (!m) return null;
  const orden = sinAcentos(m[1]);
  if (!config.commandNames.includes(orden)) return null;
  return { orden, resto: (m[2] || '').trim() };
}

/** Busca una clave del catálogo de ajustes aunque se escriba con acentos o mayúsculas. */
function claveDeAjuste(texto) {
  const q = sinAcentos(texto);
  if (!q) return null;
  return Object.keys(ajustes.CATALOGO).find((k) => sinAcentos(k) === q) || null;
}

/**
 * Todos los comandos "!claw ...": consultas, ajustes y vinculación.
 * Devuelve el `out` ya relleno.
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

  // --- Estado / ayuda ---
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
    // Los ajustes se enseñan solo en privado: en el grupo los leería todo el mundo.
    if (esAdmin && !isGroup) out.replies.push(ajustes.formato());
    else if (esAdmin && isGroup) {
      out.replies.push('⚙️ Tus ajustes los ves por privado: escríbeme _!claw ajustes_ en el chat contigo mismo.');
    }
    if (sub === 'ayuda' || sub === 'help') out.replies = [replies.ayudita()].concat(out.replies.slice(1));
    return out;
  }

  // --- Modelo conversacional de Ollama y retorno al modelo principal ---
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

  // --- Vincularse / desvincularse (varios grupos a la vez) ---
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
    const nombres = config.groupNames?.length ? config.groupNames : config.groupName ? [config.groupName] : [];
    if (nombres.length && !nombreDeGrupoConfigurado(chatName)) {
      out.replies = [`🔒 Estoy puesto para *${nombres.join(' / ')}*, no para este. No me vinculo aquí.`];
      return out;
    }
    const yaEstaba = groupAllowed(chatJid);
    bindGroup(chatJid, chatName || null);
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

  // --- Ajustes ---
  if (sub === 'ajustes' || sub === 'ajuste' || sub === 'config') {
    if (!esAdmin) {
      out.replies = [replies.noPermitido()];
      return out;
    }
    // "!claw ajustes" -> lista
    if (!palabras[1]) {
      out.replies = [ajustes.formato()];
      return out;
    }
    // "!claw ajustes reset <clave>" -> volver al valor de fábrica
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
    // Sin valor: solo decir cómo está.
    if (!valor) {
      out.replies = [
        `*${clave}* está en *${ajustes.bonito(ajustes.get(clave))}*\n_${ajustes.CATALOGO[clave].etiqueta}_`
      ];
      return out;
    }
    // La lista de administradores solo la toca el dueño.
    if (clave === 'admins' && !esDueno) {
      out.replies = ['🔒 Solo el dueño puede cambiar la lista de administradores.'];
      return out;
    }
    const r = ajustes.setDesdeTexto(clave, valor);
    out.replies = [r.ok ? `✅ *${clave}* ahora está en *${ajustes.bonito(r.valor)}*.` : `⚠️ ${r.error}`];
    if (r.ok) log.info(`Ajuste cambiado por ${senderName}: ${clave} = ${ajustes.bonito(r.valor)}`);
    return out;
  }

  // --- Administradores (atajo de "!claw ajustes admins") ---
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

  // --- Vetados: prohibir/permitir que alguien use a Claw ---
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

  // --- Ver la lista de vetados ---
  if (['vetados', 'prohibidos', 'bloqueados', 'veto'].includes(sub)) {
    if (!esAdmin) {
      out.replies = [replies.noPermitido()];
      return out;
    }
    out.action = 'comando-vetados';
    out.replies = [replies.vetadosReply({ lista: admins.vetados() })];
    return out;
  }

  // --- Modo mantenimiento (atajo de "!claw ajustes mantenimiento") ---
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

  // --- Ver todo lo apuntado (deberes y exámenes) ---
  if (['apuntes', 'apunte', 'ver', 'guardado', 'memoria', 'todo'].includes(sub)) {
    const entries = memory.listEntries(100000, chatJid);
    out.action = 'comando-apuntes';
    out.replies = [replies.apuntesReply(entries)];
    return out;
  }

  // --- Contador de palabrotas ---
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

  // --- Apuntar/editar a mano un deber o examen (con su fecha límite) ---
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

  // --- Consultas de deberes y exámenes ---
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

  // --- Borrar un apunte equivocado ---
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

  // --- Marcar deberes o exámenes como hechos ---
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

  // --- Resumen de lo que se ha hablado ---
  if (sub === 'resumen' || sub === 'resumenes') {
    const dias = /hoy/.test(cola) ? 1 : /semana|7/.test(cola) ? 7 : 3;
    const texto = await resumenDeDias(chatJid, dias);
    out.action = 'comando-resumen';
    out.replies = [texto || '🤔 Aún no tengo suficiente de qué hablar para hacer un resumen.'];
    return out;
  }

  // --- Qué hay de nuevo (novedades del bot) ---
  if (sub === 'novedades' || sub === 'novedad' || sub === 'changelog') {
    out.action = 'comando-novedades';
    const texto = textoNovedades();
    out.replies = [texto || '📌 No hay novedades pendientes: ya te lo he contado todo.'];
    return out;
  }

  // --- Buscar en internet (DuckDuckGo) ---
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

  // --- Generar una imagen (EXPERIMENTAL) ---
  // ÚNICO sitio de todo el bot donde se genera una imagen, y solo si alguien lo
  // escribe a mano. Nunca se genera una imagen por hablar de ella: la barrera es
  // el ajuste "imagenes" (apagado de fábrica), que solo el dueño/admins puede abrir.
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
    // Dibujar tarda cerca de un minuto: avisamos de que estamos en ello para
    // que no parezca que se ha colgado (y lo quitamos al acabar, pase lo que pase).
    presence.escribiendo(chatJid, true);
    // Aviso inmediato sin depender de whatsapp.js (el router no lo importa para
    // no crear un ciclo): whatsapp.js deja aquí su forma de mandar mensajes.
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
      // "Ocupado" no es un fallo: está dibujando otra. Se le dice claro.
      if (r.busy) {
        out.replies = [replies.imagenOcupadaReply()];
        return out;
      }
      // Dejamos el motivo completo en el log (el mensaje del grupo solo lleva un
      // resumen) para poder diagnosticar sin depender de lo que se vea.
      log.warn(`No pude generar la imagen "${cola}": ${r.error}`);
      out.replies = [replies.imagenErrorReply(r.error)];
      return out;
    }
    const filePath = r.filePath || media.saveTempImage(r.buffer, r.mime);
    out.media.push(media.asOutgoing({ filePath, mime: r.mime }, `🎨 ${cola}`));
    log.info(`Imagen generada para ${senderName}: "${cola}" (${r.mime})`);
    return out;
  }

  // --- Modo ajedrez: jugar, analizar y hablar como un gran maestro ---
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

  // --- Cualquier otra cosa: es una pregunta para Claw ---
  return handleClaw({ chatJid, senderName, text: comando.resto, mentionedBot, out });
}

/** Todo lo del modo ajedrez: empezar, mover, rendirse y comentar. */
async function manejaAjedrez({ chatJid, senderName, cola, out }) {
  const t = sinAcentos(cola);
  out.action = 'comando-ajedrez';

  // Empezar partida (o enseñar el tablero si ya hay una).
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

  // ¿Es una jugada?
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
    // Si no ha terminado, contesta Claw.
    if (!r.gameOver) {
      const bot = await ajedrez.jugadaDelBot(chatJid);
      if (bot.ok) partes.push('', bot.texto);
    }
    out.replies = [partes.join('\n')];
    return out;
  }

  // Si no es jugada: hablamos de ajedrez como un gran maestro (o analizamos un FEN).
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
