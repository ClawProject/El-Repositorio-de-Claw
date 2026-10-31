// Quién manda en PickleBrain: el dueño y los administradores.
//
// El dueño es el número del propio bot (o el que se ponga en WHATSAPP_OWNER_JID).
// Solo el dueño y los administradores pueden ver y tocar los ajustes.
import { config, jidDeLaCuenta, jidLidDeLaCuenta } from './config.js';
import * as settings from './settings.js';

/** Solo los números, para comparar aunque el JID venga como "@lid" o con el dispositivo pegado.
 *  Si el JID no es numérico (los nombres de prueba), comparamos el nombre tal cual. */
export function numeroDe(jid) {
  const local = String(jid || '')
    .split('@')[0]
    .split(':')[0]
    .trim();
  const soloDigitos = local.replace(/[^0-9]/g, '');
  return soloDigitos || local.toLowerCase();
}

export function sonIguales(a, b) {
  const na = numeroDe(a);
  const nb = numeroDe(b);
  return Boolean(na) && na === nb;
}

/** Todas las identidades del dueño: su número y su "@lid".
 *  WhatsApp manda los mensajes propios con cualquiera de las dos formas, así que
 *  hay que reconocer ambas para no ignorarte a ti mismo. */
export function identidadesDueno() {
  return [config.ownerJid, jidDeLaCuenta(), jidLidDeLaCuenta()].filter(Boolean);
}

/** El número del dueño (la primera identidad disponible). */
export function duenoJid() {
  return identidadesDueno()[0] || null;
}

/** Todos los que pueden tocar los ajustes (el dueño siempre está). */
export function admins() {
  const lista = [...identidadesDueno(), ...(config.adminJids || []), ...(settings.get('admins') || [])];
  return [...new Set(lista.filter(Boolean))];
}

/** Gente vetada: no puede usar a Claw (ni hablarle ni comandos). */
export function vetados() {
  const lista = [...(config.blockedJids || []), ...(settings.get('vetados') || [])];
  return [...new Set(lista.filter(Boolean))];
}

/** ¿Es el dueño? (se admiten varios JID para la misma persona: @lid y @s.whatsapp.net) */
export function esDueno(...jids) {
  const ids = identidadesDueno();
  if (!ids.length) return false;
  return jids.filter(Boolean).some((j) => ids.some((d) => sonIguales(j, d)));
}

export function esAdmin(...jids) {
  const lista = admins();
  return jids.filter(Boolean).some((j) => lista.some((a) => sonIguales(a, j)));
}

/** ¿Está vetado (no puede usar a Claw)? El dueño y los admins nunca lo están. */
export function esVetado(...jids) {
  if (esAdmin(...jids)) return false;
  return jids.filter(Boolean).some((j) => vetados().some((v) => sonIguales(v, j)));
}

/** Veta a alguien (no podrá usar a Claw). Devuelve false si ya lo estaba o es admin. */
export function addVetado(jid) {
  const limpio = String(jid || '').trim();
  if (!limpio || esAdmin(limpio) || esVetado(limpio)) return false;
  const actuales = settings.get('vetados') || [];
  settings.setLista('vetados', [...new Set([...actuales, limpio])]);
  return true;
}

/** Quita el veto. Devuelve false si no estaba vetado. */
export function removeVetado(jid) {
  const actuales = settings.get('vetados') || [];
  const quedan = actuales.filter((v) => !sonIguales(v, jid));
  if (quedan.length === actuales.length) return false;
  settings.setLista('vetados', quedan);
  return true;
}

/** Añade un administrador (el dueño no hace falta: ya lo es). */
export function addAdmin(jid) {
  const limpio = String(jid || '').trim();
  if (!limpio || esAdmin(limpio)) return false;
  const actuales = settings.get('admins') || [];
  settings.setLista('admins', [...new Set([...actuales, limpio])]);
  return true;
}

export function removeAdmin(jid) {
  const actuales = settings.get('admins') || [];
  const quedan = actuales.filter((a) => !sonIguales(a, jid));
  if (quedan.length === actuales.length) return false;
  settings.setLista('admins', quedan);
  return true;
}
