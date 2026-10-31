// Pequeña utilidad para generar un .ics (iCalendar) con los exámenes próximos.
// No es pesado y nos sirve para que el grupo pueda importar los exámenes al calendario.
import { todayISO, addDays } from './dates.js';
import { subjectLabel } from './subjects.js';

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Convierte YYYY-MM-DD a YYYYMMDD para un evento todo-el-día. */
function toDateOnly(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function uid(id, when) {
  return `${id}-${when}@picklebrain`;
}

function esc(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * Genera el contenido .ics de los exámenes que estén en el futuro (o hoy, como
 * evento del día).
 * @param {Array} exams
 * @returns {string}
 */
export function buildIcs(exams) {
  const now = new Date();
  const nowStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PickleBrain//Exámenes//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];
  for (const e of exams) {
    const dt = toDateOnly(e.fecha);
    if (!dt) continue;
    const summary = esc(`Examen: ${subjectLabel(e.subject) || e.subject || 'Asignatura'}`);
    const descParts = [];
    if (e.content) descParts.push(esc(e.content));
    descParts.push('Añadido por PickleBrain');
    const desc = descParts.join(' - ');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid(e.id, dt)}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dt}`);
    lines.push(`DTEND;VALUE=DATE:${dt}`);
    lines.push(`SUMMARY:${summary}`);
    if (desc) lines.push(`DESCRIPTION:${desc}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
