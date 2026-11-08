// WhatsApp identities: the same user can arrive as a phone number
// ("34600111222@s.whatsapp.net") or as an anonymous identifier
// ("998877665544@lid"). Without joining the two forms, banning a number is
// useless: if the message arrives only with the @lid, the bot does not
// recognise the person.
//
// Here we keep an equivalence table (jid -> canonical jid) that is learned from
// the messages themselves and from the group participants.
import { normalizarJid } from './config.js';
import * as memory from './memory.js';

const CLAVE = 'jid_aliases';
// Cap so the table does not grow forever in a very large group.
const MAX_ALIASES = 2000;
// It is read once and kept in memory: it is a small table and it is queried
// several times per message.
let cache = null;

function cargar() {
  if (cache) return cache;
  try {
    const guardado = memory.getSetting(CLAVE);
    const valor = guardado ? JSON.parse(guardado) : null;
    cache = valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {};
    return cache;
  } catch {
    // The database is not ready yet: do not cache, so it can be retried.
    return {};
  }
}

function guardar(mapa) {
  try {
    const claves = Object.keys(mapa);
    if (claves.length > MAX_ALIASES) {
      for (const clave of claves.slice(0, claves.length - MAX_ALIASES)) delete mapa[clave];
    }
    memory.setSetting(CLAVE, JSON.stringify(mapa));
    cache = mapa;
  } catch {
    // There is no database yet (for example, in an isolated test).
  }
}

/** Normalises a JID while keeping whether it is an @lid or a phone number. */
function normalizar(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return null;
  // A group, a channel or a status is not a person: they are not paired up.
  if (/@(g\.us|broadcast|newsletter)$/i.test(texto)) return null;
  const dominio = texto.includes('@lid') ? 'lid' : 's.whatsapp.net';
  return normalizarJid(texto, dominio);
}

/**
 * Records that these JIDs are the same person (number <-> @lid).
 * It is called with the message data and with the group participants.
 * Returns true if it learned something new.
 */
export function recordarAlias(...jids) {
  const unicos = [...new Set(jids.map(normalizar).filter(Boolean))];
  if (unicos.length < 2) return false;

  const mapa = { ...cargar() };

  // If any of them was already joined to other aliases, we pull them all in.
  const afectados = new Set(unicos);
  for (const [alias, canonico] of Object.entries(mapa)) {
    if (afectados.has(canonico)) afectados.add(alias);
  }

  // We prefer the phone number as canonical: it is what is written in
  // "!claw prohibir" and what shows up in the banned list.
  const destino = [...afectados].find((j) => j.endsWith('@s.whatsapp.net')) || unicos[0];

  let cambios = false;
  if (mapa[destino] !== destino) {
    mapa[destino] = destino;
    cambios = true;
  }
  for (const jid of afectados) {
    if (mapa[jid] !== destino) {
      mapa[jid] = destino;
      cambios = true;
    }
  }

  if (cambios) guardar(mapa);
  return cambios;
}

/**
 * Every known identity of a person (the ones received plus their aliases).
 * If a JID is not numeric (test names) it is returned as is.
 */
export function identidades(...jids) {
  const mapa = cargar();
  const salida = new Set();

  for (const bruto of jids) {
    if (!bruto) continue;
    const jid = normalizar(bruto);
    if (!jid) {
      salida.add(String(bruto));
      continue;
    }
    const canonico = mapa[jid] || jid;
    salida.add(jid);
    salida.add(canonico);
    for (const [alias, canon] of Object.entries(mapa)) {
      if (canon === canonico) salida.add(alias);
    }
  }

  return [...salida];
}

/** Do we already know this person's phone number (and not only their @lid)? */
export function tieneTelefono(...jids) {
  return identidades(...jids).some((jid) => jid.endsWith('@s.whatsapp.net'));
}
