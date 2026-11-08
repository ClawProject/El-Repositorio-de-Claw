// Changelog: reads CHANGELOG.md and prepares a short summary for the group.
//
// What it is for: when something new is added to the bot, the group finds out
// without having to look anywhere. The notice goes out ONLY ONCE per change (a
// marker with the fingerprint of what was announced is stored), so it does not
// spam on every restart. It can be switched off with CHANGELOG_NOTIFY=false, and
// anyone can request it by hand with "!claw novedades".
import fs from 'node:fs';
import crypto from 'node:crypto';
import { log } from './logger.js';
import { config } from './config.js';

const ARCHIVO = new URL('../CHANGELOG.md', import.meta.url);

/** The whole CHANGELOG (empty when missing). */
export function leerChangelog() {
  try {
    return fs.readFileSync(ARCHIVO, 'utf8');
  } catch (err) {
    log.warn(`No pude leer el CHANGELOG: ${err.message}`);
    return '';
  }
}

/**
 * The "[Unreleased]" section, where everything new lives.
 * Returns empty when there is none (everything already published).
 */
export function seccionSinPublicar(md = leerChangelog()) {
  const inicio = md.indexOf('## [Sin publicar]');
  if (inicio === -1) return '';
  const resto = md.slice(inicio + '## [Sin publicar]'.length);
  const fin = resto.indexOf('\n## ');
  return (fin === -1 ? resto : resto.slice(0, fin)).trim();
}

/** Splits the section into plain-text bullets (one per change). */
export function extraerCambios(seccion) {
  const lineas = String(seccion || '').split('\n');
  const salida = [];
  let actual = null;
  for (const linea of lineas) {
    const esTitulo = /^### /.test(linea);
    const esViñeta = /^- /.test(linea);
    if (esTitulo) {
      if (actual) salida.push(actual);
      actual = null;
      continue;
    }
    if (esViñeta) {
      if (actual) salida.push(actual);
      actual = linea.slice(2).trim();
      continue;
    }
    if (actual && /^\s+\S/.test(linea)) actual += ' ' + linea.trim();
  }
  if (actual) salida.push(actual);
  return salida;
}

/** Strips markdown noise so it reads well in WhatsApp. */
function limpiarMarkdown(texto) {
  return String(texto || '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/(^|\s)_([^_]+)_/g, '$1$2');
}

/** Trims at a whole word, so nothing is cut mid-word. */
function recortar(texto, max) {
  const t = String(texto || '').trim();
  if (t.length <= max) return t;
  const trozo = t.slice(0, max);
  const espacio = trozo.lastIndexOf(' ');
  return `${(espacio > max * 0.6 ? trozo.slice(0, espacio) : trozo).trimEnd()}…`;
}

/** From a long bullet, keeps the title and the first sentence. */
function resumir(texto) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  const m = /^\*\*(.+?)\.\*\*\s*(.*)$/.exec(limpio);
  const titulo = m ? limpiarMarkdown(m[1]).trim() : null;
  const resto = limpiarMarkdown(m ? m[2] : limpio).trim();
  if (!titulo) return limpiarMarkdown(recortar(limpio, 170));

  // First sentence of the rest, cut carefully (without splitting URLs or "U.S.").
  let frase = resto;
  const corte = resto.search(/(?<=[a-záéíóúñ)])\.\s+[A-ZÁÉÍÓÚÑ]/);
  if (corte !== -1) frase = resto.slice(0, corte + 1);
  return { titulo, frase: recortar(frase, 140) };
}

/** The changes already condensed: [{titulo, frase}] (or loose ones when untitled). */
export function novedades(md = leerChangelog()) {
  const seccion = seccionSinPublicar(md);
  return extraerCambios(seccion)
    .map(resumir)
    .map((r) => (typeof r === 'string' ? { titulo: null, frase: r } : r))
    .filter((r) => r.titulo || r.frase);
}

/** Fingerprint of what is still unpublished (so the notice is not repeated). */
export function hashNovedades(md = leerChangelog()) {
  const seccion = seccionSinPublicar(md);
  if (!seccion) return '';
  return crypto.createHash('sha1').update(seccion).digest('hex').slice(0, 10);
}

/** Database marker key for that fingerprint. */
export function marcadorNovedades(md = leerChangelog()) {
  const hash = hashNovedades(md);
  return hash ? `changelog:${hash}` : null;
}

/** The WhatsApp message, ready to send. Empty when there is nothing new. */
export function textoNovedades(md = leerChangelog()) {
  const lista = novedades(md);
  if (!lista.length) return '';

  const fecha = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    timeZone: config.timezone
  });
  const lineas = [`📌 *¡Hay novedades en Claw!* (${fecha})`, ''];
  for (const item of lista) {
    lineas.push(item.titulo ? `• *${item.titulo}.* ${item.frase}` : `• ${item.frase}`);
  }
  lineas.push('', '_Puedes volver a verlo cuando quieras con !claw novedades_');
  return lineas.join('\n');
}
