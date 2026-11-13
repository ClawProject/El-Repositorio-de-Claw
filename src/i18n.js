// Claw languages.
//
// There are 100 languages to choose from in the initial setup. The language is
// stored in the database and applied live: the web, the bot's fixed texts and
// the AI replies.
//
// The fixed texts are translated into Spanish, English, Catalan, French,
// Portuguese, German, Italian, Russian, Arabic and Chinese. Every other language
// falls back to English, but the AI (Ollama) answers in the chosen language
// because the system prompt asks it to.
import { config } from './config.js';
import * as memory from './memory.js';

const CLAVE = 'cfg:idioma';

/** [code, native name, English name] */
const LISTA = [
  ['es', 'Español', 'Spanish'],
  ['en', 'English', 'English'],
  ['ca', 'Català', 'Catalan'],
  ['fr', 'Français', 'French'],
  ['pt', 'Português', 'Portuguese'],
  ['de', 'Deutsch', 'German'],
  ['it', 'Italiano', 'Italian'],
  ['ru', 'Русский', 'Russian'],
  ['ar', 'العربية', 'Arabic'],
  ['zh', '中文', 'Chinese'],
  ['ja', '日本語', 'Japanese'],
  ['ko', '한국어', 'Korean'],
  ['hi', 'हिन्दी', 'Hindi'],
  ['bn', 'বাংলা', 'Bengali'],
  ['ur', 'اردو', 'Urdu'],
  ['tr', 'Türkçe', 'Turkish'],
  ['nl', 'Nederlands', 'Dutch'],
  ['sv', 'Svenska', 'Swedish'],
  ['no', 'Norsk', 'Norwegian'],
  ['da', 'Dansk', 'Danish'],
  ['fi', 'Suomi', 'Finnish'],
  ['pl', 'Polski', 'Polish'],
  ['cs', 'Čeština', 'Czech'],
  ['sk', 'Slovenčina', 'Slovak'],
  ['hu', 'Magyar', 'Hungarian'],
  ['ro', 'Română', 'Romanian'],
  ['bg', 'Български', 'Bulgarian'],
  ['el', 'Ελληνικά', 'Greek'],
  ['he', 'עברית', 'Hebrew'],
  ['fa', 'فارسی', 'Persian'],
  ['th', 'ไทย', 'Thai'],
  ['vi', 'Tiếng Việt', 'Vietnamese'],
  ['id', 'Bahasa Indonesia', 'Indonesian'],
  ['ms', 'Bahasa Melayu', 'Malay'],
  ['tl', 'Filipino', 'Filipino'],
  ['uk', 'Українська', 'Ukrainian'],
  ['sr', 'Српски', 'Serbian'],
  ['hr', 'Hrvatski', 'Croatian'],
  ['sl', 'Slovenščina', 'Slovenian'],
  ['lt', 'Lietuvių', 'Lithuanian'],
  ['lv', 'Latviešu', 'Latvian'],
  ['et', 'Eesti', 'Estonian'],
  ['is', 'Íslenska', 'Icelandic'],
  ['ga', 'Gaeilge', 'Irish'],
  ['cy', 'Cymraeg', 'Welsh'],
  ['gd', 'Gàidhlig', 'Scottish Gaelic'],
  ['eu', 'Euskara', 'Basque'],
  ['gl', 'Galego', 'Galician'],
  ['ast', 'Asturianu', 'Asturian'],
  ['oc', 'Occitan', 'Occitan'],
  ['co', 'Corsu', 'Corsican'],
  ['sc', 'Sardu', 'Sardinian'],
  ['sq', 'Shqip', 'Albanian'],
  ['mk', 'Македонски', 'Macedonian'],
  ['bs', 'Bosanski', 'Bosnian'],
  ['mt', 'Malti', 'Maltese'],
  ['ka', 'ქართული', 'Georgian'],
  ['hy', 'Հայերեն', 'Armenian'],
  ['az', 'Azərbaycanca', 'Azerbaijani'],
  ['kk', 'Қазақша', 'Kazakh'],
  ['ky', 'Кыргызча', 'Kyrgyz'],
  ['uz', 'Oʻzbekcha', 'Uzbek'],
  ['tk', 'Türkmençe', 'Turkmen'],
  ['tg', 'Тоҷикӣ', 'Tajik'],
  ['mn', 'Монгол', 'Mongolian'],
  ['ne', 'नेपाली', 'Nepali'],
  ['si', 'සිංහල', 'Sinhala'],
  ['ta', 'தமிழ்', 'Tamil'],
  ['te', 'తెలుగు', 'Telugu'],
  ['kn', 'ಕನ್ನಡ', 'Kannada'],
  ['ml', 'മലയാളം', 'Malayalam'],
  ['gu', 'ગુજરાતી', 'Gujarati'],
  ['mr', 'मराठी', 'Marathi'],
  ['pa', 'ਪੰਜਾਬੀ', 'Punjabi'],
  ['or', 'ଓଡ଼ିଆ', 'Odia'],
  ['as', 'অসমীয়া', 'Assamese'],
  ['sd', 'سنڌي', 'Sindhi'],
  ['ps', 'پښتو', 'Pashto'],
  ['ku', 'Kurdî', 'Kurdish'],
  ['ckb', 'کوردی', 'Central Kurdish'],
  ['am', 'አማርኛ', 'Amharic'],
  ['ti', 'ትግርኛ', 'Tigrinya'],
  ['so', 'Soomaali', 'Somali'],
  ['sw', 'Kiswahili', 'Swahili'],
  ['ha', 'Hausa', 'Hausa'],
  ['yo', 'Yorùbá', 'Yoruba'],
  ['ig', 'Igbo', 'Igbo'],
  ['zu', 'isiZulu', 'Zulu'],
  ['xh', 'isiXhosa', 'Xhosa'],
  ['af', 'Afrikaans', 'Afrikaans'],
  ['mg', 'Malagasy', 'Malagasy'],
  ['ny', 'Chichewa', 'Chichewa'],
  ['sn', 'chiShona', 'Shona'],
  ['rw', 'Ikinyarwanda', 'Kinyarwanda'],
  ['lb', 'Lëtzebuergesch', 'Luxembourgish'],
  ['fo', 'Føroyskt', 'Faroese'],
  ['kl', 'Kalaallisut', 'Greenlandic'],
  ['mi', 'Te Reo Māori', 'Māori'],
  ['haw', 'ʻŌlelo Hawaiʻi', 'Hawaiian'],
  ['qu', 'Runa Simi', 'Quechua']
];

export const LANGUAGES = LISTA.map(([code, name, en]) => ({ code, name, en }));

const POR_CODIGO = new Map(LANGUAGES.map((l) => [l.code, l]));

/** Languages with translated fixed texts (the rest fall back to English). */
export const SOPORTADOS = ['es', 'en', 'ca', 'fr', 'pt', 'de', 'it', 'ru', 'ar', 'zh'];

/** Normalises what a person types: "en", "en-US", "English", "inglés"... */
export function normalizarIdioma(valor) {
  const v = String(valor || '').trim().toLowerCase();
  if (!v) return null;
  if (POR_CODIGO.has(v)) return v;
  const base = v.split(/[-_]/)[0];
  if (POR_CODIGO.has(base)) return base;
  const encontrado = LANGUAGES.find(
    (l) =>
      l.en.toLowerCase() === v ||
      l.name.toLowerCase() === v ||
      l.en.toLowerCase().startsWith(v) ||
      l.name.toLowerCase().startsWith(v)
  );
  return encontrado?.code || null;
}

export function existeIdioma(codigo) {
  return POR_CODIGO.has(String(codigo || '').toLowerCase());
}

export function infoIdioma(codigo = actual) {
  return POR_CODIGO.get(String(codigo || '').toLowerCase()) || POR_CODIGO.get('en');
}

export function codigos() {
  return LANGUAGES.map((l) => l.code);
}

/** Language code from the browser's Accept-Language header. */
export function idiomaDeCabecera(header) {
  const partes = String(header || '')
    .split(',')
    .map((p) => p.trim().split(';')[0])
    .filter(Boolean);
  for (const parte of partes) {
    const code = normalizarIdioma(parte);
    if (code) return code;
  }
  return 'es';
}

let actual = normalizarIdioma(config.idioma) || 'es';

export function idioma() {
  return actual;
}

/** Changes the language in memory and in `config` (without touching the database). */
export function setIdioma(codigo) {
  const code = normalizarIdioma(codigo);
  if (!code) return false;
  actual = code;
  config.idioma = code;
  return true;
}

/** Changes and stores the language. This is what the initial setup uses. */
export function guardarIdioma(codigo) {
  if (!setIdioma(codigo)) return false;
  try {
    memory.setSetting(CLAVE, JSON.stringify(actual));
  } catch {
    // There is no database yet (isolated tests).
  }
  return true;
}

/** Loads the stored language. Called after opening the database. */
export function cargarIdioma() {
  try {
    const guardado = memory.getSetting(CLAVE);
    if (guardado) setIdioma(JSON.parse(guardado));
  } catch {
    // Without a database we keep the factory language.
  }
  return actual;
}

/** Is the language still to be chosen? (a real first start). */
export function necesitaSetup() {
  try {
    if (memory.getSetting(CLAVE)) return false;
  } catch {
    return false;
  }
  return !String(process.env.CLAW_LANGUAGE || '').trim();
}

/** Translates a key. When the language lacks it, English and then Spanish are used. */
export function t(clave, vars = {}, codigo = actual) {
  const cat = CATALOGOS[codigo] || {};
  const texto = cat[clave] ?? CATALOGOS.en?.[clave] ?? CATALOGOS.es?.[clave] ?? clave;
  return String(texto).replace(/\{(\w+)\}/g, (m, k) =>
    vars[k] === undefined || vars[k] === null ? m : String(vars[k])
  );
}

/** AI prompt instruction: answer in the chosen language. */
export function instruccionIdioma(codigo = actual) {
  const info = infoIdioma(codigo);
  if (info.code === 'es') return 'En español de España, amable y directo.';
  return `En ${info.name} (${info.en}), amable y directo. Responde siempre en ese idioma aunque te escriban en otro.`;
}

// ---------------------------------------------------------------- catalogs

const CATALOGOS = {
  es: {
    general: 'General',
    footer: '_Según lo que se ha dicho en el grupo._',

    freshnessYesterday: 'ℹ️ El último dato es de ayer.',
    freshnessDays: 'ℹ️ El último dato es de hace {n} días.',
    freshnessWeek: 'ℹ️ El último dato es de hace más de una semana. Puede estar desactualizado.',

    para: 'para {when}',
    sinFecha: 'sin fecha',
    lineDeber: '• *{subject}*: {content} — _{when}_',
    lineExamen: '• *{subject}* — _{when}_{extra}',

    deberesTitle: '📚 *Deberes pendientes*',
    deberesTitleSubject: '📚 *Deberes de {subject}*',
    examenesTitle: '📝 *Próximos exámenes*',
    examenesTitleSubject: '📝 *Examen de {subject}*',

    apuntesEmpty:
      '🗂️ No tengo nada apuntado todavía. Si alguien dice los deberes o un examen en el grupo, lo guardo.',
    apuntesTitle: '🗂️ *Todo lo que tengo apuntado* ({n} {apunte})',
    apunte: 'apunte',
    apuntes: 'apuntes',
    apuntesDeberes: '📚 *Deberes* ({n})',
    apuntesExamenes: '📝 *Exámenes* ({n})',
    apuntesHint:
      'Para borrar algo: _!claw olvida <palabra>_  ·  Todo de golpe: _!claw olvida todo_',

    pastExam: '📝 Esos exámenes ya pasaron:',
    pastExamSubject: '📝 El examen de *{subject}* ya pasó:',

    nothingFound:
      '🤔 No tengo apuntado nada{of} sobre {what}. Si alguien lo dice en el grupo, lo guardo y lo recordaré.',
    nothingFoundOf: ' de *{subject}*',
    whatDeberes: 'los deberes',
    whatExamenes: 'los exámenes',

    savedAck: '✅ Apuntado — *{subject}*: {kind}{when}{detail}',
    kindDeberes: 'deberes',
    kindExamen: 'examen',
    savedWhen: ' el {date}',
    savedWhenText: ' ({text})',
    savedDetail: ': {content}',

    noSpace:
      '😣 No he podido guardar la foto: no queda espacio en el disco. Si liberas un poco, la próxima vez sí podré.',
    tooBig: '🙈 Esa foto pesa {mb} MB, no la he guardado para no llenar el disco.',
    mediaCaptionOne: '📎 Foto de lo que se compartió de {what}{of}',
    mediaCaptionMany: '📎 Fotos de lo que se compartió de {what}{of}',
    mediaWhatDeberes: 'los deberes',
    mediaWhatExamen: 'el examen',
    mediaOf: ' de {subject}',
    mediaOnly: '📎 No tengo el texto, pero sí lo que se compartió{of} en el grupo:',
    transcript: '🎧 _He entendido:_ {text}',

    welcome: [
      '👋 ¡Hola! Soy *PickleBrain*, el bot que se ha colado en este grupo.',
      '',
      'Me quedo escuchando en silencio e iré apuntando los *deberes* y los *exámenes* que se digan por aquí: fechas, temas, y las fotos o PDFs de lo que entra.',
      '',
      'Solo hablo si me preguntáis algo. Para verme el estado: *!claw*',
      'Y para pedirme cualquier cosa, escribid *Claw* + lo que sea:  _Claw cuánto son 2+2_',
      '',
      '_(Si molesto, se me quita con *!claw fuera*.)_'
    ].join('\n'),

    help: [
      '🪝 *PickleBrain*',
      '',
      '• Modelo: `{model}`',
      '• Grupo: {group}',
      '• Apuntado: {saved}',
      '',
      'Solo hablo cuando me preguntan por deberes o exámenes. Si alguien los dice, me los apunto solo.',
      'También entiendo *notas de voz* y guardo las *fotos* y los *PDF* que entra, para reenviarlos cuando preguntéis.',
      'Y puedes pedirme cosas escribiendo *Claw* + lo que sea: _Claw cuanto son 2+2_'
    ].join('\n'),
    helpGroupLinked: 'vinculado ✅',
    helpGroupUnlinked: 'sin vincular ❌',
    helpSaved: '{deberes} deberes, {examenes} exámenes{archivos}',
    helpFiles: ', {n} archivos',

    noPermitido:
      '🔒 Eso solo lo puede hacer el dueño y los administradores. Pídemelo a mí, que soy el que manda. 😉',

    olvidaOk: '🗑️ Hecho: he borrado {n} {apunte}.',
    olvidaNada: '🤷 No tengo apuntado nada que se parezca a "{texto}".',
    olvidaTodoOk:
      '🧹 Hecho: he borrado *todos* los apuntes ({n}). Ahora mismo no tengo nada guardado.',
    olvidaTodoNada: '🤷 No tenía nada apuntado, así que no hay nada que borrar.',

    hechoOkOne: '✅ *Apunte marcado como hecho*',
    hechoOkMany: '✅ *{n} apuntes marcados como hechos*',
    hechoOkFoot: '_Ya no saldrán como pendientes ni en los recordatorios._',
    hechoNada: '🤔 No encuentro nada pendiente que coincida con "{texto}".',
    hechoNadaHint:
      '_Prueba con la asignatura (por ejemplo, "lengua") o con una palabra del enunciado._',
    hechoAyudaTitle: '✅ ¿Qué doy por hecho? Dime la asignatura o una palabra:',
    hechoAyudaHint: '_!claw hecho lengua_ · _!claw hecho ficha 3_',
    hechoAyudaPending: 'Pendiente ahora mismo:',
    hechoAyudaMore: '…y {n} más.',

    apunteCreado: '✅ Apuntado',
    apunteActualizado: '✏️ Actualizado',
    apunteSinFecha: ' (sin fecha)',
    apunteManual: '{status} — *{subject}*: {kind}{when}{detail}',

    apuntaAyuda: [
      '✍️ Dime qué apunto y, si quieres, para cuándo. Ejemplos:',
      '• _!claw apunta deberes mates hacer la ficha 3 para el viernes_',
      '• _!claw apunta deberes lengua leer el tema 2 para mañana_',
      '• _!claw apunta examen historia tema 4 el 21 de octubre_',
      '• _!claw apunta deberes mates para el lunes_  (solo cambia la fecha)'
    ].join('\n'),

    adminsTitle: '👑 *Quién puede tocar los ajustes*',
    adminsOwner: '• Dueño: *{owner}*',
    adminsOwnerNone: 'sin asignar',
    adminsList: '• Administradores: {list}',
    adminsNone: '_ninguno_',

    vetadosTitle: '🚫 *Vetados (no pueden usar a Claw)*',
    vetadosNone: '_ninguno_',
    vetadosHint:
      'Vetar: _!claw prohibir +600111222_  ·  Perdonar: _!claw permitir +600111222_',

    imagenApagada: [
      '🎨 *Generación de imágenes: experimental y APAGADA.*',
      '',
      'La IA de imágenes ya está instalada en el ordenador, pero no dibujo nada',
      'hasta que se encienda a propósito (solo el dueño o un admin):',
      '_!claw ajustes imagenes si_',
      '',
      'Y aun encendida, solo dibujo si me lo pides a mano con _!claw imagen ..._:',
      'nunca genero una imagen por mi cuenta.'
    ].join('\n'),
    imagenError: '🎨 No he podido generar la imagen.',
    imagenErrorUnknown: 'error desconocido',
    imagenErrorHint:
      'Si es del motor local, revisa que existan sd-cli.exe y el modelo (_imagen_motor_, _imagen_pasos_).',
    imagenOcupada: [
      '🎨 Dame un momento, que estoy dibujando otra imagen.',
      '',
      'Voy **de una en una** (para no quedarme sin memoria). Prueba otra vez en un momentito. ⏳'
    ].join('\n'),

    palabrotasTitle: '🐷 *Contador de palabrotas*',
    palabrotasNone: 'Nadie ha dicho ninguna todavía en este grupo. ¡Así se hace! 😇',
    palabrotasSummary: 'En este grupo se han dicho *{total}* {palabra}.',
    palabrota: 'palabrota',
    palabrotas: 'palabrotas',
    palabrotasMost: '🤬 La más dicha: *{word}* ({n} {vez}).',
    vez: 'vez',
    veces: 'veces',
    palabrotasAlert: '😜 *¡Eso ha sido una palabrota!* Así va el ranking:',

    proximoTitle: '⏰ *Lo próximo:* *{subject}*',
    proximoBody: '📝 {when}{count}{extra}',
    proximoToday: ' (¡es hoy!)',
    proximoTomorrow: ' (¡mañana!)',
    proximoInDays: ' (en {n} días)',
    proximoExtra: '\n📖 Entra: {content}',

    ayudita: [
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
      '• _!claw personalidad_ — ver o cambiar cómo habla Claw (normal, profesor, gracioso, pirata)',
      '',
      '*Solo el dueño y administradores:*',
      '• _!claw ajustes_ — ver y cambiar los ajustes',
      '• _!claw ajustes ventana 30_ — cambiar uno',
      '• _!claw ajustes privado dueno|admins|todos|nadie_ — quién puede escribirme por privado',
      '• _!claw admins +600111222_ — añadir un administrador',
      '• _!claw prohibir +600111222_ — vetar a alguien (no podrá usar a Claw)',
      '• _!claw permitir +600111222_ — levantarle el veto',
      '• _!claw mantenimiento si|no_ — el bot se queda callado',
      '• _!claw idioma en_ — cambiar el idioma del bot',
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
    ].join('\n'),

    setupTitle: '🌍 Elige tu idioma',
    setupSubtitle: 'Así hablará Claw contigo. Podrás cambiarlo cuando quieras.',
    setupSearch: 'Buscar idioma…',
    setupButton: 'Continuar',
    setupNote: 'Elige uno de los 100 idiomas. La IA responderá en el que elijas.',
    setupFirstRun: 'Configuración inicial',
    setupSaved: 'Idioma guardado',
    setupNoResults: 'No hay idiomas que coincidan.',
    setupChangeLater: 'Podrás cambiarlo más tarde con !claw idioma',
    setupSuggested: 'Recomendados',

    languageChanged: '✅ Idioma cambiado a *{name}*.',
    languageUnknown:
      '🤔 No conozco ese idioma. Escribe el código (por ejemplo, en, fr, de) o míralo con _!claw idioma_.',
    languageUsage: 'Dime el idioma: _!claw idioma en_ · _!claw idioma español_',
    languageListTitle: '🌍 Idiomas disponibles',
    languageCurrent: 'Idioma actual: *{name}*',
    languageListLine: '• *{code}* {name}',
    languageMore: 'Hay 100 idiomas en total. Los demás se eligen en la configuración inicial.'
  },

  en: {
    general: 'General',
    footer: '_Based on what has been said in the group._',

    freshnessYesterday: 'ℹ️ The last update was yesterday.',
    freshnessDays: 'ℹ️ The last update was {n} days ago.',
    freshnessWeek: 'ℹ️ The last update was more than a week ago. It may be out of date.',

    para: 'for {when}',
    sinFecha: 'no date',
    lineDeber: '• *{subject}*: {content} — _{when}_',
    lineExamen: '• *{subject}* — _{when}_{extra}',

    deberesTitle: '📚 *Pending homework*',
    deberesTitleSubject: '📚 *{subject} homework*',
    examenesTitle: '📝 *Upcoming exams*',
    examenesTitleSubject: '📝 *{subject} exam*',

    apuntesEmpty:
      '🗂️ I have nothing saved yet. If someone mentions homework or an exam in the group, I will save it.',
    apuntesTitle: '🗂️ *Everything I have saved* ({n} {apunte})',
    apunte: 'item',
    apuntes: 'items',
    apuntesDeberes: '📚 *Homework* ({n})',
    apuntesExamenes: '📝 *Exams* ({n})',
    apuntesHint: 'To delete something: _!claw forget <word>_  ·  Everything: _!claw forget all_',

    pastExam: '📝 Those exams are already over:',
    pastExamSubject: '📝 The *{subject}* exam is already over:',

    nothingFound:
      '🤔 I have nothing saved{of} about {what}. If someone mentions it in the group, I will save it and remember it.',
    nothingFoundOf: ' for *{subject}*',
    whatDeberes: 'homework',
    whatExamenes: 'exams',

    savedAck: '✅ Saved — *{subject}*: {kind}{when}{detail}',
    kindDeberes: 'homework',
    kindExamen: 'exam',
    savedWhen: ' on {date}',
    savedWhenText: ' ({text})',
    savedDetail: ': {content}',

    noSpace:
      '😣 I could not save the photo: there is no space left on the disk. If you free some space, I will be able to next time.',
    tooBig: '🙈 That photo is {mb} MB, so I did not save it to avoid filling the disk.',
    mediaCaptionOne: '📎 Photo of what was shared for {what}{of}',
    mediaCaptionMany: '📎 Photos of what was shared for {what}{of}',
    mediaWhatDeberes: 'the homework',
    mediaWhatExamen: 'the exam',
    mediaOf: ' of {subject}',
    mediaOnly: '📎 I do not have the text, but I do have what was shared{of} in the group:',
    transcript: '🎧 _I understood:_ {text}',

    welcome: [
      '👋 Hi! I am *PickleBrain*, the bot that has slipped into this group.',
      '',
      'I listen quietly and write down the *homework* and *exams* mentioned here: dates, topics, and the photos or PDFs that come in.',
      '',
      'I only speak when you ask me something. To see my status: *!claw*',
      'And to ask me anything, write *Claw* + your question:  _Claw what is 2+2_',
      '',
      '_(If I am annoying, remove me with *!claw fuera*.)_'
    ].join('\n'),

    help: [
      '🪝 *PickleBrain*',
      '',
      '• Model: `{model}`',
      '• Group: {group}',
      '• Saved: {saved}',
      '',
      'I only speak when asked about homework or exams. If someone mentions them, I save them automatically.',
      'I also understand *voice notes* and keep the *photos* and *PDFs* that come in, so I can send them back when you ask.',
      'And you can ask me anything by writing *Claw* + your question: _Claw what is 2+2_'
    ].join('\n'),
    helpGroupLinked: 'linked ✅',
    helpGroupUnlinked: 'not linked ❌',
    helpSaved: '{deberes} homework, {examenes} exams{archivos}',
    helpFiles: ', {n} files',

    noPermitido:
      '🔒 Only the owner and administrators can do that. Ask me, I am the one in charge. 😉',

    olvidaOk: '🗑️ Done: I deleted {n} {apunte}.',
    olvidaNada: '🤷 I have nothing saved that looks like "{texto}".',
    olvidaTodoOk: '🧹 Done: I deleted *all* saved items ({n}). I have nothing saved right now.',
    olvidaTodoNada: '🤷 I had nothing saved, so there is nothing to delete.',

    hechoOkOne: '✅ *Item marked as done*',
    hechoOkMany: '✅ *{n} items marked as done*',
    hechoOkFoot: '_They will no longer appear as pending or in reminders._',
    hechoNada: '🤔 I cannot find anything pending that matches "{texto}".',
    hechoNadaHint: '_Try the subject (for example, "maths") or a word from the description._',
    hechoAyudaTitle: '✅ What should I mark as done? Tell me the subject or a word:',
    hechoAyudaHint: '_!claw done maths_ · _!claw done worksheet 3_',
    hechoAyudaPending: 'Pending right now:',
    hechoAyudaMore: '…and {n} more.',

    apunteCreado: '✅ Saved',
    apunteActualizado: '✏️ Updated',
    apunteSinFecha: ' (no date)',
    apunteManual: '{status} — *{subject}*: {kind}{when}{detail}',

    apuntaAyuda: [
      '✍️ Tell me what to save and, if you want, when it is due. Examples:',
      '• _!claw save homework maths do worksheet 3 for Friday_',
      '• _!claw save homework English read topic 2 for tomorrow_',
      '• _!claw save exam history topic 4 on 21 October_',
      '• _!claw save homework maths for Monday_  (only changes the date)'
    ].join('\n'),

    adminsTitle: '👑 *Who can change the settings*',
    adminsOwner: '• Owner: *{owner}*',
    adminsOwnerNone: 'not assigned',
    adminsList: '• Administrators: {list}',
    adminsNone: '_none_',

    vetadosTitle: '🚫 *Banned (cannot use Claw)*',
    vetadosNone: '_none_',
    vetadosHint: 'Ban: _!claw ban +600111222_  ·  Forgive: _!claw unban +600111222_',

    imagenApagada: [
      '🎨 *Image generation: experimental and OFF.*',
      '',
      'The image AI is installed on the computer, but I do not draw anything',
      'until it is switched on on purpose (owner or admin only):',
      '_!claw settings images yes_',
      '',
      'And even when on, I only draw if you ask me by hand with _!claw image ..._:',
      'I never generate an image on my own.'
    ].join('\n'),
    imagenError: '🎨 I could not generate the image.',
    imagenErrorUnknown: 'unknown error',
    imagenErrorHint:
      'If it is the local engine, check that sd-cli.exe and the model exist (_image_engine_, _image_steps_).',
    imagenOcupada: [
      '🎨 Give me a moment, I am drawing another image.',
      '',
      'I go **one at a time** (so I do not run out of memory). Try again in a moment. ⏳'
    ].join('\n'),

    palabrotasTitle: '🐷 *Swear counter*',
    palabrotasNone: 'Nobody has said any in this group yet. Good job! 😇',
    palabrotasSummary: 'In this group, *{total}* {palabra} have been said.',
    palabrota: 'swear word',
    palabrotas: 'swear words',
    palabrotasMost: '🤬 Most said: *{word}* ({n} {vez}).',
    vez: 'time',
    veces: 'times',
    palabrotasAlert: '😜 *That was a swear word!* Here is the ranking:',

    proximoTitle: '⏰ *Next up:* *{subject}*',
    proximoBody: '📝 {when}{count}{extra}',
    proximoToday: ' (it is today!)',
    proximoTomorrow: ' (tomorrow!)',
    proximoInDays: ' (in {n} days)',
    proximoExtra: '\n📖 Content: {content}',

    ayudita: [
      '🪝 *PickleBrain* — commands',
      '',
      '*To check things:*',
      '• _!claw_ — status and settings (settings, owner only)',
      '• _!claw homework_ — pending homework : _!claw homework maths_',
      '• _!claw exams_ — upcoming exams',
      '• _!claw saved_ — everything I have saved (homework and exams)',
      '• _!claw done English_ — mark what has already been handed in as done',
      '• _!claw save homework maths do the worksheet for Friday_ — save or correct by hand',
      '• _!claw next_ — what is coming up next',
      '• _!claw summary_ — what has been talked about these days : _!claw summary week_',
      '• _!claw calendar_ — download the exams as .ics',
      '• _!claw search <something>_ — search the internet (DuckDuckGo)',
      '• _!claw image <what>_ — generate an image (EXPERIMENTAL, off by default)',
      '• _!claw news_ — everything new added to the bot',
      '• _!claw swears_ — ranking of who swears most (also appears automatically 😜)',
      '',
      '*Chess:*',
      '• _!claw chess_ — play a game against Claw',
      '• _!claw chess e4_ — move (also _Nf3_, _O-O_ or _e2e4_)',
      '• _!claw analyse <FEN>_ — analyse a position',
      '• _!claw personality_ — see or change how Claw talks (normal, profesor, gracioso, pirata)',
      '',
      '*Owner and administrators only:*',
      '• _!claw settings_ — see and change the settings',
      '• _!claw settings window 30_ — change one',
      '• _!claw settings private owner|admins|all|nobody_ — who can message me privately',
      '• _!claw admins +600111222_ — add an administrator',
      '• _!claw ban +600111222_ — ban someone (they cannot use Claw)',
      '• _!claw unban +600111222_ — lift the ban',
      '• _!claw maintenance yes|no_ — the bot stays silent',
      '• _!claw language en_ — change the bot language',
      '• _!claw forget <text>_ — delete a wrong saved item',
      '• _!claw forget all_ — delete ALL saved items in the group',
      '• _!claw here_ / _!claw leave_ — link or unlink the group',
      '',
      '💬 *Private messages* (direct message or your own chat) also work:',
      'for now only the owner can message me privately (change it with',
      '_!claw settings private ..._). What you tell me about homework or exams is saved',
      'in the group, and you can ask me about it there. To chat about anything',
      'else privately, write *Claw* + your question.',
      '',
      'And to talk to me about anything, write *Claw* + your question: _Claw what is 2+2_'
    ].join('\n'),

    setupTitle: '🌍 Choose your language',
    setupSubtitle: 'This is how Claw will talk to you. You can change it whenever you want.',
    setupSearch: 'Search language…',
    setupButton: 'Continue',
    setupNote: 'Choose one of 100 languages. The AI will answer in the one you pick.',
    setupFirstRun: 'First-time setup',
    setupSaved: 'Language saved',
    setupNoResults: 'No matching languages.',
    setupChangeLater: 'You can change it later with !claw language',
    setupSuggested: 'Recommended',

    languageChanged: '✅ Language changed to *{name}*.',
    languageUnknown:
      '🤔 I do not know that language. Write the code (for example, en, fr, de) or check with _!claw language_.',
    languageUsage: 'Tell me the language: _!claw language en_ · _!claw language English_',
    languageListTitle: '🌍 Available languages',
    languageCurrent: 'Current language: *{name}*',
    languageListLine: '• *{code}* {name}',
    languageMore: 'There are 100 languages in total. The rest are chosen in the first-time setup.'
  },

  ca: {
    general: 'General',
    footer: "_Segons el que s'ha dit al grup._",
    welcome: [
      "👋 Hola! Soc *PickleBrain*, el bot que s'ha colat en aquest grup.",
      '',
      'Em quedo escoltant en silenci i aniré apuntant els *deures* i els *exàmens* que es diguin per aquí: dates, temes, i les fotos o PDFs del que entra.',
      '',
      'Només parlo si em pregunteu alguna cosa. Per veure el meu estat: *!claw*',
      'I per demanar-me qualsevol cosa, escriviu *Claw* + el que sigui: _Claw quant fan 2+2_',
      '',
      '_(Si molesto, em treieu amb *!claw fuera*.)_'
    ].join('\n'),
    help: [
      '🪝 *PickleBrain*',
      '',
      '• Model: `{model}`',
      '• Grup: {group}',
      '• Apuntat: {saved}',
      '',
      'Només parlo quan em pregunten per deures o exàmens. Si algú els diu, me\'ls apunto sol.',
      'També entenc *notes de veu* i guardo les *fotos* i els *PDF* que entren, per reenviar-los quan pregunteu.',
      'I pots demanar-me coses escrivint *Claw* + el que sigui: _Claw quant fan 2+2_'
    ].join('\n'),
    helpGroupLinked: 'vinculat ✅',
    helpGroupUnlinked: 'sense vincular ❌',
    helpSaved: '{deberes} deures, {examenes} exàmens{archivos}',
    helpFiles: ', {n} arxius',
    noPermitido:
      "🔒 Això només ho pot fer el propietari i els administradors. Demana-m'ho a mi, que soc qui mana. 😉",
    adminsTitle: '👑 *Qui pot tocar els ajustos*',
    adminsOwner: '• Propietari: *{owner}*',
    adminsOwnerNone: 'sense assignar',
    adminsList: '• Administradors: {list}',
    adminsNone: '_cap_',
    vetadosTitle: '🚫 *Vetats (no poden usar Claw)*',
    vetadosNone: '_cap_',
    vetadosHint: 'Vetar: _!claw prohibir +600111222_  ·  Perdonar: _!claw perdonar +600111222_',
    languageChanged: '✅ Idioma canviat a *{name}*.',
    languageUnknown:
      '🤔 No conec aquest idioma. Escriu el codi (per exemple, en, fr, de) o consulta-ho amb _!claw idioma_.',
    languageUsage: "Digues-me l'idioma: _!claw idioma en_ · _!claw idioma català_",
    languageListTitle: '🌍 Idiomes disponibles',
    languageCurrent: 'Idioma actual: *{name}*',
    languageListLine: '• *{code}* {name}',
    languageMore: 'Hi ha 100 idiomes en total. Els altres es trien a la configuració inicial.',
    setupTitle: '🌍 Tria el teu idioma',
    setupSubtitle: 'Així parlarà Claw amb tu. Podràs canviar-lo quan vulguis.',
    setupSearch: 'Cercar idioma…',
    setupButton: 'Continuar',
    setupNote: 'Tria un dels 100 idiomes. La IA respondrà en el que triïs.',
    setupFirstRun: 'Configuració inicial',
    setupSaved: 'Idioma desat',
    setupNoResults: 'No hi ha idiomes que coincideixin.',
    setupChangeLater: 'Podràs canviar-lo més tard amb !claw idioma',
    setupSuggested: 'Recomanats',

    freshnessYesterday: "ℹ️ L'última dada és d'ahir.",
    freshnessDays: "ℹ️ L'última dada és de fa {n} dies.",
    freshnessWeek: "ℹ️ L'última dada és de fa més d'una setmana. Pot estar desactualitzada.",

    para: 'per a {when}',
    sinFecha: 'sense data',
    lineDeber: '• *{subject}*: {content} — _{when}_',
    lineExamen: '• *{subject}* — _{when}_{extra}',

    deberesTitle: '📚 *Deures pendents*',
    deberesTitleSubject: '📚 *Deures de {subject}*',
    examenesTitle: '📝 *Propers exàmens*',
    examenesTitleSubject: '📝 *Examen de {subject}*',

    apuntesEmpty:
      '🗂️ Encara no tinc res apuntat. Si algú diu els deures o un examen al grup, ho guardo.',
    apuntesTitle: '🗂️ *Tot el que tinc apuntat* ({n} {apunte})',
    apunte: 'apunt',
    apuntes: 'apunts',
    apuntesDeberes: '📚 *Deures* ({n})',
    apuntesExamenes: '📝 *Exàmens* ({n})',
    apuntesHint:
      'Per esborrar alguna cosa: _!claw olvida <paraula>_  ·  Tot de cop: _!claw olvida todo_',

    pastExam: '📝 Aquests exàmens ja han passat:',
    pastExamSubject: "📝 L'examen de *{subject}* ja ha passat:",

    nothingFound:
      '🤔 No tinc apuntat res{of} sobre {what}. Si algú ho diu al grup, ho guardo i ho recordaré.',
    nothingFoundOf: ' de *{subject}*',
    whatDeberes: 'els deures',
    whatExamenes: 'els exàmens',

    savedAck: '✅ Apuntat — *{subject}*: {kind}{when}{detail}',
    kindDeberes: 'deures',
    kindExamen: 'examen',
    savedWhen: ' el {date}',
    savedWhenText: ' ({text})',
    savedDetail: ': {content}',

    noSpace:
      "😣 No he pogut guardar la foto: no queda espai al disc. Si n'alliberes una mica, la propera vegada sí que podré.",
    tooBig: "🙈 Aquesta foto pesa {mb} MB, no l'he guardada per no omplir el disc.",
    mediaCaptionOne: '📎 Foto del que es va compartir de {what}{of}',
    mediaCaptionMany: '📎 Fotos del que es va compartir de {what}{of}',
    mediaWhatDeberes: 'els deures',
    mediaWhatExamen: "l'examen",
    mediaOf: ' de {subject}',
    mediaOnly: '📎 No tinc el text, però sí el que es va compartir{of} al grup:',
    transcript: '🎧 _He entès:_ {text}',

    olvidaOk: '🗑️ Fet: he esborrat {n} {apunte}.',
    olvidaNada: '🤷 No tinc apuntat res que s\'assembli a "{texto}".',
    olvidaTodoOk:
      '🧹 Fet: he esborrat *tots* els apunts ({n}). Ara mateix no tinc res guardat.',
    olvidaTodoNada: '🤷 No tenia res apuntat, així que no hi ha res a esborrar.',

    hechoOkOne: '✅ *Apunt marcat com a fet*',
    hechoOkMany: '✅ *{n} apunts marcats com a fets*',
    hechoOkFoot: '_Ja no sortiran com a pendents ni als recordatoris._',
    hechoNada: '🤔 No trobo res pendent que coincideixi amb "{texto}".',
    hechoNadaHint:
      '_Prova amb l\'assignatura (per exemple, "lengua") o amb una paraula de l\'enunciat._',
    hechoAyudaTitle: "✅ Què dono per fet? Digues-me l'assignatura o una paraula:",
    hechoAyudaHint: '_!claw hecho lengua_ · _!claw hecho fitxa 3_',
    hechoAyudaPending: 'Pendent ara mateix:',
    hechoAyudaMore: '…i {n} més.',

    apunteCreado: '✅ Apuntat',
    apunteActualizado: '✏️ Actualitzat',
    apunteSinFecha: ' (sense data)',
    apunteManual: '{status} — *{subject}*: {kind}{when}{detail}',

    apuntaAyuda: [
      '✍️ Digues-me què apunto i, si vols, per a quan. Exemples:',
      '• _!claw apunta deberes mates fer la fitxa 3 per al divendres_',
      '• _!claw apunta deberes lengua llegir el tema 2 per a demà_',
      "• _!claw apunta examen historia tema 4 el 21 d'octubre_",
      '• _!claw apunta deberes mates per al dilluns_  (només canvia la data)'
    ].join('\n'),

    imagenApagada: [
      "🎨 *Generació d'imatges: experimental i APAGADA.*",
      '',
      "La IA d'imatges ja està instal·lada a l'ordinador, però no dibuixo res",
      "fins que s'encengui a propòsit (només el propietari o un admin):",
      '_!claw ajustes imagenes si_',
      '',
      "I encara encesa, només dibuixo si m'ho demanes a mà amb _!claw imagen ..._:",
      'mai genero una imatge pel meu compte.'
    ].join('\n'),
    imagenError: "🎨 No he pogut generar la imatge.",
    imagenErrorUnknown: 'error desconegut',
    imagenErrorHint:
      'Si és del motor local, revisa que existeixin sd-cli.exe i el model (_imagen_motor_, _imagen_pasos_).',
    imagenOcupada: [
      "🎨 Dona'm un moment, que estic dibuixant una altra imatge.",
      '',
      "Vaig **d'una en una** (per no quedar-me sense memòria). Torna-ho a provar d'aquí a un momentet. ⏳"
    ].join('\n'),

    palabrotasTitle: '🐷 *Comptador de paraulotes*',
    palabrotasNone: "Ningú n'ha dit cap encara en aquest grup. Així es fa! 😇",
    palabrotasSummary: "En aquest grup s'han dit *{total}* {palabra}.",
    palabrota: 'paraulota',
    palabrotas: 'paraulotes',
    palabrotasMost: '🤬 La més dita: *{word}* ({n} {vez}).',
    vez: 'vegada',
    veces: 'vegades',
    palabrotasAlert: '😜 *Això ha estat una paraulota!* Així va el rànquing:',

    proximoTitle: '⏰ *El pròxim:* *{subject}*',
    proximoBody: '📝 {when}{count}{extra}',
    proximoToday: ' (és avui!)',
    proximoTomorrow: ' (demà!)',
    proximoInDays: ' (en {n} dies)',
    proximoExtra: '\n📖 Entra: {content}',

    ayudita: [
      '🪝 *PickleBrain* — comandes',
      '',
      '*Per consultar:*',
      '• _!claw_ — estat i ajustos (els ajustos, només el propietari)',
      '• _!claw deberes_ — deures pendents : _!claw deberes matematiques_',
      '• _!claw examenes_ — propers exàmens',
      '• _!claw apuntes_ — tot el que tinc apuntat (deures i exàmens)',
      '• _!claw hecho lengua_ — marcar com a fet el que ja s\'ha entregat',
      '• _!claw apunta deberes mates fer la fitxa per al divendres_ — apuntar o corregir a mà',
      '• _!claw proximo_ — el pròxim que cau',
      '• _!claw resumen_ — de què s\'ha parlat aquests dies : _!claw resumen semana_',
      '• _!claw calendario_ — descarregar els exàmens en format .ics',
      '• _!claw busca <alguna cosa>_ — buscar a internet (DuckDuckGo)',
      '• _!claw imagen <què>_ — generar una imatge (EXPERIMENTAL, apagada per defecte)',
      '• _!claw novedades_ — tot el que és nou que s\'ha afegit al bot',
      '• _!claw palabrotas_ — rànquing de qui diu més paraulotes (també surt sol 😜)',
      '',
      '*Escacs:*',
      '• _!claw ajedrez_ — jugar una partida contra Claw',
      '• _!claw ajedrez e4_ — moure (també val _Nf3_, _O-O_ o _e2e4_)',
      '• _!claw analiza <FEN>_ — analitzar una posició',
      '• _!claw personalidad_ — veure o canviar com parla Claw (normal, profesor, gracioso, pirata)',
      '',
      '*Només el propietari i administradors:*',
      '• _!claw ajustes_ — veure i canviar els ajustos',
      '• _!claw ajustes ventana 30_ — canviar-ne un',
      '• _!claw ajustes privado dueno|admins|todos|nadie_ — qui pot escriure\'m per privat',
      '• _!claw admins +600111222_ — afegir un administrador',
      '• _!claw prohibir +600111222_ — vetar algú (no podrà usar Claw)',
      '• _!claw permitir +600111222_ — aixecar-li el veto',
      '• _!claw mantenimiento si|no_ — el bot es queda callat',
      "• _!claw idioma en_ — canviar l'idioma del bot",
      '• _!claw olvida <text>_ — esborrar un apunt equivocat',
      '• _!claw olvida todo_ — esborrar TOTS els apunts del grup',
      '• _!claw aqui_ / _!claw fuera_ — vincular o desvincular el grup',
      '',
      '💬 Per *privat* (missatge directe o el xat amb tu mateix) també funciona:',
      'de moment només el propietari pot escriure\'m per privat (es canvia amb',
      '_!claw ajustes privado ..._). El que em diguis de deures o exàmens s\'apunta',
      'al grup, i pots preguntar-me\'n per aquí. Per xerrar de qualsevol',
      'altra cosa per privat, escriu *Claw* + la teva pregunta.',
      '',
      'I per parlar-li de qualsevol cosa, escriu *Claw* + la teva pregunta: _Claw quant fan 2+2_'
    ].join('\n')
  },

  fr: {
    general: 'Général',
    footer: "_D'après ce qui a été dit dans le groupe._",
    welcome: [
      "👋 Salut ! Je suis *PickleBrain*, le bot qui s'est glissé dans ce groupe.",
      '',
      "J'écoute en silence et je note les *devoirs* et les *examens* dont on parle ici : dates, thèmes, et les photos ou PDF de ce qui arrive.",
      '',
      'Je ne parle que si vous me posez une question. Pour voir mon état : *!claw*',
      'Et pour me demander n\'importe quoi, écrivez *Claw* + votre question : _Claw combien font 2+2_',
      '',
      '_(Si je dérange, retirez-moi avec *!claw fuera*.)_'
    ].join('\n'),
    help: [
      '🪝 *PickleBrain*',
      '',
      '• Modèle : `{model}`',
      '• Groupe : {group}',
      '• Enregistré : {saved}',
      '',
      'Je ne parle que lorsqu\'on me pose des questions sur les devoirs ou les examens. Si quelqu\'un les mentionne, je les note tout seul.',
      'Je comprends aussi les *notes vocales* et je garde les *photos* et les *PDF* qui arrivent, pour les renvoyer quand vous demandez.',
      'Et vous pouvez me demander n\'importe quoi en écrivant *Claw* + votre question : _Claw combien font 2+2_'
    ].join('\n'),
    helpGroupLinked: 'lié ✅',
    helpGroupUnlinked: 'non lié ❌',
    helpSaved: '{deberes} devoirs, {examenes} examens{archivos}',
    helpFiles: ', {n} fichiers',
    noPermitido:
      "🔒 Seuls le propriétaire et les administrateurs peuvent faire cela. Demandez-le-moi, c'est moi qui commande. 😉",
    adminsTitle: '👑 *Qui peut modifier les réglages*',
    adminsOwner: '• Propriétaire : *{owner}*',
    adminsOwnerNone: 'non attribué',
    adminsList: '• Administrateurs : {list}',
    adminsNone: '_aucun_',
    vetadosTitle: '🚫 *Bannis (ne peuvent pas utiliser Claw)*',
    vetadosNone: '_aucun_',
    vetadosHint: 'Bannir : _!claw bannir +600111222_  ·  Pardonner : _!claw pardonner +600111222_',
    languageChanged: '✅ Langue changée en *{name}*.',
    languageUnknown:
      '🤔 Je ne connais pas cette langue. Écrivez le code (par exemple, en, fr, de) ou consultez _!claw langue_.',
    languageUsage: 'Dites-moi la langue : _!claw langue en_ · _!claw langue français_',
    languageListTitle: '🌍 Langues disponibles',
    languageCurrent: 'Langue actuelle : *{name}*',
    languageListLine: '• *{code}* {name}',
    languageMore: 'Il y a 100 langues au total. Les autres se choisissent lors de la configuration initiale.',
    setupTitle: '🌍 Choisissez votre langue',
    setupSubtitle: "C'est ainsi que Claw vous parlera. Vous pourrez le changer quand vous voulez.",
    setupSearch: 'Rechercher une langue…',
    setupButton: 'Continuer',
    setupNote: "Choisissez l'une des 100 langues. L'IA répondra dans celle que vous choisirez.",
    setupFirstRun: 'Configuration initiale',
    setupSaved: 'Langue enregistrée',
    setupNoResults: 'Aucune langue ne correspond.',
    setupChangeLater: 'Vous pourrez la changer plus tard avec !claw langue',
    setupSuggested: 'Recommandées',

    freshnessYesterday: "ℹ️ La dernière info date d'hier.",
    freshnessDays: 'ℹ️ La dernière info date de {n} jours.',
    freshnessWeek:
      "ℹ️ La dernière info date de plus d'une semaine. Elle peut être obsolète.",

    para: 'pour {when}',
    sinFecha: 'sans date',
    lineDeber: '• *{subject}* : {content} — _{when}_',
    lineExamen: '• *{subject}* — _{when}_{extra}',

    deberesTitle: '📚 *Devoirs en attente*',
    deberesTitleSubject: '📚 *Devoirs de {subject}*',
    examenesTitle: '📝 *Prochains examens*',
    examenesTitleSubject: '📝 *Examen de {subject}*',

    apuntesEmpty:
      "🗂️ Je n'ai encore rien noté. Si quelqu'un mentionne les devoirs ou un examen dans le groupe, je l'enregistre.",
    apuntesTitle: "🗂️ *Tout ce que j'ai noté* ({n} {apunte})",
    apunte: 'note',
    apuntes: 'notes',
    apuntesDeberes: '📚 *Devoirs* ({n})',
    apuntesExamenes: '📝 *Examens* ({n})',
    apuntesHint:
      "Pour supprimer quelque chose : _!claw olvida <mot>_  ·  Tout d'un coup : _!claw olvida todo_",

    pastExam: '📝 Ces examens sont déjà passés :',
    pastExamSubject: "📝 L'examen de *{subject}* est déjà passé :",

    nothingFound:
      "🤔 Je n'ai rien noté{of} sur {what}. Si quelqu'un en parle dans le groupe, je l'enregistre et je m'en souviendrai.",
    nothingFoundOf: ' pour *{subject}*',
    whatDeberes: 'les devoirs',
    whatExamenes: 'les examens',

    savedAck: '✅ Noté — *{subject}* : {kind}{when}{detail}',
    kindDeberes: 'devoirs',
    kindExamen: 'examen',
    savedWhen: ' le {date}',
    savedWhenText: ' ({text})',
    savedDetail: ' : {content}',

    noSpace:
      "😣 Je n'ai pas pu enregistrer la photo : il ne reste plus d'espace sur le disque. Si tu en libères un peu, je pourrai la prochaine fois.",
    tooBig:
      "🙈 Cette photo pèse {mb} Mo, je ne l'ai pas enregistrée pour ne pas remplir le disque.",
    mediaCaptionOne: '📎 Photo de ce qui a été partagé pour {what}{of}',
    mediaCaptionMany: '📎 Photos de ce qui a été partagé pour {what}{of}',
    mediaWhatDeberes: 'les devoirs',
    mediaWhatExamen: "l'examen",
    mediaOf: ' de {subject}',
    mediaOnly: "📎 Je n'ai pas le texte, mais j'ai ce qui a été partagé{of} dans le groupe :",
    transcript: "🎧 _J'ai compris :_ {text}",

    olvidaOk: "🗑️ C'est fait : j'ai supprimé {n} {apunte}.",
    olvidaNada: "🤷 Je n'ai rien noté qui ressemble à « {texto} ».",
    olvidaTodoOk:
      "🧹 C'est fait : j'ai supprimé *toutes* les notes ({n}). Je n'ai plus rien enregistré.",
    olvidaTodoNada: "🤷 Je n'avais rien noté, donc il n'y a rien à supprimer.",

    hechoOkOne: '✅ *Note marquée comme faite*',
    hechoOkMany: '✅ *{n} notes marquées comme faites*',
    hechoOkFoot:
      "_Elles n'apparaîtront plus comme en attente ni dans les rappels._",
    hechoNada: '🤔 Je ne trouve rien en attente qui corresponde à « {texto} ».',
    hechoNadaHint:
      "_Essaie la matière (par exemple, « maths ») ou un mot de l'énoncé._",
    hechoAyudaTitle: '✅ Que dois-je marquer comme fait ? Dis-moi la matière ou un mot :',
    hechoAyudaHint: '_!claw hecho lengua_ · _!claw hecho fiche 3_',
    hechoAyudaPending: 'En attente en ce moment :',
    hechoAyudaMore: '…et {n} de plus.',

    apunteCreado: '✅ Noté',
    apunteActualizado: '✏️ Mis à jour',
    apunteSinFecha: ' (sans date)',
    apunteManual: '{status} — *{subject}* : {kind}{when}{detail}',

    apuntaAyuda: [
      '✍️ Dis-moi quoi noter et, si tu veux, pour quand. Exemples :',
      '• _!claw apunta deberes maths faire la fiche 3 pour vendredi_',
      '• _!claw apunta deberes anglais lire le thème 2 pour demain_',
      '• _!claw apunta examen histoire thème 4 le 21 octobre_',
      '• _!claw apunta deberes maths pour lundi_  (change seulement la date)'
    ].join('\n'),

    imagenApagada: [
      "🎨 *Génération d'images : expérimentale et DÉSACTIVÉE.*",
      '',
      "L'IA d'images est déjà installée sur l'ordinateur, mais je ne dessine rien",
      "tant qu'elle n'est pas activée exprès (propriétaire ou admin seulement) :",
      '_!claw ajustes imagenes si_',
      '',
      "Et même activée, je ne dessine que si tu me le demandes à la main avec _!claw imagen ..._ :",
      "je ne génère jamais une image de moi-même."
    ].join('\n'),
    imagenError: "🎨 Je n'ai pas pu générer l'image.",
    imagenErrorUnknown: 'erreur inconnue',
    imagenErrorHint:
      "S'il s'agit du moteur local, vérifie que sd-cli.exe et le modèle existent (_imagen_motor_, _imagen_pasos_).",
    imagenOcupada: [
      '🎨 Donne-moi un instant, je dessine une autre image.',
      '',
      'Je fais **une par une** (pour ne pas manquer de mémoire). Réessaie dans un petit moment. ⏳'
    ].join('\n'),

    palabrotasTitle: '🐷 *Compteur de gros mots*',
    palabrotasNone: "Personne n'en a encore dit dans ce groupe. Bravo ! 😇",
    palabrotasSummary: 'Dans ce groupe, *{total}* {palabra} ont été dits.',
    palabrota: 'gros mot',
    palabrotas: 'gros mots',
    palabrotasMost: '🤬 Le plus dit : *{word}* ({n} {vez}).',
    vez: 'fois',
    veces: 'fois',
    palabrotasAlert: "😜 *C'était un gros mot !* Voici le classement :",

    proximoTitle: '⏰ *Le prochain :* *{subject}*',
    proximoBody: '📝 {when}{count}{extra}',
    proximoToday: " (c'est aujourd'hui !)",
    proximoTomorrow: ' (demain !)',
    proximoInDays: ' (dans {n} jours)',
    proximoExtra: '\n📖 Au programme : {content}',

    ayudita: [
      '🪝 *PickleBrain* — commandes',
      '',
      '*Pour consulter :*',
      '• _!claw_ — état et réglages (les réglages, propriétaire uniquement)',
      '• _!claw deberes_ — devoirs en attente : _!claw deberes maths_',
      '• _!claw examenes_ — prochains examens',
      '• _!claw apuntes_ — tout ce que j\'ai noté (devoirs et examens)',
      '• _!claw hecho lengua_ — marquer comme fait ce qui a déjà été rendu',
      '• _!claw apunta deberes maths faire la fiche pour vendredi_ — noter ou corriger à la main',
      '• _!claw proximo_ — ce qui arrive ensuite',
      '• _!claw resumen_ — ce dont on a parlé ces jours-ci : _!claw resumen semana_',
      '• _!claw calendario_ — télécharger les examens au format .ics',
      '• _!claw busca <quelque chose>_ — chercher sur internet (DuckDuckGo)',
      '• _!claw imagen <quoi>_ — générer une image (EXPÉRIMENTAL, désactivé par défaut)',
      '• _!claw novedades_ — tout ce qui a été ajouté au bot',
      '• _!claw palabrotas_ — classement de ceux qui disent le plus de gros mots (apparaît aussi tout seul 😜)',
      '',
      '*Échecs :*',
      '• _!claw ajedrez_ — jouer une partie contre Claw',
      '• _!claw ajedrez e4_ — jouer un coup (aussi _Nf3_, _O-O_ ou _e2e4_)',
      '• _!claw analiza <FEN>_ — analyser une position',
      '• _!claw personalidad_ — voir ou changer la façon dont Claw parle (normal, profesor, gracioso, pirata)',
      '',
      '*Propriétaire et administrateurs uniquement :*',
      '• _!claw ajustes_ — voir et modifier les réglages',
      '• _!claw ajustes ventana 30_ — en modifier un',
      '• _!claw ajustes privado dueno|admins|todos|nadie_ — qui peut m\'écrire en privé',
      '• _!claw admins +600111222_ — ajouter un administrateur',
      '• _!claw prohibir +600111222_ — bannir quelqu\'un (il ne pourra plus utiliser Claw)',
      '• _!claw permitir +600111222_ — lever son bannissement',
      '• _!claw mantenimiento si|no_ — le bot reste muet',
      '• _!claw idioma en_ — changer la langue du bot',
      '• _!claw olvida <texte>_ — supprimer une note erronée',
      '• _!claw olvida todo_ — supprimer TOUTES les notes du groupe',
      '• _!claw aqui_ / _!claw fuera_ — lier ou délier le groupe',
      '',
      '💬 En *privé* (message direct ou le chat avec toi-même) ça marche aussi :',
      "pour l'instant seul le propriétaire peut m'écrire en privé (ça se change avec",
      '_!claw ajustes privado ..._). Ce que tu me dis sur les devoirs ou les examens est noté',
      "dans le groupe, et tu peux m'interroger là-dessus. Pour discuter d'autre chose",
      'en privé, écris *Claw* + ta question.',
      '',
      "Et pour me parler de n'importe quoi, écris *Claw* + ta question : _Claw combien font 2+2_"
    ].join('\n')
  },

  pt: {
    general: 'Geral',
    footer: '_Segundo o que foi dito no grupo._',
    welcome: [
      '👋 Olá! Sou o *PickleBrain*, o bot que se infiltrou neste grupo.',
      '',
      'Fico a ouvir em silêncio e vou anotando os *trabalhos* e os *exames* que se dizem por aqui: datas, temas e as fotos ou PDFs do que entra.',
      '',
      'Só falo se me perguntarem algo. Para ver o meu estado: *!claw*',
      'E para me pedir qualquer coisa, escrevam *Claw* + o que quiserem: _Claw quanto é 2+2_',
      '',
      '_(Se incomodar, tiram-me com *!claw fuera*.)_'
    ].join('\n'),
    help: [
      '🪝 *PickleBrain*',
      '',
      '• Modelo: `{model}`',
      '• Grupo: {group}',
      '• Anotado: {saved}',
      '',
      'Só falo quando me perguntam sobre trabalhos ou exames. Se alguém os disser, anoto-os sozinho.',
      'Também entendo *notas de voz* e guardo as *fotos* e os *PDF* que entram, para reenviá-los quando perguntarem.',
      'E podem pedir-me coisas escrevendo *Claw* + o que quiserem: _Claw quanto é 2+2_'
    ].join('\n'),
    helpGroupLinked: 'vinculado ✅',
    helpGroupUnlinked: 'não vinculado ❌',
    helpSaved: '{deberes} trabalhos, {examenes} exames{archivos}',
    helpFiles: ', {n} arquivos',
    noPermitido:
      '🔒 Só o dono e os administradores podem fazer isso. Peça-me a mim, que sou quem manda. 😉',
    adminsTitle: '👑 *Quem pode alterar as configurações*',
    adminsOwner: '• Dono: *{owner}*',
    adminsOwnerNone: 'não atribuído',
    adminsList: '• Administradores: {list}',
    adminsNone: '_nenhum_',
    vetadosTitle: '🚫 *Banidos (não podem usar o Claw)*',
    vetadosNone: '_nenhum_',
    vetadosHint: 'Banir: _!claw proibir +600111222_  ·  Perdoar: _!claw permitir +600111222_',
    languageChanged: '✅ Idioma alterado para *{name}*.',
    languageUnknown:
      '🤔 Não conheço esse idioma. Escreva o código (por exemplo, en, fr, de) ou consulte _!claw idioma_.',
    languageUsage: 'Diga-me o idioma: _!claw idioma en_ · _!claw idioma português_',
    languageListTitle: '🌍 Idiomas disponíveis',
    languageCurrent: 'Idioma atual: *{name}*',
    languageListLine: '• *{code}* {name}',
    languageMore: 'Há 100 idiomas no total. Os restantes escolhem-se na configuração inicial.',
    setupTitle: '🌍 Escolha o seu idioma',
    setupSubtitle: 'É assim que o Claw vai falar com você. Pode mudar quando quiser.',
    setupSearch: 'Pesquisar idioma…',
    setupButton: 'Continuar',
    setupNote: 'Escolha um dos 100 idiomas. A IA responderá no que escolher.',
    setupFirstRun: 'Configuração inicial',
    setupSaved: 'Idioma guardado',
    setupNoResults: 'Nenhum idioma corresponde.',
    setupChangeLater: 'Pode mudá-lo mais tarde com !claw idioma',
    setupSuggested: 'Recomendados',

    freshnessYesterday: 'ℹ️ A última informação é de ontem.',
    freshnessDays: 'ℹ️ A última informação é de há {n} dias.',
    freshnessWeek:
      'ℹ️ A última informação é de há mais de uma semana. Pode estar desatualizada.',

    para: 'para {when}',
    sinFecha: 'sem data',
    lineDeber: '• *{subject}*: {content} — _{when}_',
    lineExamen: '• *{subject}* — _{when}_{extra}',

    deberesTitle: '📚 *Trabalhos pendentes*',
    deberesTitleSubject: '📚 *Trabalhos de {subject}*',
    examenesTitle: '📝 *Próximos exames*',
    examenesTitleSubject: '📝 *Exame de {subject}*',

    apuntesEmpty:
      '🗂️ Ainda não tenho nada anotado. Se alguém disser os trabalhos ou um exame no grupo, eu guardo.',
    apuntesTitle: '🗂️ *Tudo o que tenho anotado* ({n} {apunte})',
    apunte: 'apontamento',
    apuntes: 'apontamentos',
    apuntesDeberes: '📚 *Trabalhos* ({n})',
    apuntesExamenes: '📝 *Exames* ({n})',
    apuntesHint:
      'Para apagar algo: _!claw olvida <palavra>_  ·  Tudo de uma vez: _!claw olvida todo_',

    pastExam: '📝 Esses exames já passaram:',
    pastExamSubject: '📝 O exame de *{subject}* já passou:',

    nothingFound:
      '🤔 Não tenho nada anotado{of} sobre {what}. Se alguém o disser no grupo, guardo e lembro-me.',
    nothingFoundOf: ' de *{subject}*',
    whatDeberes: 'os trabalhos',
    whatExamenes: 'os exames',

    savedAck: '✅ Anotado — *{subject}*: {kind}{when}{detail}',
    kindDeberes: 'trabalhos',
    kindExamen: 'exame',
    savedWhen: ' a {date}',
    savedWhenText: ' ({text})',
    savedDetail: ': {content}',

    noSpace:
      '😣 Não consegui guardar a foto: não há espaço no disco. Se libertares um pouco, da próxima vez consigo.',
    tooBig:
      '🙈 Essa foto pesa {mb} MB, não a guardei para não encher o disco.',
    mediaCaptionOne: '📎 Foto do que foi partilhado de {what}{of}',
    mediaCaptionMany: '📎 Fotos do que foi partilhado de {what}{of}',
    mediaWhatDeberes: 'os trabalhos',
    mediaWhatExamen: 'o exame',
    mediaOf: ' de {subject}',
    mediaOnly: '📎 Não tenho o texto, mas tenho o que foi partilhado{of} no grupo:',
    transcript: '🎧 _Percebi:_ {text}',

    olvidaOk: '🗑️ Feito: apaguei {n} {apunte}.',
    olvidaNada: '🤷 Não tenho nada anotado que se pareça com "{texto}".',
    olvidaTodoOk:
      '🧹 Feito: apaguei *todos* os apontamentos ({n}). Neste momento não tenho nada guardado.',
    olvidaTodoNada: '🤷 Não tinha nada anotado, por isso não há nada para apagar.',

    hechoOkOne: '✅ *Apontamento marcado como feito*',
    hechoOkMany: '✅ *{n} apontamentos marcados como feitos*',
    hechoOkFoot: '_Já não vão aparecer como pendentes nem nos lembretes._',
    hechoNada: '🤔 Não encontro nada pendente que corresponda a "{texto}".',
    hechoNadaHint:
      '_Tenta a disciplina (por exemplo, "lengua") ou uma palavra do enunciado._',
    hechoAyudaTitle: '✅ O que dou como feito? Diz-me a disciplina ou uma palavra:',
    hechoAyudaHint: '_!claw hecho lengua_ · _!claw hecho ficha 3_',
    hechoAyudaPending: 'Pendente neste momento:',
    hechoAyudaMore: '…e mais {n}.',

    apunteCreado: '✅ Anotado',
    apunteActualizado: '✏️ Atualizado',
    apunteSinFecha: ' (sem data)',
    apunteManual: '{status} — *{subject}*: {kind}{when}{detail}',

    apuntaAyuda: [
      '✍️ Diz-me o que anoto e, se quiseres, para quando. Exemplos:',
      '• _!claw apunta deberes mates fazer a ficha 3 para sexta_',
      '• _!claw apunta deberes lengua ler o tema 2 para amanhã_',
      '• _!claw apunta examen historia tema 4 a 21 de outubro_',
      '• _!claw apunta deberes mates para segunda_  (só muda a data)'
    ].join('\n'),

    imagenApagada: [
      '🎨 *Geração de imagens: experimental e DESLIGADA.*',
      '',
      'A IA de imagens já está instalada no computador, mas não desenho nada',
      'até ser ligada de propósito (só o dono ou um admin):',
      '_!claw ajustes imagenes si_',
      '',
      'E mesmo ligada, só desenho se me pedires à mão com _!claw imagen ..._:',
      'nunca gero uma imagem por minha conta.'
    ].join('\n'),
    imagenError: '🎨 Não consegui gerar a imagem.',
    imagenErrorUnknown: 'erro desconhecido',
    imagenErrorHint:
      'Se for do motor local, verifica se existem sd-cli.exe e o modelo (_imagen_motor_, _imagen_pasos_).',
    imagenOcupada: [
      '🎨 Dá-me um momento, que estou a desenhar outra imagem.',
      '',
      'Vou **de uma em uma** (para não ficar sem memória). Tenta outra vez daqui a pouco. ⏳'
    ].join('\n'),

    palabrotasTitle: '🐷 *Contador de palavrões*',
    palabrotasNone: 'Ainda ninguém disse nenhum neste grupo. Assim é que é! 😇',
    palabrotasSummary: 'Neste grupo já foram ditos *{total}* {palabra}.',
    palabrota: 'palavrão',
    palabrotas: 'palavrões',
    palabrotasMost: '🤬 O mais dito: *{word}* ({n} {vez}).',
    vez: 'vez',
    veces: 'vezes',
    palabrotasAlert: '😜 *Isso foi um palavrão!* Assim vai o ranking:',

    proximoTitle: '⏰ *O próximo:* *{subject}*',
    proximoBody: '📝 {when}{count}{extra}',
    proximoToday: ' (é hoje!)',
    proximoTomorrow: ' (amanhã!)',
    proximoInDays: ' (daqui a {n} dias)',
    proximoExtra: '\n📖 Entra: {content}',

    ayudita: [
      '🪝 *PickleBrain* — comandos',
      '',
      '*Para consultar:*',
      '• _!claw_ — estado e configurações (as configurações, só o dono)',
      '• _!claw deberes_ — trabalhos pendentes : _!claw deberes matemática_',
      '• _!claw examenes_ — próximos exames',
      '• _!claw apuntes_ — tudo o que tenho anotado (trabalhos e exames)',
      '• _!claw hecho lengua_ — marcar como feito o que já foi entregue',
      '• _!claw apunta deberes mates fazer a ficha para sexta_ — anotar ou corrigir à mão',
      '• _!claw proximo_ — o próximo que aparece',
      '• _!claw resumen_ — do que se falou estes dias : _!claw resumen semana_',
      '• _!claw calendario_ — descarregar os exames em formato .ics',
      '• _!claw busca <algo>_ — procurar na internet (DuckDuckGo)',
      '• _!claw imagen <o quê>_ — gerar uma imagem (EXPERIMENTAL, desligada por predefinição)',
      '• _!claw novedades_ — tudo o que é novo no bot',
      '• _!claw palabrotas_ — ranking de quem diz mais palavrões (também aparece sozinho 😜)',
      '',
      '*Xadrez:*',
      '• _!claw ajedrez_ — jogar uma partida contra o Claw',
      '• _!claw ajedrez e4_ — mover (também vale _Nf3_, _O-O_ ou _e2e4_)',
      '• _!claw analiza <FEN>_ — analisar uma posição',
      '• _!claw personalidad_ — ver ou mudar como o Claw fala (normal, profesor, gracioso, pirata)',
      '',
      '*Só o dono e os administradores:*',
      '• _!claw ajustes_ — ver e alterar as configurações',
      '• _!claw ajustes ventana 30_ — alterar uma',
      '• _!claw ajustes privado dueno|admins|todos|nadie_ — quem me pode escrever em privado',
      '• _!claw admins +600111222_ — adicionar um administrador',
      '• _!claw prohibir +600111222_ — banir alguém (não poderá usar o Claw)',
      '• _!claw permitir +600111222_ — levantar o banimento',
      '• _!claw mantenimiento si|no_ — o bot fica calado',
      '• _!claw idioma en_ — mudar o idioma do bot',
      '• _!claw olvida <texto>_ — apagar um apontamento errado',
      '• _!claw olvida todo_ — apagar TODOS os apontamentos do grupo',
      '• _!claw aqui_ / _!claw fuera_ — vincular ou desvincular o grupo',
      '',
      '💬 Em *privado* (mensagem direta ou o chat contigo mesmo) também funciona:',
      'por enquanto só o dono me pode escrever em privado (muda-se com',
      '_!claw ajustes privado ..._). O que me disseres sobre trabalhos ou exames fica anotado',
      'no grupo, e podes perguntar-me por eles aí. Para conversar sobre qualquer',
      'outra coisa em privado, escreve *Claw* + a tua pergunta.',
      '',
      'E para falar comigo sobre qualquer coisa, escreve *Claw* + a tua pergunta: _Claw quanto é 2+2_'
    ].join('\n')
  },

  de: {
    general: 'Allgemein',
    footer: '_Laut dem, was in der Gruppe gesagt wurde._',
    welcome: [
      '👋 Hallo! Ich bin *PickleBrain*, der Bot, der sich in diese Gruppe geschlichen hat.',
      '',
      'Ich höre still zu und notiere die *Hausaufgaben* und *Prüfungen*, die hier genannt werden: Termine, Themen und die Fotos oder PDFs, die eingehen.',
      '',
      'Ich spreche nur, wenn ihr mich etwas fragt. Um meinen Status zu sehen: *!claw*',
      'Und um mich irgendetwas zu fragen, schreibt *Claw* + eure Frage: _Claw wie viel ist 2+2_',
      '',
      '_(Wenn ich störe, entfernt mich mit *!claw fuera*.)_'
    ].join('\n'),
    help: [
      '🪝 *PickleBrain*',
      '',
      '• Modell: `{model}`',
      '• Gruppe: {group}',
      '• Notiert: {saved}',
      '',
      'Ich spreche nur, wenn ich nach Hausaufgaben oder Prüfungen gefragt werde. Wenn jemand sie nennt, notiere ich sie von selbst.',
      'Ich verstehe auch *Sprachnachrichten* und speichere die *Fotos* und *PDFs*, die eingehen, um sie auf Nachfrage weiterzuleiten.',
      'Und du kannst mich um alles bitten, indem du *Claw* + deine Frage schreibst: _Claw wie viel ist 2+2_'
    ].join('\n'),
    helpGroupLinked: 'verbunden ✅',
    helpGroupUnlinked: 'nicht verbunden ❌',
    helpSaved: '{deberes} Hausaufgaben, {examenes} Prüfungen{archivos}',
    helpFiles: ', {n} Dateien',
    noPermitido:
      '🔒 Das dürfen nur der Besitzer und die Administratoren. Frag mich, ich habe das Sagen. 😉',
    adminsTitle: '👑 *Wer die Einstellungen ändern darf*',
    adminsOwner: '• Besitzer: *{owner}*',
    adminsOwnerNone: 'nicht zugewiesen',
    adminsList: '• Administratoren: {list}',
    adminsNone: '_keine_',
    vetadosTitle: '🚫 *Gesperrt (können Claw nicht benutzen)*',
    vetadosNone: '_keine_',
    vetadosHint: 'Sperren: _!claw sperren +600111222_  ·  Verzeihen: _!claw verzeihen +600111222_',
    languageChanged: '✅ Sprache auf *{name}* geändert.',
    languageUnknown:
      '🤔 Diese Sprache kenne ich nicht. Schreibe den Code (zum Beispiel en, fr, de) oder sieh mit _!claw sprache_ nach.',
    languageUsage: 'Sag mir die Sprache: _!claw sprache en_ · _!claw sprache deutsch_',
    languageListTitle: '🌍 Verfügbare Sprachen',
    languageCurrent: 'Aktuelle Sprache: *{name}*',
    languageListLine: '• *{code}* {name}',
    languageMore: 'Es gibt insgesamt 100 Sprachen. Die übrigen wählst du bei der ersten Einrichtung.',
    setupTitle: '🌍 Wähle deine Sprache',
    setupSubtitle: 'So wird Claw mit dir sprechen. Du kannst es jederzeit ändern.',
    setupSearch: 'Sprache suchen…',
    setupButton: 'Weiter',
    setupNote: 'Wähle eine von 100 Sprachen. Die KI antwortet in der von dir gewählten Sprache.',
    setupFirstRun: 'Erste Einrichtung',
    setupSaved: 'Sprache gespeichert',
    setupNoResults: 'Keine passenden Sprachen.',
    setupChangeLater: 'Du kannst sie später mit !claw sprache ändern',
    setupSuggested: 'Empfohlen',

    freshnessYesterday: 'ℹ️ Die letzte Info ist von gestern.',
    freshnessDays: 'ℹ️ Die letzte Info ist {n} Tage alt.',
    freshnessWeek:
      'ℹ️ Die letzte Info ist über eine Woche alt. Sie kann veraltet sein.',

    para: 'für {when}',
    sinFecha: 'ohne Datum',
    lineDeber: '• *{subject}*: {content} — _{when}_',
    lineExamen: '• *{subject}* — _{when}_{extra}',

    deberesTitle: '📚 *Offene Hausaufgaben*',
    deberesTitleSubject: '📚 *Hausaufgaben in {subject}*',
    examenesTitle: '📝 *Nächste Prüfungen*',
    examenesTitleSubject: '📝 *Prüfung in {subject}*',

    apuntesEmpty:
      '🗂️ Ich habe noch nichts notiert. Wenn jemand die Hausaufgaben oder eine Prüfung in der Gruppe nennt, speichere ich sie.',
    apuntesTitle: '🗂️ *Alles, was ich notiert habe* ({n} {apunte})',
    apunte: 'Eintrag',
    apuntes: 'Einträge',
    apuntesDeberes: '📚 *Hausaufgaben* ({n})',
    apuntesExamenes: '📝 *Prüfungen* ({n})',
    apuntesHint:
      'Etwas löschen: _!claw olvida <Wort>_  ·  Alles auf einmal: _!claw olvida todo_',

    pastExam: '📝 Diese Prüfungen sind schon vorbei:',
    pastExamSubject: '📝 Die Prüfung in *{subject}* ist schon vorbei:',

    nothingFound:
      '🤔 Ich habe nichts{of} zu {what} notiert. Wenn es jemand in der Gruppe sagt, speichere ich es und merke es mir.',
    nothingFoundOf: ' zu *{subject}*',
    whatDeberes: 'den Hausaufgaben',
    whatExamenes: 'den Prüfungen',

    savedAck: '✅ Notiert — *{subject}*: {kind}{when}{detail}',
    kindDeberes: 'Hausaufgaben',
    kindExamen: 'Prüfung',
    savedWhen: ' am {date}',
    savedWhenText: ' ({text})',
    savedDetail: ': {content}',

    noSpace:
      '😣 Ich konnte das Foto nicht speichern: Auf dem Datenträger ist kein Platz mehr. Wenn du etwas freimachst, klappt es beim nächsten Mal.',
    tooBig:
      '🙈 Dieses Foto ist {mb} MB groß, ich habe es nicht gespeichert, um den Datenträger nicht zu füllen.',
    mediaCaptionOne: '📎 Foto von dem, was zu {what}{of} geteilt wurde',
    mediaCaptionMany: '📎 Fotos von dem, was zu {what}{of} geteilt wurde',
    mediaWhatDeberes: 'den Hausaufgaben',
    mediaWhatExamen: 'der Prüfung',
    mediaOf: ' in {subject}',
    mediaOnly: '📎 Ich habe den Text nicht, aber das, was{of} in der Gruppe geteilt wurde:',
    transcript: '🎧 _Verstanden:_ {text}',

    olvidaOk: '🗑️ Erledigt: Ich habe {n} {apunte} gelöscht.',
    olvidaNada: '🤷 Ich habe nichts notiert, das nach „{texto}“ klingt.',
    olvidaTodoOk:
      '🧹 Erledigt: Ich habe *alle* Einträge gelöscht ({n}). Im Moment habe ich nichts gespeichert.',
    olvidaTodoNada: '🤷 Ich hatte nichts notiert, es gibt also nichts zu löschen.',

    hechoOkOne: '✅ *Eintrag als erledigt markiert*',
    hechoOkMany: '✅ *{n} Einträge als erledigt markiert*',
    hechoOkFoot: '_Sie erscheinen nicht mehr als offen und nicht in den Erinnerungen._',
    hechoNada: '🤔 Ich finde nichts Offenes, das zu „{texto}“ passt.',
    hechoNadaHint:
      '_Versuche es mit dem Fach (zum Beispiel „lengua“) oder einem Wort aus der Aufgabe._',
    hechoAyudaTitle: '✅ Was soll ich als erledigt markieren? Sag mir das Fach oder ein Wort:',
    hechoAyudaHint: '_!claw hecho lengua_ · _!claw hecho Aufgabe 3_',
    hechoAyudaPending: 'Gerade offen:',
    hechoAyudaMore: '…und {n} weitere.',

    apunteCreado: '✅ Notiert',
    apunteActualizado: '✏️ Aktualisiert',
    apunteSinFecha: ' (ohne Datum)',
    apunteManual: '{status} — *{subject}*: {kind}{when}{detail}',

    apuntaAyuda: [
      '✍️ Sag mir, was ich notieren soll, und wenn du willst, bis wann. Beispiele:',
      '• _!claw apunta deberes Mathe Arbeitsblatt 3 bis Freitag machen_',
      '• _!claw apunta deberes Englisch Thema 2 bis morgen lesen_',
      '• _!claw apunta examen Geschichte Thema 4 am 21. Oktober_',
      '• _!claw apunta deberes Mathe bis Montag_  (ändert nur das Datum)'
    ].join('\n'),

    imagenApagada: [
      '🎨 *Bildgenerierung: experimentell und AUS.*',
      '',
      'Die Bild-KI ist schon auf dem Computer installiert, aber ich zeichne nichts,',
      'bis sie absichtlich eingeschaltet wird (nur Besitzer oder Admin):',
      '_!claw ajustes imagenes si_',
      '',
      'Und selbst dann zeichne ich nur, wenn du es mir von Hand mit _!claw imagen ..._ sagst:',
      'ich erzeuge nie von selbst ein Bild.'
    ].join('\n'),
    imagenError: '🎨 Ich konnte das Bild nicht erzeugen.',
    imagenErrorUnknown: 'unbekannter Fehler',
    imagenErrorHint:
      'Wenn es die lokale Engine ist, prüfe, ob sd-cli.exe und das Modell vorhanden sind (_imagen_motor_, _imagen_pasos_).',
    imagenOcupada: [
      '🎨 Gib mir einen Moment, ich zeichne gerade ein anderes Bild.',
      '',
      'Ich mache **eins nach dem anderen** (damit mir der Speicher nicht ausgeht). Versuch es gleich noch einmal. ⏳'
    ].join('\n'),

    palabrotasTitle: '🐷 *Schimpfwort-Zähler*',
    palabrotasNone: 'In dieser Gruppe hat noch niemand eins gesagt. Weiter so! 😇',
    palabrotasSummary: 'In dieser Gruppe wurden *{total}* {palabra} gesagt.',
    palabrota: 'Schimpfwort',
    palabrotas: 'Schimpfwörter',
    palabrotasMost: '🤬 Am häufigsten: *{word}* ({n} {vez}).',
    vez: 'Mal',
    veces: 'Mal',
    palabrotasAlert: '😜 *Das war ein Schimpfwort!* So steht die Rangliste:',

    proximoTitle: '⏰ *Als Nächstes:* *{subject}*',
    proximoBody: '📝 {when}{count}{extra}',
    proximoToday: ' (es ist heute!)',
    proximoTomorrow: ' (morgen!)',
    proximoInDays: ' (in {n} Tagen)',
    proximoExtra: '\n📖 Inhalt: {content}',

    ayudita: [
      '🪝 *PickleBrain* — Befehle',
      '',
      '*Zum Nachsehen:*',
      '• _!claw_ — Status und Einstellungen (Einstellungen nur für den Besitzer)',
      '• _!claw deberes_ — offene Hausaufgaben : _!claw deberes Mathe_',
      '• _!claw examenes_ — nächste Prüfungen',
      '• _!claw apuntes_ — alles, was ich notiert habe (Hausaufgaben und Prüfungen)',
      '• _!claw hecho lengua_ — als erledigt markieren, was schon abgegeben ist',
      '• _!claw apunta deberes Mathe Arbeitsblatt für Freitag machen_ — von Hand notieren oder korrigieren',
      '• _!claw proximo_ — was als Nächstes ansteht',
      '• _!claw resumen_ — worüber in den letzten Tagen gesprochen wurde : _!claw resumen semana_',
      '• _!claw calendario_ — die Prüfungen als .ics herunterladen',
      '• _!claw busca <etwas>_ — im Internet suchen (DuckDuckGo)',
      '• _!claw imagen <was>_ — ein Bild erzeugen (EXPERIMENTELL, standardmäßig aus)',
      '• _!claw novedades_ — alles Neue am Bot',
      '• _!claw palabrotas_ — Rangliste, wer am meisten flucht (erscheint auch von selbst 😜)',
      '',
      '*Schach:*',
      '• _!claw ajedrez_ — eine Partie gegen Claw spielen',
      '• _!claw ajedrez e4_ — ziehen (auch _Nf3_, _O-O_ oder _e2e4_)',
      '• _!claw analiza <FEN>_ — eine Stellung analysieren',
      '• _!claw personalidad_ — sehen oder ändern, wie Claw spricht (normal, profesor, gracioso, pirata)',
      '',
      '*Nur Besitzer und Administratoren:*',
      '• _!claw ajustes_ — Einstellungen ansehen und ändern',
      '• _!claw ajustes ventana 30_ — eine ändern',
      '• _!claw ajustes privado dueno|admins|todos|nadie_ — wer mir privat schreiben darf',
      '• _!claw admins +600111222_ — einen Administrator hinzufügen',
      '• _!claw prohibir +600111222_ — jemanden sperren (er kann Claw nicht mehr nutzen)',
      '• _!claw permitir +600111222_ — die Sperre aufheben',
      '• _!claw mantenimiento si|no_ — der Bot bleibt stumm',
      '• _!claw idioma en_ — die Sprache des Bots ändern',
      '• _!claw olvida <Text>_ — einen falschen Eintrag löschen',
      '• _!claw olvida todo_ — ALLE Einträge der Gruppe löschen',
      '• _!claw aqui_ / _!claw fuera_ — die Gruppe verbinden oder trennen',
      '',
      '💬 *Privat* (Direktnachricht oder der Chat mit dir selbst) geht auch:',
      'vorerst kann mir nur der Besitzer privat schreiben (änderbar mit',
      '_!claw ajustes privado ..._). Was du mir zu Hausaufgaben oder Prüfungen sagst, wird',
      'in der Gruppe notiert, und du kannst mich dort danach fragen. Um privat über',
      'etwas anderes zu reden, schreib *Claw* + deine Frage.',
      '',
      'Und um mit mir über irgendetwas zu sprechen, schreib *Claw* + deine Frage: _Claw wie viel ist 2+2_'
    ].join('\n')
  },

  it: {
    general: 'Generale',
    footer: '_Secondo quanto detto nel gruppo._',
    welcome: [
      '👋 Ciao! Sono *PickleBrain*, il bot che si è infilato in questo gruppo.',
      '',
      'Rimango in ascolto in silenzio e annoterò i *compiti* e gli *esami* che si dicono qui: date, argomenti e le foto o i PDF di ciò che arriva.',
      '',
      'Parlo solo se mi fate una domanda. Per vedere il mio stato: *!claw*',
      'E per chiedermi qualsiasi cosa, scrivete *Claw* + quello che volete: _Claw quanto fa 2+2_',
      '',
      '_(Se dò fastidio, toglietemi con *!claw fuera*.)_'
    ].join('\n'),
    help: [
      '🪝 *PickleBrain*',
      '',
      '• Modello: `{model}`',
      '• Gruppo: {group}',
      '• Annotato: {saved}',
      '',
      'Parlo solo quando mi si chiede di compiti o esami. Se qualcuno li dice, li annoto da solo.',
      'Capisco anche le *note vocali* e conservo le *foto* e i *PDF* che arrivano, per reinviarli quando chiedete.',
      'E potete chiedermi qualsiasi cosa scrivendo *Claw* + la vostra domanda: _Claw quanto fa 2+2_'
    ].join('\n'),
    helpGroupLinked: 'collegato ✅',
    helpGroupUnlinked: 'non collegato ❌',
    helpSaved: '{deberes} compiti, {examenes} esami{archivos}',
    helpFiles: ', {n} file',
    noPermitido:
      '🔒 Solo il proprietario e gli amministratori possono farlo. Chiedilo a me, che comando io. 😉',
    adminsTitle: '👑 *Chi può modificare le impostazioni*',
    adminsOwner: '• Proprietario: *{owner}*',
    adminsOwnerNone: 'non assegnato',
    adminsList: '• Amministratori: {list}',
    adminsNone: '_nessuno_',
    vetadosTitle: '🚫 *Bannati (non possono usare Claw)*',
    vetadosNone: '_nessuno_',
    vetadosHint: 'Bannare: _!claw bandire +600111222_  ·  Perdonare: _!claw perdonare +600111222_',
    languageChanged: '✅ Lingua cambiata in *{name}*.',
    languageUnknown:
      '🤔 Non conosco questa lingua. Scrivi il codice (per esempio en, fr, de) o controlla con _!claw lingua_.',
    languageUsage: 'Dimmi la lingua: _!claw lingua en_ · _!claw lingua italiano_',
    languageListTitle: '🌍 Lingue disponibili',
    languageCurrent: 'Lingua attuale: *{name}*',
    languageListLine: '• *{code}* {name}',
    languageMore: 'Ci sono 100 lingue in totale. Le altre si scelgono nella configurazione iniziale.',
    setupTitle: '🌍 Scegli la tua lingua',
    setupSubtitle: 'Così Claw parlerà con te. Puoi cambiarla quando vuoi.',
    setupSearch: 'Cerca lingua…',
    setupButton: 'Continua',
    setupNote: "Scegli una delle 100 lingue. L'IA risponderà in quella che scegli.",
    setupFirstRun: 'Configurazione iniziale',
    setupSaved: 'Lingua salvata',
    setupNoResults: 'Nessuna lingua corrisponde.',
    setupChangeLater: 'Puoi cambiarla più tardi con !claw lingua',
    setupSuggested: 'Consigliate',

    freshnessYesterday: "ℹ️ L'ultima informazione è di ieri.",
    freshnessDays: "ℹ️ L'ultima informazione è di {n} giorni fa.",
    freshnessWeek:
      "ℹ️ L'ultima informazione è di più di una settimana fa. Potrebbe essere superata.",

    para: 'per {when}',
    sinFecha: 'senza data',
    lineDeber: '• *{subject}*: {content} — _{when}_',
    lineExamen: '• *{subject}* — _{when}_{extra}',

    deberesTitle: '📚 *Compiti in sospeso*',
    deberesTitleSubject: '📚 *Compiti di {subject}*',
    examenesTitle: '📝 *Prossimi esami*',
    examenesTitleSubject: '📝 *Esame di {subject}*',

    apuntesEmpty:
      '🗂️ Non ho ancora niente annotato. Se qualcuno dice i compiti o un esame nel gruppo, lo salvo.',
    apuntesTitle: '🗂️ *Tutto quello che ho annotato* ({n} {apunte})',
    apunte: 'nota',
    apuntes: 'note',
    apuntesDeberes: '📚 *Compiti* ({n})',
    apuntesExamenes: '📝 *Esami* ({n})',
    apuntesHint:
      'Per cancellare qualcosa: _!claw olvida <parola>_  ·  Tutto in una volta: _!claw olvida todo_',

    pastExam: '📝 Questi esami sono già passati:',
    pastExamSubject: "📝 L'esame di *{subject}* è già passato:",

    nothingFound:
      '🤔 Non ho niente annotato{of} su {what}. Se qualcuno lo dice nel gruppo, lo salvo e me lo ricordo.',
    nothingFoundOf: ' di *{subject}*',
    whatDeberes: 'i compiti',
    whatExamenes: 'gli esami',

    savedAck: '✅ Annotato — *{subject}*: {kind}{when}{detail}',
    kindDeberes: 'compiti',
    kindExamen: 'esame',
    savedWhen: ' il {date}',
    savedWhenText: ' ({text})',
    savedDetail: ': {content}',

    noSpace:
      "😣 Non sono riuscito a salvare la foto: non c'è più spazio sul disco. Se ne liberi un po', la prossima volta ci riuscirò.",
    tooBig:
      "🙈 Questa foto pesa {mb} MB, non l'ho salvata per non riempire il disco.",
    mediaCaptionOne: '📎 Foto di ciò che è stato condiviso per {what}{of}',
    mediaCaptionMany: '📎 Foto di ciò che è stato condiviso per {what}{of}',
    mediaWhatDeberes: 'i compiti',
    mediaWhatExamen: "l'esame",
    mediaOf: ' di {subject}',
    mediaOnly: '📎 Non ho il testo, ma ho ciò che è stato condiviso{of} nel gruppo:',
    transcript: '🎧 _Ho capito:_ {text}',

    olvidaOk: '🗑️ Fatto: ho cancellato {n} {apunte}.',
    olvidaNada: '🤷 Non ho niente annotato che somigli a "{texto}".',
    olvidaTodoOk:
      '🧹 Fatto: ho cancellato *tutte* le note ({n}). Al momento non ho niente salvato.',
    olvidaTodoNada: "🤷 Non avevo niente annotato, quindi non c'è niente da cancellare.",

    hechoOkOne: '✅ *Nota segnata come fatta*',
    hechoOkMany: '✅ *{n} note segnate come fatte*',
    hechoOkFoot: '_Non appariranno più come in sospeso né nei promemoria._',
    hechoNada: '🤔 Non trovo niente in sospeso che corrisponda a "{texto}".',
    hechoNadaHint:
      '_Prova con la materia (per esempio, "lengua") o con una parola della consegna._',
    hechoAyudaTitle: '✅ Cosa segno come fatto? Dimmi la materia o una parola:',
    hechoAyudaHint: '_!claw hecho lengua_ · _!claw hecho scheda 3_',
    hechoAyudaPending: 'In sospeso adesso:',
    hechoAyudaMore: '…e altre {n}.',

    apunteCreado: '✅ Annotato',
    apunteActualizado: '✏️ Aggiornato',
    apunteSinFecha: ' (senza data)',
    apunteManual: '{status} — *{subject}*: {kind}{when}{detail}',

    apuntaAyuda: [
      '✍️ Dimmi cosa annoto e, se vuoi, per quando. Esempi:',
      '• _!claw apunta deberes matematica fare la scheda 3 per venerdì_',
      '• _!claw apunta deberes italiano leggere il tema 2 per domani_',
      '• _!claw apunta examen storia tema 4 il 21 ottobre_',
      '• _!claw apunta deberes matematica per lunedì_  (cambia solo la data)'
    ].join('\n'),

    imagenApagada: [
      "🎨 *Generazione di immagini: sperimentale e SPENTA.*",
      '',
      "L'IA delle immagini è già installata sul computer, ma non disegno niente",
      'finché non viene accesa di proposito (solo proprietario o admin):',
      '_!claw ajustes imagenes si_',
      '',
      'E anche accesa, disegno solo se me lo chiedi a mano con _!claw imagen ..._:',
      'non genero mai un\'immagine da solo.'
    ].join('\n'),
    imagenError: "🎨 Non sono riuscito a generare l'immagine.",
    imagenErrorUnknown: 'errore sconosciuto',
    imagenErrorHint:
      "Se è del motore locale, controlla che esistano sd-cli.exe e il modello (_imagen_motor_, _imagen_pasos_).",
    imagenOcupada: [
      '🎨 Dammi un momento, sto disegnando un\'altra immagine.',
      '',
      'Vado **una alla volta** (per non restare senza memoria). Riprova tra un attimo. ⏳'
    ].join('\n'),

    palabrotasTitle: '🐷 *Contatore di parolacce*',
    palabrotasNone: 'Nessuno ne ha ancora detta una in questo gruppo. Così si fa! 😇',
    palabrotasSummary: 'In questo gruppo sono state dette *{total}* {palabra}.',
    palabrota: 'parolaccia',
    palabrotas: 'parolacce',
    palabrotasMost: '🤬 La più detta: *{word}* ({n} {vez}).',
    vez: 'volta',
    veces: 'volte',
    palabrotasAlert: '😜 *Questa è stata una parolaccia!* Ecco la classifica:',

    proximoTitle: '⏰ *Il prossimo:* *{subject}*',
    proximoBody: '📝 {when}{count}{extra}',
    proximoToday: ' (è oggi!)',
    proximoTomorrow: ' (domani!)',
    proximoInDays: ' (tra {n} giorni)',
    proximoExtra: '\n📖 Programma: {content}',

    ayudita: [
      '🪝 *PickleBrain* — comandi',
      '',
      '*Per consultare:*',
      '• _!claw_ — stato e impostazioni (le impostazioni, solo il proprietario)',
      '• _!claw deberes_ — compiti in sospeso : _!claw deberes matematica_',
      '• _!claw examenes_ — prossimi esami',
      '• _!claw apuntes_ — tutto quello che ho annotato (compiti ed esami)',
      '• _!claw hecho lengua_ — segnare come fatto ciò che è già stato consegnato',
      '• _!claw apunta deberes matematica fare la scheda per venerdì_ — annotare o correggere a mano',
      '• _!claw proximo_ — cosa arriva adesso',
      '• _!claw resumen_ — di cosa si è parlato questi giorni : _!claw resumen semana_',
      '• _!claw calendario_ — scaricare gli esami in formato .ics',
      '• _!claw busca <qualcosa>_ — cercare su internet (DuckDuckGo)',
      '• _!claw imagen <cosa>_ — generare un\'immagine (SPERIMENTALE, spenta per impostazione predefinita)',
      '• _!claw novedades_ — tutto ciò che è nuovo nel bot',
      '• _!claw palabrotas_ — classifica di chi dice più parolacce (compare anche da sola 😜)',
      '',
      '*Scacchi:*',
      '• _!claw ajedrez_ — giocare una partita contro Claw',
      '• _!claw ajedrez e4_ — muovere (vale anche _Nf3_, _O-O_ o _e2e4_)',
      '• _!claw analiza <FEN>_ — analizzare una posizione',
      '• _!claw personalidad_ — vedere o cambiare come parla Claw (normal, profesor, gracioso, pirata)',
      '',
      '*Solo proprietario e amministratori:*',
      '• _!claw ajustes_ — vedere e modificare le impostazioni',
      '• _!claw ajustes ventana 30_ — modificarne una',
      '• _!claw ajustes privado dueno|admins|todos|nadie_ — chi può scrivermi in privato',
      '• _!claw admins +600111222_ — aggiungere un amministratore',
      '• _!claw prohibir +600111222_ — bannare qualcuno (non potrà usare Claw)',
      '• _!claw permitir +600111222_ — togliere il ban',
      '• _!claw mantenimiento si|no_ — il bot resta in silenzio',
      '• _!claw idioma en_ — cambiare la lingua del bot',
      '• _!claw olvida <testo>_ — cancellare una nota sbagliata',
      '• _!claw olvida todo_ — cancellare TUTTE le note del gruppo',
      '• _!claw aqui_ / _!claw fuera_ — collegare o scollegare il gruppo',
      '',
      '💬 In *privato* (messaggio diretto o la chat con te stesso) funziona anche:',
      'per ora solo il proprietario può scrivermi in privato (si cambia con',
      '_!claw ajustes privado ..._). Quello che mi dici su compiti o esami viene annotato',
      'nel gruppo, e puoi chiedermelo lì. Per parlare di qualsiasi',
      'altra cosa in privato, scrivi *Claw* + la tua domanda.',
      '',
      'E per parlarmi di qualsiasi cosa, scrivi *Claw* + la tua domanda: _Claw quanto fa 2+2_'
    ].join('\n')
  },

  ru: {
    general: 'Общее',
    footer: '_По тому, что говорилось в группе._',
    welcome: [
      '👋 Привет! Я *PickleBrain*, бот, который пробрался в эту группу.',
      '',
      'Я тихо слушаю и записываю *домашние задания* и *экзамены*, о которых здесь говорят: даты, темы, а также фото и PDF, которые приходят.',
      '',
      'Я говорю только тогда, когда вы меня о чём-то спрашиваете. Чтобы увидеть мой статус: *!claw*',
      'А чтобы попросить меня о чём угодно, напишите *Claw* + ваш вопрос: _Claw сколько будет 2+2_',
      '',
      '_(Если я мешаю, уберите меня с помощью *!claw fuera*.)_'
    ].join('\n'),
    help: [
      '🪝 *PickleBrain*',
      '',
      '• Модель: `{model}`',
      '• Группа: {group}',
      '• Записано: {saved}',
      '',
      'Я говорю только тогда, когда меня спрашивают о домашних заданиях или экзаменах. Если кто-то о них упоминает, я записываю их сам.',
      'Я также понимаю *голосовые сообщения* и сохраняю *фото* и *PDF*, которые приходят, чтобы переслать их, когда вы спросите.',
      'И вы можете попросить меня о чём угодно, написав *Claw* + ваш вопрос: _Claw сколько будет 2+2_'
    ].join('\n'),
    helpGroupLinked: 'подключён ✅',
    helpGroupUnlinked: 'не подключён ❌',
    helpSaved: '{deberes} заданий, {examenes} экзаменов{archivos}',
    helpFiles: ', {n} файлов',
    noPermitido:
      '🔒 Это могут делать только владелец и администраторы. Попросите меня, я здесь главный. 😉',
    adminsTitle: '👑 *Кто может менять настройки*',
    adminsOwner: '• Владелец: *{owner}*',
    adminsOwnerNone: 'не назначен',
    adminsList: '• Администраторы: {list}',
    adminsNone: '_нет_',
    vetadosTitle: '🚫 *Заблокированные (не могут пользоваться Claw)*',
    vetadosNone: '_нет_',
    vetadosHint: 'Заблокировать: _!claw запретить +600111222_  ·  Простить: _!claw разрешить +600111222_',
    languageChanged: '✅ Язык изменён на *{name}*.',
    languageUnknown:
      '🤔 Я не знаю этот язык. Напишите код (например, en, fr, de) или посмотрите _!claw язык_.',
    languageUsage: 'Назовите язык: _!claw язык en_ · _!claw язык русский_',
    languageListTitle: '🌍 Доступные языки',
    languageCurrent: 'Текущий язык: *{name}*',
    languageListLine: '• *{code}* {name}',
    languageMore: 'Всего доступно 100 языков. Остальные выбираются при первоначальной настройке.',
    setupTitle: '🌍 Выберите язык',
    setupSubtitle: 'Так Claw будет говорить с вами. Вы можете изменить это в любое время.',
    setupSearch: 'Поиск языка…',
    setupButton: 'Продолжить',
    setupNote: 'Выберите один из 100 языков. ИИ будет отвечать на выбранном языке.',
    setupFirstRun: 'Первоначальная настройка',
    setupSaved: 'Язык сохранён',
    setupNoResults: 'Нет подходящих языков.',
    setupChangeLater: 'Вы можете изменить его позже с помощью !claw язык',
    setupSuggested: 'Рекомендуемые',

    freshnessYesterday: 'ℹ️ Последние данные — вчерашние.',
    freshnessDays: 'ℹ️ Последние данные — {n} дней назад.',
    freshnessWeek: 'ℹ️ Последние данные старше недели. Возможно, они устарели.',

    para: 'на {when}',
    sinFecha: 'без даты',
    lineDeber: '• *{subject}*: {content} — _{when}_',
    lineExamen: '• *{subject}* — _{when}_{extra}',

    deberesTitle: '📚 *Невыполненные задания*',
    deberesTitleSubject: '📚 *Задания по предмету {subject}*',
    examenesTitle: '📝 *Ближайшие экзамены*',
    examenesTitleSubject: '📝 *Экзамен по предмету {subject}*',

    apuntesEmpty:
      '🗂️ У меня пока ничего не записано. Если кто-то скажет задания или про экзамен в группе, я сохраню.',
    apuntesTitle: '🗂️ *Всё, что у меня записано* ({n} {apunte})',
    apunte: 'запись',
    apuntes: 'записей',
    apuntesDeberes: '📚 *Задания* ({n})',
    apuntesExamenes: '📝 *Экзамены* ({n})',
    apuntesHint:
      'Удалить что-то: _!claw olvida <слово>_  ·  Все сразу: _!claw olvida todo_',

    pastExam: '📝 Эти экзамены уже прошли:',
    pastExamSubject: '📝 Экзамен по предмету *{subject}* уже прошёл:',

    nothingFound:
      '🤔 У меня ничего не записано{of} о {what}. Если кто-то скажет это в группе, я сохраню и запомню.',
    nothingFoundOf: ' по предмету *{subject}*',
    whatDeberes: 'заданиях',
    whatExamenes: 'экзаменах',

    savedAck: '✅ Записано — *{subject}*: {kind}{when}{detail}',
    kindDeberes: 'задания',
    kindExamen: 'экзамен',
    savedWhen: ' на {date}',
    savedWhenText: ' ({text})',
    savedDetail: ': {content}',

    noSpace:
      '😣 Не смог сохранить фото: на диске не осталось места. Если освободишь немного, в следующий раз получится.',
    tooBig:
      '🙈 Это фото весит {mb} МБ, я не стал его сохранять, чтобы не заполнить диск.',
    mediaCaptionOne: '📎 Фото того, что прислали по {what}{of}',
    mediaCaptionMany: '📎 Фотографии того, что прислали по {what}{of}',
    mediaWhatDeberes: 'заданиям',
    mediaWhatExamen: 'экзамену',
    mediaOf: ' по предмету {subject}',
    mediaOnly: '📎 Текста у меня нет, но есть то, что{of} присылали в группе:',
    transcript: '🎧 _Я понял:_ {text}',

    olvidaOk: '🗑️ Готово: удалил {n} {apunte}.',
    olvidaNada: '🤷 У меня нет ничего похожего на «{texto}».',
    olvidaTodoOk:
      '🧹 Готово: удалил *все* записи ({n}). Сейчас у меня ничего не сохранено.',
    olvidaTodoNada: '🤷 У меня ничего не было записано, так что удалять нечего.',

    hechoOkOne: '✅ *Запись отмечена как выполненная*',
    hechoOkMany: '✅ *Записей отмечено как выполненные: {n}*',
    hechoOkFoot:
      '_Они больше не будут появляться как невыполненные и в напоминаниях._',
    hechoNada: '🤔 Не нахожу ничего невыполненного по запросу «{texto}».',
    hechoNadaHint: '_Попробуй предмет (например, «lengua») или слово из задания._',
    hechoAyudaTitle: '✅ Что считать выполненным? Назови предмет или слово:',
    hechoAyudaHint: '_!claw hecho lengua_ · _!claw hecho задание 3_',
    hechoAyudaPending: 'Сейчас не выполнено:',
    hechoAyudaMore: '…и ещё {n}.',

    apunteCreado: '✅ Записано',
    apunteActualizado: '✏️ Обновлено',
    apunteSinFecha: ' (без даты)',
    apunteManual: '{status} — *{subject}*: {kind}{when}{detail}',

    apuntaAyuda: [
      '✍️ Скажи, что записать, и, если хочешь, к какому сроку. Примеры:',
      '• _!claw apunta deberes математика сделать задание 3 к пятнице_',
      '• _!claw apunta deberes английский прочитать тему 2 к завтрашнему дню_',
      '• _!claw apunta examen история тема 4 21 октября_',
      '• _!claw apunta deberes математика к понедельнику_  (меняет только дату)'
    ].join('\n'),

    imagenApagada: [
      '🎨 *Генерация изображений: экспериментальная и ВЫКЛЮЧЕНА.*',
      '',
      'ИИ изображений уже установлен на компьютере, но я ничего не рисую,',
      'пока его не включат намеренно (только владелец или админ):',
      '_!claw ajustes imagenes si_',
      '',
      'И даже включённый, я рисую только если ты попросишь вручную: _!claw imagen ..._',
      'я никогда не генерирую изображение сам.'
    ].join('\n'),
    imagenError: '🎨 Не удалось создать изображение.',
    imagenErrorUnknown: 'неизвестная ошибка',
    imagenErrorHint:
      'Если это локальный движок, проверь, что есть sd-cli.exe и модель (_imagen_motor_, _imagen_pasos_).',
    imagenOcupada: [
      '🎨 Дай мне минутку, я рисую другое изображение.',
      '',
      'Я делаю **по одному** (чтобы не остаться без памяти). Попробуй ещё раз чуть позже. ⏳'
    ].join('\n'),

    palabrotasTitle: '🐷 *Счётчик ругательств*',
    palabrotasNone: 'В этой группе пока никто не ругался. Так держать! 😇',
    palabrotasSummary: 'В этой группе сказали *{total}* {palabra}.',
    palabrota: 'ругательство',
    palabrotas: 'ругательств',
    palabrotasMost: '🤬 Чаще всего: *{word}* ({n} {vez}).',
    vez: 'раз',
    veces: 'раз',
    palabrotasAlert: '😜 *Это было ругательство!* Вот рейтинг:',

    proximoTitle: '⏰ *Ближайшее:* *{subject}*',
    proximoBody: '📝 {when}{count}{extra}',
    proximoToday: ' (это сегодня!)',
    proximoTomorrow: ' (завтра!)',
    proximoInDays: ' (через {n} дн.)',
    proximoExtra: '\n📖 Содержание: {content}',

    ayudita: [
      '🪝 *PickleBrain* — команды',
      '',
      '*Чтобы посмотреть:*',
      '• _!claw_ — статус и настройки (настройки — только владельцу)',
      '• _!claw deberes_ — невыполненные задания : _!claw deberes математика_',
      '• _!claw examenes_ — ближайшие экзамены',
      '• _!claw apuntes_ — всё, что у меня записано (задания и экзамены)',
      '• _!claw hecho lengua_ — отметить как выполненное то, что уже сдали',
      '• _!claw apunta deberes математика сделать задание к пятнице_ — записать или исправить вручную',
      '• _!claw proximo_ — что будет дальше',
      '• _!claw resumen_ — о чём говорили эти дни : _!claw resumen semana_',
      '• _!claw calendario_ — скачать экзамены в формате .ics',
      '• _!claw busca <что-то>_ — поиск в интернете (DuckDuckGo)',
      '• _!claw imagen <что>_ — создать изображение (ЭКСПЕРИМЕНТАЛЬНО, по умолчанию выключено)',
      '• _!claw novedades_ — всё новое, что добавили боту',
      '• _!claw palabrotas_ — рейтинг тех, кто больше всех ругается (появляется и сам 😜)',
      '',
      '*Шахматы:*',
      '• _!claw ajedrez_ — сыграть партию против Claw',
      '• _!claw ajedrez e4_ — сделать ход (также _Nf3_, _O-O_ или _e2e4_)',
      '• _!claw analiza <FEN>_ — проанализировать позицию',
      '• _!claw personalidad_ — посмотреть или сменить, как говорит Claw (normal, profesor, gracioso, pirata)',
      '',
      '*Только владелец и администраторы:*',
      '• _!claw ajustes_ — посмотреть и изменить настройки',
      '• _!claw ajustes ventana 30_ — изменить одну',
      '• _!claw ajustes privado dueno|admins|todos|nadie_ — кто может писать мне в личку',
      '• _!claw admins +600111222_ — добавить администратора',
      '• _!claw prohibir +600111222_ — заблокировать кого-то (он не сможет пользоваться Claw)',
      '• _!claw permitir +600111222_ — снять блокировку',
      '• _!claw mantenimiento si|no_ — бот замолкает',
      '• _!claw idioma en_ — сменить язык бота',
      '• _!claw olvida <текст>_ — удалить ошибочную запись',
      '• _!claw olvida todo_ — удалить ВСЕ записи группы',
      '• _!claw aqui_ / _!claw fuera_ — подключить или отключить группу',
      '',
      '💬 В *личных сообщениях* (прямое сообщение или чат с самим собой) тоже работает:',
      'пока только владелец может писать мне в личку (меняется через',
      '_!claw ajustes privado ..._). То, что ты скажешь про задания или экзамены, записывается',
      'в группе, и там же можно меня о них спрашивать. Чтобы поговорить о чём-то',
      'другом в личке, напиши *Claw* + свой вопрос.',
      '',
      'И чтобы поговорить со мной о чём угодно, напиши *Claw* + свой вопрос: _Claw сколько будет 2+2_'
    ].join('\n')
  },

  ar: {
    general: 'عام',
    footer: '_حسب ما قيل في المجموعة._',
    welcome: [
      '👋 مرحبًا! أنا *PickleBrain*، البوت الذي تسلّل إلى هذه المجموعة.',
      '',
      'أستمع بصمت وأسجّل *الواجبات* و*الامتحانات* التي تُذكر هنا: التواريخ والمواضيع والصور أو ملفات PDF التي تصل.',
      '',
      'لا أتحدث إلا إذا سألتموني شيئًا. لرؤية حالتي: *!claw*',
      'ولطلب أي شيء، اكتبوا *Claw* + سؤالك: _Claw كم يساوي 2+2_',
      '',
      '_(إذا أزعجتكم، أزيلوني باستخدام *!claw fuera*.)_'
    ].join('\n'),
    help: [
      '🪝 *PickleBrain*',
      '',
      '• النموذج: `{model}`',
      '• المجموعة: {group}',
      '• المحفوظ: {saved}',
      '',
      'لا أتحدث إلا عندما يسألني أحد عن الواجبات أو الامتحانات. إذا ذكرها أحد، أسجّلها بنفسي.',
      'أفهم أيضًا *الرسائل الصوتية* وأحفظ *الصور* و*ملفات PDF* التي تصل، لإعادة إرسالها عندما تسألون.',
      'ويمكنكم أن تطلبوا مني أي شيء بكتابة *Claw* + سؤالك: _Claw كم يساوي 2+2_'
    ].join('\n'),
    helpGroupLinked: 'مرتبط ✅',
    helpGroupUnlinked: 'غير مرتبط ❌',
    helpSaved: '{deberes} واجبات، {examenes} امتحانات{archivos}',
    helpFiles: '، {n} ملفات',
    noPermitido:
      '🔒 يمكن للمالك والمسؤولين فقط فعل ذلك. اطلبه مني، فأنا المسؤول هنا. 😉',
    adminsTitle: '👑 *من يمكنه تعديل الإعدادات*',
    adminsOwner: '• المالك: *{owner}*',
    adminsOwnerNone: 'غير معيّن',
    adminsList: '• المسؤولون: {list}',
    adminsNone: '_لا أحد_',
    vetadosTitle: '🚫 *المحظورون (لا يمكنهم استخدام Claw)*',
    vetadosNone: '_لا أحد_',
    vetadosHint: 'الحظر: _!claw حظر +600111222_  ·  المسامحة: _!claw مسامحة +600111222_',
    languageChanged: '✅ تم تغيير اللغة إلى *{name}*.',
    languageUnknown:
      '🤔 لا أعرف هذه اللغة. اكتب الرمز (مثل en أو fr أو de) أو تحقق باستخدام _!claw اللغة_.',
    languageUsage: 'أخبرني باللغة: _!claw اللغة en_ · _!claw اللغة العربية_',
    languageListTitle: '🌍 اللغات المتاحة',
    languageCurrent: 'اللغة الحالية: *{name}*',
    languageListLine: '• *{code}* {name}',
    languageMore: 'هناك 100 لغة في المجموع. يتم اختيار البقية في الإعداد الأولي.',
    setupTitle: '🌍 اختر لغتك',
    setupSubtitle: 'هكذا سيتحدث Claw معك. يمكنك تغييرها متى شئت.',
    setupSearch: 'ابحث عن لغة…',
    setupButton: 'متابعة',
    setupNote: 'اختر واحدة من 100 لغة. سيجيب الذكاء الاصطناعي باللغة التي تختارها.',
    setupFirstRun: 'الإعداد الأولي',
    setupSaved: 'تم حفظ اللغة',
    setupNoResults: 'لا توجد لغات مطابقة.',
    setupChangeLater: 'يمكنك تغييرها لاحقًا باستخدام !claw اللغة',
    setupSuggested: 'موصى بها',

    freshnessYesterday: 'ℹ️ آخر معلومة من أمس.',
    freshnessDays: 'ℹ️ آخر معلومة منذ {n} أيام.',
    freshnessWeek: 'ℹ️ آخر معلومة منذ أكثر من أسبوع. قد تكون قديمة.',

    para: 'حتى {when}',
    sinFecha: 'بدون تاريخ',
    lineDeber: '• *{subject}*: {content} — _{when}_',
    lineExamen: '• *{subject}* — _{when}_{extra}',

    deberesTitle: '📚 *الواجبات المعلّقة*',
    deberesTitleSubject: '📚 *واجبات {subject}*',
    examenesTitle: '📝 *الامتحانات القادمة*',
    examenesTitleSubject: '📝 *امتحان {subject}*',

    apuntesEmpty:
      '🗂️ لم أسجّل شيئًا بعد. إذا ذكر أحد الواجبات أو امتحانًا في المجموعة، سأحفظه.',
    apuntesTitle: '🗂️ *كل ما سجّلته* ({n} {apunte})',
    apunte: 'ملاحظة',
    apuntes: 'ملاحظات',
    apuntesDeberes: '📚 *الواجبات* ({n})',
    apuntesExamenes: '📝 *الامتحانات* ({n})',
    apuntesHint:
      'لحذف شيء: _!claw olvida <كلمة>_  ·  الكل مرة واحدة: _!claw olvida todo_',

    pastExam: '📝 هذه الامتحانات انتهت بالفعل:',
    pastExamSubject: '📝 امتحان *{subject}* انتهى بالفعل:',

    nothingFound:
      '🤔 لا يوجد لدي شيء مسجّل{of} عن {what}. إذا ذكره أحد في المجموعة، سأحفظه وأتذكره.',
    nothingFoundOf: ' عن *{subject}*',
    whatDeberes: 'الواجبات',
    whatExamenes: 'الامتحانات',

    savedAck: '✅ تم التسجيل — *{subject}*: {kind}{when}{detail}',
    kindDeberes: 'واجبات',
    kindExamen: 'امتحان',
    savedWhen: ' في {date}',
    savedWhenText: ' ({text})',
    savedDetail: ': {content}',

    noSpace:
      '😣 لم أتمكن من حفظ الصورة: لا توجد مساحة على القرص. إذا حرّرت قليلًا، سأستطيع في المرة القادمة.',
    tooBig:
      '🙈 هذه الصورة بحجم {mb} ميغابايت، لم أحفظها حتى لا أملأ القرص.',
    mediaCaptionOne: '📎 صورة لما تمت مشاركته في {what}{of}',
    mediaCaptionMany: '📎 صور لما تمت مشاركته في {what}{of}',
    mediaWhatDeberes: 'الواجبات',
    mediaWhatExamen: 'الامتحان',
    mediaOf: ' لمادة {subject}',
    mediaOnly: '📎 ليس لدي النص، لكن لدي ما تمت مشاركته{of} في المجموعة:',
    transcript: '🎧 _فهمت:_ {text}',

    olvidaOk: '🗑️ تم: حذفت {n} {apunte}.',
    olvidaNada: '🤷 لا يوجد لدي شيء مسجّل يشبه "{texto}".',
    olvidaTodoOk:
      '🧹 تم: حذفت *كل* الملاحظات ({n}). الآن لا يوجد لدي أي شيء محفوظ.',
    olvidaTodoNada: '🤷 لم يكن لدي شيء مسجّل، لذلك لا يوجد ما يُحذف.',

    hechoOkOne: '✅ *تم وضع علامة "منجز" على الملاحظة*',
    hechoOkMany: '✅ *تم وضع علامة "منجز" على {n} ملاحظات*',
    hechoOkFoot: '_لن تظهر بعد الآن كمعلّقة ولا في التذكيرات._',
    hechoNada: '🤔 لا أجد شيئًا معلّقًا يطابق "{texto}".',
    hechoNadaHint: '_جرّب المادة (مثل "lengua") أو كلمة من نص الواجب._',
    hechoAyudaTitle: '✅ ما الذي أعتبره منجزًا؟ اخبرني المادة أو كلمة:',
    hechoAyudaHint: '_!claw hecho lengua_ · _!claw hecho المهمة 3_',
    hechoAyudaPending: 'المعلّق الآن:',
    hechoAyudaMore: '…و{n} غيرها.',

    apunteCreado: '✅ تم التسجيل',
    apunteActualizado: '✏️ تم التحديث',
    apunteSinFecha: ' (بدون تاريخ)',
    apunteManual: '{status} — *{subject}*: {kind}{when}{detail}',

    apuntaAyuda: [
      '✍️ اخبرني ماذا أسجّل، وإن أردت، حتى متى. أمثلة:',
      '• _!claw apunta deberes رياضيات حل المهمة 3 حتى الجمعة_',
      '• _!claw apunta deberes لغة قراءة الموضوع 2 حتى غدًا_',
      '• _!claw apunta examen تاريخ الموضوع 4 في 21 أكتوبر_',
      '• _!claw apunta deberes رياضيات حتى الاثنين_  (يغيّر التاريخ فقط)'
    ].join('\n'),

    imagenApagada: [
      '🎨 *توليد الصور: تجريبي ومُعطّل.*',
      '',
      'ذكاء الصور مثبّت بالفعل على الحاسوب، لكنني لا أرسم شيئًا',
      'حتى يُشغَّل عن قصد (المالك أو المسؤول فقط):',
      '_!claw ajustes imagenes si_',
      '',
      'وحتى عند تشغيله، لا أرسم إلا إذا طلبته منّي يدويًا بـ _!claw imagen ..._:',
      'لا أولّد صورة من تلقاء نفسي أبدًا.'
    ].join('\n'),
    imagenError: '🎨 لم أتمكن من إنشاء الصورة.',
    imagenErrorUnknown: 'خطأ غير معروف',
    imagenErrorHint:
      'إذا كان المحرك محليًا، تحقق من وجود sd-cli.exe والنموذج (_imagen_motor_, _imagen_pasos_).',
    imagenOcupada: [
      '🎨 أمهلني لحظة، فأنا أرسم صورة أخرى.',
      '',
      'أرسم **واحدة تلو الأخرى** (حتى لا تنفد الذاكرة). جرّب مرة أخرى بعد قليل. ⏳'
    ].join('\n'),

    palabrotasTitle: '🐷 *عدّاد الشتائم*',
    palabrotasNone: 'لم يقل أحد أي شتيمة في هذه المجموعة بعد. أحسنت! 😇',
    palabrotasSummary: 'في هذه المجموعة قيلت *{total}* {palabra}.',
    palabrota: 'شتيمة',
    palabrotas: 'شتائم',
    palabrotasMost: '🤬 الأكثر تكرارًا: *{word}* ({n} {vez}).',
    vez: 'مرة',
    veces: 'مرات',
    palabrotasAlert: '😜 *كانت هذه شتيمة!* هذا هو الترتيب:',

    proximoTitle: '⏰ *التالي:* *{subject}*',
    proximoBody: '📝 {when}{count}{extra}',
    proximoToday: ' (إنه اليوم!)',
    proximoTomorrow: ' (غدًا!)',
    proximoInDays: ' (بعد {n} أيام)',
    proximoExtra: '\n📖 المحتوى: {content}',

    ayudita: [
      '🪝 *PickleBrain* — الأوامر',
      '',
      '*للاستعلام:*',
      '• _!claw_ — الحالة والإعدادات (الإعدادات للمالك فقط)',
      '• _!claw deberes_ — الواجبات المعلّقة : _!claw deberes رياضيات_',
      '• _!claw examenes_ — الامتحانات القادمة',
      '• _!claw apuntes_ — كل ما سجّلته (واجبات وامتحانات)',
      '• _!claw hecho lengua_ — وضع علامة منجز على ما تم تسليمه',
      '• _!claw apunta deberes رياضيات حل المهمة حتى الجمعة_ — التسجيل أو التصحيح يدويًا',
      '• _!claw proximo_ — ما يأتي بعد ذلك',
      '• _!claw resumen_ — عمّا تحدثنا هذه الأيام : _!claw resumen semana_',
      '• _!claw calendario_ — تنزيل الامتحانات بصيغة .ics',
      '• _!claw busca <شيء>_ — البحث في الإنترنت (DuckDuckGo)',
      '• _!claw imagen <ماذا>_ — إنشاء صورة (تجريبي، مُعطّل افتراضيًا)',
      '• _!claw novedades_ — كل ما أُضيف للبوت',
      '• _!claw palabrotas_ — ترتيب من يقول الشتائم أكثر (يظهر تلقائيًا أيضًا 😜)',
      '',
      '*الشطرنج:*',
      '• _!claw ajedrez_ — لعب مباراة ضد Claw',
      '• _!claw ajedrez e4_ — تحريك قطعة (أيضًا _Nf3_ أو _O-O_ أو _e2e4_)',
      '• _!claw analiza <FEN>_ — تحليل وضعية',
      '• _!claw personalidad_ — عرض طريقة كلام Claw أو تغييرها (normal, profesor, gracioso, pirata)',
      '',
      '*المالك والمسؤولون فقط:*',
      '• _!claw ajustes_ — عرض الإعدادات وتغييرها',
      '• _!claw ajustes ventana 30_ — تغيير إعداد واحد',
      '• _!claw ajustes privado dueno|admins|todos|nadie_ — من يمكنه مراسلتي على الخاص',
      '• _!claw admins +600111222_ — إضافة مسؤول',
      '• _!claw prohibir +600111222_ — حظر شخص (لن يستطيع استخدام Claw)',
      '• _!claw permitir +600111222_ — رفع الحظر عنه',
      '• _!claw mantenimiento si|no_ — يبقى البوت صامتًا',
      '• _!claw idioma en_ — تغيير لغة البوت',
      '• _!claw olvida <نص>_ — حذف ملاحظة خاطئة',
      '• _!claw olvida todo_ — حذف كل ملاحظات المجموعة',
      '• _!claw aqui_ / _!claw fuera_ — ربط المجموعة أو فصلها',
      '',
      '💬 على *الخاص* (رسالة مباشرة أو محادثة نفسك) يعمل أيضًا:',
      'حاليًا المالك فقط يمكنه مراسلتي على الخاص (يُغيَّر بـ',
      '_!claw ajustes privado ..._). ما تقوله لي عن الواجبات أو الامتحانات يُسجَّل',
      'في المجموعة، ويمكنك أن تسألني عنها هناك. للحديث عن أي',
      'شيء آخر على الخاص، اكتب *Claw* + سؤالك.',
      '',
      'وللتحدث معي عن أي شيء، اكتب *Claw* + سؤالك: _Claw كم يساوي 2+2_'
    ].join('\n')
  },

  zh: {
    general: '通用',
    footer: '_根据群里所说的内容。_',
    welcome: [
      '👋 你好！我是 *PickleBrain*，偷偷加入这个群的机器人。',
      '',
      '我会安静地听着，并记下这里提到的*作业*和*考试*：日期、主题，以及收到的照片或 PDF。',
      '',
      '只有你们问我时我才会说话。查看我的状态：*!claw*',
      '想让我做任何事，请写 *Claw* + 你的问题：_Claw 2+2 等于几_',
      '',
      '_（如果我打扰了，可以用 *!claw fuera* 把我移除。）_'
    ].join('\n'),
    help: [
      '🪝 *PickleBrain*',
      '',
      '• 模型：`{model}`',
      '• 群组：{group}',
      '• 已记录：{saved}',
      '',
      '只有有人问我作业或考试时我才会说话。如果有人提到，我会自动记下。',
      '我也能听懂*语音消息*，并保存收到的*照片*和*PDF*，以便你们需要时转发。',
      '你可以写 *Claw* + 你的问题来让我做任何事：_Claw 2+2 等于几_'
    ].join('\n'),
    helpGroupLinked: '已绑定 ✅',
    helpGroupUnlinked: '未绑定 ❌',
    helpSaved: '{deberes} 项作业，{examenes} 场考试{archivos}',
    helpFiles: '，{n} 个文件',
    noPermitido: '🔒 只有主人和管理员才能这样做。请找我，我说了算。😉',
    adminsTitle: '👑 *谁可以修改设置*',
    adminsOwner: '• 主人：*{owner}*',
    adminsOwnerNone: '未指定',
    adminsList: '• 管理员：{list}',
    adminsNone: '_无_',
    vetadosTitle: '🚫 *已封禁（不能使用 Claw）*',
    vetadosNone: '_无_',
    vetadosHint: '封禁：_!claw 禁止 +600111222_  ·  原谅：_!claw 允许 +600111222_',
    languageChanged: '✅ 语言已更改为 *{name}*。',
    languageUnknown: '🤔 我不认识这种语言。请写代码（例如 en、fr、de）或用 _!claw 语言_ 查看。',
    languageUsage: '告诉我语言：_!claw 语言 en_ · _!claw 语言 中文_',
    languageListTitle: '🌍 可用语言',
    languageCurrent: '当前语言：*{name}*',
    languageListLine: '• *{code}* {name}',
    languageMore: '共有 100 种语言。其余的在首次设置中选择。',
    setupTitle: '🌍 选择你的语言',
    setupSubtitle: 'Claw 将用这种语言与你交流。你可以随时更改。',
    setupSearch: '搜索语言…',
    setupButton: '继续',
    setupNote: '从 100 种语言中选择一种。AI 将用你选择的语言回答。',
    setupFirstRun: '首次设置',
    setupSaved: '语言已保存',
    setupNoResults: '没有匹配的语言。',
    setupChangeLater: '你可以稍后用 !claw 语言 更改',
    setupSuggested: '推荐',

    freshnessYesterday: 'ℹ️ 最后一条信息是昨天的。',
    freshnessDays: 'ℹ️ 最后一条信息是 {n} 天前的。',
    freshnessWeek: 'ℹ️ 最后一条信息是一周多以前的，可能已经过时。',

    para: '截止 {when}',
    sinFecha: '无日期',
    lineDeber: '• *{subject}*：{content} — _{when}_',
    lineExamen: '• *{subject}* — _{when}_{extra}',

    deberesTitle: '📚 *待完成作业*',
    deberesTitleSubject: '📚 *{subject} 作业*',
    examenesTitle: '📝 *即将到来的考试*',
    examenesTitleSubject: '📝 *{subject} 考试*',

    apuntesEmpty:
      '🗂️ 我还没有记录任何内容。如果群里有人提到作业或考试，我会保存下来。',
    apuntesTitle: '🗂️ *我记录的全部内容*（{n} {apunte}）',
    apunte: '条记录',
    apuntes: '条记录',
    apuntesDeberes: '📚 *作业*（{n}）',
    apuntesExamenes: '📝 *考试*（{n}）',
    apuntesHint:
      '删除某项：_!claw olvida <关键词>_  ·  全部删除：_!claw olvida todo_',

    pastExam: '📝 这些考试已经结束了：',
    pastExamSubject: '📝 *{subject}* 的考试已经结束了：',

    nothingFound:
      '🤔 我这里没有关于{what}的记录{of}。如果有人在群里提到，我会保存并记住。',
    nothingFoundOf: '（*{subject}*）',
    whatDeberes: '作业',
    whatExamenes: '考试',

    savedAck: '✅ 已记录 — *{subject}*：{kind}{when}{detail}',
    kindDeberes: '作业',
    kindExamen: '考试',
    savedWhen: ' 于 {date}',
    savedWhenText: '（{text}）',
    savedDetail: '：{content}',

    noSpace:
      '😣 我没能保存照片：磁盘没有剩余空间。如果你释放一些空间，下次就能保存了。',
    tooBig:
      '🙈 这张照片有 {mb} MB，为了不占满磁盘，我没有保存。',
    mediaCaptionOne: '📎 与{what}相关的分享照片{of}',
    mediaCaptionMany: '📎 与{what}相关的分享照片{of}',
    mediaWhatDeberes: '作业',
    mediaWhatExamen: '考试',
    mediaOf: '（{subject}）',
    mediaOnly: '📎 我没有文字内容，但有群里分享的内容{of}：',
    transcript: '🎧 _我听到的是：_ {text}',

    olvidaOk: '🗑️ 完成：已删除 {n} {apunte}。',
    olvidaNada: '🤷 没有找到与“{texto}”相似的记录。',
    olvidaTodoOk:
      '🧹 完成：已删除*全部*记录（{n}）。目前我没有任何保存的内容。',
    olvidaTodoNada: '🤷 我本来就没有记录，所以没有可删除的内容。',

    hechoOkOne: '✅ *已标记为完成*',
    hechoOkMany: '✅ *已将 {n} 条记录标记为完成*',
    hechoOkFoot: '_它们不会再显示为待完成，也不会出现在提醒中。_',
    hechoNada: '🤔 没有找到与“{texto}”匹配的待完成事项。',
    hechoNadaHint: '_试试科目（例如“lengua”）或作业描述里的某个词。_',
    hechoAyudaTitle: '✅ 要把什么标记为完成？告诉我科目或关键词：',
    hechoAyudaHint: '_!claw hecho lengua_ · _!claw hecho 练习 3_',
    hechoAyudaPending: '当前待完成：',
    hechoAyudaMore: '…还有 {n} 项。',

    apunteCreado: '✅ 已记录',
    apunteActualizado: '✏️ 已更新',
    apunteSinFecha: '（无日期）',
    apunteManual: '{status} — *{subject}*：{kind}{when}{detail}',

    apuntaAyuda: [
      '✍️ 告诉我记录什么，如果需要，也可以说截止时间。示例：',
      '• _!claw apunta deberes 数学 周五前做完练习 3_',
      '• _!claw apunta deberes 英语 明天前读完第 2 单元_',
      '• _!claw apunta examen 历史 第 4 单元 10 月 21 日_',
      '• _!claw apunta deberes 数学 到周一_（只改日期）'
    ].join('\n'),

    imagenApagada: [
      '🎨 *图像生成：实验性，已关闭。*',
      '',
      '图像 AI 已经安装在电脑上，但在有人特意开启之前我不会画任何东西',
      '（只有主人或管理员可以开启）：',
      '_!claw ajustes imagenes si_',
      '',
      '即使开启，也只有当你用 _!claw imagen ..._ 手动要求时我才会画：',
      '我从不自行生成图像。'
    ].join('\n'),
    imagenError: '🎨 我没能生成图片。',
    imagenErrorUnknown: '未知错误',
    imagenErrorHint:
      '如果是本地引擎，请检查 sd-cli.exe 和模型是否存在（_imagen_motor_、_imagen_pasos_）。',
    imagenOcupada: [
      '🎨 稍等一下，我正在画另一张图。',
      '',
      '我**一次只画一张**（以免内存不足）。请稍后再试。⏳'
    ].join('\n'),

    palabrotasTitle: '🐷 *脏话计数器*',
    palabrotasNone: '这个群里还没有人说过脏话。干得好！😇',
    palabrotasSummary: '这个群里已经说了 *{total}* {palabra}。',
    palabrota: '句脏话',
    palabrotas: '句脏话',
    palabrotasMost: '🤬 最常说的：*{word}*（{n} {vez}）。',
    vez: '次',
    veces: '次',
    palabrotasAlert: '😜 *刚才那句是脏话！* 排行榜如下：',

    proximoTitle: '⏰ *接下来：* *{subject}*',
    proximoBody: '📝 {when}{count}{extra}',
    proximoToday: '（就是今天！）',
    proximoTomorrow: '（明天！）',
    proximoInDays: '（{n} 天后）',
    proximoExtra: '\n📖 内容：{content}',

    ayudita: [
      '🪝 *PickleBrain* — 命令',
      '',
      '*查询：*',
      '• _!claw_ — 状态和设置（设置仅主人可改）',
      '• _!claw deberes_ — 待完成作业：_!claw deberes 数学_',
      '• _!claw examenes_ — 即将到来的考试',
      '• _!claw apuntes_ — 我记录的全部内容（作业和考试）',
      '• _!claw hecho lengua_ — 把已交的内容标记为完成',
      '• _!claw apunta deberes 数学 周五前做完练习_ — 手动记录或更正',
      '• _!claw proximo_ — 接下来要发生的事',
      '• _!claw resumen_ — 这些天聊了什么：_!claw resumen semana_',
      '• _!claw calendario_ — 下载 .ics 格式的考试',
      '• _!claw busca <内容>_ — 在互联网搜索（DuckDuckGo）',
      '• _!claw imagen <什么>_ — 生成图片（实验性，默认关闭）',
      '• _!claw novedades_ — 机器人新增的全部内容',
      '• _!claw palabrotas_ — 说脏话最多的排名（也会自动出现 😜）',
      '',
      '*国际象棋：*',
      '• _!claw ajedrez_ — 和 Claw 下棋',
      '• _!claw ajedrez e4_ — 走棋（也支持 _Nf3_、_O-O_ 或 _e2e4_）',
      '• _!claw analiza <FEN>_ — 分析局面',
      '• _!claw personalidad_ — 查看或更改 Claw 的说话方式 (normal, profesor, gracioso, pirata)',
      '',
      '*仅主人和管理员：*',
      '• _!claw ajustes_ — 查看和修改设置',
      '• _!claw ajustes ventana 30_ — 修改某一项',
      '• _!claw ajustes privado dueno|admins|todos|nadie_ — 谁可以私信我',
      '• _!claw admins +600111222_ — 添加管理员',
      '• _!claw prohibir +600111222_ — 封禁某人（他将无法使用 Claw）',
      '• _!claw permitir +600111222_ — 解除封禁',
      '• _!claw mantenimiento si|no_ — 机器人保持沉默',
      '• _!claw idioma en_ — 更改机器人语言',
      '• _!claw olvida <文字>_ — 删除错误的记录',
      '• _!claw olvida todo_ — 删除群里的全部记录',
      '• _!claw aqui_ / _!claw fuera_ — 绑定或解绑群组',
      '',
      '💬 *私聊*（直接消息或与自己的对话）也可以：',
      '目前只有主人可以私信我（可用',
      '_!claw ajustes privado ..._ 更改）。你告诉我的作业或考试信息会记录',
      '在群里，你也可以在那里问我。想私聊其他',
      '话题，请写 *Claw* + 你的问题。',
      '',
      '想和我聊任何事，请写 *Claw* + 你的问题：_Claw 2+2 等于几_'
    ].join('\n')
  }
};
