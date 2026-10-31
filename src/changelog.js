// Novedades: lee el CHANGELOG.md y prepara un resumen corto para el grupo.
//
// Para qué sirve: cuando se añade algo nuevo al bot, el grupo se entera sin
// tener que mirar nada. El aviso sale SOLO UNA VEZ por novedad (se guarda un
// marcador con la huella de lo que se ha contado), así que no spamea cada vez
// que se reinicia. Se puede apagar con CHANGELOG_NOTIFY=false, y cualquiera
// puede pedirlo a mano con "!claw novedades".
import fs from 'node:fs';
import crypto from 'node:crypto';
import { log } from './logger.js';
import { config } from './config.js';

const ARCHIVO = new URL('../CHANGELOG.md', import.meta.url);

/** Todo el CHANGELOG (vacío si no está). */
export function leerChangelog() {
  try {
    return fs.readFileSync(ARCHIVO, 'utf8');
  } catch (err) {
    log.warn(`No pude leer el CHANGELOG: ${err.message}`);
    return '';
  }
}

/**
 * La sección "[Sin publicar]", que es donde vive todo lo nuevo.
 * Devuelve vacío si no hay (ya publicado todo).
 */
export function seccionSinPublicar(md = leerChangelog()) {
  const inicio = md.indexOf('## [Sin publicar]');
  if (inicio === -1) return '';
  const resto = md.slice(inicio + '## [Sin publicar]'.length);
  const fin = resto.indexOf('\n## ');
  return (fin === -1 ? resto : resto.slice(0, fin)).trim();
}

/** Desmonta la sección en viñetas de texto (una por cambio). */
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

/** Quita el ruido de markdown para que se lea bien en WhatsApp. */
function limpiarMarkdown(texto) {
  return String(texto || '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/(^|\s)_([^_]+)_/g, '$1$2');
}

/** Recorta por una palabra entera, para no cortar a mitad. */
function recortar(texto, max) {
  const t = String(texto || '').trim();
  if (t.length <= max) return t;
  const trozo = t.slice(0, max);
  const espacio = trozo.lastIndexOf(' ');
  return `${(espacio > max * 0.6 ? trozo.slice(0, espacio) : trozo).trimEnd()}…`;
}

/** De una viñeta larga, se queda con el título y la primera frase. */
function resumir(texto) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  const m = /^\*\*(.+?)\.\*\*\s*(.*)$/.exec(limpio);
  const titulo = m ? limpiarMarkdown(m[1]).trim() : null;
  const resto = limpiarMarkdown(m ? m[2] : limpio).trim();
  if (!titulo) return limpiarMarkdown(recortar(limpio, 170));

  // Primera frase del resto, cortada con cuidado (sin partir URLs ni "U.S.").
  let frase = resto;
  const corte = resto.search(/(?<=[a-záéíóúñ)])\.\s+[A-ZÁÉÍÓÚÑ]/);
  if (corte !== -1) frase = resto.slice(0, corte + 1);
  return { titulo, frase: recortar(frase, 140) };
}

/** Las novedades ya reducidas: [{titulo, frase}] (o sueltas si no llevan título). */
export function novedades(md = leerChangelog()) {
  const seccion = seccionSinPublicar(md);
  return extraerCambios(seccion)
    .map(resumir)
    .map((r) => (typeof r === 'string' ? { titulo: null, frase: r } : r))
    .filter((r) => r.titulo || r.frase);
}

/** Huella de lo que queda por publicar (para no repetir el aviso). */
export function hashNovedades(md = leerChangelog()) {
  const seccion = seccionSinPublicar(md);
  if (!seccion) return '';
  return crypto.createHash('sha1').update(seccion).digest('hex').slice(0, 10);
}

/** Clave del marcador en la base de datos para esa huella. */
export function marcadorNovedades(md = leerChangelog()) {
  const hash = hashNovedades(md);
  return hash ? `changelog:${hash}` : null;
}

/** El mensaje de WhatsApp, listo para mandar. Vacío si no hay novedades. */
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
