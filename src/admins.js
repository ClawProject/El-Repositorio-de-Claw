// Who is in charge in PickleBrain: the owner and the administrators.
//
// The owner is the bot's own number (or whatever is set in WHATSAPP_OWNER_JID).
// Only the owner and the administrators can see and change the settings.
import { config, jidDeLaCuenta, jidLidDeLaCuenta } from './config.js';
import * as settings from './settings.js';
import { identidades } from './identities.js';

/** Digits only, so they can be compared even when the JID comes as "@lid" or with
 *  the device attached. If the JID is not numeric (test names), compare the name as is. */
export function numeroDe(jid) {
  const local = String(jid || '')
    .split('@')[0]
    .split(':')[0]
    .trim();
  const soloDigitos = local.replace(/[^0-9]/g, '');
  if (!soloDigitos) return local.toLowerCase();
  // Spanish mobile numbers have 9 digits (starting with 6 or 7) and WhatsApp
  // stores them with 34 in front. We treat both forms as equal so "600111222"
  // and "34600111222" count as the same person: people (and the README) usually
  // write the number without the prefix.
  if (/^[67]\d{8}$/.test(soloDigitos)) return `34${soloDigitos}`;
  return soloDigitos;
}

export function sonIguales(a, b) {
  const na = numeroDe(a);
  const nb = numeroDe(b);
  return Boolean(na) && na === nb;
}

/** Every identity of the owner: their number and their "@lid".
 *  WhatsApp sends your own messages with either form, so both must be recognised
 *  in order not to ignore yourself. */
export function identidadesDueno() {
  return [config.ownerJid, jidDeLaCuenta(), jidLidDeLaCuenta()].filter(Boolean);
}

/** The owner's number (the first available identity). */
export function duenoJid() {
  return identidadesDueno()[0] || null;
}

/** Everyone who can change the settings (the owner is always included). */
export function admins() {
  const lista = [...identidadesDueno(), ...(config.adminJids || []), ...(settings.get('admins') || [])];
  return [...new Set(lista.filter(Boolean))];
}

/** Banned people: they cannot use Claw (neither talk to it nor run commands). */
export function vetados() {
  const lista = [...(config.blockedJids || []), ...(settings.get('vetados') || [])];
  return [...new Set(lista.filter(Boolean))];
}

/** Is it the owner? (several JIDs for the same person are accepted: @lid and @s.whatsapp.net) */
export function esDueno(...jids) {
  const ids = identidadesDueno();
  if (!ids.length) return false;
  const conocidos = identidades(...jids);
  return conocidos.some((j) => ids.some((d) => sonIguales(j, d)));
}

export function esAdmin(...jids) {
  const lista = admins();
  const conocidos = identidades(...jids);
  return conocidos.some((j) => lista.some((a) => sonIguales(j, a)));
}

/** Is it banned (cannot use Claw)? The owner and admins never are. */
export function esVetado(...jids) {
  if (esAdmin(...jids)) return false;
  const lista = vetados();
  const conocidos = identidades(...jids);
  return conocidos.some((j) => lista.some((v) => sonIguales(j, v)));
}

/** Bans someone (they will not be able to use Claw). Returns false if already banned or an admin. */
export function addVetado(jid) {
  const limpio = String(jid || '').trim();
  if (!limpio || esAdmin(limpio) || esVetado(limpio)) return false;
  const actuales = settings.get('vetados') || [];
  settings.setLista('vetados', [...new Set([...actuales, limpio])]);
  return true;
}

/** Lifts the ban. Returns false if it was not banned.
 *  Accepts any known identity of the person (number or @lid). */
export function removeVetado(jid) {
  const actuales = settings.get('vetados') || [];
  const ids = identidades(jid);
  const quedan = actuales.filter((v) => !ids.some((id) => sonIguales(v, id)));
  if (quedan.length === actuales.length) return false;
  settings.setLista('vetados', quedan);
  return true;
}

/** Adds an administrator (the owner does not need it: they already are one). */
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
