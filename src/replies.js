// Builds the text of the bot replies (WhatsApp format).
import { config } from './config.js';
import { todayISO, humanDate, longDate, shortDate, daysBetween, parseSpanishDate } from './dates.js';
import { subjectLabel } from './subjects.js';
import { t } from './i18n.js';

function footer() {
  return t('footer');
}

/**
 * Header that tells assistant (Claw) replies apart from the normal
 * homework/exam notices. It can be removed with "!claw ajustes firma no".
 */
export function firmaClaw(texto) {
  if (!config.clawSignature) return texto;
  return `🪝 *Claw*\n${texto}`;
}

function freshness(entries) {
  if (!entries.length) return null;
  const newest = entries
    .map((e) => e.updatedAt || e.createdAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  if (!newest) return null;
  const diff = daysBetween(newest.slice(0, 10), todayISO());
  if (diff <= 0) return null;
  if (diff === 1) return t('freshnessYesterday');
  if (diff < 7) return t('freshnessDays', { n: diff });
  return t('freshnessWeek');
}

function label(entry) {
  return subjectLabel(entry.subject) || t('general');
}

/**
 * Useful content of an entry: when all there is is the repeated date
 * ("el 23 de octubre") or the generic filler, it is not shown.
 */
function meaningfulContent(entry) {
  const content = (entry.content || '').trim();
  if (!content || content === 'Examen') return '';
  const asDate = parseSpanishDate(content);
  if (asDate && entry.fecha && asDate === entry.fecha) return '';
  return content;
}

function plazoDeber(entry, today) {
  if (entry.fecha) return `${t('para', { when: humanDate(entry.fecha, today) })} (${shortDate(entry.fecha)})`;
  if (entry.fechaTexto) return t('para', { when: entry.fechaTexto });
  return t('sinFecha');
}

function lineDeber(entry, today) {
  return t('lineDeber', {
    subject: label(entry),
    content: entry.content,
    when: plazoDeber(entry, today)
  });
}

function lineExamen(entry, today) {
  const when = entry.fecha ? longDate(entry.fecha) : entry.fechaTexto || t('sinFecha');
  const extra = meaningfulContent(entry) ? ` — ${meaningfulContent(entry)}` : '';
  return t('lineExamen', { subject: label(entry), when, extra });
}

export function deberesReply(entries, { subject = null } = {}) {
  const today = todayISO();
  const title = subject
    ? t('deberesTitleSubject', { subject: subjectLabel(subject) || subject })
    : t('deberesTitle');
  const body = entries.map((e) => lineDeber(e, today)).join('\n');
  const note = freshness(entries);
  return [title, '', body, '', note, footer()].filter((x) => x !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function examenesReply(entries, { subject = null } = {}) {
  const today = todayISO();
  const title = subject
    ? t('examenesTitleSubject', { subject: subjectLabel(subject) || subject })
    : t('examenesTitle');
  const body = entries.map((e) => lineExamen(e, today)).join('\n');
  const note = freshness(entries);
  return [title, '', body, '', note, footer()].filter((x) => x !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Full view of what the bot has noted down in the group (for "!claw apuntes").
 * It shows at a glance what there is and which word deletes it.
 */
export function apuntesReply(entries) {
  if (!entries.length) {
    return t('apuntesEmpty');
  }
  const today = todayISO();
  const deberes = entries.filter((e) => e.kind === 'deberes');
  const examenes = entries.filter((e) => e.kind === 'examen');
  const bloques = [];
  if (deberes.length) {
    bloques.push(t('apuntesDeberes', { n: deberes.length }));
    bloques.push(...deberes.map((e) => lineDeber(e, today)));
  }
  if (examenes.length) {
    if (bloques.length) bloques.push('');
    bloques.push(t('apuntesExamenes', { n: examenes.length }));
    bloques.push(...examenes.map((e) => lineExamen(e, today)));
  }
  const total = entries.length;
  return [
    t('apuntesTitle', { n: total, apunte: total === 1 ? t('apunte') : t('apuntes') }),
    '',
    ...bloques,
    '',
    t('apuntesHint'),
    footer()
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function pastExamReply(entries, { subject = null } = {}) {
  const today = todayISO();
  const lines = entries.map((e) => {
    const when = e.fecha ? longDate(e.fecha) : e.fechaTexto || t('sinFecha');
    const extra = meaningfulContent(e) ? ` — ${meaningfulContent(e)}` : '';
    return t('lineExamen', { subject: label(e), when, extra });
  });
  const head = subject
    ? t('pastExamSubject', { subject: subjectLabel(subject) || subject })
    : t('pastExam');
  return [head, '', lines.join('\n')].join('\n');
}

export function nothingFound({ kind, subject = null }) {
  const what = kind === 'examen' ? t('whatExamenes') : t('whatDeberes');
  const of = subject ? t('nothingFoundOf', { subject: subjectLabel(subject) || subject }) : '';
  return t('nothingFound', { of, what });
}

export function savedAck(entry) {
  const kind = entry.kind === 'examen' ? t('kindExamen') : t('kindDeberes');
  const subj = subjectLabel(entry.subject) || t('general');
  const when = entry.fecha
    ? t('savedWhen', { date: longDate(entry.fecha) })
    : entry.fechaTexto
      ? t('savedWhenText', { text: entry.fechaTexto })
      : '';
  const detail = entry.content && entry.content !== 'Examen' ? t('savedDetail', { content: entry.content }) : '';
  return t('savedAck', { subject: subj, kind, when, detail });
}

export function recallReply(entry) {
  return savedAck(entry);
}

export function noSpaceReply() {
  return t('noSpace');
}

export function tooBigReply(needMb) {
  return t('tooBig', { mb: needMb });
}

/** Short caption to go with the saved photos. */
export function mediaCaption({ kind = null, subject = null, count = 1 } = {}) {
  const what = kind === 'deberes' ? t('mediaWhatDeberes') : t('mediaWhatExamen');
  const of = subject ? t('mediaOf', { subject: subjectLabel(subject) || subject }) : '';
  if (count > 1) return t('mediaCaptionMany', { what, of });
  return t('mediaCaptionOne', { what, of });
}

export function mediaOnlyReply({ kind = null, subject = null } = {}) {
  const of = subject ? t('mediaOf', { subject: `*${subjectLabel(subject) || subject}*` }) : '';
  return t('mediaOnly', { of });
}

export function transcriptNote(text) {
  return t('transcript', { text });
}

/** What the bot says the first time it starts, to introduce itself to the group. */
export function welcomeText(custom) {
  const cuerpo = custom || t('welcome');
  // "@todos" + mentioning every participant: the whole group sees the text and
  // the mention list notifies them all even if they have it muted.
  return `@todos ${cuerpo}`;
}

export function helpReply({ boundGroup, groupName, model, stats }) {
  const group = boundGroup
    ? `${t('helpGroupLinked')}${groupName ? ` (${groupName})` : ''}`
    : t('helpGroupUnlinked');
  const saved = t('helpSaved', {
    deberes: stats.deberes,
    examenes: stats.examenes,
    archivos: stats.archivos ? t('helpFiles', { n: stats.archivos }) : ''
  });
  return t('help', { model, group, saved });
}

/** What is answered when someone tries to change the settings without permission. */
export function noPermitido() {
  return t('noPermitido');
}

export function olvidaOk(n) {
  return t('olvidaOk', { n, apunte: n === 1 ? t('apunte') : t('apuntes') });
}

export function olvidaNada(texto) {
  return t('olvidaNada', { texto });
}

export function olvidaTodoOk(n) {
  return n ? t('olvidaTodoOk', { n }) : t('olvidaTodoNada');
}

/** Confirmation when homework/exams are marked as done (they are no longer remembered). */
export function hechoOk(entries) {
  const items = entries.map((e) => {
    const que = meaningfulContent(e);
    return `• *${label(e)}*${que ? `: ${que}` : ''}`;
  });
  const total = entries.length;
  return [
    total === 1 ? t('hechoOkOne') : t('hechoOkMany', { n: total }),
    '',
    ...items,
    '',
    t('hechoOkFoot')
  ].join('\n');
}

/** There is no pending entry matching what was asked for. */
export function hechoNada(texto) {
  return [t('hechoNada', { texto }), '', t('hechoNadaHint')].join('\n');
}

/** Help for "!claw hecho" with the list of what is still pending. */
export function hechoAyuda(pendientes) {
  const items = pendientes.slice(0, 10).map((e) => {
    const que = meaningfulContent(e);
    return `• *${label(e)}*${que ? `: ${que}` : ''}`;
  });
  const resto = pendientes.length > 10 ? [t('hechoAyudaMore', { n: pendientes.length - 10 })] : [];
  return [
    t('hechoAyudaTitle'),
    t('hechoAyudaHint'),
    '',
    t('hechoAyudaPending'),
    ...items,
    ...resto
  ].join('\n');
}

/** Confirmation when a homework or exam is added/modified by hand. */
export function apunteManual(entry, { creado = false } = {}) {
  const kind = entry.kind === 'examen' ? t('kindExamen') : t('kindDeberes');
  const subj = subjectLabel(entry.subject) || t('general');
  const when =
    entry.kind === 'examen'
      ? entry.fecha
        ? t('savedWhen', { date: longDate(entry.fecha) })
        : entry.fechaTexto
          ? t('savedWhenText', { text: entry.fechaTexto })
          : t('apunteSinFecha')
      : ` — _${plazoDeber(entry, todayISO())}_`;
  const detail = entry.content && entry.content !== 'Examen' ? t('savedDetail', { content: entry.content }) : '';
  return t('apunteManual', {
    status: creado ? t('apunteCreado') : t('apunteActualizado'),
    subject: subj,
    kind,
    when,
    detail
  });
}

/** Help when "!claw apunta ..." does not bring enough data. */
export function apuntaAyuda() {
  return t('apuntaAyuda');
}

/** Administrator list. */
export function adminsReply({ dueno = null, lista = [] } = {}) {
  const numero = (j) => String(j || '').split('@')[0];
  const otros = lista.filter((j) => numero(j) !== numero(dueno));
  return [
    t('adminsTitle'),
    '',
    t('adminsOwner', { owner: dueno ? numero(dueno) : t('adminsOwnerNone') }),
    t('adminsList', { list: otros.length ? otros.map((j) => `*${numero(j)}*`).join(', ') : t('adminsNone') })
  ].join('\n');
}

/** List of banned people (they cannot use Claw). */
export function vetadosReply({ lista = [] } = {}) {
  const numero = (j) => String(j || '').split('@')[0];
  return [
    t('vetadosTitle'),
    '',
    `• ${lista.length ? lista.map((j) => `*${numero(j)}*`).join(', ') : t('vetadosNone')}`,
    '',
    t('vetadosHint')
  ].join('\n');
}

/** Notice that image generation is switched off (experimental). */
export function imagenApagadaReply() {
  return t('imagenApagada');
}

/** Error while trying to generate an image. */
export function imagenErrorReply(error) {
  return [t('imagenError'), '', `*${error || t('imagenErrorUnknown')}*`, '', t('imagenErrorHint')].join('\n');
}

/**
 * Notice that it is currently drawing another image.
 * This is not a failure: it goes one at a time on purpose (the GPU is small), so
 * it is said plainly instead of throwing an error message.
 */
export function imagenOcupadaReply() {
  return t('imagenOcupada');
}

/** Ranking of the swear counter. */
export function palabrotasReply({ ranking = [], total = 0, topWord = null, aviso = false } = {}) {
  if (!total || !ranking.length) {
    return [t('palabrotasTitle'), '', t('palabrotasNone')].join('\n');
  }
  const medallas = ['🥇', '🥈', '🥉'];
  const filas = ranking.map((r, i) => `${medallas[i] || '•'} *${r.author || 'alguien'}* — ${r.n}`);
  const mas =
    topWord && topWord.word
      ? `\n\n${t('palabrotasMost', {
          word: topWord.word,
          n: topWord.n,
          vez: topWord.n === 1 ? t('vez') : t('veces')
        })}`
      : '';
  return [
    aviso ? t('palabrotasAlert') : t('palabrotasTitle'),
    '',
    t('palabrotasSummary', { total, palabra: total === 1 ? t('palabrota') : t('palabrotas') }),
    '',
    ...filas,
    mas
  ].join('\n');
}

/** The nearest exam, with the days left. */
export function proximoReply(entries) {
  if (!entries.length) return nothingFound({ kind: 'examen' });
  const today = todayISO();
  const e = entries[0];
  const dias = e.fecha ? daysBetween(today, e.fecha) : null;
  const cuando = e.fecha ? longDate(e.fecha) : e.fechaTexto || t('sinFecha');
  const cuenta =
    dias === null
      ? ''
      : dias <= 0
        ? t('proximoToday')
        : dias === 1
          ? t('proximoTomorrow')
          : t('proximoInDays', { n: dias });
  const extra = meaningfulContent(e) ? t('proximoExtra', { content: meaningfulContent(e) }) : '';
  return [
    t('proximoTitle', { subject: label(e) }),
    '',
    t('proximoBody', { when: cuando, count: cuenta, extra }),
    '',
    footer()
  ].join('\n');
}

/** Help with every command. */
export function ayudita() {
  return t('ayudita');
}
