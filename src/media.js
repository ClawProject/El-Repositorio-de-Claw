// Gestion de los archivos (sobre todo fotos) que el bot se guarda.
//
// Reglas del juego:
//   - Antes de descargar nada se comprueba el espacio libre del disco.
//   - Si no hay sitio, no se guarda y se avisa con un mensaje simpatico.
//   - Pasado el periodo (fecha del examen + margen) se borra TODO: el archivo
//     y el apunte. Asi el disco no se llena nunca.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { log } from './logger.js';
import * as memory from './memory.js';
import { nowStamp, todayISO, addDays, isValidISO } from './dates.js';

const MB = 1024 * 1024;

export const EXTS = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip',
  'text/plain': 'txt'
};

export function extensionFor(mime, fallback = 'bin') {
  return EXTS[String(mime || '').toLowerCase().split(';')[0].trim()] || fallback;
}

export function mediaDir() {
  return config.mediaDir;
}

function tempDir() {
  return path.join(config.dataDir, 'tmp');
}

export function ensureDirs() {
  fs.mkdirSync(mediaDir(), { recursive: true });
  fs.mkdirSync(tempDir(), { recursive: true });
}

// ---------------------------------------------------------------- espacio

/** Espacio libre (en bytes) del disco donde vive la carpeta de archivos. */
export function freeBytes() {
  try {
    ensureDirs();
    const st = fs.statfsSync(mediaDir());
    const free = Number(st.bavail) * Number(st.bsize);
    return Number.isFinite(free) ? free : null;
  } catch (err) {
    log.debug('No puedo mirar el espacio libre:', err.message);
    return null;
  }
}

export function spaceInfo() {
  const free = freeBytes();
  return {
    freeBytes: free,
    freeMb: free === null ? null : Math.round(free / MB),
    keepMb: config.mediaMinFreeMb,
    capMb: config.mediaMaxTotalMb
  };
}

/**
 * ¿Cabe un archivo de `bytes` sin quedarnos sin disco?
 * @returns {{ok:boolean, reason?:'too-big'|'no-space', freeMb:number|null, needMb:number, keepMb:number}}
 */
export function canStore(bytes) {
  const needMb = Math.ceil((Number(bytes) || 0) / MB);
  const info = { needMb, keepMb: config.mediaMinFreeMb, freeMb: null };
  if (needMb > config.mediaMaxMb) return { ok: false, reason: 'too-big', ...info };
  const free = freeBytes();
  if (free === null) return { ok: true, ...info }; // no podemos medirlo: no bloqueamos
  info.freeMb = Math.round(free / MB);
  if (free - (Number(bytes) || 0) < config.mediaMinFreeMb * MB) {
    return { ok: false, reason: 'no-space', ...info };
  }
  return { ok: true, ...info };
}

// ---------------------------------------------------------------- escribir

function subfolderFor(dateISO) {
  return dateISO.slice(0, 7); // 2026-10
}

function newFileName(ext, when = todayISO()) {
  const stamp = nowStamp().replace(/[-: ]/g, '').slice(0, 14); // 20261014 232015
  const rand = crypto.randomBytes(3).toString('hex');
  return path.join(subfolderFor(when), `${stamp}-${rand}.${ext}`);
}

/**
 * Guarda una imagen. Comprueba el espacio antes de escribir nada.
 * @returns {{ok:true, media:object} | {ok:false, reason:string, needMb?:number, freeMb?:number|null}}
 */
export function saveImage({ buffer, mime, fileName, caption, kind, subject, subjectKey, chatJid, msgId, author, authorJid, expiresAt, entryId }) {
  const size = buffer?.length || 0;
  const check = canStore(size);
  if (!check.ok) return { ok: false, reason: check.reason, needMb: check.needMb, freeMb: check.freeMb };

  ensureDirs();
  const rel = newFileName(extensionFor(mime, 'jpg'));
  const full = path.join(mediaDir(), rel);
  try {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, buffer);
  } catch (err) {
    log.error('No pude escribir el archivo en disco:', err.message);
    return { ok: false, reason: 'write-error' };
  }

  const media = memory.addMedia({
    chatJid,
    msgId,
    entryId: entryId ?? null,
    kind: kind || null,
    subject: subject || null,
    subjectKey: subjectKey || null,
    filePath: full,
    fileName: fileName || null,
    mime: mime || null,
    size,
    caption: caption || null,
    author: author || null,
    authorJid: authorJid || null,
    expiresAt: expiresAt || computeExpiry({})
  });

  log.info(
    `Guardado archivo #${media.id} (${(size / 1024).toFixed(0)} KB)${kind ? ` para ${kind}${subject ? ` de ${subject}` : ''}` : ''}` +
      `${media.expiresAt ? ` · se borra el ${media.expiresAt.slice(0, 10)}` : ''}`
  );
  return { ok: true, media };
}

/** Guarda un audio temporal (para transcribirlo); luego se borra. */
export function saveTempAudio(buffer, mime) {
  ensureDirs();
  const name = `voice-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${extensionFor(mime, 'ogg')}`;
  const full = path.join(tempDir(), name);
  fs.writeFileSync(full, buffer);
  return full;
}

/** Ruta libre dentro de la carpeta temporal, para que otro programa escriba ahí. */
export function tempFilePath(prefix = 'tmp', ext = 'bin') {
  ensureDirs();
  const name = `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
  return path.join(tempDir(), name);
}

/** Guarda una imagen generada por IA (se envía ya y luego la limpia cleanup). */
export function saveTempImage(buffer, mime) {
  ensureDirs();
  const name = `gen-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${extensionFor(mime, 'png')}`;
  const full = path.join(tempDir(), name);
  fs.writeFileSync(full, buffer);
  return full;
}

export function removeFile(file) {
  if (!file) return 0;
  try {
    const size = fs.statSync(file).size;
    fs.rmSync(file, { force: true });
    return size;
  } catch {
    return 0;
  }
}

/** Cuando hay que borrar un archivo: tambien quitamos su apunte. */
export function deleteMedia(media) {
  removeFile(media.filePath);
  memory.deleteMediaRow(media.id);
}

// ---------------------------------------------------------------- caducidad

/**
 * Cuando hay que borrar un archivo:
 *   - si sabemos la fecha (un examen), se guarda hasta unos dias despues;
 *   - si no, unos dias desde que llego.
 */
export function computeExpiry({ fecha = null } = {}) {
  if (fecha && isValidISO(fecha)) {
    return `${addDays(fecha, config.cleanupExamGraceDays)} 23:59:59`;
  }
  return nowStamp(new Date(Date.now() + config.mediaRetentionDays * 86400000));
}

function listFiles(dir = mediaDir()) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isFile()) out.push(path.join(entry.parentPath || dir, entry.name));
  }
  return out;
}

export function dirStats() {
  const files = listFiles();
  let bytes = 0;
  for (const f of files) {
    try {
      bytes += fs.statSync(f).size;
    } catch {
      /* ignorar */
    }
  }
  return { files: files.length, bytes, mb: Math.round(bytes / MB) };
}

export function fileSize(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------- limpieza

/**
 * Limpieza: borra archivos caducados, huerfanos, aplica el tope total y
 * olvida los examenes/deberes que ya pasaron.
 */
export function cleanup() {
  ensureDirs();
  const result = { expired: 0, orphans: 0, capped: 0, entries: 0, freedBytes: 0 };

  // 1. Archivos caducados.
  for (const m of memory.expiredMedia()) {
    result.freedBytes += removeFile(m.filePath);
    memory.deleteMediaRow(m.id);
    result.expired += 1;
  }

  // 2. Archivos sin apunte (huerfanos).
  const known = new Set(memory.allMedia().map((m) => path.resolve(m.filePath)));
  for (const file of listFiles()) {
    if (!known.has(path.resolve(file))) {
      result.freedBytes += removeFile(file);
      result.orphans += 1;
    }
  }

  // 3. Tope total de la carpeta (borra lo mas antiguo primero).
  const cap = config.mediaMaxTotalMb * MB;
  const rows = memory.allMedia().map((m) => ({ ...m, size: fileSize(m.filePath) }));
  let total = rows.reduce((a, r) => a + r.size, 0);
  if (total > cap) {
    log.warn(`La carpeta de archivos ocupa ${Math.round(total / MB)} MB (tope ${config.mediaMaxTotalMb} MB). Borro lo mas antiguo.`);
    for (const row of rows) {
      if (total <= cap) break;
      removeFile(row.filePath);
      memory.deleteMediaRow(row.id);
      total -= row.size;
      result.capped += 1;
    }
  }

  // 4. Olvidar lo que ya paso de fecha.
  if (config.cleanupRemoveEntries) {
    const before = addDays(todayISO(), -config.cleanupExamGraceDays);
    const stale = addDays(todayISO(), -config.mediaRetentionDays);
    const purged = memory.purgeOld(before, stale);
    result.entries = purged.entradas;
    for (const p of purged.archivos) result.freedBytes += removeFile(p);
  }

  // 5. Restos de transcripciones.
  for (const file of listFiles(tempDir())) {
    if (Date.now() - fileMtime(file) > 6 * 3600000) result.freedBytes += removeFile(file);
  }

  return result;
}

function fileMtime(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return Date.now();
  }
}

/** Borra TODOS los archivos y sus apuntes (comando /borrar del simulador). */
export function wipeAll() {
  const paths = memory.wipeMedia();
  let freed = 0;
  for (const p of paths) freed += removeFile(p);
  // Restos sueltos.
  for (const file of listFiles()) freed += removeFile(file);
  for (const file of listFiles(tempDir())) removeFile(file);
  return { files: paths.length, freedBytes: freed };
}

/** Prepara un archivo guardado para enviarlo por WhatsApp (foto o documento). */
export function asOutgoing(media, caption = null) {
  const mime = media.mime || 'image/jpeg';
  const esDocumento = !mime.startsWith('image/');
  if (esDocumento) {
    return {
      filePath: media.filePath,
      mime,
      caption,
      kind: 'document',
      filename: media.fileName || defaultDocName(media.filePath, mime)
    };
  }
  return { filePath: media.filePath, mime, caption, kind: 'image' };
}

/** Nombre de reserva para un documento guardado, si no sabemos el original. */
function defaultDocName(filePath, mime) {
  const base = path.basename(filePath || 'documento');
  return base || `documento.${extensionFor(mime, 'pdf')}`;
}

export function summarizeCleanup(result) {
  const parts = [];
  if (result.expired) parts.push(`${result.expired} caducados`);
  if (result.orphans) parts.push(`${result.orphans} sueltos`);
  if (result.capped) parts.push(`${result.capped} por espacio`);
  if (result.entries) parts.push(`${result.entries} apuntes olvidados`);
  return parts.length ? parts.join(', ') : 'nada que borrar';
}
