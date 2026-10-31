// Almacenamiento en SQLite usando node:sqlite (incluido en Node 22.5+).
// Guarda deberes, examenes, preguntas abiertas y un pequeno historial de mensajes.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { log } from './logger.js';
import { todayISO, addDays, nowStamp, isValidISO, longDate, daysBetween, parseSpanishDate } from './dates.js';
import { subjectKey, canonicalSubject } from './subjects.js';

let db = null;

async function loadDatabaseSync() {
  try {
    const mod = await import('node:sqlite');
    return mod.DatabaseSync;
  } catch {
    throw new Error(
      'Esta version de Node no incluye "node:sqlite". Necesitas Node 22.5 o superior (recomendado Node 24 LTS).'
    );
  }
}

export async function init(customPath) {
  if (db) return db;
  const DatabaseSync = await loadDatabaseSync();
  const file = customPath || config.dbPath;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL CHECK (kind IN ('deberes','examen')),
      subject TEXT,
      subject_key TEXT,
      content TEXT NOT NULL,
      fecha TEXT,
      fecha_texto TEXT,
      raw_text TEXT,
      author TEXT,
      author_jid TEXT,
      msg_id TEXT,
      chat_jid TEXT,
      confidence REAL,
      active INTEGER NOT NULL DEFAULT 1,
      superseded_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_jid TEXT NOT NULL,
      kind TEXT NOT NULL,
      subject TEXT,
      subject_key TEXT,
      asked_by TEXT,
      msg_id TEXT,
      asked_at TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS students (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      surname TEXT,
      course TEXT,
      group_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_jid TEXT,
      msg_id TEXT UNIQUE,
      author TEXT,
      author_jid TEXT,
      text TEXT,
      ts TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_jid TEXT,
      msg_id TEXT,
      entry_id INTEGER,
      kind TEXT,
      subject TEXT,
      subject_key TEXT,
      file_path TEXT NOT NULL,
      file_name TEXT,
      mime TEXT,
      size INTEGER,
      caption TEXT,
      author TEXT,
      author_jid TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS swears (
      chat_jid TEXT NOT NULL,
      author_key TEXT NOT NULL,
      author TEXT,
      word TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (chat_jid, author_key, word)
    );

    CREATE INDEX IF NOT EXISTS idx_entries_pending
      ON entries(kind, active, subject_key, fecha);
    CREATE INDEX IF NOT EXISTS idx_questions_open
      ON questions(chat_jid, resolved, asked_at);
    CREATE INDEX IF NOT EXISTS idx_messages_chat
      ON messages(chat_jid, id);
    CREATE INDEX IF NOT EXISTS idx_media_lookup
      ON media(kind, subject_key, chat_jid);
    CREATE INDEX IF NOT EXISTS idx_media_expiry
      ON media(expires_at);
    CREATE INDEX IF NOT EXISTS idx_swears_chat
      ON swears(chat_jid);
  `);
  migrate(db);
  pruneMessages();
  return db;
}

/** Arreglos para bases de datos que ya existian antes de un cambio. */
function migrate(db) {
  const cols = (tabla) => db.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name);
  try {
    if (!cols('media').includes('file_name')) {
      db.exec('ALTER TABLE media ADD COLUMN file_name TEXT');
    }
  } catch (err) {
    log.debug('Migración de la base de datos (ignorada):', err.message);
  }
}

function handle() {
  if (!db) throw new Error('La base de datos no esta inicializada. Llama antes a memory.init().');
  return db;
}

// ---------------------------------------------------------------- ajustes

export function getSetting(key, fallback = null) {
  const row = handle().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  handle()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value == null ? null : String(value));
}

// ---------------------------------------------------------------- estudiantes

/** Normaliza el correo de un estudiante. */
function studentEmail(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Guarda (o actualiza) los datos de registro de un estudiante.
 * El correo institucional es la clave: si vuelve a registrarse, se actualiza.
 */
export function saveStudent({ email, name, surname = '', course = '', group = '', lastLoginAt = null } = {}) {
  const clave = studentEmail(email);
  if (!clave) throw new Error('El correo del estudiante es obligatorio.');
  const ahora = nowStamp();
  const anterior = getStudent(clave);
  handle()
    .prepare(`
      INSERT INTO students (email, name, surname, course, group_name, created_at, updated_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        name = excluded.name,
        surname = excluded.surname,
        course = excluded.course,
        group_name = excluded.group_name,
        updated_at = excluded.updated_at,
        last_login_at = COALESCE(excluded.last_login_at, students.last_login_at)
    `)
    .run(
      clave,
      String(name || anterior?.name || '').trim(),
      String(surname || anterior?.surname || '').trim(),
      String(course || anterior?.course || '').trim(),
      String(group || anterior?.group || '').trim(),
      anterior?.createdAt || ahora,
      ahora,
      lastLoginAt
    );
  return getStudent(clave);
}

/** Datos de un estudiante por correo, o null si no está registrado. */
export function getStudent(email) {
  const row = handle().prepare('SELECT * FROM students WHERE email = ?').get(studentEmail(email));
  if (!row) return null;
  return {
    email: row.email,
    name: row.name,
    surname: row.surname || '',
    course: row.course || '',
    group: row.group_name || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at
  };
}

/** Todos los estudiantes registrados (para el panel de administración). */
export function listStudents(limit = 500) {
  return handle()
    .prepare('SELECT * FROM students ORDER BY updated_at DESC LIMIT ?')
    .all(Math.max(1, Math.min(5000, Number(limit) || 500)))
    .map((row) => ({
      email: row.email,
      name: row.name,
      surname: row.surname || '',
      course: row.course || '',
      group: row.group_name || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at
    }));
}

/** Marca la última entrada de un estudiante (sin tocar el resto del perfil). */
export function touchStudentLogin(email) {
  const clave = studentEmail(email);
  if (!clave) return null;
  handle()
    .prepare('UPDATE students SET last_login_at = ?, updated_at = ? WHERE email = ?')
    .run(nowStamp(), nowStamp(), clave);
  return getStudent(clave);
}

/** Borra el registro de un estudiante. Devuelve true si existía. */
export function deleteStudent(email) {
  const clave = studentEmail(email);
  if (!clave) return false;
  const result = handle().prepare('DELETE FROM students WHERE email = ?').run(clave);
  return Number(result.changes) > 0;
}

// ---------------------------------------------------------------- entradas

function rowToEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    subject: row.subject,
    subjectKey: row.subject_key,
    content: row.content,
    fecha: row.fecha,
    fechaTexto: row.fecha_texto,
    rawText: row.raw_text,
    author: row.author,
    confidence: row.confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Guarda un deber o un examen.
 * Devuelve { status, entry, replaced } donde status es:
 *   'nuevo' | 'duplicado' | 'actualizado' | 'reemplaza'
 */
export function saveEntry(input) {
  const database = handle();
  const now = nowStamp();
  const kind = input.kind === 'examen' ? 'examen' : 'deberes';
  const subject = canonicalSubject(input.subject) || (input.subject ? String(input.subject).trim() : null);
  const sKey = subject ? subjectKey(subject) : '';
  const fecha = isValidISO(input.fecha) ? input.fecha : null;
  let content = String(input.content || '').trim();

  // Cada grupo tiene sus propios deberes: filtramos por chat si nos lo dicen.
  const chatJid = input.chatJid || null;
  const chatWhere = chatJid ? ' AND (chat_jid IS NULL OR chat_jid = ?)' : '';
  const chatArg = chatJid ? [chatJid] : [];

  // Un examen del que solo sabemos la fecha sigue siendo util: lo guardamos.
  if (!content) {
    if (kind === 'examen' && (fecha || input.fechaTexto)) content = 'Examen';
    else return { status: 'ignorado', entry: null, replaced: [] };
  }

  const replaced = [];

  // Un examen "vacío" (sin fecha y sin contenido propio) no debe borrar lo que
  // ya sabíamos de esa asignatura: casi siempre es un "hay examen" repetido.
  const vagueExam =
    kind === 'examen' && !fecha && !input.fechaTexto && (!content || content === 'Examen');
  if (vagueExam && sKey) {
    const existing = database
      .prepare(`SELECT id FROM entries WHERE kind = 'examen' AND active = 1 AND subject_key = ?${chatWhere} LIMIT 1`)
      .get(sKey, ...chatArg);
    if (existing) return { status: 'ignorado', entry: null, replaced: [] };
  }

  // Un examen nuevo de la misma asignatura invalida los anteriores de esa asignatura.
  if (kind === 'examen' && sKey) {
    const previous = database
      .prepare(
        `SELECT * FROM entries WHERE kind = ? AND active = 1 AND subject_key = ? AND (fecha IS NOT ? OR content IS NOT ?)${chatWhere}`
      )
      .all('examen', sKey, fecha, content, ...chatArg);
    for (const old of previous) {
      replaced.push(rowToEntry(old));
    }
  }
  if (kind === 'deberes' && input.correction && sKey) {
    const previous = database
      .prepare(
        `SELECT * FROM entries WHERE kind = ? AND active = 1 AND subject_key = ? AND (fecha IS NOT ? OR content IS NOT ?)${chatWhere}`
      )
      .all('deberes', sKey, fecha, content, ...chatArg);
    for (const old of previous) {
      replaced.push(rowToEntry(old));
    }
  }

  const existing = database
    .prepare(
      `SELECT * FROM entries
       WHERE kind = ? AND active = 1
         AND IFNULL(subject_key,'') = ?
         AND content = ?
         AND IFNULL(fecha,'') = ?${chatWhere}`
    )
    .get(kind, sKey, content, fecha || '', ...chatArg);

  if (existing) {
    database
      .prepare('UPDATE entries SET updated_at = ?, confidence = MAX(IFNULL(confidence,0), ?) WHERE id = ?')
      .run(now, Number(input.confidence ?? 0), existing.id);
    return { status: 'duplicado', entry: rowToEntry({ ...existing, updated_at: now }), replaced: [] };
  }

  const info = database
    .prepare(
      `INSERT INTO entries
        (kind, subject, subject_key, content, fecha, fecha_texto, raw_text, author, author_jid, msg_id, chat_jid, confidence, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .run(
      kind,
      subject,
      sKey,
      content,
      fecha,
      input.fechaTexto || null,
      input.rawText || null,
      input.author || null,
      input.authorJid || null,
      input.msgId || null,
      input.chatJid || null,
      Number(input.confidence ?? 0),
      now,
      now
    );

  const newId = Number(info.lastInsertRowid);

  for (const old of replaced) {
    database
      .prepare('UPDATE entries SET active = 0, superseded_by = ?, updated_at = ? WHERE id = ?')
      .run(newId, now, old.id);
  }

  const entry = rowToEntry(database.prepare('SELECT * FROM entries WHERE id = ?').get(newId));
  if (replaced.length) {
    log.info(`Entrada ${newId} reemplaza a ${replaced.map((r) => r.id).join(', ')} (misma asignatura)`);
    return { status: 'reemplaza', entry, replaced };
  }
  return { status: 'nuevo', entry, replaced: [] };
}

/**
 * Crea o modifica a mano el apunte de una asignatura (para "!claw apunta...").
 * Si ya hay uno de esa asignatura, lo actualiza (solo los campos que le pasen);
 * si no, crea uno nuevo. Sirve para corregir deberes/exámenes y poner la fecha
 * límite a mano.
 * @returns {{status:'actualizado'|'creado'|'nada', entry:object|null}}
 */
export function upsertManual({ kind = 'deberes', subject = null, content = null, fecha = null, fechaTexto = null, chatJid = null }) {
  const database = handle();
  const k = kind === 'examen' ? 'examen' : 'deberes';
  const canonical = canonicalSubject(subject) || (subject ? String(subject).trim() : null);
  const sKey = canonical ? subjectKey(canonical) : '';
  const chatWhere = chatJid ? ' AND (chat_jid IS NULL OR chat_jid = ?)' : '';
  const chatArg = chatJid ? [chatJid] : [];

  const existing = database
    .prepare(`SELECT * FROM entries WHERE kind = ? AND active = 1 AND subject_key = ?${chatWhere} ORDER BY updated_at DESC LIMIT 1`)
    .get(k, sKey, ...chatArg);

  const nuevoContenido = String(content || '').trim();

  if (existing) {
    const finalContent = nuevoContenido || existing.content;
    const finalFecha = fecha != null ? fecha : existing.fecha;
    const finalFechaTexto = fechaTexto != null ? fechaTexto : existing.fecha_texto;
    database
      .prepare('UPDATE entries SET subject = ?, content = ?, fecha = ?, fecha_texto = ?, updated_at = ? WHERE id = ?')
      .run(canonical || existing.subject, finalContent, finalFecha, finalFechaTexto, nowStamp(), existing.id);
    return { status: 'actualizado', entry: rowToEntry(database.prepare('SELECT * FROM entries WHERE id = ?').get(existing.id)) };
  }

  // Sin apunte previo: para un examen basta con la fecha; para deberes hace falta texto.
  if (!nuevoContenido && !(k === 'examen' && (fecha || fechaTexto))) {
    return { status: 'nada', entry: null };
  }

  const saved = saveEntry({
    kind: k,
    subject: canonical,
    content: nuevoContenido,
    fecha,
    fechaTexto,
    chatJid,
    confidence: 1
  });
  return { status: saved.entry ? 'creado' : 'nada', entry: saved.entry };
}

/**
 * Entradas que siguen "vigentes": con fecha futura o sin fecha y recientes.
 * @param {{kind: 'deberes'|'examen', subjectKey?: string|null, chatJid?: string|null}} options
 */
export function findPending({ kind, subjectKey: sKey = null, chatJid = null }) {
  const today = todayISO();
  const freshLimit = addDays(today, -7);
  const params = [kind, freshLimit.slice(0, 10), today];
  let sql = `
    SELECT * FROM entries
    WHERE active = 1 AND kind = ?
      AND ( (fecha IS NULL AND substr(created_at,1,10) >= ?) OR (fecha IS NOT NULL AND fecha >= ?) )`;
  if (chatJid) {
    sql += ' AND (chat_jid IS NULL OR chat_jid = ?)';
    params.push(chatJid);
  }
  if (sKey) {
    sql += ' AND subject_key = ?';
    params.push(sKey);
  }
  sql += ' ORDER BY (fecha IS NULL), fecha ASC, created_at ASC';
  return handle().prepare(sql).all(...params).map(rowToEntry);
}

/** Ultimo examen pasado de una asignatura (por si preguntan por uno que ya paso). */
export function findLastExam(sKey = null, chatJid = null) {
  const today = todayISO();
  const params = ['examen', today];
  let sql = 'SELECT * FROM entries WHERE active = 1 AND kind = ? AND fecha IS NOT NULL AND fecha < ?';
  if (chatJid) {
    sql += ' AND (chat_jid IS NULL OR chat_jid = ?)';
    params.push(chatJid);
  }
  if (sKey) {
    sql += ' AND subject_key = ?';
    params.push(sKey);
  }
  sql += ' ORDER BY fecha DESC LIMIT 3';
  return handle().prepare(sql).all(...params).map(rowToEntry);
}

export function listEntries(limit = 100, chatJid = null) {
  let sql = 'SELECT * FROM entries WHERE active = 1';
  const params = [];
  if (chatJid) {
    sql += ' AND (chat_jid IS NULL OR chat_jid = ?)';
    params.push(chatJid);
  }
  sql += ' ORDER BY kind, (fecha IS NULL), fecha, created_at';
  return handle().prepare(sql).all(...params).slice(0, limit).map(rowToEntry);
}

export function deactivateEntry(id) {
  handle().prepare('UPDATE entries SET active = 0, updated_at = ? WHERE id = ?').run(nowStamp(), id);
}

/**
 * Desactiva los apuntes que coincidan con un texto (para "!claw olvida ...").
 * Compara sin acentos y sin mayúsculas, contra la asignatura y el contenido.
 * @returns {number} cuántos ha borrado
 */
export function forgetMatches(texto, chatJid = null) {
  const limpia = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const q = limpia(texto).trim();
  if (!q) return 0;
  let n = 0;
  for (const e of listEntries(100, chatJid)) {
    const heno = limpia(`${e.subject || ''} ${e.content || ''}`);
    if (heno.includes(q)) {
      deactivateEntry(e.id);
      n++;
    }
  }
  return n;
}

export function wipeEntries() {
  handle().exec('DELETE FROM entries; DELETE FROM questions;');
}

/**
 * Desactiva TODOS los apuntes de un grupo (para "!claw olvida todo").
 * A diferencia de wipeEntries(), respeta los otros grupos y no borra el historial.
 * @returns {number} cuántos ha borrado
 */
export function forgetAll(chatJid = null) {
  const rows = listEntries(100000, chatJid);
  for (const e of rows) deactivateEntry(e.id);
  return rows.length;
}

// ---------------------------------------------------------------- archivos

function rowToMedia(row) {
  if (!row) return null;
  return {
    id: row.id,
    chatJid: row.chat_jid,
    msgId: row.msg_id,
    entryId: row.entry_id,
    kind: row.kind,
    subject: row.subject,
    subjectKey: row.subject_key,
    filePath: row.file_path,
    fileName: row.file_name,
    mime: row.mime,
    size: row.size,
    caption: row.caption,
    author: row.author,
    expiresAt: row.expires_at,
    createdAt: row.created_at
  };
}

/** Apunta un archivo guardado en el disco. */
export function addMedia(input) {
  const now = nowStamp();
  const info = handle()
    .prepare(
      `INSERT INTO media
        (chat_jid, msg_id, entry_id, kind, subject, subject_key, file_path, file_name, mime, size, caption, author, author_jid, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.chatJid || null,
      input.msgId || null,
      input.entryId ?? null,
      input.kind || null,
      input.subject || null,
      input.subjectKey || null,
      input.filePath,
      input.fileName || null,
      input.mime || null,
      input.size ?? null,
      input.caption || null,
      input.author || null,
      input.authorJid || null,
      input.expiresAt || null,
      now
    );
  return rowToMedia(handle().prepare('SELECT * FROM media WHERE id = ?').get(Number(info.lastInsertRowid)));
}

/** Archivos vigentes de una asignatura (los que se pueden reenviar). */
export function listMedia({ kind = null, subjectKey = null, chatJid = null, limit = 10 } = {}) {
  const now = nowStamp();
  const params = [now];
  let sql = 'SELECT * FROM media WHERE (expires_at IS NULL OR expires_at > ?)';
  if (kind) {
    sql += ' AND kind = ?';
    params.push(kind);
  }
  if (subjectKey) {
    sql += ' AND subject_key = ?';
    params.push(subjectKey);
  } else {
    sql += ' AND (subject_key IS NULL OR subject_key = \'\')';
  }
  if (chatJid) {
    sql += ' AND chat_jid = ?';
    params.push(chatJid);
  }
  sql += ' ORDER BY created_at ASC, id ASC LIMIT ?';
  params.push(limit);
  return handle().prepare(sql).all(...params).map(rowToMedia);
}

export function allMedia() {
  return handle().prepare('SELECT * FROM media ORDER BY created_at ASC, id ASC').all().map(rowToMedia);
}

/** Archivos que ya han caducado y hay que borrar. */
export function expiredMedia(now = nowStamp()) {
  return handle()
    .prepare('SELECT * FROM media WHERE expires_at IS NOT NULL AND expires_at <= ?')
    .all(now)
    .map(rowToMedia);
}

export function deleteMediaRow(id) {
  handle().prepare('DELETE FROM media WHERE id = ?').run(id);
}

/** Borra los apuntes de archivos y devuelve las rutas para borrar del disco. */
export function wipeMedia() {
  const paths = allMedia().map((m) => m.filePath);
  handle().exec('DELETE FROM media;');
  return paths;
}

/**
 * Borra lo que ya no sirve: entradas con fecha pasada (con margen) y
 * entradas sin fecha demasiado antiguas.
 * @returns {{entradas:number, archivos:string[]}}
 */
export function purgeOld(beforeISO, staleISO) {
  const database = handle();
  const timed = database.prepare('SELECT id FROM entries WHERE fecha IS NOT NULL AND fecha < ?').all(beforeISO);
  const undated = database
    .prepare('SELECT id FROM entries WHERE fecha IS NULL AND substr(created_at,1,10) < ?')
    .all(staleISO);
  const ids = [...timed, ...undated].map((r) => r.id);
  if (!ids.length) return { entradas: 0, archivos: [] };

  const placeholders = ids.map(() => '?').join(', ');
  const linked = database
    .prepare(`SELECT id, file_path FROM media WHERE entry_id IN (${placeholders})`)
    .all(...ids);
  for (const row of linked) deleteMediaRow(row.id);

  database.prepare(`DELETE FROM entries WHERE id IN (${placeholders})`).run(...ids);
  return { entradas: ids.length, archivos: linked.map((r) => r.file_path) };
}

// ---------------------------------------------------------------- preguntas

export function openQuestion({ chatJid, kind, subject, askedBy, msgId }) {
  const database = handle();
  const sKey = subject ? subjectKey(canonicalSubject(subject) || subject) : '';
  // No dupliques la misma pregunta si ya hay una reciente sin resolver.
  const cutoff = new Date(Date.now() - config.answerWindowMinutes * 60000).toISOString();
  const open = database
    .prepare(
      `SELECT * FROM questions
       WHERE chat_jid = ? AND kind = ? AND IFNULL(subject_key,'') = ? AND resolved = 0`
    )
    .all(chatJid, kind, sKey);
  for (const q of open) {
    if (rowToQuestion(q).askedAtISO >= cutoff) return rowToQuestion(q);
  }
  const info = database
    .prepare(
      `INSERT INTO questions (chat_jid, kind, subject, subject_key, asked_by, msg_id, asked_at, resolved)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .run(chatJid, kind, subject || null, sKey, askedBy || null, msgId || null, new Date().toISOString());
  return rowToQuestion(database.prepare('SELECT * FROM questions WHERE id = ?').get(Number(info.lastInsertRowid)));
}

function rowToQuestion(row) {
  if (!row) return null;
  return {
    id: row.id,
    chatJid: row.chat_jid,
    kind: row.kind,
    subject: row.subject,
    subjectKey: row.subject_key,
    askedBy: row.asked_by,
    askedAtISO: row.asked_at,
    resolved: row.resolved
  };
}

/** Ultima pregunta sin resolver dentro de la ventana de tiempo. */
export function getPendingQuestion(chatJid, minutes = config.answerWindowMinutes) {
  const cutoff = new Date(Date.now() - minutes * 60000).toISOString();
  const row = handle()
    .prepare(
      `SELECT * FROM questions
       WHERE chat_jid = ? AND resolved = 0 AND asked_at >= ?
       ORDER BY asked_at DESC LIMIT 1`
    )
    .get(chatJid, cutoff);
  return rowToQuestion(row);
}

export function resolveQuestion(id) {
  handle()
    .prepare('UPDATE questions SET resolved = 1, resolved_at = ? WHERE id = ?')
    .run(new Date().toISOString(), id);
}

/** Marca como resueltas las preguntas viejas para no arrastrarlas. */
export function closeStaleQuestions(minutes = config.answerWindowMinutes) {
  const cutoff = new Date(Date.now() - minutes * 60000).toISOString();
  handle()
    .prepare('UPDATE questions SET resolved = 1, resolved_at = ? WHERE resolved = 0 AND asked_at < ?')
    .run(new Date().toISOString(), cutoff);
}

// ---------------------------------------------------------------- historial

export function logMessage({ chatJid, msgId, author, authorJid, text }) {
  if (!text || !config.storeMessages) return;
  try {
    handle()
      .prepare(
        'INSERT OR IGNORE INTO messages (chat_jid, msg_id, author, author_jid, text, ts) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(chatJid || null, msgId || null, author || null, authorJid || null, text, new Date().toISOString());
  } catch (err) {
    log.debug('No se pudo guardar el mensaje en el historial:', err.message);
  }
}

export function recentMessages(chatJid, limit = config.contextMessages) {
  const rows = handle()
    .prepare('SELECT author, text FROM messages WHERE chat_jid = ? ORDER BY id DESC LIMIT ?')
    .all(chatJid, limit);
  return rows.reverse().map((r) => ({ author: r.author, text: r.text }));
}

/** Mensajes de un chat desde una fecha (para los resúmenes). */
export function messagesSince(chatJid, sinceISO, limit = config.summaryMaxMessages) {
  const rows = handle()
    .prepare('SELECT author, text, ts FROM messages WHERE chat_jid = ? AND ts >= ? ORDER BY id ASC LIMIT ?')
    .all(chatJid, sinceISO, limit);
  return rows.map((r) => ({ author: r.author, text: r.text, ts: r.ts }));
}

function pruneMessages(days = config.storeMessagesDays) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  handle().prepare('DELETE FROM messages WHERE ts < ?').run(cutoff);
}

// ---------------------------------------------------------------- palabrotas

/**
 * Suma las palabrotas de un mensaje a la cuenta del grupo.
 * @param {{chatJid:string, authorKey:string, author?:string, byWord:Record<string,number>}} input
 */
export function addSwears({ chatJid, authorKey, author = null, byWord }) {
  const palabras = Object.entries(byWord || {}).filter(([, n]) => n > 0);
  if (!palabras.length) return;
  const now = nowStamp();
  const stmt = handle().prepare(
    `INSERT INTO swears (chat_jid, author_key, author, word, count, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(chat_jid, author_key, word)
     DO UPDATE SET count = count + excluded.count, author = excluded.author, updated_at = excluded.updated_at`
  );
  for (const [word, n] of palabras) {
    stmt.run(chatJid, authorKey, author, word, n, now);
  }
}

/** Ranking de quién dice más palabrotas en un grupo. */
export function swearRanking(chatJid, limit = 10) {
  return handle()
    .prepare(
      `SELECT author, SUM(count) AS n FROM swears
       WHERE chat_jid = ? GROUP BY author_key ORDER BY n DESC, author ASC LIMIT ?`
    )
    .all(chatJid, limit);
}

/** La palabrota más dicha en el grupo ({ word, n }) o null. */
export function swearTopWord(chatJid) {
  return (
    handle()
      .prepare('SELECT word, SUM(count) AS n FROM swears WHERE chat_jid = ? GROUP BY word ORDER BY n DESC, word ASC LIMIT 1')
      .get(chatJid) || null
  );
}

/** Total de palabrotas del grupo. */
export function swearTotal(chatJid) {
  const row = handle().prepare('SELECT SUM(count) AS n FROM swears WHERE chat_jid = ?').get(chatJid);
  return Number(row?.n || 0);
}

/** Pone el contador a cero (de un grupo, o de todos si no se pasa chatJid). */
export function resetSwears(chatJid = null) {
  if (chatJid) handle().prepare('DELETE FROM swears WHERE chat_jid = ?').run(chatJid);
  else handle().exec('DELETE FROM swears;');
}

// ---------------------------------------------------------------- resumen

export function stats(chatJid = null) {
  const database = handle();
  const one = (sql, ...params) => database.prepare(sql).get(...params);
  const scope = chatJid ? ' AND (chat_jid IS NULL OR chat_jid = ?)' : '';
  const arg = chatJid ? [chatJid] : [];
  return {
    deberes: one(`SELECT COUNT(*) AS n FROM entries WHERE active = 1 AND kind = 'deberes'${scope}`, ...arg).n,
    examenes: one(`SELECT COUNT(*) AS n FROM entries WHERE active = 1 AND kind = 'examen'${scope}`, ...arg).n,
    preguntas: one(`SELECT COUNT(*) AS n FROM questions WHERE resolved = 0${scope}`, ...arg).n,
    // Ojo: en estas dos no hay WHERE previo, así que hace falta "WHERE 1=1"
    // para poder encadenar el "AND (chat_jid ...)" del ámbito.
    mensajes: one(`SELECT COUNT(*) AS n FROM messages WHERE 1=1${scope}`, ...arg).n,
    archivos: one(`SELECT COUNT(*) AS n FROM media WHERE 1=1${scope}`, ...arg).n
  };
}

/** Ultima entrada (la mas reciente) de un tipo y asignatura, para engancharle una foto. */
export function findLatestEntry({ kind, subjectKey: sKey = null, chatJid = null }) {
  const params = [kind];
  let sql = 'SELECT * FROM entries WHERE active = 1 AND kind = ?';
  if (chatJid) {
    sql += ' AND (chat_jid IS NULL OR chat_jid = ?)';
    params.push(chatJid);
  }
  if (sKey) {
    sql += ' AND subject_key = ?';
    params.push(sKey);
  }
  sql += ' ORDER BY created_at DESC LIMIT 1';
  return rowToEntry(handle().prepare(sql).get(...params));
}

/** Resumen corto de lo que sabe, para dárselo como contexto al modo Claw. */
export function briefing(chatJid = null) {
  const today = todayISO();
  const pretty = (e) => {
    if (!e.fecha) return e.fechaTexto || 'sin fecha';
    const diff = daysBetween(today, e.fecha);
    if (diff === 0) return 'hoy';
    if (diff === 1) return 'mañana';
    if (diff > 1 && diff <= 7) return `el ${longDate(e.fecha)}`;
    return `el ${longDate(e.fecha)} (${e.fecha})`;
  };
  const lines = [];
  const exams = findPending({ kind: 'examen', chatJid });
  if (exams.length) {
    lines.push('EXÁMENES CONOCIDOS:');
    for (const e of exams.slice(0, 8)) {
      const extra = e.content && e.content !== 'Examen' && parseSpanishDate(e.content) !== e.fecha ? ` · ${e.content}` : '';
      lines.push(`- ${e.subject || 'sin asignatura'}: ${pretty(e)}${extra}`);
    }
  }
  const homework = findPending({ kind: 'deberes', chatJid });
  if (homework.length) {
    lines.push('DEBERES CONOCIDOS:');
    for (const h of homework.slice(0, 10)) {
      const when = h.fecha ? ` (para ${pretty(h)})` : '';
      lines.push(`- ${h.subject || 'sin asignatura'}: ${h.content}${when}`);
    }
  }
  if (!lines.length) return '';
  return `\n\nDatos reales que tienes apuntados del grupo. Hoy es ${longDate(today)} (${today}). Úsalos si te preguntan por ellos, con lenguaje natural, sin soltar códigos de fecha:\n${lines.join('\n')}`;
}

/** Borra una entrada por su ID. */
export function deleteEntry(id) {
  if (!id) return false;
  handle().prepare('DELETE FROM entries WHERE id = ?').run(Number(id));
  return true;
}

export function close() {
  if (db) {
    try {
      db.close();
    } catch {
      /* ignorar */
    }
    db = null;
  }
}
