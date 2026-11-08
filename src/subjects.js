// Subject name normalisation: "mates" and "matematicas" are the same thing.

const ALIASES = {
  mate: 'matemáticas',
  mates: 'matemáticas',
  matematicas: 'matemáticas',
  'matematicas aplicadas': 'matemáticas aplicadas',
  'matematicas academicas': 'matemáticas académicas',
  lengua: 'lengua',
  'lengua y literatura': 'lengua',
  literatura: 'lengua',
  // In Spain "castellano" is used as often as "lengua". Without these variants,
  // a message saying "castellano" recognised no subject and the bot just showed
  // the examples instead of recording the homework.
  castellano: 'lengua',
  castellana: 'lengua',
  'lengua y castellano': 'lengua',
  'lengua castellana': 'lengua',
  'castellano y literatura': 'lengua',
  'lengua castellana y literatura': 'lengua',
  ingles: 'inglés',
  english: 'inglés',
  historia: 'historia',
  'historia del arte': 'historia del arte',
  socio: 'sociología',
  sociologia: 'sociología',
  deporte: 'educación física',
  tutoria: 'tutoría',
  'geografia e historia': 'geografía e historia',
  geografia: 'geografía',
  biologia: 'biología',
  'biologia y geologia': 'biología y geología',
  byg: 'biología y geología',
  fyq: 'física y química',
  fisica: 'física',
  quimica: 'química',
  'fisica y quimica': 'física y química',
  filosofia: 'filosofía',
  filos: 'filosofía',
  tecnologia: 'tecnología',
  tecno: 'tecnología',
  informatica: 'informática',
  informatic: 'informática',
  plastica: 'plástica',
  'educacion plastica': 'plástica',
  musica: 'música',
  ef: 'educación física',
  'educacion fisica': 'educación física',
  gimnasia: 'educación física',
  religion: 'religión',
  valores: 'valores éticos',
  economia: 'economía',
  latin: 'latín',
  griego: 'griego',
  frances: 'francés',
  aleman: 'alemán',
  dibujo: 'dibujo técnico',
  'dibujo tecnico': 'dibujo técnico',
  tecnologia_industrial: 'tecnología industrial'
};

// Words searched for directly inside a message to guess the subject.
const SEARCHABLE = [
  'matemáticas', 'matemáticas aplicadas', 'matemáticas académicas', 'mates', 'mate',
  'lengua', 'literatura', 'castellano', 'lengua y castellano',
  'castellano y literatura', 'lengua castellana',
  'inglés', 'english',
  'geografía e historia', 'historia', 'geografía',
  'biología y geología', 'biología', 'byg',
  'física y química', 'física', 'química', 'fyq',
  'filosofía', 'filos', 'tecnología', 'tecno', 'informática',
  'plástica', 'educación plástica', 'música', 'educación física', 'gimnasia', 'ef',
  'religión', 'valores éticos', 'economía', 'latín', 'griego',
  'francés', 'alemán', 'dibujo', 'dibujo técnico', 'tecnología industrial',
  'lengua y literatura', 'sociología', 'socio', 'deporte', 'tutoría'
];

export function stripAccents(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Internal key to compare subjects: "Matemáticas " -> "matematicas" */
export function subjectKey(name) {
  return stripAccents(String(name || '').toLowerCase())
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Turns any variant into its "pretty" name: "mates" -> "matemáticas" */
export function canonicalSubject(name) {
  const key = subjectKey(name);
  if (!key) return null;
  if (ALIASES[key]) return ALIASES[key];
  // first word as an alias ("mates de la clase" -> "mates")
  const first = key.split(' ')[0];
  if (ALIASES[first]) return ALIASES[first];
  return key;
}

// The needles are prepared once. Previously the 70+ candidates were normalised
// on every message, which was the biggest cost of the AI-free triage.
const SEARCHABLE_NEEDLES = SEARCHABLE.map((candidate) => ({
  candidate,
  needle: ` ${stripAccents(candidate)} `
}));

/**
 * Tries to guess the subject mentioned in free text.
 * Returns { key, label } or null.
 */
export function detectSubject(text) {
  const normalized = ' ' + stripAccents(String(text || '').toLowerCase()).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  let best = null;
  for (const { candidate, needle } of SEARCHABLE_NEEDLES) {
    if (normalized.includes(needle)) {
      if (!best || candidate.length > best.matched.length) {
        best = { matched: candidate };
      }
    }
  }
  if (!best) return null;
  const label = canonicalSubject(best.matched) || best.matched;
  return { key: subjectKey(label), label, matched: best.matched };
}

/** Pretty label to show in the group. */
export function subjectLabel(name) {
  if (!name) return null;
  const canonical = canonicalSubject(name);
  if (!canonical) return null;
  return canonical.charAt(0).toUpperCase() + canonical.slice(1);
}
