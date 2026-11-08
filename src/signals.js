// Fast signals (no AI). They are used to:
//  1) discard irrelevant messages without burning GPU time,
//  2) answer INSTANTLY to typical homework/exam questions.
import { config } from './config.js';
import { detectSubject, stripAccents } from './subjects.js';

export function normalize(text) {
  return stripAccents(String(text || '').toLowerCase()).replace(/\s+/g, ' ').trim();
}

const CLUE_WORDS = [
  'deber', 'deberes', 'tarea', 'tareas', 'ejercicio', 'ejercicios',
  'examen', 'examenes', 'control', 'controles', 'prueba', 'pruebas',
  'entra', 'entran', 'entregar', 'entrega', 'exponer', 'exposicion',
  'trabajo', 'practica', 'practicas', 'parcial', 'recuperacion',
  'mandado', 'mandaron', 'manda', 'puesto', 'ropuesto',
  'temario', 'tema', 'unidad', 'paginas', 'pagina', 'ej ',
  'trimestre', 'apuntes', 'resumen', 'lectura', 'capitulo'
];

const DATE_HINTS = [
  'manana', 'pasado manana', 'hoy', 'lunes', 'martes', 'miercoles', 'jueves',
  'viernes', 'sabado', 'domingo', 'enero', 'febrero', 'marzo', 'abril', 'mayo',
  'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  'semana que viene', 'proxima semana', 'finde'
];

const QUESTION_WORDS = [
  'que', 'qué', 'cual', 'cuál', 'cuales', 'cuáles', 'cuando', 'cuándo',
  'quien', 'quién', 'donde', 'dónde', 'cuanto', 'cuánto', 'como', 'cómo',
  'alguien sabe', 'sabeis', 'sabéis', 'me pasais', 'me pasáis', 'decidme',
  'alguien tiene', 'hay que', 'tenemos que', 'mandaron algo', 'info', 'alguien me dice'
];

const DEBERES_WORDS = ['deber', 'tarea', 'ejercicio', 'entregar', 'entrega', 'mandaron', 'mandado', 'trabajo', 'exponer', 'lectura'];
const EXAMEN_WORDS = ['examen', 'control', 'prueba', 'parcial', 'recuperacion', 'entra en el exam'];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Every message checks about 90 words, and a new RegExp used to be built for
// each word and message. They are compiled once and reused: this was the biggest
// cost of the AI-free triage.
const wordReCache = new Map();

function wordRegex(word) {
  let re = wordReCache.get(word);
  if (!re) {
    re = new RegExp(`(^|[^a-z0-9])${escapeRe(word)}([^a-z0-9]|$)`);
    wordReCache.set(word, re);
  }
  return re;
}

function hasWord(haystack, word) {
  if (word.endsWith(' ')) return haystack.includes(word);
  return wordRegex(word).test(haystack);
}

/** Is this message worth passing through the AI? */
export function looksRelevant(text) {
  const n = normalize(text);
  if (n.length < 2) return false;
  if (/\d{1,2}\s*(de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/.test(n)) return true;
  if (/\b\d{1,2}[/\-]\d{1,2}\b/.test(n)) return true;
  for (const w of CLUE_WORDS) if (n.includes(w)) return true;
  for (const w of DATE_HINTS) if (hasWord(n, w)) return true;
  return false;
}

/** Is the message a question (and not a statement)? */
export function isQuestion(text) {
  const raw = String(text || '');
  if (/[?¿]/.test(raw)) return true;
  const n = normalize(raw);
  for (const w of QUESTION_WORDS) if (hasWord(n, w)) return true;
  return false;
}

/**
 * Does it mention homework or exams? Returns 'deberes', 'examen' or null.
 * If it mentions both, the more specific word wins.
 */
export function detectKind(text) {
  const n = normalize(text);
  const hasExam = EXAMEN_WORDS.some((w) => n.includes(w));
  const hasHomework = DEBERES_WORDS.some((w) => n.includes(w));
  if (hasExam && !hasHomework) return 'examen';
  if (hasHomework && !hasExam) return 'deberes';
  if (hasExam && hasHomework) {
    // "¿qué deberes hay para el examen?" -> it asks about homework
    const examIdx = Math.min(...EXAMEN_WORDS.map((w) => (n.indexOf(w) === -1 ? Infinity : n.indexOf(w))));
    const hwIdx = Math.min(...DEBERES_WORDS.map((w) => (n.indexOf(w) === -1 ? Infinity : n.indexOf(w))));
    return hwIdx <= examIdx ? 'deberes' : 'examen';
  }
  return null;
}

/**
 * Fast route: if the message is clearly a question about homework or exams, we
 * can answer from the database without calling the AI.
 * @returns {{kind:'deberes'|'examen', subjectKey:string|null, subjectLabel:string|null}|null}
 */
export function fastRoute(text) {
  const n = normalize(text);
  if (n.length < 3) return null;
  const kind = detectKind(text);
  if (!kind) return null;

  const looksLikeQuestion = isQuestion(text) || /\bque\b|\bqué\b/.test(n) || n.endsWith('?');
  // "no hay deberes" / "hay que hacer la página 5" are data, not questions.
  const looksLikeStatement = /^\s*(no\s+)?hay\s+que\b/.test(n) && !/[?¿]/.test(String(text));
  if (!looksLikeQuestion || looksLikeStatement) return null;

  const subject = detectSubject(text);
  return {
    kind,
    subjectKey: subject ? subject.key : null,
    subjectLabel: subject ? subject.label : null
  };
}

// The trigger expression is also compiled only once per configuration.
const clawReCache = new Map();

/** Detects the Claw mode keyword as a standalone word. */
export function clawMatch(text) {
  const configuredTrigger = String(config.clawTrigger || '').trim();
  if (!configuredTrigger) return null;

  const triggers = [configuredTrigger];
  if (normalize(configuredTrigger) === 'claw') {
    // Whisper often transcribes the name, as pronounced in Spanish, by its sound.
    triggers.push('clau', 'clao');
  }
  const key = triggers.join('\u0000');
  let re = clawReCache.get(key);
  if (!re) {
    const alternatives = [...new Set(triggers)].map(escapeRe).join('|');
    re = new RegExp(`(^|[^\\p{L}\\p{N}])(${alternatives})(?=$|[^\\p{L}\\p{N}])`, 'iu');
    clawReCache.set(key, re);
  }
  const m = String(text || '').match(re);
  if (!m) return null;
  const index = m.index + m[1].length;
  const before = String(text).slice(0, index);
  const after = String(text).slice(index + m[2].length);
  return { before, after, index };
}

/** Strips "Claw" and the surrounding punctuation: "Claw, cuanto son 2+2" -> "cuanto son 2+2" */
export function clawQuestion(text) {
  const m = clawMatch(text);
  if (!m) return String(text || '').trim();
  return (m.before + ' ' + m.after)
    .replace(/^[\s,.:;!¡¿?"'`-]+/, '')
    .replace(/[\s,.:;!?]+$/, '')
    .trim();
}
