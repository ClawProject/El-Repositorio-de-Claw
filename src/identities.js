// Identidades de WhatsApp: un mismo usuario puede llegar como número de
// teléfono ("34600111222@s.whatsapp.net") o como identificador anónimo
// ("998877665544@lid"). Sin unir las dos formas, vetar un número no sirve:
// si el mensaje llega solo con el @lid, el bot no reconoce a la persona.
//
// Aquí guardamos una tabla de equivalencias (jid -> jid canónico) que se va
// aprendiendo de los propios mensajes y de los participantes de los grupos.
import { normalizarJid } from './config.js';
import * as memory from './memory.js';

const CLAVE = 'jid_aliases';
// Tope para que la tabla no crezca sin fin en un grupo muy grande.
const MAX_ALIASES = 2000;
// Se lee una vez y se mantiene en memoria: es una tabla pequeña y se consulta
// varias veces por cada mensaje.
let cache = null;

function cargar() {
  if (cache) return cache;
  try {
    const guardado = memory.getSetting(CLAVE);
    const valor = guardado ? JSON.parse(guardado) : null;
    cache = valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {};
    return cache;
  } catch {
    // La base de datos todavía no está lista: no cacheamos para reintentar.
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
    // Todavía no hay base de datos (por ejemplo, en una prueba aislada).
  }
}

/** Normaliza un JID conservando si es @lid o número de teléfono. */
function normalizar(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return null;
  // Un grupo, un canal o un estado no son personas: no los emparejamos.
  if (/@(g\.us|broadcast|newsletter)$/i.test(texto)) return null;
  const dominio = texto.includes('@lid') ? 'lid' : 's.whatsapp.net';
  return normalizarJid(texto, dominio);
}

/**
 * Apunta que estos JID son la misma persona (número <-> @lid).
 * Se llama con los datos del mensaje y con los participantes del grupo.
 * Devuelve true si aprendió algo nuevo.
 */
export function recordarAlias(...jids) {
  const unicos = [...new Set(jids.map(normalizar).filter(Boolean))];
  if (unicos.length < 2) return false;

  const mapa = { ...cargar() };

  // Si alguno ya estaba unido a otros alias, los arrastramos todos.
  const afectados = new Set(unicos);
  for (const [alias, canonico] of Object.entries(mapa)) {
    if (afectados.has(canonico)) afectados.add(alias);
  }

  // Preferimos el número de teléfono como canónico: es lo que se escribe en
  // "!claw prohibir" y lo que se ve en la lista de vetados.
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
 * Todas las identidades conocidas de una persona (las recibidas y sus alias).
 * Si un JID no es numérico (nombres de prueba) se devuelve tal cual.
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

/** ¿Ya sabemos el número de teléfono de esta persona (y no solo su @lid)? */
export function tieneTelefono(...jids) {
  return identidades(...jids).some((jid) => jid.endsWith('@s.whatsapp.net'));
}
