// Señales rapidas (sin IA). Sirven para:
//  1) descartar mensajes irrelevantes sin gastar GPU,
//  2) responder INSTANTANEAMENTE a las preguntas tipicas de deberes/examenes.
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

// Cada mensaje comprueba alrededor de 90 palabras, y antes se construia un
// RegExp nuevo por palabra y por mensaje. Se compilan una vez y se reutilizan:
// es el mayor coste del triaje sin IA.
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

/** ¿Merece la pena pasar este mensaje por la IA? */
export function looksRelevant(text) {
  const n = normalize(text);
  if (n.length < 2) return false;
  if (/\d{1,2}\s*(de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/.test(n)) return true;
  if (/\b\d{1,2}[/\-]\d{1,2}\b/.test(n)) return true;
  for (const w of CLUE_WORDS) if (n.includes(w)) return true;
  for (const w of DATE_HINTS) if (hasWord(n, w)) return true;
  return false;
}

/** ¿El mensaje es una pregunta (y no una afirmación)? */
export function isQuestion(text) {
  const raw = String(text || '');
  if (/[?¿]/.test(raw)) return true;
  const n = normalize(raw);
  for (const w of QUESTION_WORDS) if (hasWord(n, w)) return true;
  return false;
}

/**
 * ¿Menciona deberes o exámenes? Devuelve 'deberes', 'examen' o null.
 * Si menciona ambos, gana el que aparezca con la palabra más específica.
 */
export function detectKind(text) {
  const n = normalize(text);
  const hasExam = EXAMEN_WORDS.some((w) => n.includes(w));
  const hasHomework = DEBERES_WORDS.some((w) => n.includes(w));
  if (hasExam && !hasHomework) return 'examen';
  if (hasHomework && !hasExam) return 'deberes';
  if (hasExam && hasHomework) {
    // "¿qué deberes hay para el examen?" -> pregunta por deberes
    const examIdx = Math.min(...EXAMEN_WORDS.map((w) => (n.indexOf(w) === -1 ? Infinity : n.indexOf(w))));
    const hwIdx = Math.min(...DEBERES_WORDS.map((w) => (n.indexOf(w) === -1 ? Infinity : n.indexOf(w))));
    return hwIdx <= examIdx ? 'deberes' : 'examen';
  }
  return null;
}

/**
 * Ruta rápida: si el mensaje es claramente una pregunta sobre deberes o exámenes,
 * podemos responder desde la base de datos sin llamar a la IA.
 * @returns {{kind:'deberes'|'examen', subjectKey:string|null, subjectLabel:string|null}|null}
 */
export function fastRoute(text) {
  const n = normalize(text);
  if (n.length < 3) return null;
  const kind = detectKind(text);
  if (!kind) return null;

  const looksLikeQuestion = isQuestion(text) || /\bque\b|\bqué\b/.test(n) || n.endsWith('?');
  // "no hay deberes" / "hay que hacer la página 5" son datos, no preguntas.
  const looksLikeStatement = /^\s*(no\s+)?hay\s+que\b/.test(n) && !/[?¿]/.test(String(text));
  if (!looksLikeQuestion || looksLikeStatement) return null;

  const subject = detectSubject(text);
  return {
    kind,
    subjectKey: subject ? subject.key : null,
    subjectLabel: subject ? subject.label : null
  };
}

// La expresión del trigger también se compila una sola vez por configuración.
const clawReCache = new Map();

/** Detecta la palabra clave del modo Claw como palabra suelta. */
export function clawMatch(text) {
  const configuredTrigger = String(config.clawTrigger || '').trim();
  if (!configuredTrigger) return null;

  const triggers = [configuredTrigger];
  if (normalize(configuredTrigger) === 'claw') {
    // Whisper suele transcribir el nombre pronunciado en español por su sonido.
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

/** Quita "Claw" y los signos de alrededor: "Claw, cuanto son 2+2" -> "cuanto son 2+2" */
export function clawQuestion(text) {
  const m = clawMatch(text);
  if (!m) return String(text || '').trim();
  return (m.before + ' ' + m.after)
    .replace(/^[\s,.:;!¡¿?"'`-]+/, '')
    .replace(/[\s,.:;!?]+$/, '')
    .trim();
}
