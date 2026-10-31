// Genera el texto de las respuestas del bot (formato WhatsApp).
import { config } from './config.js';
import { todayISO, humanDate, longDate, shortDate, daysBetween, parseSpanishDate } from './dates.js';import { subjectLabel } from './subjects.js';

const FOOTER = '_Según lo que se ha dicho en el grupo._';

/**
 * Cabecera para distinguir las respuestas del asistente (Claw) de los avisos
 * normales de deberes/exámenes. Se puede quitar con "!claw ajustes firma no".
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
  if (diff === 1) return 'ℹ️ El último dato es de ayer.';
  if (diff < 7) return `ℹ️ El último dato es de hace ${diff} días.`;
  return `ℹ️ El último dato es de hace más de una semana. Puede estar desactualizado.`;
}

function label(entry) {
  return subjectLabel(entry.subject) || 'General';
}

/**
 * Contenido util de una entrada: si lo unico que hay es la fecha repetida
 * ("el 23 de octubre") o el relleno generico, no lo mostramos.
 */
function meaningfulContent(entry) {
  const content = (entry.content || '').trim();
  if (!content || content === 'Examen') return '';
  const asDate = parseSpanishDate(content);
  if (asDate && entry.fecha && asDate === entry.fecha) return '';
  return content;
}

function plazoDeber(entry, today) {
  if (entry.fecha) return `para ${humanDate(entry.fecha, today)} (${shortDate(entry.fecha)})`;
  if (entry.fechaTexto) return `para ${entry.fechaTexto}`;
  return 'sin fecha';
}

function lineDeber(entry, today) {
  return `• *${label(entry)}*: ${entry.content} — _${plazoDeber(entry, today)}_`;
}

function lineExamen(entry, today) {
  const when = entry.fecha ? longDate(entry.fecha) : entry.fechaTexto || 'sin fecha';
  const extra = meaningfulContent(entry) ? ` — ${meaningfulContent(entry)}` : '';
  return `• *${label(entry)}* — _${when}_${extra}`;
}

export function deberesReply(entries, { subject = null } = {}) {
  const today = todayISO();
  const title = subject ? `📚 *Deberes de ${subjectLabel(subject) || subject}*` : '📚 *Deberes pendientes*';
  const body = entries.map((e) => lineDeber(e, today)).join('\n');
  const note = freshness(entries);
  return [title, '', body, '', note, FOOTER].filter((x) => x !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function examenesReply(entries, { subject = null } = {}) {
  const today = todayISO();
  const title = subject ? `📝 *Examen de ${subjectLabel(subject) || subject}*` : '📝 *Próximos exámenes*';
  const body = entries.map((e) => lineExamen(e, today)).join('\n');
  const note = freshness(entries);
  return [title, '', body, '', note, FOOTER].filter((x) => x !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Vista completa de lo que el bot tiene apuntado en el grupo (para "!claw apuntes").
 * Sirve para ver de un vistazo qué hay y con qué palabra borrarlo.
 */
export function apuntesReply(entries) {
  if (!entries.length) {
    return '🗂️ No tengo nada apuntado todavía. Si alguien dice los deberes o un examen en el grupo, lo guardo.';
  }
  const today = todayISO();
  const deberes = entries.filter((e) => e.kind === 'deberes');
  const examenes = entries.filter((e) => e.kind === 'examen');
  const bloques = [];
  if (deberes.length) {
    bloques.push(`📚 *Deberes* (${deberes.length})`);
    bloques.push(...deberes.map((e) => lineDeber(e, today)));
  }
  if (examenes.length) {
    if (bloques.length) bloques.push('');
    bloques.push(`📝 *Exámenes* (${examenes.length})`);
    bloques.push(...examenes.map((e) => lineExamen(e, today)));
  }
  const total = entries.length;
  return [
    `🗂️ *Todo lo que tengo apuntado* (${total} ${total === 1 ? 'apunte' : 'apuntes'})`,
    '',
    ...bloques,
    '',
    'Para borrar algo: _!claw olvida <palabra>_  ·  Todo de golpe: _!claw olvida todo_',
    FOOTER
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function pastExamReply(entries, { subject = null } = {}) {
  const today = todayISO();
  const lines = entries.map((e) => {
    const when = e.fecha ? longDate(e.fecha) : e.fechaTexto || 'sin fecha';
    const extra = meaningfulContent(e) ? ` — ${meaningfulContent(e)}` : '';
    return `• *${label(e)}* — _${when}_${extra}`;
  });
  const head = subject
    ? `📝 El examen de *${subjectLabel(subject) || subject}* ya pasó:`
    : '📝 Esos exámenes ya pasaron:';
  return [head, '', lines.join('\n')].join('\n');
}

export function nothingFound({ kind, subject = null }) {
  const what = kind === 'examen' ? 'los exámenes' : 'los deberes';
  const of = subject ? ` de *${subjectLabel(subject) || subject}*` : '';
  return `🤔 No tengo apuntado nada${of} sobre ${what}. Si alguien lo dice en el grupo, lo guardo y lo recordaré.`;
}

export function savedAck(entry) {
  const kind = entry.kind === 'examen' ? 'Examen' : 'Deberes';
  const subj = subjectLabel(entry.subject) || 'General';
  const when = entry.fecha ? ` el ${longDate(entry.fecha)}` : entry.fechaTexto ? ` (${entry.fechaTexto})` : '';
  const detail = entry.content && entry.content !== 'Examen' ? `: ${entry.content}` : '';
  return `✅ Apuntado — *${subj}*: ${kind.toLowerCase()}${when}${detail}`;
}

export function recallReply(entry) {
  return savedAck(entry);
}

export function noSpaceReply() {
  return '😣 No he podido guardar la foto: no queda espacio en el disco. Si liberas un poco, la próxima vez sí podré.';
}

export function tooBigReply(needMb) {
  return `🙈 Esa foto pesa ${needMb} MB, no la he guardado para no llenar el disco.`;
}

/** Pie corto para acompañar a las fotos guardadas. */
export function mediaCaption({ kind = null, subject = null, count = 1 } = {}) {
  const what = kind === 'deberes' ? 'los deberes' : 'el examen';
  const of = subject ? ` de ${subjectLabel(subject) || subject}` : '';
  if (count > 1) return `📎 Fotos de lo que se compartió de ${what}${of}`;
  return `📎 Foto de lo que se compartió de ${what}${of}`;
}

export function mediaOnlyReply({ kind = null, subject = null } = {}) {
  const what = kind === 'deberes' ? 'de los deberes' : 'del examen';
  const of = subject ? ` de *${subjectLabel(subject) || subject}*` : '';
  return `📎 No tengo el texto, pero sí lo que se compartió${of} en el grupo:`;
}

export function transcriptNote(text) {
  return `🎧 _He entendido:_ ${text}`;
}

/** Lo que dice el bot la primera vez que se abre, para presentarse en el grupo. */
export function welcomeText(custom) {
  const cuerpo =
    custom ||
    [
      '👋 ¡Hola! Soy *PickleBrain*, el bot que se ha colado en este grupo.',
      '',
      'Me quedo escuchando en silencio e iré apuntando los *deberes* y los *exámenes* que se digan por aquí: fechas, temas, y las fotos o PDFs de lo que entra.',
      '',
      'Solo hablo si me preguntáis algo. Para verme el estado: *!claw*',
      'Y para pedirme cualquier cosa, escribid *Claw* + lo que sea:  _Claw cuánto son 2+2_',
      '',
      '_(Si molesto, se me quita con *!claw fuera*.)_'
    ].join('\n');
  // "@todos" + mencionar a todos los participantes: el texto lo ve todo el
  // grupo y la lista de menciones les avisa a todos aunque tengan silenciado.
  return `@todos ${cuerpo}`;
}

export function helpReply({ boundGroup, groupName, model, stats }) {
  return [
    '🪝 *PickleBrain*',
    '',
    `• Modelo: \`${model}\``,
    `• Grupo: ${boundGroup ? `vinculado ✅${groupName ? ` (${groupName})` : ''}` : 'sin vincular ❌'}`,
    `• Apuntado: ${stats.deberes} deberes, ${stats.examenes} exámenes${
      stats.archivos ? `, ${stats.archivos} archivos` : ''
    }`,
    '',
    'Solo hablo cuando me preguntan por deberes o exámenes. Si alguien los dice, me los apunto solo.',
    'También entiendo *notas de voz* y guardo las *fotos* y los *PDF* que entra, para reenviarlos cuando preguntéis.',
    'Y puedes pedirme cosas escribiendo *Claw* + lo que sea: _Claw cuanto son 2+2_'
  ].join('\n');
}

/** Lo que se contesta cuando alguien intenta tocar los ajustes sin permiso. */
export function noPermitido() {
  return '🔒 Eso solo lo puede hacer el dueño y los administradores. Pídemelo a mí, que soy el que manda. 😉';
}

export function olvidaOk(n) {
  return `🗑️ Hecho: he borrado ${n} apunte${n === 1 ? '' : 's'}.`;
}

export function olvidaNada(texto) {
  return `🤷 No tengo apuntado nada que se parezca a "${texto}".`;
}

export function olvidaTodoOk(n) {
  return n
    ? `🧹 Hecho: he borrado *todos* los apuntes (${n}). Ahora mismo no tengo nada guardado.`
    : '🤷 No tenía nada apuntado, así que no hay nada que borrar.';
}

/** Confirmación al marcar deberes/exámenes como hechos (ya no se recuerdan). */
export function hechoOk(entries) {
  const items = entries.map((e) => {
    const que = meaningfulContent(e);
    return `• *${label(e)}*${que ? `: ${que}` : ''}`;
  });
  const total = entries.length;
  return [
    `✅ *${total === 1 ? 'Apunte marcado como hecho' : `${total} apuntes marcados como hechos`}*`,
    '',
    ...items,
    '',
    '_Ya no saldrán como pendientes ni en los recordatorios._'
  ].join('\n');
}

/** No hay ningún apunte pendiente que coincida con lo que se ha pedido. */
export function hechoNada(texto) {
  return [
    `🤔 No encuentro nada pendiente que coincida con "${texto}".`,
    '',
    '_Prueba con la asignatura (por ejemplo, "lengua") o con una palabra del enunciado._'
  ].join('\n');
}

/** Ayuda de "!claw hecho" con la lista de lo que queda pendiente. */
export function hechoAyuda(pendientes) {
  const items = pendientes.slice(0, 10).map((e) => {
    const que = meaningfulContent(e);
    return `• *${label(e)}*${que ? `: ${que}` : ''}`;
  });
  const resto = pendientes.length > 10 ? [`…y ${pendientes.length - 10} más.`] : [];
  return [
    '✅ ¿Qué doy por hecho? Dime la asignatura o una palabra:',
    '_!claw hecho lengua_ · _!claw hecho ficha 3_',
    '',
    'Pendiente ahora mismo:',
    ...items,
    ...resto
  ].join('\n');
}

/** Confirmación al apuntar/modificar un deber o examen a mano. */
export function apunteManual(entry, { creado = false } = {}) {
  const kind = entry.kind === 'examen' ? 'Examen' : 'Deberes';
  const subj = subjectLabel(entry.subject) || 'General';
  const when =
    entry.kind === 'examen'
      ? entry.fecha
        ? ` el ${longDate(entry.fecha)}`
        : entry.fechaTexto
          ? ` (${entry.fechaTexto})`
          : ' (sin fecha)'
      : ` — _${plazoDeber(entry, todayISO())}_`;
  const detail = entry.content && entry.content !== 'Examen' ? `: ${entry.content}` : '';
  return `${creado ? '✅ Apuntado' : '✏️ Actualizado'} — *${subj}*: ${kind.toLowerCase()}${when}${detail}`;
}

/** Ayuda cuando "!claw apunta ..." no trae datos suficientes. */
export function apuntaAyuda() {
  return [
    '✍️ Dime qué apunto y, si quieres, para cuándo. Ejemplos:',
    '• _!claw apunta deberes mates hacer la ficha 3 para el viernes_',
    '• _!claw apunta deberes lengua leer el tema 2 para mañana_',
    '• _!claw apunta examen historia tema 4 el 21 de octubre_',
    '• _!claw apunta deberes mates para el lunes_  (solo cambia la fecha)'
  ].join('\n');
}

/** Lista de administradores. */
export function adminsReply({ dueno = null, lista = [] } = {}) {
  const numero = (j) => String(j || '').split('@')[0];
  const otros = lista.filter((j) => numero(j) !== numero(dueno));
  return [
    '👑 *Quién puede tocar los ajustes*',
    '',
    `• Dueño: *${dueno ? numero(dueno) : 'sin asignar'}*`,
    otros.length ? `• Administradores: ${otros.map((j) => `*${numero(j)}*`).join(', ')}` : '• Administradores: _ninguno_'
  ].join('\n');
}

/** Lista de gente vetada (no puede usar a Claw). */
export function vetadosReply({ lista = [] } = {}) {
  const numero = (j) => String(j || '').split('@')[0];
  return [
    '🚫 *Vetados (no pueden usar a Claw)*',
    '',
    lista.length ? `• ${lista.map((j) => `*${numero(j)}*`).join(', ')}` : '• _ninguno_',
    '',
    'Vetar: _!claw prohibir +600111222_  ·  Perdonar: _!claw permitir +600111222_'
  ].join('\n');
}

/** Aviso de que la generación de imágenes está apagada (experimental). */
export function imagenApagadaReply() {
  return [
    '🎨 *Generación de imágenes: experimental y APAGADA.*',
    '',
    'La IA de imágenes ya está instalada en el ordenador, pero no dibujo nada',
    'hasta que se encienda a propósito (solo el dueño o un admin):',
    '_!claw ajustes imagenes si_',
    '',
    'Y aun encendida, solo dibujo si me lo pides a mano con _!claw imagen ..._:',
    'nunca genero una imagen por mi cuenta.'
  ].join('\n');
}

/** Error al intentar generar una imagen. */
export function imagenErrorReply(error) {
  return [
    '🎨 No he podido generar la imagen.',
    '',
    `*${error || 'error desconocido'}*`,
    '',
    'Si es del motor local, revisa que existan sd-cli.exe y el modelo (_imagen_motor_, _imagen_pasos_).'
  ].join('\n');
}

/**
 * Aviso de que ahora mismo está dibujando otra imagen.
 * No es un fallo: va de una en una a propósito (la gráfica es pequeña), así que
 * se le dice con claridad en vez de soltarle un mensaje de error.
 */
export function imagenOcupadaReply() {
  return [
    '🎨 Dame un momento, que estoy dibujando otra imagen.',
    '',
    'Voy **de una en una** (para no quedarme sin memoria). Prueba otra vez en un momentito. ⏳'
  ].join('\n');
}

/** Ranking del contador de palabrotas. */
export function palabrotasReply({ ranking = [], total = 0, topWord = null, aviso = false } = {}) {
  if (!total || !ranking.length) {
    return [
      '🐷 *Contador de palabrotas*',
      '',
      'Nadie ha dicho ninguna todavía en este grupo. ¡Así se hace! 😇'
    ].join('\n');
  }
  const medallas = ['🥇', '🥈', '🥉'];
  const filas = ranking.map((r, i) => `${medallas[i] || '•'} *${r.author || 'alguien'}* — ${r.n}`);
  const mas =
    topWord && topWord.word
      ? `\n\n🤬 La más dicha: *${topWord.word}* (${topWord.n} ${topWord.n === 1 ? 'vez' : 'veces'}).`
      : '';
  return [
    aviso ? '😜 *¡Eso ha sido una palabrota!* Así va el ranking:' : '🐷 *Contador de palabrotas*',
    '',
    `En este grupo se han dicho *${total}* ${total === 1 ? 'palabrota' : 'palabrotas'}.`,
    '',
    ...filas,
    mas
  ].join('\n');
}

/** El examen más próximo, con los días que quedan. */
export function proximoReply(entries) {
  if (!entries.length) return nothingFound({ kind: 'examen' });
  const today = todayISO();
  const e = entries[0];
  const dias = e.fecha ? daysBetween(today, e.fecha) : null;
  const cuando = e.fecha ? longDate(e.fecha) : e.fechaTexto || 'sin fecha';
  const cuenta =
    dias === null ? '' : dias <= 0 ? ' (¡es hoy!)' : dias === 1 ? ' (¡mañana!)' : ` (en ${dias} días)`;
  const extra = meaningfulContent(e) ? `\n📖 Entra: ${meaningfulContent(e)}` : '';
  return [
    `⏰ *Lo próximo:* *${label(e)}*`,
    '',
    `📝 ${cuando}${cuenta}${extra}`,
    '',
    FOOTER
  ].join('\n');
}

/** Ayuda con todos los comandos. */
export function ayudita() {
  return [
    '🪝 *PickleBrain* — comandos',
    '',
    '*Para consultar:*',
    '• _!claw_ — estado y ajustes (los ajustes, solo el dueño)',
    '• _!claw deberes_ — deberes pendientes : _!claw deberes matematicas_',
    '• _!claw examenes_ — próximos exámenes',
    '• _!claw apuntes_ — todo lo que tengo apuntado (deberes y exámenes)',
    '• _!claw hecho lengua_ — marcar como hecho lo que ya está entregado',
    '• _!claw apunta deberes mates hacer la ficha para el viernes_ — apuntar o corregir a mano',
    '• _!claw proximo_ — lo próximo que cae',
    '• _!claw resumen_ — de qué se ha hablado estos días : _!claw resumen semana_',
    '• _!claw calendario_ — descargar los exámenes en formato .ics',
    '• _!claw busca <algo>_ — buscar en internet (DuckDuckGo)',
    '• _!claw imagen <qué>_ — generar una imagen (EXPERIMENTAL, apagada por defecto)',
    '• _!claw novedades_ — todo lo nuevo que se le ha añadido al bot',
    '• _!claw palabrotas_ — ranking de quién dice más tacos (también sale solo al soltar una 😜)',
    '',
    '*Ajedrez:*',
    '• _!claw ajedrez_ — jugar una partida contra Claw',
    '• _!claw ajedrez e4_ — mover (también vale _Nf3_, _O-O_ o _e2e4_)',
    '• _!claw analiza <FEN>_ — analizar una posición',
    '',
    '*Solo el dueño y administradores:*',
    '• _!claw ajustes_ — ver y cambiar los ajustes',
    '• _!claw ajustes ventana 30_ — cambiar uno',
    '• _!claw ajustes privado dueno|admins|todos|nadie_ — quién puede escribirme por privado',
    '• _!claw admins +600111222_ — añadir un administrador',
    '• _!claw prohibir +600111222_ — vetar a alguien (no podrá usar a Claw)',
    '• _!claw permitir +600111222_ — levantarle el veto',
    '• _!claw mantenimiento si|no_ — el bot se queda callado',
    '• _!claw olvida <texto>_ — borrar un apunte equivocado',
    '• _!claw olvida todo_ — borrar TODOS los apuntes del grupo',
    '• _!claw aqui_ / _!claw fuera_ — vincular o desvincular el grupo',
    '',
    '💬 Por *privado* (mensaje directo o el chat contigo mismo) también funciona:',
    'de momento solo el dueño puede escribirme por privado (se cambia con',
    '_!claw ajustes privado ..._). Lo que me digas de deberes o exámenes se apunta',
    'en el grupo, y puedes preguntarme por ellos por ahí. Para charlar de cualquier',
    'otra cosa por privado, escribe *Claw* + tu pregunta.',
    '',
    'Y para hablarle de cualquier cosa, escribe *Claw* + tu pregunta: _Claw cuánto son 2+2_'
  ].join('\n');
}
