// Recordatorios de exámenes y deberes: el bot avisa en el grupo la tarde antes y la mañana del día.
import { config } from './config.js';
import { todayISO, addDays, longDate } from './dates.js';
import { subjectLabel } from './subjects.js';

/** Texto del aviso: con antelación, la víspera y el mismo día. */
function textoAviso(entry, cuando, dias = 0) {
  const subj = subjectLabel(entry.subject) || entry.subject || 'General';
  const cuandoTxt = entry.fecha ? longDate(entry.fecha) : entry.fechaTexto || '';
  const isHomework = entry.kind === 'deberes';
  const extra = entry.content && entry.content !== 'Examen' ? `\n📖 Detalle: ${entry.content}` : '';

  if (cuando === 'previo') {
    return `📅 *En ${dias} días hay examen*\n\n📝 *${subj}*${cuandoTxt ? ` — _${cuandoTxt}_` : ''}${extra}\n\n_Ve repasando con tiempo._`;
  }

  if (isHomework) {
    if (cuando === 'tarde') {
      return `⏰ *¡Mañana hay deberes que entregar!*\n\n📚 *${subj}*${cuandoTxt ? ` — _${cuandoTxt}_` : ''}${extra}\n\n_Revisa si los tienes hechos._`;
    }
    return `🚨 *¡HOY se entregan los deberes!*\n\n📚 *${subj}*${cuandoTxt ? ` — _${cuandoTxt}_` : ''}${extra}`;
  }

  if (cuando === 'tarde') {
    return `⏰ *¡Mañana hay examen!*\n\n📝 *${subj}*${cuandoTxt ? ` — _${cuandoTxt}_` : ''}${extra}\n\n_Que no se os olvide estudiar._`;
  }
  return `🚨 *¡HOY es el examen!*\n\n📝 *${subj}*${cuandoTxt ? ` — _${cuandoTxt}_` : ''}${extra}\n\n_¡Mucha suerte!_ 🍀`;
}

/**
 * Qué avisos toca mandar ahora mismo.
 *
 * @param {Array} entries       deberes y exámenes apuntados
 * @param {Date}  now          momento actual
 * @param {(clave:string)=>boolean} yaEnviado  ¿ya se mandó este aviso?
 * @returns {Array<{clave:string, texto:string, cuando:'previo'|'tarde'|'manana'}>}
 */
export function avisosPendientes({ exams = [], deberes = [], now = new Date(), yaEnviado = () => false } = {}) {
  if (!config.reminderEnabled) return [];
  const hoy = todayISO(now);
  const manana = addDays(hoy, 1);
  const hora = now.getHours();
  const diasAntes = Math.floor(Number(config.reminderAdvanceDays) || 0);
  const diaPrevio = diasAntes >= 2 ? addDays(hoy, diasAntes) : null;
  const salida = [];
  const todas = [...exams, ...deberes];

  for (const e of todas) {
    if (!e?.fecha) continue;
    if (e.kind === 'examen' && diaPrevio && e.fecha === diaPrevio && hora >= config.reminderHour) {
      const clave = `recordatorio:previo:${e.id}`;
      if (!yaEnviado(clave)) salida.push({ clave, texto: textoAviso(e, 'previo', diasAntes), cuando: 'previo' });
    }
    if (e.fecha === manana && hora >= config.reminderHour) {
      const clave = `recordatorio:tarde:${e.kind || 'e'}:${e.id}`;
      if (!yaEnviado(clave)) salida.push({ clave, texto: textoAviso(e, 'tarde'), cuando: 'tarde' });
    }
    if (e.fecha === hoy && hora >= config.reminderMorningHour) {
      const clave = `recordatorio:hoy:${e.kind || 'e'}:${e.id}`;
      if (!yaEnviado(clave)) salida.push({ clave, texto: textoAviso(e, 'manana'), cuando: 'manana' });
    }
  }
  return salida;
}
