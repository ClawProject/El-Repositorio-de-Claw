// Pruebas de integracion: una conversacion completa por el router real,
// sobre una base de datos temporal. Uso:  npm test
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { config } from '../config.js';
import * as memory from '../memory.js';
import * as ajustes from '../settings.js';
import * as power from '../power.js';
import * as admins from '../admins.js';
import { avisosPendientes } from '../reminders.js';
import { tocaResumenSemanal } from '../summary.js';
import * as ajedrez from '../chess.js';
import { eligeJugada as eligeJugadaMotor } from '../chessengine.js';
import { Chess } from 'chess.js';
import { handleMessage, resetTransientState, rememberBotMessage, boundGroupJid } from '../router.js';
import { recordarAlias } from '../identities.js';
import { sendReplies, estaConectado, cuandoConecte } from '../whatsapp.js';
import { liberarVram } from '../ollama.js';
import { necesitaBuscar, parsearResultadosDDG } from '../search.js';
import { conFuenteWeb, PERSONALIDADES } from '../claw.js';
import { resolverComando } from '../commands.js';
import { contarPalabrotas } from '../swears.js';
import { esPedidoDeImagen, parsearImagen, sniffMime, argsCli, generarImagen, pistaDeError } from '../imagegen.js';
import { novedades, textoNovedades, hashNovedades, marcadorNovedades } from '../changelog.js';
import * as replies from '../replies.js';
import { ping } from '../ollama.js';
import { todayISO, addDays, longDate, weekdayOf, extractDatePhrase } from '../dates.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

const JID = 'test@g.us';

async function say(text, who = 'Ana') {
  const t0 = Date.now();
  const result = await handleMessage({
    chatJid: JID,
    chatName: 'Grupo de prueba',
    isGroup: true,
    text,
    senderName: who,
    senderJid: `${who.toLowerCase()}@s.whatsapp.net`,
    msgId: `t-${Math.random().toString(36).slice(2)}`,
    mentionedBot: false,
    fromMe: false,
    esPrivado: false,
    esChatPropio: false
  });
  const ms = Date.now() - t0;
  const reply = [...result.replies, ...(result.notices || [])].join('\n');
  console.log(
    `\n  \x1b[2m[${who}] ${text}\x1b[0m\n  ${
      reply ? `\x1b[36m↳ ${reply.replace(/\n/g, '\n    ')}\x1b[0m` : `\x1b[2m(no dice nada)\x1b[0m`
    } \x1b[2m(${result.action}, ${ms}ms)\x1b[0m`
  );
  return { ...result, reply, ms };
}

// Un PNG de 1x1, para simular fotos sin depender de archivos externos.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64'
);

/** Un servidor local de mentira que devuelve una imagen, para probar sin red.
 *  Con `retardo` se puede comprobar que no se piden dos imágenes a la vez. */
async function servidorImagen(payload, { retardo = 0 } = {}) {
  let aLaVez = 0;
  const estado = { maxALaVez: 0, peticiones: 0 };
  const srv = http.createServer((req, res) => {
    estado.peticiones++;
    aLaVez++;
    estado.maxALaVez = Math.max(estado.maxALaVez, aLaVez);
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      const responder = () => {
        aLaVez--;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      if (retardo) setTimeout(responder, retardo);
      else responder();
    });
  });
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const { port } = srv.address();
  return {
    url: `http://127.0.0.1:${port}/v1/images/generations`,
    estado,
    close: () => new Promise((resolve) => srv.close(resolve))
  };
}

async function sendMedia(kind, buffer, { text = '', who = 'Ana', seconds = 0, fileName = null } = {}) {
  const t0 = Date.now();
  const result = await handleMessage({
    chatJid: JID,
    chatName: 'Grupo de prueba',
    isGroup: true,
    text,
    senderName: who,
    senderJid: `${who.toLowerCase()}@s.whatsapp.net`,
    msgId: `tm-${Math.random().toString(36).slice(2)}`,
    mentionedBot: false,
    fromMe: false,
    esPrivado: false,
    esChatPropio: false,
    media: {
      kind,
      mime: kind === 'image' ? 'image/png' : kind === 'document' ? 'application/pdf' : 'audio/ogg',
      size: buffer.length,
      seconds,
      fileName,
      download: async () => buffer
    }
  });
  const ms = Date.now() - t0;
  const reply = [...result.replies, ...(result.notices || [])].join('\n');
  const tag = kind === 'image' ? '[foto]' : kind === 'document' ? '[documento]' : '[nota de voz]';
  const extra = result.media?.length ? `, +${result.media.length} archivo(s)` : '';
  console.log(
    `\n  \x1b[2m[${who}] ${tag} ${text}\x1b[0m\n  ${
      reply ? `\x1b[36m↳ ${reply.replace(/\n/g, '\n    ')}\x1b[0m` : `\x1b[2m(no dice nada)\x1b[0m`
    } \x1b[2m(${result.action}${extra}, ${ms}ms)\x1b[0m`
  );
  return { ...result, reply, ms };
}

async function main() {
  const stamp = Date.now();
  const tmpDb = path.join(os.tmpdir(), `picklebrain-test-${stamp}.db`);
  // Los tests no deben tocar los archivos ni la base de datos de verdad.
  config.dataDir = path.join(os.tmpdir(), `picklebrain-test-${stamp}`);
  config.mediaDir = path.join(config.dataDir, 'media');
  // No abrir un candado de energía real mientras corren las pruebas.
  config.preventSleep = false;
  await memory.init(tmpDb);
  resetTransientState();
  memory.setSetting('group_jid', JID);

  console.log('\n\x1b[1m=== PickleBrain: pruebas ===\x1b[0m');
  console.log(`Hoy es ${longDate(todayISO())} (${todayISO()})\n`);

  const health = await ping();
  if (!health.ok) {
    console.log('Ollama no responde, no puedo hacer las pruebas completas.');
    process.exitCode = 1;
    return;
  }

  // ---- 1. No responde a charla normal -------------------------------
  console.log('\n\x1b[1m--- Charla normal: no debe hablar ---\x1b[0m');
  let r = await say('jajajaja que bueno');
  check('Ignora los memes', r.replies.length === 0 && r.action === 'silencio', `action=${r.action}`);

  r = await say('quedamos a las 5 en la puerta');
  check('Ignora la charla sin deberes ni examenes', r.replies.length === 0, `action=${r.action}`);

  // ---- 2. Pregunta sin datos: no inventa ----------------------------
  console.log('\n\x1b[1m--- Pregunta sin datos: no debe inventarse nada ---\x1b[0m');
  r = await say('que deberes hay de lengua?');
  check('No se inventa deberes', /no tengo apuntado nada/i.test(r.reply), r.reply.slice(0, 80));

  // ---- 3. Alguien contesta: debe guardarlo en silencio --------------
  console.log('\n\x1b[1m--- Alguien contesta: lo aprende en silencio ---\x1b[0m');
  const fechaTarea = addDays(todayISO(), 1);
  const diaTarea = longDate(fechaTarea).split(' ')[0];
  r = await say(`hay que hacer las paginas 30 a 32 de lengua para el ${diaTarea}`, 'Marcos');
  check('Guarda la respuesta (en silencio)', r.replies.length === 0, `action=${r.action} reply=${r.reply}`);

  const saved = memory.findPending({ kind: 'deberes', subjectKey: 'lengua' });
  check('El deber esta en la base de datos', saved.length === 1, JSON.stringify(saved.map((s) => s.content)));
  check(
    `La fecha "el ${diaTarea}" se calcula bien (${fechaTarea})`,
    saved[0]?.fecha === fechaTarea,
    `guardado=${saved[0]?.fecha} esperado=${fechaTarea}`
  );

  // ---- 4. Ahora si pregunta: responde al instante -------------------
  console.log('\n\x1b[1m--- Vuelve a preguntar: responde desde la memoria ---\x1b[0m');
  r = await say('alguien sabe que deberes hay de lengua?');
  check('Responde con los deberes guardados', /30 a 32/i.test(r.reply), r.reply.slice(0, 120));
  check('La respuesta es instantanea (<1s)', r.ms < 1000, `${r.ms} ms`);

  // ---- 5. Examenes -------------------------------------------------
  console.log('\n\x1b[1m--- Examenes ---\x1b[0m');
  const fechaExamen = addDays(todayISO(), 6);
  r = await say('el examen de historia es el ' + longDate(fechaExamen).split(' ').slice(1).join(' ') + ', entra el tema 4', 'Lucia');
  check('Guarda el examen en silencio', r.replies.length === 0, r.reply);

  r = await say('cuando es el examen de historia?');
  check('Responde con el examen', /historia/i.test(r.reply) && /tema 4/i.test(r.reply), r.reply.slice(0, 150));
  check('La fecha del examen es correcta', r.reply.includes(String(Number(fechaExamen.split('-')[2]))), r.reply.slice(0, 150));
  check('Respuesta instantanea (<1s)', r.ms < 1000, `${r.ms} ms`);

  // ---- 6. Cambio de fecha: reemplaza ------------------------------
  console.log('\n\x1b[1m--- Cambian la fecha del examen: debe reemplazar ---\x1b[0m');
  const nueva = addDays(todayISO(), 9);
  await say(`el examen de historia se ha movido al ${longDate(nueva).split(' ').slice(1).join(' ')}`, 'Lucia');
  r = await say('cuando es el examen de historia?');
  check('La fecha nueva sustituye a la vieja', r.reply.includes(String(Number(nueva.split('-')[2]))), r.reply.slice(0, 150));

  // ---- 7. Pregunta por asignatura desconocida ---------------------
  console.log('\n\x1b[1m--- Pregunta de algo que no sabe ---\x1b[0m');
  r = await say('cuando es el examen de filosofia?');
  check('No se inventa el examen de filosofia', /no tengo apuntado/i.test(r.reply), r.reply.slice(0, 120));

  // ---- 8. Modo Claw ------------------------------------------------
  console.log('\n\x1b[1m--- Modo Claw ---\x1b[0m');
  r = await say('Claw cuanto son 2+2');
  check('Claw responde al calculo', /4/.test(r.reply), r.reply.slice(0, 120));

  r = await say('Claw, que deberes hay de lengua?');
  check('Claw usa los datos reales del grupo', /30 a 32/i.test(r.reply), r.reply.slice(0, 120));

  r = await say('Claw');
  check('Claw solo no da error', r.replies.length === 1 && r.reply.length > 5, r.reply);

  // ---- 9. No se contesta a si mismo -------------------------------
  console.log('\n\x1b[1m--- No debe contestarse a si mismo ---\x1b[0m');
  const ownId = 'BOT-msg-' + Date.now();
  rememberBotMessage(ownId);
  const selfReply = await handleMessage({
    chatJid: JID,
    chatName: 'Grupo de prueba',
    isGroup: true,
    text: 'Claw cuanto son 2+2',
    senderName: 'PickleBrain',
    senderJid: 'bot@s.whatsapp.net',
    msgId: ownId,
    mentionedBot: false,
    fromMe: true
  });
  check('Ignora los mensajes que ha enviado el mismo', selfReply.replies.length === 0, `action=${selfReply.action}`);

  // ---- 10. Fotos: recordar "lo que entra" -------------------------
  console.log('\n\x1b[1m--- Fotos: recuerda lo que entra en el examen ---\x1b[0m');
  resetTransientState();
  r = await sendMedia('image', TINY_PNG, { who: 'Marcos' });
  check('Ignora una foto sin nada que ver', memory.allMedia().length === 0, `archivos=${memory.allMedia().length}`);

  const fotosAntes = memory.allMedia().length;
  r = await sendMedia('image', TINY_PNG, { text: 'esto entra en el examen de historia', who: 'Marcos' });
  check('Guarda la foto sin decir nada', r.replies.length === 0, `action=${r.action}`);

  const fotos = memory.allMedia();
  check('La foto queda guardada', fotos.length === fotosAntes + 1, `archivos=${fotos.length}`);
  check('La foto se enlaza al examen de historia', fotos.at(-1)?.subjectKey === 'historia', String(fotos.at(-1)?.subjectKey));
  check('La foto tiene fecha de borrado', Boolean(fotos.at(-1)?.expiresAt), String(fotos.at(-1)?.expiresAt));
  check(
    'El pie de foto no pisa la fecha del examen',
    memory.findPending({ kind: 'examen', subjectKey: 'historia' })[0]?.fecha === nueva,
    `guardado=${memory.findPending({ kind: 'examen', subjectKey: 'historia' })[0]?.fecha} esperado=${nueva}`
  );

  resetTransientState();
  r = await say('que entra en el examen de historia?');
  check('Al preguntar, reenvía la foto', r.media.length >= 1, `archivos=${r.media.length}`);
  check('Sigue dando el texto del examen', /tema 4|historia/i.test(r.reply), r.reply.slice(0, 120));

  // ---- 10-bis. PDFs: se guardan y se reenvían ---------------------
  console.log('\n\x1b[1m--- PDFs: guarda el temario y lo reenvía ---\x1b[0m');
  const PDF = Buffer.from('%PDF-1.4 ejemplo minimo de temario');
  const docsAntes = memory.allMedia().length;
  r = await sendMedia('document', PDF, {
    text: 'esto entra en el examen de historia',
    who: 'Marcos',
    fileName: 'tema-4-historia.pdf'
  });
  check('Guarda el PDF sin decir nada', r.replies.length === 0, `action=${r.action}`);
  const docs = memory.allMedia();
  check('El PDF queda guardado', docs.length === docsAntes + 1, `archivos=${docs.length}`);
  check('El PDF conserva su nombre', docs.at(-1)?.fileName === 'tema-4-historia.pdf', String(docs.at(-1)?.fileName));
  check('El PDF se guarda con extensión .pdf', /\.pdf$/i.test(docs.at(-1)?.filePath || ''), String(docs.at(-1)?.filePath));
  check('El PDF se enlaza al examen de historia', docs.at(-1)?.subjectKey === 'historia', String(docs.at(-1)?.subjectKey));

  resetTransientState();
  r = await say('que entra en el examen de historia?');
  const docItem = r.media.find((m) => m.kind === 'document');
  check('Al preguntar, reenvía el PDF como documento', Boolean(docItem), `tipos=${r.media.map((m) => m.kind).join(',')}`);
  check('El PDF se reenvía con su nombre', docItem?.filename === 'tema-4-historia.pdf', String(docItem?.filename));

  // Si los PDFs están desactivados, se ignoran.
  const guardDocs = config.docsEnabled;
  config.docsEnabled = false;
  const docsAntes2 = memory.allMedia().length;
  await sendMedia('document', PDF, { text: 'esto entra en el examen de historia', who: 'Marcos' });
  check('Con los PDFs desactivados, no se guardan', memory.allMedia().length === docsAntes2, `archivos=${memory.allMedia().length}`);
  config.docsEnabled = guardDocs;

  // ---- 11. Disco lleno --------------------------------------------
  console.log('\n\x1b[1m--- Disco lleno: avisa con educación ---\x1b[0m');
  const fotosOk = memory.allMedia().length;
  const keepReal = config.mediaMinFreeMb;
  config.mediaMinFreeMb = 10000000; // exigimos 10 TB libres: imposible
  resetTransientState();
  r = await sendMedia('image', TINY_PNG, { text: 'esto entra en el examen de historia', who: 'Marcos' });
  check('Avisa de que no hay espacio 😣', /no queda espacio/i.test(r.reply), r.reply.slice(0, 120));
  check('No guarda nada si no hay espacio', memory.allMedia().length === fotosOk, `archivos=${memory.allMedia().length}`);
  config.mediaMinFreeMb = keepReal;

  // ---- 12. Notas de voz -------------------------------------------
  console.log('\n\x1b[1m--- Notas de voz: las entiende ---\x1b[0m');
  const voiceFixture = process.env.WHISPER_TEST_AUDIO ||
    path.join(config.rootDir, 'src', 'tools', 'fixtures', 'nota-de-voz.ogg');
  if (!fs.existsSync(voiceFixture)) {
    console.log('  Se omite la prueba de voz: no hay una muestra local incluida.');
  } else if (!(await (await import('../transcribe.js')).voiceAvailable())) {
    check(
      'Entiende las notas de voz (necesita ffmpeg o el servicio Python)',
      false,
      'instala ffmpeg o arranca python/server.py'
    );
  } else {
    const ogg = fs.readFileSync(voiceFixture);
    const previousHistory = memory.findPending({ kind: 'examen', subjectKey: 'historia' })[0];
    if (previousHistory) memory.deactivateEntry(previousHistory.id);
    resetTransientState();
    r = await sendMedia('audio', ogg, { seconds: 8, who: 'Lucia' });
    check(
      'Entiende la nota de voz',
      /examen/i.test(r.transcript || ''),
      `transcrito=${JSON.stringify(String(r.transcript || '').slice(0, 90))}`
    );
    const historial = memory.findPending({ kind: 'examen', subjectKey: 'historia' })[0];
    // En la nota se dice "el 20 de octubre" (sin año): si ese día ya ha pasado
    // este año, la fecha se refiere al siguiente.
    const ejercicio = `${todayISO().slice(0, 4)}-10-20`;
    const esperado = ejercicio >= todayISO() ? ejercicio : `${Number(todayISO().slice(0, 4)) + 1}-10-20`;
    check(
      'Aprende la fecha dicha en voz alta',
      historial?.fecha === esperado,
      `guardado=${historial?.fecha} esperado=${esperado}`
    );
  }

  // ---- 13. Limpieza automática ------------------------------------
  console.log('\n\x1b[1m--- Limpieza: borra lo que caduca ---\x1b[0m');
  const mediaLib = await import('../media.js');
  const vieja = mediaLib.saveImage({
    buffer: TINY_PNG,
    mime: 'image/png',
    kind: 'examen',
    subject: 'Filosofía',
    subjectKey: 'filosofia',
    expiresAt: '2020-01-01 00:00:00'
  });
  memory.saveEntry({ kind: 'examen', subject: 'Filosofía', content: 'Tema 1', fecha: addDays(todayISO(), -30), confidence: 1 });
  check('La foto del examen viejo está en disco', fs.existsSync(vieja.media.filePath), vieja.media.filePath);

  const limpieza = mediaLib.cleanup();
  check('La limpieza borra la foto caducada', !fs.existsSync(vieja.media.filePath), 'el archivo sigue ahí');
  check('La limpieza olvida el examen que ya pasó', !memory.listEntries().some((e) => e.subjectKey === 'filosofia'), `caducados=${limpieza.expired}, apuntes=${limpieza.entries}`);
  check('La limpieza no toca los exámenes que aún no han pasado', memory.findPending({ kind: 'examen' }).length > 0, '');

  // ---- 14. Aguanta sin Ollama -------------------------------------
  console.log('\n\x1b[1m--- Resistencia: la IA no responde ---\x1b[0m');
  resetTransientState(); // partimos de cero para saltarnos el anti-repeticion
  const { config: cfg } = await import('../config.js');
  const realUrl = cfg.ollamaUrl;
  cfg.ollamaUrl = 'http://127.0.0.1:59999'; // puerto muerto
  try {
    r = await say('cuando es el examen de historia?');
    check('Sigue respondiendo con la IA caida (ruta rapida)', /historia/i.test(r.reply), r.reply.slice(0, 100));
    r = await say('Claw cuanto son 2+2');
    check('Avisa con elegancia si Claw no puede pensar', /ollama|momento/i.test(r.reply), r.reply.slice(0, 120));
    r = await say('hay que hacer los ejercicios 5 y 6 de biologia');
    check('No revienta al guardar sin IA', r.replies.length === 0, `action=${r.action}`);
  } finally {
    cfg.ollamaUrl = realUrl;
  }

  // ---- 15. Vinculacion del grupo (solo por identificador) -----------
  console.log('\n\x1b[1m--- Vinculación del grupo (sin mirar el nombre) ---\x1b[0m');
  memory.setSetting('group_jid', null);
  memory.setSetting('group_name', null);
  memory.setSetting('welcome_sent', null);
  // Ana hace de administradora para poder vincular y desvincular.
  memory.setSetting('cfg:admins', JSON.stringify(['ana@s.whatsapp.net']));

  const enOtro = async (chatJid, chatName, text) =>
    handleMessage({
      chatJid,
      chatName,
      isGroup: true,
      text,
      senderName: 'Ana',
      senderJid: 'ana@s.whatsapp.net',
      msgId: `b-${Math.random().toString(36).slice(2)}`,
      mentionedBot: false,
      fromMe: false,
      esPrivado: false,
      esChatPropio: false
    });

  await enOtro('otros-familia@g.us', 'Familia 🎄', 'que deberes hay?');
  check(
    'No se vincula solo a un grupo ajeno',
    boundGroupJid() === null,
    `vinculado=${boundGroupJid()}`
  );

  const unido = await enOtro(JID, 'Grupo de clase 2B 🎓', '!claw aqui');
  const diceUnido = [...unido.replies, ...unido.notices].join(' | ');
  check(
    'Se vincula con "!claw aqui"',
    boundGroupJid() === JID,
    `vinculado=${boundGroupJid()}`
  );
  check(
    'Contesta al vincularse',
    /me quedo aquí/i.test(diceUnido),
    `dice=${diceUnido.slice(0, 90)}`
  );
  check(
    'No guarda el nombre del grupo',
    memory.getSetting('group_name') === null,
    `group_name=${memory.getSetting('group_name')}`
  );

  const fuera = await enOtro(JID, 'Grupo de clase 2B 🎓', '!claw fuera');
  check(
    'Se puede desvincular con "!claw fuera"',
    boundGroupJid() === null,
    `vinculado=${boundGroupJid()} reply=${fuera.replies.join(' ').slice(0, 80)}`
  );

  // Dejamos todo como estaba para no confundir a nadie.
  memory.setSetting('group_jid', JID);
  memory.setSetting('group_name', null);
  memory.setSetting('cfg:admins', null);

  // ---- 16. Comandos, ajustes y permisos ----------------------------
  console.log('\n\x1b[1m--- Comandos "!claw" y ajustes (solo el dueño/admin) ---\x1b[0m');

  const dice = async (text, who, extra = {}, dependencies = {}) =>
    handleMessage({
      chatJid: JID,
      chatName: 'Grupo de prueba',
      isGroup: true,
      text,
      senderName: who,
      senderJid: `${who.toLowerCase()}@s.whatsapp.net`,
      msgId: `c-${Math.random().toString(36).slice(2)}`,
      mentionedBot: false,
      fromMe: false,
      esPrivado: false,
      esChatPropio: false,
      ...extra
    }, dependencies);

  const texto = (r) => [...r.replies, ...r.notices].join(' | ');

  // Un chaval cualquiera (no admin) no puede tocar los ajustes.
  const intruso = await dice('!claw ajustes', 'Bea');
  check(
    'Sin ser admin, "!claw ajustes" se rechaza',
    /solo lo puede hacer el dueño/i.test(texto(intruso)),
    `dice=${texto(intruso).slice(0, 80)}`
  );

  // El dueño sí (es el número de la propia cuenta del bot).
  const duenoJid = admins.duenoJid();
  const delDueno = await dice('!claw ajustes', 'Dueno', {
    senderJid: duenoJid,
    fromMe: true,
    esChatPropio: false
  });
  check(
    'El dueño ve los ajustes',
    /Ajustes de Claw/.test(texto(delDueno)) && /ack/.test(texto(delDueno)),
    `dice=${texto(delDueno).slice(0, 80)}`
  );

  const fakeModelList = async () => ({
    ok: true,
    models: [config.ollamaPrimaryModel, config.ollamaFallbackModel]
  });
  const iaEstado = await dice(
    '!claw ia',
    'Dueno',
    { senderJid: duenoJid, fromMe: true },
    { listModels: fakeModelList }
  );
  check(
    'El dueño consulta el modelo activo y los instalados',
    /Modelo conversacional/.test(texto(iaEstado)) &&
      texto(iaEstado).includes(config.ollamaPrimaryModel) &&
      texto(iaEstado).includes(config.ollamaFallbackModel),
    texto(iaEstado)
  );
  const iaIntruso = await dice('!claw ia fallback', 'Bea', {}, { listModels: fakeModelList });
  check(
    'Un usuario normal no puede cambiar el modelo de IA',
    /solo lo puede hacer el dueño/i.test(texto(iaIntruso)),
    texto(iaIntruso)
  );
  const modeloPrevio = config.ollamaModel;
  const usarFallback = await dice(
    '!claw ia fallback',
    'Dueno',
    { senderJid: duenoJid, fromMe: true },
    { listModels: fakeModelList }
  );
  check(
    'El comando fallback cambia al modelo ligero y lo persiste',
    config.ollamaModel === config.ollamaFallbackModel &&
      memory.getSetting('ollama_model_active') === JSON.stringify(config.ollamaFallbackModel) &&
      texto(usarFallback).includes(config.ollamaFallbackModel) &&
      /volver al modelo principal/i.test(texto(usarFallback)),
    `activo=${config.ollamaModel} respuesta=${texto(usarFallback)}`
  );
  config.ollamaModel = 'modelo-sin-instalar';
  ajustes.aplicarTodos();
  check(
    'El modelo fallback persiste tras volver a aplicar ajustes al arrancar',
    config.ollamaModel === config.ollamaFallbackModel,
    `activo=${config.ollamaModel}`
  );
  const usarPrincipal = await dice(
    '!claw ia principal',
    'Dueno',
    { senderJid: duenoJid, fromMe: true },
    { listModels: fakeModelList }
  );
  check(
    'El comando principal revierte el fallback persistido',
    config.ollamaModel === config.ollamaPrimaryModel &&
      memory.getSetting('ollama_model_active') === null &&
      texto(usarPrincipal).includes(config.ollamaPrimaryModel) &&
      /respaldo/i.test(texto(usarPrincipal)),
    `activo=${config.ollamaModel} previo=${modeloPrevio}`
  );
  const modeloNoInstalado = await dice(
    '!claw ia modelo-que-no-existe',
    'Dueno',
    { senderJid: duenoJid, fromMe: true },
    { listModels: fakeModelList }
  );
  check(
    'No cambia a un modelo que Ollama no tiene instalado',
    config.ollamaModel === config.ollamaPrimaryModel &&
      /no está instalado/i.test(texto(modeloNoInstalado)),
    texto(modeloNoInstalado)
  );
  memory.setSetting('ollama_model_active', null);

  // Cambiamos un ajuste y se aplica en caliente a config.
  const antesAck = config.ackSaves;
  const setAck = await dice('!claw ajustes ack si', 'Dueno', { senderJid: duenoJid, fromMe: true });
  check(
    'Cambiar un ajuste lo aplica al momento',
    ajustes.get('ack') === true && config.ackSaves === true && /ack/.test(texto(setAck)),
    `ack=${ajustes.get('ack')} config.ackSaves=${config.ackSaves}`
  );
  const resetAck = await dice('!claw ajustes reset ack', 'Dueno', { senderJid: duenoJid, fromMe: true });
  check(
    'Resetear un ajuste vuelve al valor de fábrica',
    ajustes.get('ack') === antesAck && /fábrica/.test(texto(resetAck)),
    `ack=${ajustes.get('ack')} (esperado ${antesAck})`
  );

  // La lista de administradores solo la toca el dueño.
  const otraAdmin = 'bea@s.whatsapp.net';
  const addAdmin = await dice('!claw admins +600111222', 'Dueno', { senderJid: duenoJid, fromMe: true });
  check(
    'El dueño añade un administrador',
    admins.esAdmin('600111222@s.whatsapp.net') && /Administradores/.test(texto(addAdmin)),
    `dice=${texto(addAdmin).slice(0, 80)}`
  );
  const verAdmins = await dice('!claw admins', otraAdmin, { senderJid: '600111222@s.whatsapp.net' });
  check(
    'Un administrador ve la lista pero no la cambia',
    /Quién puede tocar/i.test(texto(verAdmins)),
    `dice=${texto(verAdmins).slice(0, 80)}`
  );
  const noCambia = await dice('!claw admins -600111222', 'Caco', { senderJid: '600111222@s.whatsapp.net' });
  check(
    'Ni un administrador puede quitar a otro (solo el dueño)',
    /Solo el dueño/i.test(texto(noCambia)),
    `dice=${texto(noCambia).slice(0, 80)}`
  );
  memory.setSetting('cfg:admins', null);

  // Consultas rápidas de deberes/exámenes/próximo.
  const listaDeberes = await dice('!claw deberes', 'Ana');
  check(
    '"!claw deberes" lista lo apuntado',
    /📚/.test(texto(listaDeberes)),
    `dice=${texto(listaDeberes).slice(0, 80)}`
  );
  const proximo = await dice('!claw proximo', 'Ana');
  check(
    '"!claw proximo" dice lo que cae antes',
    /⏰|🤔/.test(texto(proximo)),
    `dice=${texto(proximo).slice(0, 80)}`
  );

  // Olvidar un apunte: solo administradores.
  const olvidaIntruso = await dice('!claw olvida historia', 'Bea');
  check(
    'Sin ser admin, "!claw olvida" se rechaza',
    /solo lo puede hacer el dueño/i.test(texto(olvidaIntruso)),
    `dice=${texto(olvidaIntruso).slice(0, 80)}`
  );
  const olvidaDueno = await dice('!claw olvida historia', 'Dueno', { senderJid: duenoJid, fromMe: true });
  check(
    'El dueño puede borrar un apunte equivocado',
    /borrado|Hecho|No tengo/i.test(texto(olvidaDueno)),
    `dice=${texto(olvidaDueno).slice(0, 80)}`
  );

  // Ver de un vistazo TODO lo que hay apuntado (deberes y exámenes).
  memory.saveEntry({ kind: 'deberes', subject: 'biologia', content: 'ejercicios 7 y 8', chatJid: JID });
  memory.saveEntry({ kind: 'examen', subject: 'ingles', content: 'tema 2', fecha: addDays(todayISO(), 5), chatJid: JID });
  const listaApuntes = await dice('!claw apuntes', 'Ana');
  check(
    '"!claw apuntes" muestra deberes y exámenes de un vistazo',
    /Todo lo que tengo apuntado/i.test(texto(listaApuntes)) &&
      /Deberes/i.test(texto(listaApuntes)) &&
      /Exámenes/i.test(texto(listaApuntes)),
    `dice=${texto(listaApuntes).slice(0, 100)}`
  );

  // La fecha se encuentra en el texto, pero el contenido queda limpio.
  const dp = extractDatePhrase('hacer la ficha 3 para el viernes');
  check(
    'extractDatePhrase saca la fecha y la frase exacta',
    dp?.phrase === 'el viernes' && weekdayOf(dp.iso) === 5,
    JSON.stringify(dp)
  );

  // Sin año, la fecha se refiere a la próxima vez que caiga ese día.
  check(
    'Una fecha sin año que aún no ha llegado se queda en este año',
    extractDatePhrase('el 20 de octubre', '2026-10-10')?.iso === '2026-10-20',
    JSON.stringify(extractDatePhrase('el 20 de octubre', '2026-10-10'))
  );
  check(
    'Una fecha sin año que ya pasó se guarda para el año siguiente',
    extractDatePhrase('el 20 de octubre', '2026-10-29')?.iso === '2027-10-20',
    JSON.stringify(extractDatePhrase('el 20 de octubre', '2026-10-29'))
  );

  // Apuntar/editar a mano un deber, con su fecha límite.
  // Por defecto lo puede usar cualquiera del grupo.
  const apuntaCualquiera = await dice('!claw apunta deberes mates hacer la ficha 3 para el 20 de diciembre', 'Bea');
  check(
    'Por defecto cualquiera puede usar "!claw apunta"',
    /(Apuntado|Actualizado)/i.test(texto(apuntaCualquiera)),
    `dice=${texto(apuntaCualquiera).slice(0, 80)}`
  );

  // El dueño puede restringirlo a dueño y admins.
  await dice('!claw ajustes apunta no', 'Dueno', { senderJid: duenoJid, fromMe: true });
  const apuntaIntruso = await dice('!claw apunta deberes mates otra cosa', 'Bea');
  check(
    'Con apunta=no, un no-admin es rechazado',
    /solo lo puede hacer el dueño/i.test(texto(apuntaIntruso)),
    `dice=${texto(apuntaIntruso).slice(0, 80)}`
  );
  await dice('!claw ajustes apunta si', 'Dueno', { senderJid: duenoJid, fromMe: true });

  const apuntaDueno = await dice('!claw apunta deberes mates hacer la ficha 3 para el 20 de diciembre', 'Dueno', {
    senderJid: duenoJid,
    fromMe: true
  });
  check(
    'El dueño apunta un deber con su fecha',
    /(Apuntado|Actualizado)/i.test(texto(apuntaDueno)) &&
      /Matem/i.test(texto(apuntaDueno)) &&
      /ficha 3/i.test(texto(apuntaDueno)),
    `dice=${texto(apuntaDueno).slice(0, 120)}`
  );

  // Al consultarlos, aparece el contenido (sin la asignatura repetida) y el plazo.
  const deberesMates = await dice('!claw deberes mates', 'Ana');
  check(
    '"!claw deberes mates" lo muestra limpio y con su fecha de entrega',
    /ficha 3/i.test(texto(deberesMates)) &&
      /diciembre/i.test(texto(deberesMates)) &&
      !/mates hacer/i.test(texto(deberesMates)),
    `dice=${texto(deberesMates).slice(0, 120)}`
  );

  // Cambiar solo la fecha (sin repetir el contenido) lo conserva.
  await dice('!claw apunta deberes mates para el 25 de diciembre', 'Dueno', { senderJid: duenoJid, fromMe: true });
  const deberesMates2 = await dice('!claw deberes mates', 'Ana');
  check(
    'Cambiar solo la fecha conserva el contenido',
    /ficha 3/i.test(texto(deberesMates2)) && /25 de diciembre/i.test(texto(deberesMates2)),
    `dice=${texto(deberesMates2).slice(0, 120)}`
  );

  // Un deber sin fecha lo dice claramente.
  memory.saveEntry({ kind: 'deberes', subject: 'filosofia', content: 'leer el tema 1', chatJid: JID });
  const deberesSinFecha = await dice('!claw deberes filosofia', 'Ana');
  check(
    'Un deber sin fecha lo indica ("sin fecha")',
    /sin fecha/i.test(texto(deberesSinFecha)),
    `dice=${texto(deberesSinFecha).slice(0, 120)}`
  );

  // También sirve para exámenes.
  const apuntaExamen = await dice('!claw apunta examen historia tema 4 para el 21 de octubre', 'Dueno', {
    senderJid: duenoJid,
    fromMe: true
  });
  check(
    'El dueño apunta un examen a mano con su fecha',
    /(Apuntado|Actualizado)/i.test(texto(apuntaExamen)) &&
      /Historia/i.test(texto(apuntaExamen)) &&
      /tema 4/i.test(texto(apuntaExamen)),
    `dice=${texto(apuntaExamen).slice(0, 120)}`
  );

  // Sin datos, pide instrucciones.
  const apuntaVacio = await dice('!claw apunta deberes', 'Dueno', { senderJid: duenoJid, fromMe: true });
  check(
    '"!claw apunta" sin datos pide instrucciones',
    /Dime qué apunto/i.test(texto(apuntaVacio)),
    `dice=${texto(apuntaVacio).slice(0, 100)}`
  );

  // ¡Sin fecha y con "castellano"! Antes fallaba: "castellano" no estaba en la
  // lista de asignaturas (solo "lengua"), el parser devolvía asignatura=null y
  // el bot se limitaba a enseñar los ejemplos sin apuntar nada. Ni la
  // asignatura ni la fecha son obligatorias: basta con entender qué se apunta.
  const apuntaCastellano = await dice('!claw apunta deberes castellano pagina 37 ejercicios 3-5-6', 'Ana');
  check(
    'Apunta un deber con "castellano" (sin fecha) en vez de dar la ayuda',
    !/Dime qué apunto/i.test(texto(apuntaCastellano)) &&
      /(Apuntado|Actualizado)/i.test(texto(apuntaCastellano)) &&
      /Lengua/i.test(texto(apuntaCastellano)),
    `dice=${texto(apuntaCastellano).slice(0, 120)}`
  );
  check(
    'El apunte de castellano guarda el contenido tal cual',
    /pagina 37/i.test(texto(apuntaCastellano)) && /3-5-6/.test(texto(apuntaCastellano)),
    `dice=${texto(apuntaCastellano).slice(0, 160)}`
  );

  // "!claw <lo que sea>" es una pregunta para Claw (con la IA caída avisará).
  const pregunta = await dice('!claw cuanto son 2+2', 'Ana');
  check(
    '"!claw <pregunta>" entra en modo Claw',
    pregunta.action === 'claw' || pregunta.action === 'claw-limitado',
    `action=${pregunta.action}`
  );

  // ---- 17. Mensajes privados y chat propio -------------------------
  console.log('\n\x1b[1m--- Privados: hablarle a Claw y panel del dueño ---\x1b[0m');

  // Partimos del valor por defecto ("privado = dueno"), sin depender de lo que
  // tenga configurado el .env de verdad (aquí puede estar en "todos").
  memory.setSetting('cfg:privado', null);
  config.privateMode = 'dueno';

  // Por defecto ("privado = dueno") solo el dueño puede escribirle por privado.
  const privadoAjeno = await handleMessage({
    chatJid: 'ana@s.whatsapp.net',
    isGroup: false,
    text: 'hola, quien eres?',
    senderName: 'Ana',
    senderJid: 'ana@s.whatsapp.net',
    msgId: `p-${Math.random().toString(36).slice(2)}`,
    mentionedBot: false,
    fromMe: false,
    esPrivado: true,
    esChatPropio: false
  });
  check(
    'Por privado, un desconocido es ignorado (solo el dueño, por defecto)',
    privadoAjeno.action === 'silencio' && !privadoAjeno.replies.length,
    `action=${privadoAjeno.action}`
  );

  // El dueño puede abrir los privados a cualquiera.
  const abrePrivados = await dice('!claw ajustes privado todos', 'Dueno', { senderJid: duenoJid });
  check(
    'Con "privado todos", el ajuste queda en "cualquiera"',
    /privado/i.test(texto(abrePrivados)) && /cualquiera/i.test(texto(abrePrivados)),
    `dice=${texto(abrePrivados).slice(0, 80)}`
  );

  const privadoTodos = await handleMessage({
    chatJid: 'ana@s.whatsapp.net',
    isGroup: false,
    text: 'hola, quien eres?',
    senderName: 'Ana',
    senderJid: 'ana@s.whatsapp.net',
    msgId: `p-${Math.random().toString(36).slice(2)}`,
    mentionedBot: false,
    fromMe: false,
    esPrivado: true,
    esChatPropio: false
  });
  check(
    'Con "privado todos", un privado cualquiera llega a Claw',
    privadoTodos.action === 'claw' || privadoTodos.action === 'claw-limitado',
    `action=${privadoTodos.action}`
  );

  const privadoMalo = await dice('!claw ajustes privado pepito', 'Dueno', { senderJid: duenoJid });
  check(
    'Un valor raro de "privado" se rechaza',
    /solo puede ser/i.test(texto(privadoMalo)),
    `dice=${texto(privadoMalo).slice(0, 80)}`
  );

  const vuelvePrivados = await dice('!claw ajustes privado dueno', 'Dueno', { senderJid: duenoJid });
  check(
    '"privado dueno" vuelve a dejar fuera a los desconocidos',
    /solo el dueño/i.test(texto(vuelvePrivados)),
    `dice=${texto(vuelvePrivados).slice(0, 80)}`
  );

  const privadoAjeno2 = await handleMessage({
    chatJid: 'ana@s.whatsapp.net',
    isGroup: false,
    text: 'sigo aqui?',
    senderName: 'Ana',
    senderJid: 'ana@s.whatsapp.net',
    msgId: `p-${Math.random().toString(36).slice(2)}`,
    mentionedBot: false,
    fromMe: false,
    esPrivado: true,
    esChatPropio: false
  });
  check(
    'Tras volver a "dueno", el desconocido vuelve a ser ignorado',
    privadoAjeno2.action === 'silencio' && !privadoAjeno2.replies.length,
    `action=${privadoAjeno2.action}`
  );

  const chatPropioNota = await handleMessage({
    chatJid: duenoJid,
    isGroup: false,
    text: 'apuntar: comprar leche',
    senderName: 'Dueno',
    senderJid: duenoJid,
    msgId: `s-${Math.random().toString(36).slice(2)}`,
    mentionedBot: false,
    fromMe: true,
    esPrivado: true,
    esChatPropio: true
  });
  check(
    'En el chat propio, una nota suelta no despierta al bot',
    chatPropioNota.action === 'silencio' && !chatPropioNota.replies.length,
    `action=${chatPropioNota.action}`
  );

  const chatPropioClaw = await handleMessage({
    chatJid: duenoJid,
    isGroup: false,
    text: 'claw cuanto son 2+2',
    senderName: 'Dueno',
    senderJid: duenoJid,
    msgId: `s-${Math.random().toString(36).slice(2)}`,
    mentionedBot: false,
    fromMe: true,
    esPrivado: true,
    esChatPropio: true
  });
  check(
    'En el chat propio, "claw ..." sí contesta',
    chatPropioClaw.action === 'claw' || chatPropioClaw.action === 'claw-limitado',
    `action=${chatPropioClaw.action}`
  );

  // Lo que se escribe por privado (DM o chat propio) se apunta en el GRUPO.
  // Abrimos los privados para que el DM de alguien que no es el dueño también llegue.
  await dice('!claw ajustes privado todos', 'Dueno', { senderJid: duenoJid });
  const dmApunta = await handleMessage({
    chatJid: 'bea@s.whatsapp.net',
    isGroup: false,
    text: '!claw apunta deberes mates hacer la ficha 7 para el 20 de diciembre',
    senderName: 'Bea',
    senderJid: 'bea@s.whatsapp.net',
    msgId: `p-${Math.random().toString(36).slice(2)}`,
    mentionedBot: false,
    fromMe: false,
    esPrivado: true,
    esChatPropio: false
  });
  const matesGrupo = memory.findPending({ kind: 'deberes', subjectKey: 'matematicas', chatJid: JID });
  const matesPrivado = memory.findPending({ kind: 'deberes', subjectKey: 'matematicas', chatJid: 'bea@s.whatsapp.net' });
  check(
    'Un "!claw apunta" por privado apunta el deber en el GRUPO (no en el privado)',
    /ficha 7/i.test(texto(dmApunta)) &&
      matesGrupo.some((e) => /ficha 7/i.test(e.content)) &&
      matesPrivado.length === 0,
    `reply=${texto(dmApunta).slice(0, 50)} enGrupo=${matesGrupo.length} enPrivado=${matesPrivado.length}`
  );

  const dmDeberes = await handleMessage({
    chatJid: 'bea@s.whatsapp.net',
    isGroup: false,
    text: '!claw deberes mates',
    senderName: 'Bea',
    senderJid: 'bea@s.whatsapp.net',
    msgId: `p-${Math.random().toString(36).slice(2)}`,
    mentionedBot: false,
    fromMe: false,
    esPrivado: true,
    esChatPropio: false
  });
  check(
    'Por privado, "!claw deberes" enseña lo apuntado en el grupo',
    /ficha 7/i.test(texto(dmDeberes)),
    `reply=${texto(dmDeberes).slice(0, 80)}`
  );

  const dmDato = await handleMessage({
    chatJid: 'bea@s.whatsapp.net',
    isGroup: false,
    text: 'hay que hacer los ejercicios 8 y 9 de historia para el jueves',
    senderName: 'Bea',
    senderJid: 'bea@s.whatsapp.net',
    msgId: `p-${Math.random().toString(36).slice(2)}`,
    mentionedBot: false,
    fromMe: false,
    esPrivado: true,
    esChatPropio: false
  });
  const histGrupo = memory.findPending({ kind: 'deberes', subjectKey: 'historia', chatJid: JID });
  const histPrivado = memory.findPending({ kind: 'deberes', subjectKey: 'historia', chatJid: 'bea@s.whatsapp.net' });
  check(
    'Un deber contado por privado se apunta en el grupo (y no en el privado)',
    histGrupo.some((e) => /8 y 9/i.test(e.content)) && histPrivado.length === 0,
    `enGrupo=${histGrupo.length} enPrivado=${histPrivado.length} action=${dmDato.action}`
  );
  // Volvemos a dejar los privados solo para el dueño.
  await dice('!claw ajustes privado dueno', 'Dueno', { senderJid: duenoJid });

  const propioDato = await handleMessage({
    chatJid: duenoJid,
    isGroup: false,
    text: 'hay que hacer los ejercicios 11 y 12 de ingles para el martes',
    senderName: 'Dueno',
    senderJid: duenoJid,
    msgId: `s-${Math.random().toString(36).slice(2)}`,
    mentionedBot: false,
    fromMe: true,
    esPrivado: true,
    esChatPropio: true
  });
  const ingGrupo = memory.findPending({ kind: 'deberes', subjectKey: 'ingles', chatJid: JID });
  const ingPrivado = memory.findPending({ kind: 'deberes', subjectKey: 'ingles', chatJid: duenoJid });
  check(
    'Un deber escrito en el chat propio se apunta en el grupo',
    ingGrupo.some((e) => /11 y 12/i.test(e.content)) && ingPrivado.length === 0,
    `enGrupo=${ingGrupo.length} enPrivado=${ingPrivado.length} action=${propioDato.action}`
  );

  const dmFuera = await handleMessage({
    chatJid: duenoJid,
    isGroup: false,
    text: '!claw fuera',
    senderName: 'Dueno',
    senderJid: duenoJid,
    msgId: `s-${Math.random().toString(36).slice(2)}`,
    mentionedBot: false,
    fromMe: true,
    esPrivado: true,
    esChatPropio: true
  });
  check(
    'Por privado, "!claw fuera" no desvincula el grupo',
    boundGroupJid() === JID && /dentro del grupo/i.test(texto(dmFuera)),
    `grupo=${boundGroupJid()} reply=${texto(dmFuera).slice(0, 60)}`
  );

  const mencion = await dice('oye, tu sabes algo?', 'Ana', { mentionedBot: true });
  check(
    'Si le mencionan, contesta aunque no le llamen por su nombre',
    mencion.action === 'mencion' || /Me llamabas/i.test(texto(mencion)),
    `action=${mencion.action} dice=${texto(mencion).slice(0, 60)}`
  );

  // ---- 17-bis. Vetados: prohibir usar a Claw -----------------------
  console.log('\n\x1b[1m--- Vetados: prohibir usar a Claw ---\x1b[0m');

  const vetar = await dice('!claw prohibir +600555444', 'Dueno', { senderJid: duenoJid });
  check(
    'El dueño veta a alguien',
    admins.esVetado('600555444@s.whatsapp.net') && /600555444/.test(texto(vetar)),
    `dice=${texto(vetar).slice(0, 80)}`
  );

  const vetadoClaw = await dice('Claw, cuánto es 2+2?', 'Caco', { senderJid: '600555444@s.whatsapp.net' });
  check(
    'Un vetado no consigue respuesta de Claw',
    vetadoClaw.action === 'vetado' && !texto(vetadoClaw).trim(),
    `action=${vetadoClaw.action}`
  );

  const vetadoComando = await dice('!claw apuntes', 'Caco', { senderJid: '600555444@s.whatsapp.net' });
  check(
    'Un vetado no puede usar comandos "!claw"',
    vetadoComando.action === 'vetado' && !texto(vetadoComando).trim(),
    `action=${vetadoComando.action}`
  );

  const vetadoMencion = await dice('hola', 'Caco', { senderJid: '600555444@s.whatsapp.net', mentionedBot: true });
  check(
    'A un vetado tampoco le contesta aunque le mencionen',
    vetadoMencion.action === 'vetado',
    `action=${vetadoMencion.action}`
  );

  // WhatsApp puede identificar a la misma persona con su número o con su @lid.
  // Si el mensaje llega solo con el @lid, el veto por número también debe valer.
  recordarAlias('998877665544@lid', '600555444@s.whatsapp.net');
  const vetadoLid = await dice('!claw apuntes', 'Caco', { senderJid: '998877665544@lid' });
  check(
    'Un vetado por número sigue vetado cuando llega solo con @lid',
    vetadoLid.action === 'vetado' && !texto(vetadoLid).trim(),
    `action=${vetadoLid.action}`
  );

  const sinPermisoVetar = await dice('!claw prohibir +600777888', 'Ana');
  check(
    'Sin ser admin, no se puede vetar a nadie',
    /solo lo puede hacer el dueño/i.test(texto(sinPermisoVetar)),
    `dice=${texto(sinPermisoVetar).slice(0, 80)}`
  );

  const vetarDueno = await dice(`!claw prohibir ${duenoJid.split('@')[0]}`, 'Dueno', { senderJid: duenoJid });
  check(
    'No se puede vetar al dueño',
    /No puedo vetar/i.test(texto(vetarDueno)) && !admins.esVetado(duenoJid),
    `dice=${texto(vetarDueno).slice(0, 80)}`
  );

  const listaVetados = await dice('!claw vetados', 'Dueno', { senderJid: duenoJid });
  check(
    'La lista de vetados se puede ver',
    /600555444/.test(texto(listaVetados)),
    `dice=${texto(listaVetados).slice(0, 80)}`
  );

  const perdonar = await dice('!claw permitir +600555444', 'Dueno', { senderJid: duenoJid });
  check(
    'El dueño perdona a un vetado',
    !admins.esVetado('600555444@s.whatsapp.net') && /Ya puede usar a Claw|No ha cambiado/i.test(texto(perdonar)),
    `dice=${texto(perdonar).slice(0, 80)}`
  );

  const vetadoLibre = await dice('Claw, cuánto es 2+2?', 'Caco', { senderJid: '600555444@s.whatsapp.net' });
  check(
    'Tras perdonarlo, Claw le vuelve a contestar',
    vetadoLibre.action === 'claw' || vetadoLibre.action === 'claw-limitado',
    `action=${vetadoLibre.action}`
  );

  const libreLid = await dice('!claw apuntes', 'Caco', { senderJid: '998877665544@lid' });
  check(
    'Perdonar por número también le perdona cuando llega con @lid',
    libreLid.action !== 'vetado',
    `action=${libreLid.action}`
  );

  // Y al revés: vetar por @lid bloquea también los mensajes con el número.
  await dice('!claw prohibir 998877665544@lid', 'Dueno', { senderJid: duenoJid });
  const vetadoPorLid = await dice('!claw apuntes', 'Caco', { senderJid: '600555444@s.whatsapp.net' });
  check(
    'Vetar por @lid bloquea también el número',
    vetadoPorLid.action === 'vetado',
    `action=${vetadoPorLid.action}`
  );

  // Perdonar por número quita el veto guardado como @lid.
  const perdonaAlias = await dice('!claw permitir +600555444', 'Dueno', { senderJid: duenoJid });
  check(
    'Perdonar por número quita un veto guardado como @lid',
    /Ya puede usar a Claw/i.test(texto(perdonaAlias)) && !admins.esVetado('998877665544@lid'),
    `dice=${texto(perdonaAlias).slice(0, 80)}`
  );

  // El número se puede escribir con o sin el prefijo del país.
  await dice('!claw prohibir 600777888', 'Dueno', { senderJid: duenoJid });
  const vetadoSinPrefijo = await dice('!claw apuntes', 'Caco', { senderJid: '34600777888@s.whatsapp.net' });
  check(
    'Vetar sin prefijo del país también bloquea el número completo',
    vetadoSinPrefijo.action === 'vetado',
    `action=${vetadoSinPrefijo.action}`
  );
  await dice('!claw permitir +34600777888', 'Dueno', { senderJid: duenoJid });

  memory.setSetting('cfg:vetados', null);

  // ---- 17-ter. Contador de palabrotas ------------------------------
  console.log('\n\x1b[1m--- Contador de palabrotas ---\x1b[0m');

  const t1 = contarPalabrotas('que puta mierda, joder!');
  check(
    'Detecta palabrotas como palabras completas (sin falsos positivos)',
    t1.total === 3 &&
      contarPalabrotas('la computadora es conocida').total === 0 &&
      contarPalabrotas('un cono de helado').total === 0 &&
      contarPalabrotas('vaya coño').total === 1,
    `t1=${t1.total} computadora=${contarPalabrotas('la computadora es conocida').total} cono=${contarPalabrotas('un cono de helado').total}`
  );

  // Sin espera entre avisos, para probar el ranking automático sin líos de tiempo.
  await dice('!claw ajustes palabrotas_espera 0', 'Dueno', { senderJid: duenoJid });

  const antesPal = memory.swearTotal(JID);
  const sw1 = await say('esto es una puta mierda', 'Marcos');
  const sw2 = await say('joder, vaya lio', 'Lucia');
  check(
    'Al decir una palabrota saca el ranking solo',
    /Eso ha sido una palabrota/i.test(sw1.reply) && /Marcos/.test(sw1.reply),
    `reply=${sw1.reply.slice(0, 110)}`
  );
  check(
    'Cuenta las palabrotas y el ranking se va actualizando',
    memory.swearTotal(JID) >= antesPal + 3 && /Lucia/.test(sw2.reply) && /Marcos/.test(sw2.reply),
    `antes=${antesPal} despues=${memory.swearTotal(JID)} reply=${sw2.reply.slice(0, 90)}`
  );

  const rankingPal = await dice('!claw palabrotas', 'Ana');
  check(
    'El ranking manual muestra a quien dice las palabrotas',
    /palabrotas/i.test(texto(rankingPal)) && /Marcos/.test(texto(rankingPal)),
    `dice=${texto(rankingPal).slice(0, 120)}`
  );

  // Con una espera larga, no vuelve a sacar el ranking tan pronto (no spamea).
  await dice('!claw ajustes palabrotas_espera 120', 'Dueno', { senderJid: duenoJid });
  const sw3 = await say('menuda mierda de dia', 'Pablo');
  check(
    'No spamea: con espera, no saca el ranking otra vez',
    !/palabrota/i.test(sw3.reply),
    `reply=${sw3.reply.slice(0, 80)}`
  );
  await dice('!claw ajustes palabrotas_espera 0', 'Dueno', { senderJid: duenoJid });

  const noResetPal = await dice('!claw palabrotas reset', 'Ana');
  check(
    'Sin ser admin no se puede poner a cero el contador',
    /solo lo puede hacer el dueño/i.test(texto(noResetPal)),
    `dice=${texto(noResetPal).slice(0, 80)}`
  );

  const resetPal = await dice('!claw palabrotas reset', 'Dueno', { senderJid: duenoJid });
  check(
    'El dueño pone el contador a cero',
    /a cero/i.test(texto(resetPal)) && memory.swearTotal(JID) === 0,
    `dice=${texto(resetPal).slice(0, 60)} total=${memory.swearTotal(JID)}`
  );

  await dice('!claw ajustes palabrotas no', 'Dueno', { senderJid: duenoJid });
  const swOff = await say('otra puta vez', 'Marcos');
  check(
    'Con el contador apagado no cuenta ni saca ranking',
    memory.swearTotal(JID) === 0 && !/palabrota/i.test(swOff.reply),
    `total=${memory.swearTotal(JID)} reply=${swOff.reply.slice(0, 60)}`
  );
  await dice('!claw ajustes palabrotas si', 'Dueno', { senderJid: duenoJid });

  // ---- 17-cuatro. Generación de imágenes (experimental) ---------------
  console.log('\n\x1b[1m--- Generación de imágenes (experimental) ---\x1b[0m');

  check(
    'Solo pide imagen por el comando, nunca por cualquier palabra',
    esPedidoDeImagen('imagen') &&
      esPedidoDeImagen('dibuja') &&
      !esPedidoDeImagen('busca') &&
      !esPedidoDeImagen('claw'),
    ''
  );

  const parseOpenAi = parsearImagen({ data: [{ b64_json: TINY_PNG.toString('base64') }] });
  const parseOllama = parsearImagen({ images: [TINY_PNG.toString('base64')] });
  check(
    'Entiende las respuestas de los endpoints (OpenAI y Ollama)',
    Boolean(parseOpenAi?.buffer?.equals(TINY_PNG)) &&
      Boolean(parseOllama?.buffer?.equals(TINY_PNG)) &&
      sniffMime(TINY_PNG) === 'image/png',
    `openai=${parseOpenAi?.buffer?.length} ollama=${parseOllama?.buffer?.length} mime=${sniffMime(TINY_PNG)}`
  );

  // De fábrica apagada: no genera nada, ni siquiera cuando lo piden con el comando.
  const prevImagen = {
    enabled: config.imageGenEnabled,
    backend: config.imageGenBackend,
    bin: config.imageGenBin,
    modelPath: config.imageGenModelPath,
    endpoint: config.imageGenEndpoint,
    timeout: config.imageGenTimeout,
    steps: config.imageGenSteps,
    negative: config.imageGenNegative
  };

  // En una gráfica pequeña (4 GB) hay que soltar el modelo de texto antes de
  // dibujar, o al motor de imágenes le falta memoria y falla. Esta es la causa
  // real de los fallos "unet segment failed during workspace capacity check".
  check(
    'Antes de dibujar se suelta el modelo de texto (para que quepa en la VRAM)',
    typeof liberarVram === 'function' && config.imageGenFreeVram === true,
    `freeVram=${config.imageGenFreeVram}`
  );

  // Los argumentos del motor local (sd-cli) se montan a mano, sin usar la shell.
  const args = argsCli({
    prompt: 'un gato',
    out: 'C:\\tmp\\x.png',
    steps: 8,
    width: 512,
    height: 512,
    negative: 'borroso',
    seed: 7
  });
  check(
    'Monta bien los argumentos de sd-cli (sin shell)',
    args[args.indexOf('-p') + 1] === 'un gato' &&
      args[args.indexOf('--steps') + 1] === '8' &&
      args[args.indexOf('-W') + 1] === '512' &&
      args[args.indexOf('-H') + 1] === '512' &&
      args[args.indexOf('-n') + 1] === 'borroso' &&
      args[args.indexOf('-s') + 1] === '7',
    args.join(' ')
  );

  config.imageGenEnabled = false;
  const apagada = await dice('!claw imagen un pingüino con gafas', 'Ana');
  check(
    'Apagada de fábrica: no genera ninguna imagen',
    /apagada/i.test(texto(apagada)) && !apagada.media?.length,
    `media=${apagada.media?.length || 0} dice=${texto(apagada).slice(0, 70)}`
  );

  // Encendida pero con el motor local apuntando a un ejecutable que no existe.
  config.imageGenEnabled = true;
  config.imageGenBackend = 'cli';
  config.imageGenBin = 'sdserver\\NO-EXISTE-sd-cli.exe';
  const sinMotor = await dice('!claw imagen un pingüino', 'Ana');
  check(
    'Con el motor local mal puesto, avisa en claro en vez de romperse',
    !sinMotor.media?.length && /No he podido generar la imagen/i.test(texto(sinMotor)),
    `media=${sinMotor.media?.length || 0} dice=${texto(sinMotor).slice(0, 90)}`
  );

  // Encendida, motor http, y sin nadie escuchando: explica el fallo.
  config.imageGenBackend = 'http';
  config.imageGenEndpoint = 'http://127.0.0.1:1/v1/images/generations';
  config.imageGenTimeout = 5;
  const sinServidor = await dice('!claw imagen un pingüino', 'Ana');
  check(
    'Si el servidor no está vivo, da un error claro en vez de romperse',
    !sinServidor.media?.length && /No he podido generar la imagen/i.test(texto(sinServidor)),
    `media=${sinServidor.media?.length || 0} dice=${texto(sinServidor).slice(0, 90)}`
  );

  // Encendida, motor http y con un servidor local de mentira: genera y adjunta.
  const srv = await servidorImagen({ data: [{ b64_json: TINY_PNG.toString('base64') }] });
  config.imageGenEndpoint = srv.url;
  const generada = await dice('!claw imagen un pingüino con gafas de sol', 'Ana');
  const enviada = generada.media?.[0];
  check(
    'Genera y adjunta la imagen cuando está encendida',
    Boolean(enviada) && enviada.kind === 'image' && fs.existsSync(enviada.filePath),
    `media=${JSON.stringify(generada.media || [])} dice=${texto(generada).slice(0, 60)}`
  );
  if (enviada?.filePath) {
    try {
      fs.rmSync(enviada.filePath, { force: true });
    } catch {
      /* nada: la limpiaría el cleanup igualmente */
    }
  }
  await srv.close();

  // --- No se puede dibujar dos veces a la vez -------------------------
  // La tarjeta gráfica tiene 4 GB: dos generaciones a la vez se quedan sin
  // memoria y fallan las dos. Esto comprueba que van de una en una.
  const srvLento = await servidorImagen({ data: [{ b64_json: TINY_PNG.toString('base64') }] }, { retardo: 250 });
  config.imageGenBackend = 'http';
  config.imageGenEndpoint = srvLento.url;
  config.imageGenTimeout = 30;
  const tres = await Promise.all([
    generarImagen('uno', { forzar: true }),
    generarImagen('dos', { forzar: true }),
    generarImagen('tres', { forzar: true })
  ]);
  const salieron = tres.filter((r) => r.ok).length;
  const ocupados = tres.filter((r) => !r.ok && r.busy === true).length;
  check(
    'No dibuja dos imágenes a la vez (si no, se quedan sin memoria)',
    srvLento.estado.maxALaVez === 1 && salieron === 2 && ocupados === 1,
    `a la vez=${srvLento.estado.maxALaVez} ok=${salieron} avisados=${ocupados}`
  );

  // Y por el camino "de verdad" (el mensaje del grupo), el que llega tarde recibe
  // un aviso claro de "estoy ocupado", no un mensaje de error que asuste.
  const [rUno, rDos, rTres] = await Promise.all([
    dice('!claw imagen un perro', 'Ana'),
    dice('!claw imagen un gato', 'Bea'),
    dice('!claw imagen un ratón', 'Cris')
  ]);
  const respuestas = [rUno, rDos, rTres];
  const textos = respuestas.map((r) => texto(r));
  const algunoOcupado = textos.some((t) => /Dame un momento|estoy dibujando otra/i.test(t));
  const dibujadas = respuestas.filter((r) => Boolean(r.media?.length)).length;
  check(
    'Al que llega de más le dice "estoy ocupado" (no un error feo) y los otros dibujan',
    algunoOcupado && dibujadas === 2,
    `ocupado=${algunoOcupado} dibujadas=${dibujadas}`
  );
  for (const r of respuestas) {
    const f = r.media?.[0]?.filePath;
    if (f) {
      try {
        fs.rmSync(f, { force: true });
      } catch {
        /* nada */
      }
    }
  }
  await srvLento.close();

  // --- El aviso de error tiene que decir POR QUÉ falla -----------------
  const pista = pistaDeError(
    [
      'loading model from ...',
      '|====> 8/20 - 2.86s/it',
      '[E] ggml_cuda_compute_forward: failed to allocate 512.00 MB',
      '[E] generate failed --- main.cpp:940'
    ].join('\n'),
    1
  );
  check(
    'Del fallo saca la causa útil, no solo el "generate failed" final',
    /allocate/i.test(pista) && /failed/i.test(pista) && !/^\[E\] generate failed/.test(pista),
    pista
  );

  config.imageGenEnabled = prevImagen.enabled;
  config.imageGenBackend = prevImagen.backend;
  config.imageGenBin = prevImagen.bin;
  config.imageGenModelPath = prevImagen.modelPath;
  config.imageGenEndpoint = prevImagen.endpoint;
  config.imageGenTimeout = prevImagen.timeout;
  config.imageGenSteps = prevImagen.steps;
  config.imageGenNegative = prevImagen.negative;

  // ---- 17-quinto. Novedades del bot (changelog) -----------------------
  console.log('\n\x1b[1m--- Novedades del bot (changelog) ---\x1b[0m');

  const mdPrueba = [
    '## [Sin publicar]',
    '',
    '### Añadido',
    '',
    '- **Cosa nueva.** Hace algo chulo. Y además otra cosa.',
    '- Otra cosa sin título.',
    '',
    '## [1.0.0] — 2020-01-01',
    '',
    '- **Viejo.** Esto no debe salir.'
  ].join('\n');

  const lista = novedades(mdPrueba);
  check(
    'Saca solo las novedades de "Sin publicar" (nada ya publicado)',
    lista.length === 2 && lista[0].titulo === 'Cosa nueva' && /Hace algo chulo/.test(lista[0].frase) &&
      !lista.some((i) => /Viejo/.test(i.titulo || i.frase)),
    JSON.stringify(lista)
  );

  const textoNov = textoNovedades(mdPrueba);
  check(
    'El mensaje de novedades queda presentable',
    /¡Hay novedades en Claw!/.test(textoNov) && /Cosa nueva/.test(textoNov) && !/Viejo/.test(textoNov),
    textoNov.split('\n').slice(0, 3).join(' | ')
  );

  const h1 = hashNovedades(mdPrueba);
  const mdPrueba2 = mdPrueba.replace('\n## [1.0.0]', '\n- **Otra más.** nueva nueva.\n\n## [1.0.0]');
  const h2 = hashNovedades(mdPrueba2);
  check(
    'La huella cambia cuando aparece algo nuevo (para no repetir el aviso)',
    Boolean(h1) && Boolean(h2) && h1 !== h2 && marcadorNovedades(mdPrueba) === `changelog:${h1}`,
    `${h1} vs ${h2}`
  );

  const textoReal = textoNovedades();
  check(
    'Lee el CHANGELOG de verdad y saca lo último añadido',
    /¡Hay novedades en Claw!/.test(textoReal) && (textoReal.match(/•/g) || []).length >= 3,
    `${(textoReal.match(/•/g) || []).length} novedades`
  );

  const cmdNov = await dice('!claw novedades', 'Ana');
  check(
    'El comando "!claw novedades" cuenta lo nuevo',
    /¡Hay novedades en Claw!/.test(texto(cmdNov)),
    texto(cmdNov).slice(0, 80)
  );

  const key = marcadorNovedades();
  memory.setSetting(key, new Date().toISOString());
  check(
    'El aviso de novedades se marca como enviado (no se repite)',
    Boolean(memory.getSetting(key)),
    key
  );
  memory.setSetting(key, null);

  // Sin conexión NO se puede dar nada por enviado (esto evitaba que el aviso se
  // "perdiera": se marcaba como enviado aunque el mensaje no hubiera salido).
  check('Sin conexión, el bot sabe que no está conectado', estaConectado() === false, String(estaConectado()));
  const sinConexion = await sendReplies('120363427797260523@g.us', ['hola']);
  check(
    'Sin conexión, sendReplies avisa de que NO se envió (para poder reintentar)',
    sinConexion === false,
    String(sinConexion)
  );

  let avisoDisparado = false;
  cuandoConecte(() => {
    avisoDisparado = true;
  });
  check(
    'cuandoConecte guarda el aviso para cuando haya conexión (no lo dispara antes)',
    avisoDisparado === false,
    String(avisoDisparado)
  );

  // ---- 18. Recordatorios y resumen ---------------------------------
  console.log('\n\x1b[1m--- Recordatorios de exámenes y resumen semanal ---\x1b[0m');

  // Fabricamos exámenes de mentira: uno mañana y otro hoy.
  const mananaISO = addDays(todayISO(), 1);
  const examenes = [
    { id: 9001, subject: 'Historia', fecha: mananaISO, content: 'tema 4 y 5' },
    { id: 9002, subject: 'Lengua', fecha: todayISO(), content: 'Examen' },
    { id: 9003, subject: 'Mates', fecha: addDays(todayISO(), 5), content: 'Examen' }
  ];
  const enviados = new Set();

  // A las 21:00 toca el aviso de la tarde (víspera) y el de "hoy".
  const noche = new Date(`${todayISO()}T21:00:00`);
  const avisosNoche = avisosPendientes({ exams: examenes, now: noche, yaEnviado: (k) => enviados.has(k) });
  check(
    'La víspera avisa del examen de mañana',
    avisosNoche.some((a) => a.cuando === 'tarde' && /Mañana hay examen/.test(a.texto) && /Historia/.test(a.texto)),
    avisosNoche.map((a) => a.texto.split('\n')[0]).join(' | ')
  );
  check(
    'El mismo día de mañana no avisa (solo la víspera)',
    !avisosNoche.some((a) => a.cuando === 'tarde' && /Lengua/.test(a.texto)),
    avisosNoche.map((a) => a.texto.split('\n')[0]).join(' | ')
  );

  // A las 8:00 toca el aviso de "hoy es el examen".
  const temprano = new Date(`${todayISO()}T08:30:00`);
  const avisosManana = avisosPendientes({ exams: examenes, now: temprano, yaEnviado: (k) => enviados.has(k) });
  check(
    'La mañana del examen avisa de que es hoy',
    avisosManana.some((a) => a.cuando === 'manana' && /HOY es el examen/.test(a.texto) && /Lengua/.test(a.texto)),
    avisosManana.map((a) => a.texto.split('\n')[0]).join(' | ')
  );

  // Aviso con antelación (3 días por defecto) para poder repasar.
  const guardAdvance = config.reminderAdvanceDays;
  config.reminderAdvanceDays = 3;
  const avisoPrevio = avisosPendientes({
    exams: [{ id: 9005, kind: 'examen', subject: 'Biología', fecha: addDays(todayISO(), 3), content: 'temas 1 a 3' }],
    now: noche,
    yaEnviado: () => false
  });
  check(
    'Avisa del examen con 3 días de antelación',
    avisoPrevio.some((a) => a.cuando === 'previo' && /En 3 días hay examen/.test(a.texto) && /Biología/.test(a.texto)),
    avisoPrevio.map((a) => a.texto.split('\n')[0]).join(' | ')
  );
  config.reminderAdvanceDays = guardAdvance;

  // Un aviso ya enviado no se repite.
  for (const a of avisosNoche) enviados.add(a.clave);
  const repetido = avisosPendientes({ exams: examenes, now: noche, yaEnviado: (k) => enviados.has(k) });
  check('Un recordatorio ya enviado no se repite', repetido.length === 0, `quedan=${repetido.length}`);

  // Los exámenes sin fecha no generan avisos.
  const sinFecha = avisosPendientes({
    exams: [{ id: 9004, subject: 'Física', fecha: null, content: 'Examen' }],
    now: noche
  });
  check('Los exámenes sin fecha no generan avisos', sinFecha.length === 0, `avisos=${sinFecha.length}`);

  // El resumen semanal solo toca el día y la hora configurados.
  const guardDay = config.summaryDay;
  const guardHour = config.summaryHour;
  config.summaryDay = 0; // domingo
  config.summaryHour = 19;
  const domingo = new Date('2026-10-18T19:30:00'); // 18/10/2026 es domingo
  const sabado = new Date('2026-10-17T19:30:00');
  const domingoPronto = new Date('2026-10-18T10:00:00');
  check('El resumen semanal toca el domingo por la tarde', tocaResumenSemanal(domingo, null) === true);
  check('El resumen semanal no toca un sábado', tocaResumenSemanal(sabado, null) === false);
  check('El resumen semanal no toca el domingo por la mañana', tocaResumenSemanal(domingoPronto, null) === false);
  check(
    'El resumen semanal no se repite el mismo día',
    tocaResumenSemanal(domingo, todayISO(domingo)) === false
  );
  config.summaryDay = guardDay;
  config.summaryHour = guardHour;

  // ---- 19. Modo ajedrez --------------------------------------------
  console.log('\n\x1b[1m--- Modo ajedrez: jugar, analizar y hablar como gran maestro ---\x1b[0m');

  // Comprobamos el tablero y el análisis sin depender de la IA.
  const inicial = new Chess().fen();
  check('Saca el FEN de un texto', ajedrez.extraeFen(`mira: ${inicial}`) === inicial, String(ajedrez.extraeFen(`mira: ${inicial}`)));
  check('Sin FEN no hay nada que sacar', ajedrez.extraeFen('hola que tal') === null);

  const tablero = ajedrez.tableroTexto(new Chess());
  check('Dibuja el tablero con las piezas', /[♔♕♖♗♘♙♚♛♜♝♞♟]/.test(tablero) && /a b c d e f g h/.test(tablero), tablero.split('\n')[0]);
  check('Distingue blancas y negras', tablero.includes('♙') && tablero.includes('♟'));

  const mateFen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'; // mate del loco
  check('Detecta el jaque mate en la posición', /jaque mate/i.test(ajedrez.analiza(mateFen)), ajedrez.analiza(mateFen).replace(/\n/g, ' / '));
  check('Sabe terminar la partida', /Jaque mate/i.test(ajedrez.finDePartida(new Chess(mateFen))), ajedrez.finDePartida(new Chess(mateFen)));
  check('Un FEN inválido se trata con cariño', /no me cuadra/i.test(ajedrez.analiza('esto no es un fen')), ajedrez.analiza('esto no es un fen'));

  const analisis = ajedrez.analiza(inicial);
  check('El análisis habla de material y movilidad', /Material/i.test(analisis) && /Movilidad/i.test(analisis), analisis.replace(/\n/g, ' / '));
  check('Cuenta la movilidad de los dos bandos', /20 jugadas blancas, 20 negras/.test(analisis), analisis.replace(/\n/g, ' / '));
  check('Con el tablero lleno, la posición está equilibrada', /equilibrada|igualdad/i.test(analisis), analisis.replace(/\n/g, ' / '));

  // El motor propio: antes la IA de 3B jugaba casi al azar (movía el caballo de
  // h6 a g4 y vuelta) y era imposible jugar. Ahora las jugadas las elige un
  // minimax con poda alfa-beta, así que tiene que ver lo evidente.
  const mateEnUno = eligeJugadaMotor(new Chess('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'), { tiempoMaxMs: 800 });
  check('El motor ve un mate en 1', mateEnUno?.san === 'Ra8#', String(mateEnUno?.san));

  const damaColgando = eligeJugadaMotor(new Chess('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1'), { tiempoMaxMs: 800 });
  check('El motor se come una dama que está colgando', damaColgando?.san === 'exd5', String(damaColgando?.san));

  const salida = eligeJugadaMotor(new Chess(), { tiempoMaxMs: 800 });
  check(
    'El motor abre con una jugada sensata (no bailotea con el caballo)',
    ['e4', 'd4', 'Nf3', 'c4', 'e3', 'd3', 'g3', 'Nc3'].includes(salida?.san),
    String(salida?.san)
  );

  // A partir de aquí, sin Ollama (puerto muerto): la jugada de Claw la decide el
  // motor propio, que no depende de la IA.
  const ajRealUrl = config.ollamaUrl;
  config.ollamaUrl = 'http://127.0.0.1:59999';
  try {
    resetTransientState();
    r = await say('!claw ajedrez');
    check('"!claw ajedrez" empieza una partida', /Nueva partida/i.test(r.reply) && /a b c d e f g h/.test(r.reply), r.reply.split('\n')[0]);
    check('La partida queda registrada', Boolean(ajedrez.partida(JID)), 'sin partida');

    r = await say('!claw ajedrez e4');
    const estado = ajedrez.partida(JID);
    check('Acepta una jugada legal', estado?.game.history().includes('e4'), `historial=${estado?.game.history().join(' ')}`);
    check('Claw contesta con su jugada', /Claw juega/i.test(r.reply), r.reply.split('\n')[0]);
    check('Claw mueve algo legal', estado?.game.history().length >= 2, `historial=${estado?.game.history().join(' ')}`);

    r = await say('!claw ajedrez Nf6');
    check(
      'Rechaza una jugada ilegal',
      /no es legal|no he podido/i.test(r.reply),
      r.reply.split('\n')[0]
    );

    r = await say('!claw ajedrez rendirse');
    check('Se puede abandonar la partida', /terminada/i.test(r.reply), r.reply.split('\n')[0]);
    check('Tras abandonar no queda partida', !ajedrez.partida(JID), 'sigue habiendo partida');
    ajedrez.borraPartida(JID);

    r = await say('!claw analiza ' + inicial);
    check('"!claw analiza <FEN>" analiza la posición', /Posición analizada/i.test(r.reply), r.reply.split('\n')[0]);

    r = await say('Claw, analiza esta posición: ' + mateFen);
    check('Si le pasan un FEN, contesta con el análisis', /jaque mate/i.test(r.reply), r.reply.replace(/\n/g, ' / ').slice(0, 120));
  } finally {
    config.ollamaUrl = ajRealUrl;
  }

  // Con el modo ajedrez desactivado, no se juega.
  const ajGuard = config.chessEnabled;
  config.chessEnabled = false;
  r = await say('!claw ajedrez');
  check('Con el ajedrez desactivado, lo dice', /desactivado/i.test(r.reply), r.reply.split('\n')[0]);
  config.chessEnabled = ajGuard;

  // ---- 20. Modo mantenimiento --------------------------------------
  console.log('\n\x1b[1m--- Modo mantenimiento: el bot se queda callado ---\x1b[0m');

  // Un chaval cualquiera no puede activarlo.
  const mantIntruso = await dice('!claw mantenimiento si', 'Bea');
  check(
    'Un no-admin no puede activar el mantenimiento',
    !config.maintenance && /due[ñn]o|administrador/i.test(texto(mantIntruso)),
    `config=${config.maintenance} dice=${texto(mantIntruso).slice(0, 80)}`
  );

  // El dueño lo activa (con el atajo, que es lo mismo que "ajustes mantenimiento").
  const mantOn = await dice('!claw mantenimiento si', 'Dueno', { senderJid: duenoJid, fromMe: true });
  check(
    'El dueño activa el modo mantenimiento',
    config.maintenance === true && ajustes.get('mantenimiento') === true && /activado/i.test(texto(mantOn)),
    `config=${config.maintenance} dice=${texto(mantOn).slice(0, 80)}`
  );

  // Estando en mantenimiento, no contesta a nada.
  const enMant = await dice('Claw hola, ¿qué tal?', 'Ana');
  check(
    'En mantenimiento no contesta a Claw',
    enMant.action === 'mantenimiento' && enMant.replies.length === 0,
    `action=${enMant.action} replies=${enMant.replies.length}`
  );

  // Ni apunta deberes/exámenes que se digan en el grupo.
  const antesEntradas = memory.listEntries().length;
  await dice('mañana hay examen de historia', 'Ana');
  check(
    'En mantenimiento no apunta deberes ni exámenes',
    memory.listEntries().length === antesEntradas,
    `antes=${antesEntradas} ahora=${memory.listEntries().length}`
  );

  // Un no-admin tampoco consigue respuestas a otros comandos.
  const comandoIntruso = await dice('!claw deberes', 'Bea');
  check(
    'En mantenimiento, un no-admin no consigue respuesta ni a comandos',
    comandoIntruso.action === 'mantenimiento' && comandoIntruso.replies.length === 0,
    `action=${comandoIntruso.action} replies=${comandoIntruso.replies.length}`
  );

  // El propio dueño sí puede consultar y quitarlo.
  const mantEstado = await dice('!claw mantenimiento', 'Dueno', { senderJid: duenoJid, fromMe: true });
  check(
    'El dueño ve el estado del mantenimiento',
    /activado/i.test(texto(mantEstado)),
    `dice=${texto(mantEstado).slice(0, 80)}`
  );
  const mantOff = await dice('!claw mantenimiento no', 'Dueno', { senderJid: duenoJid, fromMe: true });
  check(
    'El dueño desactiva el modo mantenimiento',
    config.maintenance === false && /desactivado/i.test(texto(mantOff)),
    `config=${config.maintenance} dice=${texto(mantOff).slice(0, 80)}`
  );

  // Y todo vuelve a la normalidad.
  resetTransientState();
  r = await say('Claw, ¿cuánto es 2+2?');
  check(
    'Tras el mantenimiento, Claw vuelve a contestar',
    r.action === 'claw' || r.action === 'claw-limitado',
    `action=${r.action}`
  );

  // ---- 21. Búsqueda en internet (DuckDuckGo) -----------------------
  console.log('\n\x1b[1m--- Búsqueda en internet: cuándo y cómo ---\x1b[0m');

  // Cuándo conviene buscar.
  check(
    'Detecta que una pregunta pide buscar en internet',
    necesitaBuscar('quién ganó el último partido del Real Madrid') &&
      necesitaBuscar('busca el tiempo que hará mañana') &&
      necesitaBuscar('precio del bitcoin hoy'),
    'debería ser true'
  );
  check(
    'No busca para preguntas de andar por casa',
    !necesitaBuscar('cuánto son 2+2') &&
      !necesitaBuscar('qué deberes hay de matemáticas') &&
      !necesitaBuscar('cómo se dice hola en inglés') &&
      !necesitaBuscar('qué día es hoy') &&
      !necesitaBuscar('cuáles son los resultados de los exámenes'),
    'debería ser false'
  );

  // El parser de resultados (offline, con HTML de ejemplo).
  const htmlDDG = [
    '<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fejemplo.com%2Funo&rut=x">Resultado <b>uno</b></a>',
    '<a class="result__snippet" href="#">Un resumen del <b>primer</b> resultado.</a>',
    '<a rel="nofollow" class="result__a" href="https://ejemplo.com/dos">Resultado dos</a>',
    '<a class="result__snippet" href="#">Segundo resumen.</a>'
  ].join('\n');
  const parsed = parsearResultadosDDG(htmlDDG, 5);
  check(
    'Extrae título, URL real y resumen de DuckDuckGo',
    parsed.length === 2 &&
      parsed[0].title === 'Resultado uno' &&
      parsed[0].url === 'https://ejemplo.com/uno' &&
      /primer/.test(parsed[0].snippet) &&
      parsed[1].url === 'https://ejemplo.com/dos',
    `len=${parsed.length} url0=${parsed[0]?.url}`
  );
  // Cuando la respuesta viene de internet, se nota que es de DuckDuckGo.
  const conFuente = conFuenteWeb('El resultado es 42.');
  check(
    'Una respuesta de internet dice "según DuckDuckGo"',
    /Según DuckDuckGo/i.test(conFuente) && /42/.test(conFuente),
    `texto=${conFuente.slice(0, 60)}`
  );
  check(
    'Si ya lo menciona, no se repite la fuente',
    conFuenteWeb('Según DuckDuckGo, el resultado es 42.') === 'Según DuckDuckGo, el resultado es 42.',
    'no debería duplicar la cabecera'
  );

  const htmlLite = [
    "<a rel=\"nofollow\" href=\"https://ejemplo.org/tres\" class='result-link'>Tercer resultado</a>",
    "<td class='result-snippet'>Tercer resumen.</td>"
  ].join('\n');
  const parsedLite = parsearResultadosDDG(htmlLite, 5);
  check(
    'También entiende el formato "lite" de DuckDuckGo',
    parsedLite.length === 1 && parsedLite[0].url === 'https://ejemplo.org/tres',
    `len=${parsedLite.length} url0=${parsedLite[0]?.url}`
  );

  // Ajuste del propietario.
  check(
    'Existe el ajuste "buscar" y viene activado de fábrica',
    Boolean(ajustes.CATALOGO.buscar) && ajustes.get('buscar') === true,
    `valor=${ajustes.get('buscar')}`
  );

  // Quién puede usar "!claw apunta" (por defecto, cualquiera).
  check(
    'Existe el ajuste "apunta" y viene abierto a todos de fábrica',
    Boolean(ajustes.CATALOGO.apunta) && ajustes.get('apunta') === true,
    `valor=${ajustes.get('apunta')}`
  );

  // Candado de energía: evita que el ordenador se duerma/hiberne con el bot abierto.
  check(
    'Existen los ajustes "despierto" y "pantalla" del candado de energía',
    Boolean(ajustes.CATALOGO.despierto) &&
      Boolean(ajustes.CATALOGO.pantalla) &&
      ajustes.get('despierto') === true &&
      ajustes.get('pantalla') === false,
    `despierto=${ajustes.get('despierto')} pantalla=${ajustes.get('pantalla')}`
  );
  check(
    'El candado de energía no se activa si el ajuste está en "no"',
    typeof power.start === 'function' &&
      typeof power.stop === 'function' &&
      typeof power.sync === 'function' &&
      (() => {
        const guard = config.preventSleep;
        config.preventSleep = false;
        power.sync(); // no debe lanzar ni abrir ningún proceso
        const ok = power.activo() === false;
        config.preventSleep = guard;
        return ok;
      })(),
    `activo=${power.activo()}`
  );

  // El "cerebro" (apuntar deberes/exámenes) puede usar un modelo distinto al de
  // Claw, que es lo que permite tener un 7b listo para charlar y un 3b obediente
  // para extraer datos.
  check(
    'El cerebro puede usar un modelo distinto al de Claw',
    Boolean(ajustes.CATALOGO.modelo_cerebro) &&
      typeof config.ollamaBrainModel === 'string' &&
      config.ollamaBrainModel.length > 0,
    `cerebro=${config.ollamaBrainModel} claw=${config.ollamaModel}`
  );

  // El dueño lo apaga y "!claw busca" avisa de que está desactivado.
  await dice('!claw ajustes buscar no', 'Dueno', { senderJid: duenoJid, fromMe: true });
  const buscaOff = await dice('!claw busca algo', 'Dueno', { senderJid: duenoJid, fromMe: true });
  check(
    'Con la búsqueda apagada, avisa de que está desactivada',
    config.webSearchEnabled === false && /desactivad/i.test(texto(buscaOff)),
    `config=${config.webSearchEnabled} dice=${texto(buscaOff).slice(0, 80)}`
  );
  // Sin decir qué buscar, pide el texto.
  await dice('!claw ajustes buscar si', 'Dueno', { senderJid: duenoJid, fromMe: true });
  const buscaVacio = await dice('!claw busca', 'Dueno', { senderJid: duenoJid, fromMe: true });
  check(
    'Con "!claw busca" sin texto, pide qué buscar',
    config.webSearchEnabled === true && /qu[eé] busco/i.test(texto(buscaVacio)),
    `dice=${texto(buscaVacio).slice(0, 80)}`
  );

  // ---- 22. Firma de Claw: se distingue de los avisos -----------------
  console.log('\n\x1b[1m--- Firma de Claw: se distingue de los avisos ---\x1b[0m');

  const firmaAntes = config.clawSignature;
  config.clawSignature = true;
  check(
    'La firma de Claw es una cabecera reconocible',
    /^🪝 \*Claw\*/.test(replies.firmaClaw('hola')),
    replies.firmaClaw('hola').split('\n')[0]
  );

  resetTransientState();
  r = await say('Claw, cuéntame algo interesante');
  check(
    'Las respuestas de Claw llevan la cabecera 🪝 Claw',
    r.action === 'claw' && /🪝 \*Claw\*/.test(r.reply),
    `action=${r.action} reply=${r.reply.slice(0, 60)}`
  );

  // Un aviso normal de deberes (sin pasar por Claw) NO lleva la cabecera.
  resetTransientState();
  r = await say('alguien sabe que deberes hay de lengua?');
  check(
    'Los avisos normales no llevan la cabecera de Claw',
    !/🪝 \*Claw\*/.test(r.reply),
    r.reply.slice(0, 60)
  );

  // Se puede quitar con el ajuste.
  config.clawSignature = false;
  check(
    'Con la firma apagada, las respuestas de Claw van sin cabecera',
    replies.firmaClaw('hola') === 'hola',
    replies.firmaClaw('hola')
  );
  config.clawSignature = firmaAntes;

  // ---- 22-bis. Marcar como hecho -------------------------------------
  console.log('\n\x1b[1m--- Marcar deberes y exámenes como hechos ---\x1b[0m');

  await dice('!claw apunta deberes filosofia leer el capitulo 2 para el viernes', 'Ana');
  const hechoFilo = await dice('!claw hecho filosofia', 'Ana');
  check(
    '"!claw hecho <asignatura>" marca el deber como hecho',
    /marcad[oa] como hecho/i.test(texto(hechoFilo)),
    `dice=${texto(hechoFilo).slice(0, 90)}`
  );
  const quedanFilo = memory.findPending({ kind: 'deberes', chatJid: JID }).filter((e) => e.subject === 'filosofia');
  check(
    'El deber marcado como hecho ya no aparece pendiente',
    quedanFilo.length === 0,
    `quedan=${quedanFilo.length}`
  );
  const hechoNada = await dice('!claw hecho asignaturaquenoexiste', 'Ana');
  check(
    '"!claw hecho" avisa cuando no encuentra el apunte',
    /No encuentro nada pendiente/i.test(texto(hechoNada)),
    `dice=${texto(hechoNada).slice(0, 90)}`
  );

  // ---- 23. Ver y borrar todo de golpe --------------------------------
  console.log('\n\x1b[1m--- Borrar TODOS los apuntes de golpe ---\x1b[0m');

  memory.saveEntry({ kind: 'deberes', subject: 'lengua', content: 'paginas 1 a 3', chatJid: JID });
  const antesTodo = memory.listEntries(100000, JID).length;

  const intrusoTodo = await dice('!claw olvida todo', 'Bea');
  check(
    'Sin ser admin, "!claw olvida todo" se rechaza',
    /solo lo puede hacer el dueño/i.test(texto(intrusoTodo)),
    `dice=${texto(intrusoTodo).slice(0, 80)}`
  );

  const borraTodo = await dice('!claw olvida todo', 'Dueno', { senderJid: duenoJid, fromMe: true });
  const despuesTodo = memory.listEntries(100000, JID).length;
  check(
    '"!claw olvida todo" vacía los apuntes del grupo',
    antesTodo > 0 && despuesTodo === 0 && /todos|🧹/i.test(texto(borraTodo)),
    `antes=${antesTodo} despues=${despuesTodo} dice=${texto(borraTodo).slice(0, 80)}`
  );

  // ---- Personalidades ----------------------------------------------
  console.log('\n\x1b[1m--- Personalidades: cómo habla Claw ---\x1b[0m');

  check(
    'Hay 4 personalidades con nombre y descripción',
    Object.keys(PERSONALIDADES).length === 4 &&
      Object.values(PERSONALIDADES).every((p) => p.nombre && p.descripcion && p.prompt),
    Object.keys(PERSONALIDADES).join(',')
  );
  check(
    'Todas mantienen la regla de respeto y se presentan como Claw',
    Object.values(PERSONALIDADES).every((p) => /Nunca insultes/i.test(p.prompt) && p.prompt.includes('Eres "Claw"')),
    'revisar los prompts de src/claw.js'
  );
  check('"personality" resuelve al comando personalidad', resolverComando('personality') === 'personalidad');
  check('"persönlichkeit" resuelve al comando personalidad', resolverComando('persönlichkeit') === 'personalidad');

  const ver = await dice('!claw personalidad', 'Ana');
  check(
    '"!claw personalidad" enseña la actual y la lista',
    /Personalidad actual: \*normal\*/i.test(texto(ver)) && /pirata/.test(texto(ver)),
    `dice=${texto(ver).slice(0, 90)}`
  );
  const alias = await dice('!claw personality', 'Ana');
  check(
    'El alias inglés "!claw personality" también enseña la lista',
    /Personalidad actual/i.test(texto(alias)),
    `dice=${texto(alias).slice(0, 80)}`
  );
  const intrusoP = await dice('!claw personalidad pirata', 'Bea');
  check(
    'Sin ser admin no se puede cambiar',
    /solo lo puede hacer el dueño/i.test(texto(intrusoP)),
    `dice=${texto(intrusoP).slice(0, 80)}`
  );
  const cambio = await dice('!claw personalidad pirata', 'Dueno', { senderJid: duenoJid, fromMe: true });
  check(
    'El dueño cambia a pirata',
    /ahora habla como \*pirata\*/i.test(texto(cambio)) && config.clawPersonality === 'pirata',
    `dice=${texto(cambio).slice(0, 80)}`
  );
  const mala = await dice('!claw personalidad ninja', 'Dueno', { senderJid: duenoJid, fromMe: true });
  check(
    'Un nombre inventado se rechaza con la lista y no cambia nada',
    /solo puede ser/i.test(texto(mala)) && config.clawPersonality === 'pirata',
    `dice=${texto(mala).slice(0, 80)}`
  );
  const viaAjustes = await dice('!claw ajustes personalidad gracioso', 'Dueno', {
    senderJid: duenoJid,
    fromMe: true
  });
  check(
    '"!claw ajustes personalidad gracioso" también funciona',
    /gracioso/.test(texto(viaAjustes)) && config.clawPersonality === 'gracioso',
    `dice=${texto(viaAjustes).slice(0, 80)}`
  );
  const resetP = await dice('!claw ajustes reset personalidad', 'Dueno', { senderJid: duenoJid, fromMe: true });
  check(
    'El reset devuelve a normal',
    /normal/.test(texto(resetP)) && config.clawPersonality === 'normal',
    `dice=${texto(resetP).slice(0, 80)}`
  );

  // ---- Resumen -----------------------------------------------------
  console.log('\n\x1b[1m=== Resumen ===\x1b[0m');
  console.log(`  ${passed} correctas, ${failed} fallidas`);
  if (failures.length) {
    console.log('  Fallos:');
    for (const f of failures) console.log(`   - ${f}`);
  }
  console.log('');

  memory.close();
  power.stop();
  try {
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(tmpDb + suffix, { force: true });
    fs.rmSync(config.dataDir, { recursive: true, force: true });
  } catch {
    /* ignorar */
  }
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error('Las pruebas fallaron:', err);
  process.exitCode = 1;
});
