// Swear counter: recognises the swear words and insults said in the group.
// It censors nothing and scolds nobody: it only counts, for the "!claw palabrotas"
// ranking.
//
// Comparison is per whole word, so "computadora" does NOT count as "puta" nor
// "conocido" as "coño". Accents are kept, so "coño" and "cono" (ice cream cone)
// are different.

// Words that count as a swear word (lowercase, exactly as written).
const PALABRAS = [
  // Classic ones
  'puta', 'puto', 'putas', 'putos', 'putita', 'putito', 'putón', 'putona',
  'mierda', 'mierdas', 'mierdero', 'mierdoso',
  'joder', 'jodete', 'jódete', 'jodes', 'jodido', 'jodida', 'jodidos', 'jodidas',
  'jodienda', 'jodanse', 'jódanse', 'joputa', 'joputas',
  'coño', 'coños', 'cojones', 'cojonudo', 'cojonuda',
  'hostia', 'hostias', 'hostiaputa', 'ostia', 'ostias',
  // Insults
  'cabrón', 'cabron', 'cabrona', 'cabrones', 'cabronas', 'cabronazo',
  'gilipollas', 'gilipuertas', 'imbécil', 'imbecil', 'imbéciles', 'imbeciles',
  'idiota', 'idiotas', 'capullo', 'capulla', 'capullos', 'capullas',
  'subnormal', 'subnormales',
  'pendejo', 'pendeja', 'pendejos', 'pendejas',
  'zorra', 'zorras', 'zorrón',
  'maricón', 'maricon', 'marica', 'maricas', 'mariconazo',
  'mamón', 'mamon', 'mamona', 'mamones',
  'hijoputa', 'hijoputas', 'hijaputa', 'malparido', 'malparida',
  'bastardo', 'bastarda',
  // Cruder ones
  'polla', 'pollas', 'pollón', 'verga', 'vergas', 'chupapollas', 'chupavergas',
  'culo', 'culos', 'culiao', 'culiada', 'culiaos',
  'huevón', 'huevon', 'huevones', 'hueón', 'weón', 'weon'
];

const SET = new Set(PALABRAS);

// Set phrases that also count as one swear word.
const FRASES = [
  { re: /\bhijo\s+de\s+puta\b/i, nombre: 'hijo de puta' },
  { re: /\bme\s+cag(?:ü|u)en\b/i, nombre: 'me cagüen' },
  { re: /\bcago\s+en\b/i, nombre: 'cago en' }
];

/** Splits the text into words (letters, with accents and ñ). */
function palabrasDe(texto) {
  return String(texto || '')
    .toLowerCase()
    .split(/[^a-záéíóúüñ]+/)
    .filter(Boolean);
}

/** Is it a standalone swear word? (a single word) */
export function esPalabrota(palabra) {
  return SET.has(String(palabra || '').toLowerCase().trim());
}

/**
 * Counts the swear words in a text.
 * @returns {{total:number, byWord:Record<string,number>}}
 */
export function contarPalabrotas(texto) {
  const s = String(texto || '');
  const byWord = {};
  let total = 0;

  for (const p of palabrasDe(s)) {
    if (SET.has(p)) {
      byWord[p] = (byWord[p] || 0) + 1;
      total += 1;
    }
  }

  for (const { re, nombre } of FRASES) {
    if (re.test(s)) {
      byWord[nombre] = (byWord[nombre] || 0) + 1;
      total += 1;
    }
  }

  return { total, byWord };
}

/** All known words (in case they are needed). */
export function listaPalabrotas() {
  return [...PALABRAS];
}
