// Spanish date utilities. The whole bot works with ISO dates (YYYY-MM-DD)
// calculated in the configured time zone, never with the system's local time.
import { config } from './config.js';

export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

// index 0 = Sunday, same as Date#getUTCDay
export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const pad = (n) => String(n).padStart(2, '0');

/** Breaks a Date into its parts as they are seen in the given time zone. */
export function partsInTz(date = new Date(), tz = config.timezone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

/** Today's date (or `date`) as YYYY-MM-DD in the configured time zone. */
export function todayISO(date = new Date(), tz = config.timezone) {
  const { year, month, day } = partsInTz(date, tz);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Current time in the configured zone, as YYYY-MM-DD HH:MM:SS. */
export function nowStamp(date = new Date(), tz = config.timezone) {
  const { year, month, day, hour, minute, second } = partsInTz(date, tz);
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

export function isoToUTC(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function utcToISO(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(iso, n) {
  return utcToISO(isoToUTC(iso) + n * 86400000);
}

/** Days from `from` to `to`. Positive = future. */
export function daysBetween(from, to) {
  return Math.round((isoToUTC(to) - isoToUTC(from)) / 86400000);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekdayOf(iso) {
  return new Date(isoToUTC(iso)).getUTCDay();
}

export function isValidISO(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** e.g. "20 de octubre" (Spanish output) */
export function dayMonth(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
}

/** e.g. "miércoles 20 de octubre" (Spanish output) */
export function longDate(iso) {
  return `${WEEKDAYS[weekdayOf(iso)]} ${dayMonth(iso)}`;
}

/** "hoy", "mañana", "el lunes", "el 20 de octubre"... (Spanish output) */
export function humanDate(iso, today = todayISO()) {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'mañana';
  if (diff === 2) return 'pasado mañana';
  if (diff === -1) return 'ayer';
  if (diff > 2 && diff <= 7) return `el ${WEEKDAYS[weekdayOf(iso)]}`;
  return `el ${dayMonth(iso)}`;
}

export function shortDate(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** Text given to the AI so it knows which day today is. */
export function describeToday(today = todayISO()) {
  const [y] = today.split('-').map(Number);
  return `${longDate(today)} de ${y} (${today})`;
}

function stripAccents(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Like stripAccents but keeping the length (character by character) and
 * lowercasing. It is used to search inside a text and then slice the ORIGINAL
 * text at the same indexes (the normal version changes length on accented
 * letters).
 */
export function fold(s) {
  let out = '';
  for (const ch of String(s)) {
    const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    out += base.length === 1 ? base : ch;
  }
  return out;
}

function monthFromName(name) {
  const n = stripAccents(String(name).toLowerCase());
  return MONTHS.findIndex((m) => stripAccents(m) === n || stripAccents(m).startsWith(n.slice(0, 3)));
}

function weekdayFromName(name) {
  const n = stripAccents(String(name).toLowerCase());
  const idx = WEEKDAYS.findIndex((w) => stripAccents(w) === n);
  return idx;
}

/**
 * Looks for a date in a Spanish text and ALSO returns the exact phrase that
 * represents it (so it can be cut out of the content).
 * @returns {{iso: string, phrase: string}|null}
 */
export function extractDatePhrase(text, today = todayISO()) {
  if (!text) return null;
  const raw = String(text);
  const t = fold(raw); // lowercase and without accents, same length as `raw`
  const hit = (m, iso) => ({ iso, phrase: raw.slice(m.index, m.index + m[0].length) });

  // 2026-10-20
  const isoMatch = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const candidate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    if (isValidISO(candidate)) return hit(isoMatch, candidate);
  }

  if (/\bpasado ma[nñ]?ana\b/.test(t)) return hit(t.match(/\bpasado ma[nñ]?ana\b/), addDays(today, 2));
  if (/\bma[nñ]?ana\b/.test(t) && !/\b(por|de)\s+la\s+ma[nñ]?ana\b/.test(t)) return hit(t.match(/\bma[nñ]?ana\b/), addDays(today, 1));
  if (/\bhoy\b/.test(t)) return hit(t.match(/\bhoy\b/), today);

  // "en 3 dias" / "dentro de 2 semanas" (in 3 days / within 2 weeks)
  const enDias = t.match(/\b(?:en|dentro de)\s+(\d{1,2})\s+d[ií]as?\b/);
  if (enDias) return hit(enDias, addDays(today, Number(enDias[1])));
  const enSemanas = t.match(/\b(?:en|dentro de)\s+(\d{1,2})\s+semanas?\b/);
  if (enSemanas) return hit(enSemanas, addDays(today, Number(enSemanas[1]) * 7));

  // 20/10 or 20/10/2026 or 20-10
  const slash = t.match(/(?<![\d/\-.])(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?\b(?![/\-.]\d)/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    let year = slash[3] ? Number(slash[3]) : Number(today.slice(0, 4));
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      let candidate = `${year}-${pad(month)}-${pad(day)}`;
      if (!slash[3] && daysBetween(today, candidate) < 0) {
        candidate = `${year + 1}-${pad(month)}-${pad(day)}`;
      }
      if (isValidISO(candidate)) return hit(slash, candidate);
    }
  }

  // "20 de octubre [de 2026]" (Spanish long form)
  const longMatch = t.match(/\b(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (longMatch) {
    const day = Number(longMatch[1]);
    const month = monthFromName(longMatch[2]);
    if (month >= 0 && day >= 1 && day <= 31) {
      let year = longMatch[3] ? Number(longMatch[3]) : Number(today.slice(0, 4));
      let candidate = `${year}-${pad(month + 1)}-${pad(day)}`;
      if (!longMatch[3] && daysBetween(today, candidate) < 0) {
        year += 1;
        candidate = `${year}-${pad(month + 1)}-${pad(day)}`;
      }
      if (isValidISO(candidate)) return hit(longMatch, candidate);
    }
  }

  // "el lunes", "el proximo lunes", "el lunes que viene" (next Monday)
  const weekdayMatch = t.match(
    /\b((?:el\s+)?(?:(?:este|proximo|siguiente)\s+)?(?:domingo|lunes|martes|miercoles|jueves|viernes|sabado)(?:\s+que\s+viene)?)\b/
  );
  if (weekdayMatch) {
    const dayName = weekdayMatch[1].match(/(domingo|lunes|martes|miercoles|jueves|viernes|sabado)/)[1];
    const target = weekdayFromName(dayName);
    if (target >= 0) {
      const current = weekdayOf(today);
      let delta = (target - current + 7) % 7;
      const isNext = /\b(que viene|proximo|pr[oó]ximo|siguiente)\b/.test(t);
      if (delta === 0) delta = isNext ? 7 : 0;
      else if (isNext) delta += 7;
      return hit(weekdayMatch, addDays(today, delta));
    }
  }

  // "la semana que viene" -> next Monday
  const semanaMatch = t.match(/\bla\s+semana\s+(que\s+viene|proxima|pr[oó]xima|siguiente)\b/);
  if (semanaMatch) {
    const toMonday = (1 - weekdayOf(today) + 7) % 7;
    return hit(semanaMatch, addDays(today, toMonday === 0 ? 7 : toMonday));
  }

  return null;
}

/**
 * Spanish date parser, used as a safety net when the AI returns something that
 * is not a valid ISO date.
 * Returns YYYY-MM-DD or null.
 */
export function parseSpanishDate(text, today = todayISO()) {
  return extractDatePhrase(text, today)?.iso ?? null;
}
