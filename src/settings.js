// Settings that can be seen and changed from WhatsApp (administrators only).
//
// Trick: every setting is hooked to a `config` variable. Changing it from
// WhatsApp stores it in the database and updates `config` live, so the whole bot
// starts using the new value without a restart. The .env value stays as the
// factory default (so it can be restored with reset).
import { config, listaDeJids } from './config.js';
import * as memory from './memory.js';
import * as power from './power.js';
import * as i18n from './i18n.js';

const PREFIJO = 'cfg:';

// setting -> name of the variable in config
const EN_CONFIG = {
  modelo: 'ollamaModel',
  modelo_cerebro: 'ollamaBrainModel',
  fotos: 'mediaEnabled',
  documentos: 'docsEnabled',
  ack: 'ackSaves',
  ventana: 'answerWindowMinutes',
  claw_por_minuto: 'clawMaxPerMinute',
  firma: 'clawSignature',
  bienvenida: 'welcomeEnabled',
  menciones: 'replyToMentions',
  privado: 'privateMode',
  recordatorios: 'reminderEnabled',
  hora_aviso: 'reminderHour',
  hora_manana: 'reminderMorningHour',
  resumen: 'summaryEnabled',
  resumen_dia: 'summaryDay',
  resumen_hora: 'summaryHour',
  ajedrez: 'chessEnabled',
  mantenimiento: 'maintenance',
  buscar: 'webSearchEnabled',
  apunta: 'apuntaLibre',
  despierto: 'preventSleep',
  pantalla: 'keepDisplay',
  palabrotas: 'countSwears',
  palabrotas_aviso: 'swearAlert',
  palabrotas_espera: 'swearCooldown',
  imagenes: 'imageGenEnabled',
  imagen_modelo: 'imageGenModel',
  imagen_endpoint: 'imageGenEndpoint',
  imagen_motor: 'imageGenBackend',
  imagen_pasos: 'imageGenSteps',
  imagen_negativo: 'imageGenNegative',
  novedades: 'changelogNotify',
  idioma: 'idioma'
};

// The factory values (the ones from .env), saved before touching anything.
const DE_FABRICA = {};
for (const nombre of Object.values(EN_CONFIG)) DE_FABRICA[nombre] = config[nombre];

export const CATALOGO = {
  modelo: { etiqueta: 'modelo de IA de Ollama (ej. qwen3:4b o qwen2.5:3b)', tipo: 'texto' },
  modelo_cerebro: { etiqueta: 'modelo que apunta deberes y exámenes (rápido y obediente)', tipo: 'texto' },
  fotos: { etiqueta: 'guardar fotos y documentos que se manden', tipo: 'bool' },
  documentos: { etiqueta: 'guardar tambien PDFs, temarios y fichas', tipo: 'bool' },
  ack: { etiqueta: 'avisar en el grupo cuando apunta algo', tipo: 'bool' },
  ventana: { etiqueta: 'minutos que una pregunta sigue abierta', tipo: 'num', min: 1, max: 720 },
  claw_por_minuto: { etiqueta: 'mensajes de Claw por minuto (por persona)', tipo: 'num', min: 1, max: 60 },
  firma: { etiqueta: 'marcar las respuestas de Claw con una cabecera “🪝 Claw”', tipo: 'bool' },
  bienvenida: { etiqueta: 'presentarse la primera vez que arranca', tipo: 'bool' },
  menciones: { etiqueta: 'contestar si le mencionan directamente', tipo: 'bool' },
  privado: {
    etiqueta: 'quién puede escribirle por privado (DM): dueno | admins | todos | nadie',
    tipo: 'opciones',
    opciones: ['dueno', 'admins', 'todos', 'nadie']
  },
  recordatorios: { etiqueta: 'avisar la tarde antes del examen', tipo: 'bool' },
  hora_aviso: { etiqueta: 'hora del aviso de la tarde (0-23)', tipo: 'num', min: 0, max: 23 },
  hora_manana: { etiqueta: 'hora del aviso la manana del examen (0-23)', tipo: 'num', min: 0, max: 23 },
  resumen: { etiqueta: 'resumen de la semana en el grupo', tipo: 'bool' },
  resumen_dia: { etiqueta: 'dia del resumen (0=domingo ... 6=sabado)', tipo: 'num', min: 0, max: 6 },
  resumen_hora: { etiqueta: 'hora del resumen (0-23)', tipo: 'num', min: 0, max: 23 },
  ajedrez: { etiqueta: 'modo ajedrez (jugar y analizar partidas)', tipo: 'bool' },
  mantenimiento: { etiqueta: 'modo mantenimiento: el bot se queda callado', tipo: 'bool' },
  buscar: { etiqueta: 'buscar en internet (DuckDuckGo) cuando haga falta', tipo: 'bool' },
  apunta: { etiqueta: 'dejar que CUALQUIERA use "!claw apunta" (si) o solo dueño/admins (no)', tipo: 'bool' },
  despierto: { etiqueta: 'mientras el bot está abierto, evitar que el ordenador se duerma o hiberne', tipo: 'bool' },
  pantalla: { etiqueta: 'además, no apagar la pantalla (más gasto; por defecto no)', tipo: 'bool' },
  palabrotas: { etiqueta: 'llevar la cuenta de las palabrotas del grupo (ranking con "!claw palabrotas")', tipo: 'bool' },
  palabrotas_aviso: { etiqueta: 'sacar el ranking en cuanto alguien dice una palabrota', tipo: 'bool' },
  palabrotas_espera: { etiqueta: 'segundos mínimos entre avisos de palabrotas en el mismo grupo (para no spamear)', tipo: 'num', min: 0, max: 3600 },
  imagenes: { etiqueta: 'generación de imágenes EXPERIMENTAL (por ahora solo manual: !claw imagen)', tipo: 'bool' },
  imagen_modelo: { etiqueta: 'modelo para generar imágenes (experimental)', tipo: 'texto' },
  imagen_endpoint: { etiqueta: 'endpoint para generar imágenes (motor http)', tipo: 'texto' },
  imagen_motor: {
    etiqueta: 'motor de imágenes: cli (sd-cli.exe local, recomendado) | http (servidor)',
    tipo: 'opciones',
    opciones: ['cli', 'http']
  },
  imagen_pasos: { etiqueta: 'pasos de la imagen (más = mejor y más lento; 20 va bien, 8 es rapidísimo)', tipo: 'num', min: 1, max: 50 },
  imagen_negativo: { etiqueta: 'lo que NO debe salir en la imagen (prompt negativo)', tipo: 'texto' },
  novedades: { etiqueta: 'contarle al grupo lo que se ha añadido al bot (una sola vez por novedad)', tipo: 'bool' },
  idioma: { etiqueta: 'idioma en el que habla Claw (código: es, en, fr, de...)', tipo: 'texto' },
  admins: { etiqueta: 'administradores de Claw', tipo: 'lista' },
  vetados: { etiqueta: 'personas vetadas: no pueden usar a Claw', tipo: 'lista' }
};

/** Factory value of a setting (the one from .env). */
export function defecto(clave) {
  if (clave === 'admins') return config.adminJids || [];
  if (clave === 'vetados') return config.blockedJids || [];
  if (clave === 'idioma') return DE_FABRICA.idioma || 'es';
  const nombre = EN_CONFIG[clave];
  return nombre ? DE_FABRICA[nombre] : undefined;
}

/** Converts the stored value (JSON text) into the right type. */
function convertir(texto, def) {
  let valor;
  try {
    valor = JSON.parse(texto);
  } catch {
    valor = texto;
  }
  if (def.tipo === 'bool') return Boolean(valor);
  if (def.tipo === 'num') {
    const n = Number(valor);
    return Number.isFinite(n) ? n : defecto(claveDe(def));
  }
  if (def.tipo === 'lista') return Array.isArray(valor) ? valor : listaDeJids(valor);
  if (def.tipo === 'opciones') {
    const v = normalizaOpcion(valor);
    return (def.opciones || []).includes(v) ? v : defecto(claveDe(def));
  }
  return String(valor);
}

// Aliases people can write for each value of an options setting.
const ALIAS_OPCIONES = {
  dueno: 'dueno',
  dueño: 'dueno',
  owner: 'dueno',
  yo: 'dueno',
  mi: 'dueno',
  solo: 'dueno',
  solo_dueno: 'dueno',
  admin: 'admins',
  admins: 'admins',
  administrador: 'admins',
  administradores: 'admins',
  todos: 'todos',
  cualquiera: 'todos',
  todo: 'todos',
  all: 'todos',
  nadie: 'nadie',
  ninguno: 'nadie',
  nobody: 'nadie',
  no: 'nadie'
};

function normalizaOpcion(valor) {
  return String(valor ?? '').trim().toLowerCase();
}

/** Readable value of an option (for the settings list). */
const BONITO_OPCION = {
  dueno: 'solo el dueño',
  admins: 'dueño y admins',
  todos: 'cualquiera',
  nadie: 'nadie'
};

function claveDe(def) {
  return Object.keys(CATALOGO).find((k) => CATALOGO[k] === def);
}

/** Current value of a setting (the stored one, or the .env one otherwise). */
export function get(clave) {
  const def = CATALOGO[clave];
  if (!def) return undefined;
  const guardado = memory.getSetting(PREFIJO + clave);
  if (guardado === null || guardado === undefined) return defecto(clave);
  return convertir(guardado, def);
}

/** Pushes a setting's value into `config` (so the bot uses it right away). */
function aplicar(clave, valor) {
  if (clave === 'idioma') {
    i18n.setIdioma(valor);
    return;
  }
  const nombre = EN_CONFIG[clave];
  if (nombre) config[nombre] = valor;
}

/** Loads every stored setting into `config`. Called on startup. */
export function aplicarTodos() {
  for (const clave of Object.keys(CATALOGO)) aplicar(clave, get(clave));
  const modeloGuardado = memory.getSetting('ollama_model_active');
  if (modeloGuardado) {
    try {
      config.ollamaModel = String(JSON.parse(modeloGuardado));
    } catch {
      memory.setSetting('ollama_model_active', null);
    }
  }
}

/** Changes and persists the active chat model (the school brain does not change). */
export function usarModelo(modelo) {
  const nombre = String(modelo || '').trim();
  if (!nombre) return { ok: false, error: 'Dime el nombre del modelo de Ollama.' };
  memory.setSetting(PREFIJO + 'modelo', null);
  memory.setSetting('ollama_model_active', JSON.stringify(nombre));
  config.ollamaModel = nombre;
  return { ok: true, model: nombre };
}

/** Goes back to the chat model set as primary in the configuration. */
export function restaurarModeloPrincipal() {
  memory.setSetting(PREFIJO + 'modelo', null);
  memory.setSetting('ollama_model_active', null);
  config.ollamaModel = config.ollamaPrimaryModel;
  return config.ollamaModel;
}

function guardar(clave, valor) {
  memory.setSetting(PREFIJO + clave, JSON.stringify(valor));
  if (clave === 'modelo') memory.setSetting('ollama_model_active', JSON.stringify(valor));
  aplicar(clave, valor);
  power.sync(); // in case the setting was the power-lock one
  return { ok: true, clave, valor };
}

/** Changes a setting from what a person typed. */
export function setDesdeTexto(clave, texto) {
  const def = CATALOGO[clave];
  if (!def) {
    return { ok: false, error: `No conozco el ajuste *${clave}*. Mira la lista con *!claw ajustes*.` };
  }
  const t = String(texto ?? '').trim();

  if (def.tipo === 'bool') {
    if (/^(si|sí|s|true|1|on|activar|activado|activo)$/i.test(t)) return guardar(clave, true);
    if (/^(no|n|false|0|off|desactivar|desactivado|apagado)$/i.test(t)) return guardar(clave, false);
    return { ok: false, error: `*${clave}* es de sí o no. Ejemplo:  !claw ajustes ${clave} no` };
  }

  if (def.tipo === 'num') {
    const n = Number(t.replace(',', '.'));
    const min = def.min ?? 0;
    const max = def.max ?? 99999;
    if (!Number.isFinite(n)) {
      return { ok: false, error: `*${clave}* es un número entre ${min} y ${max}.` };
    }
    if (n < min || n > max) return { ok: false, error: `*${clave}* tiene que estar entre ${min} y ${max}.` };
    return guardar(clave, Math.round(n));
  }

  if (def.tipo === 'lista') {
    if (/^(vaciar|nada|ninguno|limpiar)$/i.test(t)) return guardar(clave, []);
    const sumar = t.startsWith('+');
    const quitar = t.startsWith('-');
    const nuevos = listaDeJids(sumar || quitar ? t.slice(1) : t);
    if (!nuevos.length) {
      return {
        ok: false,
        error:
          'Dime números de teléfono. Añadir:  _!claw ajustes admins +600111222_  ·  Quitar:  _!claw ajustes admins -600111222_'
      };
    }
    const actuales = get(clave) || [];
    const juntos = quitar ? actuales.filter((j) => !nuevos.includes(j)) : [...new Set([...actuales, ...nuevos])];
    return guardar(clave, juntos);
  }

  if (def.tipo === 'opciones') {
    const q = normalizaOpcion(t);
    const v = (def.opciones || []).includes(q) ? q : ALIAS_OPCIONES[q];
    if (!v || !(def.opciones || []).includes(v)) {
      return { ok: false, error: `*${clave}* solo puede ser: ${def.opciones.join(' / ')}.` };
    }
    return guardar(clave, v);
  }

  if (!t) return { ok: false, error: `*${clave}* necesita un valor.` };
  return guardar(clave, t);
}

/** Stores an already decided list (used from admins.js). */
export function setLista(clave, valores) {
  const def = CATALOGO[clave];
  if (!def || def.tipo !== 'lista') return { ok: false, error: 'Ese ajuste no es una lista.' };
  const limpia = listaDeJids(Array.isArray(valores) ? valores.join(',') : String(valores));
  return guardar(clave, limpia);
}

export function reset(clave) {
  const def = CATALOGO[clave];
  if (!def) return { ok: false, error: `No conozco el ajuste *${clave}*.` };
  memory.setSetting(PREFIJO + clave, null);
  if (clave === 'modelo') memory.setSetting('ollama_model_active', null);
  const valor = defecto(clave);
  aplicar(clave, valor);
  power.sync(); // in case the setting was the power-lock one
  return { ok: true, clave, valor };
}

/** Every setting with its current value. */
export function list() {
  return Object.keys(CATALOGO).map((clave) => ({
    clave,
    etiqueta: CATALOGO[clave].etiqueta,
    tipo: CATALOGO[clave].tipo,
    valor: get(clave)
  }));
}

/** How a value is written so it reads well in WhatsApp. */
export function bonito(valor) {
  if (valor === true) return 'sí';
  if (valor === false) return 'no';
  if (Array.isArray(valor)) {
    return valor.length ? valor.map((j) => j.split('@')[0]).join(', ') : 'ninguno';
  }
  if (typeof valor === 'string' && BONITO_OPCION[valor]) return BONITO_OPCION[valor];
  return String(valor);
}

/** Text with the settings list, for WhatsApp. */
export function formato() {
  const filas = list().map((a) => `• *${a.clave}* (${bonito(a.valor)}) — ${a.etiqueta}`);
  return [
    '⚙️ *Ajustes de Claw*',
    '',
    ...filas,
    '',
    'Para cambiar uno:  _!claw ajustes <ajuste> <valor>_',
    'Ejemplos:  _!claw ajustes ack si_   ·   _!claw ajustes hora_aviso 21_',
    'Añadir administrador:  _!claw ajustes admins +600111222_',
    'Volver a fábrica:  _!claw ajustes reset <ajuste>_'
  ].join('\n');
}
