// Reconocer el grupo del instituto por su nombre.
//
// El nombre NO es un identificador fiable (cualquiera lo puede renombrar), pero
// sirve de comodidad: en cuanto lo reconocemos, guardamos el identificador de
// verdad ("...@g.us"), que ya no cambia.

/** Deja un nombre comparable: sin acentos, sin invisibles, en minusculas. */
export function normalizeGroupName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[\u200b-\u200d\ufeff]/g, '') // quita caracteres invisibles
    .replace(/[º°]/g, '') // "2ºB" y "2B" cuentan como lo mismo
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Deja el nombre "machacado": solo letras y numeros ("Gru-Pito 2ºB" -> "grupito2b"). */
export function squashGroupName(value) {
  return normalizeGroupName(value).replace(/[^a-z0-9]+/g, '');
}

/**
 * ¿El nombre del grupo de verdad coincide con el que hemos puesto en la
 * configuracion? Tolera adornos ("Grupo de clase 2B 🎓") pero no se conforma con
 * nombres muy cortos, para no vincularse al grupo equivocado.
 */
export function sameGroupName(actual, expected) {
  const a = normalizeGroupName(actual);
  const b = normalizeGroupName(expected);
  if (!a || !b || b.length < 4) return false;
  if (a === b || a.includes(b)) return true;

  const sa = squashGroupName(a);
  const sb = squashGroupName(b);
  return sb.length >= 4 && (sa === sb || sa.includes(sb));
}
