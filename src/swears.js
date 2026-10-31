// Contador de "palabrotas": reconoce los tacos e insultos que se dicen en el grupo.
// No censura nada ni regaña a nadie: solo cuenta, para el ranking de "!claw palabrotas".
//
// La comparación es por palabras completas, así que "computadora" NO cuenta como
// "puta" ni "conocido" como "coño". Se mantienen los acentos, así que "coño" y
// "cono" (el de helado) son distintos.

// Palabras que cuentan como palabrota (en minúsculas, tal cual se escriben).
const PALABRAS = [
  // Clásicas
  'puta', 'puto', 'putas', 'putos', 'putita', 'putito', 'putón', 'putona',
  'mierda', 'mierdas', 'mierdero', 'mierdoso',
  'joder', 'jodete', 'jódete', 'jodes', 'jodido', 'jodida', 'jodidos', 'jodidas',
  'jodienda', 'jodanse', 'jódanse', 'joputa', 'joputas',
  'coño', 'coños', 'cojones', 'cojonudo', 'cojonuda',
  'hostia', 'hostias', 'hostiaputa', 'ostia', 'ostias',
  // Insultos
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
  // Más gruesas
  'polla', 'pollas', 'pollón', 'verga', 'vergas', 'chupapollas', 'chupavergas',
  'culo', 'culos', 'culiao', 'culiada', 'culiaos',
  'huevón', 'huevon', 'huevones', 'hueón', 'weón', 'weon'
];

const SET = new Set(PALABRAS);

// Frases hechas que también cuentan como una palabrota.
const FRASES = [
  { re: /\bhijo\s+de\s+puta\b/i, nombre: 'hijo de puta' },
  { re: /\bme\s+cag(?:ü|u)en\b/i, nombre: 'me cagüen' },
  { re: /\bcago\s+en\b/i, nombre: 'cago en' }
];

/** Trocea el texto en palabras (letras, con acentos y ñ). */
function palabrasDe(texto) {
  return String(texto || '')
    .toLowerCase()
    .split(/[^a-záéíóúüñ]+/)
    .filter(Boolean);
}

/** ¿Es una palabrota suelta? (una sola palabra) */
export function esPalabrota(palabra) {
  return SET.has(String(palabra || '').toLowerCase().trim());
}

/**
 * Cuenta las palabrotas de un texto.
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

/** Todas las palabras conocidas (por si hiciera falta). */
export function listaPalabrotas() {
  return [...PALABRAS];
}
