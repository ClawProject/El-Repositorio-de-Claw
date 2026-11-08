// Local tests for AI extraction and context; they need neither Ollama nor WhatsApp.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.js';
import * as memory from '../memory.js';
import { analyze } from '../brain.js';
import { clawAnswer } from '../claw.js';
import { chat } from '../ollama.js';
import { handleMessage, resetTransientState } from '../router.js';
import { extractDatePhrase, parseSpanishDate, todayISO } from '../dates.js';
import { mejorarPrompt, prepararPromptImagen } from '../promptmagic.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'picklebrain-ai-test-'));
const dbPath = path.join(tempDir, 'test.db');
const originalFetch = globalThis.fetch;
const originalStoreMessages = config.storeMessages;
const originalTranscribeEnabled = config.transcribeEnabled;
const originalTranscribeMode = config.transcribeMode;
const originalGroupJids = config.groupJids;
const originalWebSearchEnabled = config.webSearchEnabled;
const CHAT = 'ia-test@g.us';
const VOICE_CHAT = 'voice-test@g.us';
let responseContent = '';
let responseDoneReason = 'stop';
let lastRequest = null;
let modelResponses = null;
const requestedModels = [];
let passed = 0;

function mockFetch(_url, options) {
  lastRequest = JSON.parse(options.body);
  requestedModels.push(lastRequest.model);
  const modelResponse = modelResponses?.[lastRequest.model];
  const content = modelResponse?.content ?? responseContent;
  const doneReason = modelResponse?.doneReason ?? responseDoneReason;
  return Promise.resolve(
    new Response(JSON.stringify({ done_reason: doneReason, message: { content } }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  );
}

async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

async function routeVoice(transcript, seconds = 3) {
  return handleMessage(
    {
      chatJid: VOICE_CHAT,
      isGroup: true,
      text: '',
      senderName: 'Lucía',
      media: {
        kind: 'audio',
        mime: 'audio/ogg',
        seconds,
        download: async () => Buffer.from('audio de prueba')
      }
    },
    { transcribe: async () => ({ text: transcript, ms: 1 }) }
  );
}

try {
  await memory.init(dbPath);
  config.storeMessages = true;
  config.transcribeEnabled = true;
  config.transcribeMode = 'contexto';
  config.groupJids = [];
  config.webSearchEnabled = false;
  globalThis.fetch = mockFetch;
  memory.setSetting('group_jid', VOICE_CHAT);
  resetTransientState();

  await check('La fecha conserva el modificador de semana que viene', () => {
    const date = extractDatePhrase('Corrijo: el próximo jueves será el examen', todayISO());
    assert.equal(date?.phrase, 'el próximo jueves');
    assert.equal(date?.iso, parseSpanishDate('el próximo jueves', todayISO()));
  });

  await check('No confunde una lista de ejercicios 3/5/6 con una fecha', () => {
    assert.equal(parseSpanishDate('hacer los ejercicios 3/5/6', todayISO()), null);
  });

  await check('El clasificador extrae fecha y reconoce una corrección', async () => {
    responseContent = JSON.stringify({
      tipo: 'dato_examen',
      asignatura: '',
      contenido: 'tema 5',
      fecha: '',
      fecha_texto: '',
      confianza: 0.9,
      correccion: true
    });
    const result = await analyze({
      text: 'Han cambiado el examen de historia al próximo jueves: entra tema 5'
    });
    assert.equal(result.tipo, 'dato_examen');
    assert.equal(result.subject, 'historia');
    assert.equal(result.content, 'tema 5');
    assert.equal(result.fechaTexto, 'próximo jueves');
    assert.equal(result.fecha, parseSpanishDate('próximo jueves', todayISO()));
    assert.equal(result.correction, true);
  });

  await check('Una respuesta breve usa la pregunta pendiente para asignatura y tipo', async () => {
    responseContent = JSON.stringify({
      tipo: 'otro',
      asignatura: '',
      contenido: '',
      fecha: '',
      fecha_texto: '',
      confianza: 0.2,
      correccion: false
    });
    const result = await analyze({
      text: 'el viernes',
      pending: { kind: 'examen', subject: 'Historia' }
    });
    assert.equal(result.tipo, 'dato_examen');
    assert.equal(result.subject, 'historia');
    assert.equal(result.fecha, parseSpanishDate('el viernes', todayISO()));
    assert.ok(result.confidence >= 0.65);
  });

  await check('Una corrección breve hereda el tipo y la asignatura pendientes', async () => {
    responseContent = JSON.stringify({
      tipo: 'otro',
      asignatura: '',
      contenido: 'hacer la página 14',
      fecha: '',
      fecha_texto: '',
      confianza: 0.2,
      correccion: false
    });
    const result = await analyze({
      text: 'No, corrijo: era la página 12, es la 14',
      pending: { kind: 'deberes', subject: 'Lengua' }
    });
    assert.equal(result.tipo, 'dato_deberes');
    assert.equal(result.subject, 'lengua');
    assert.equal(result.content, 'hacer la página 14');
    assert.equal(result.correction, true);
    assert.ok(result.confidence >= 0.7);
  });

  await check('Una corrección explícita de deberes sustituye el apunte anterior', () => {
    const original = memory.saveEntry({
      kind: 'deberes',
      subject: 'lengua',
      content: 'hacer la página 12',
      chatJid: CHAT
    });
    const corrected = memory.saveEntry({
      kind: 'deberes',
      subject: 'lengua',
      content: 'hacer la página 14',
      correction: true,
      chatJid: CHAT
    });
    assert.equal(corrected.status, 'reemplaza');
    assert.equal(memory.findPending({ kind: 'deberes', subjectKey: 'lengua', chatJid: CHAT }).length, 1);
    assert.equal(memory.listEntries(10, CHAT)[0].id, corrected.entry.id);
    assert.ok(original.entry.id < corrected.entry.id);
  });

  await check('Claw consulta el historial local al responder a un seguimiento escolar', async () => {
    memory.logMessage({
      chatJid: CHAT,
      msgId: 'contexto-1',
      author: 'Lucía',
      text: 'El examen de historia es el viernes y entra el tema 4'
    });
    memory.saveEntry({
      kind: 'examen',
      subject: 'historia',
      content: 'tema 4',
      fecha: parseSpanishDate('el viernes', todayISO()),
      chatJid: CHAT
    });
    responseContent = 'Entra el tema 4.';
    const answer = await clawAnswer({ question: '¿y qué entra?', chatJid: CHAT });
    assert.equal(answer, 'Entra el tema 4.');
    const system = lastRequest.messages[0].content;
    assert.match(system, /MENSAJES RECIENTES DEL GRUPO/);
    assert.match(system, /tema 4/);
    assert.match(system, /EXÁMENES CONOCIDOS/);
  });

  await check('El prompt de imagen conserva el encargo y añade guía visual para SD 1.5', async () => {
    responseContent = 'a red penguin standing beside a blue backpack';
    const improved = await mejorarPrompt('Un pingüino rojo de pie junto a una mochila azul');
    assert.equal(improved, responseContent);
    assert.match(lastRequest.messages[0].content, /Never replace, omit or contradict/);
    assert.match(lastRequest.messages[0].content, /Do not invent people, objects/);
    assert.equal(
      prepararPromptImagen(improved),
      'a red penguin standing beside a blue backpack, high quality, highly detailed, balanced composition, sharp focus'
    );
    assert.equal(prepararPromptImagen(`${improved}, high quality`), `${improved}, high quality, highly detailed, balanced composition, sharp focus`);
  });

  await check('Qwen3 recibe la opción para no mostrar razonamiento interno', async () => {
    responseContent = 'La respuesta.';
    await chat([{ role: 'user', content: 'Hola' }], { model: 'qwen3:4b' });
    assert.equal(lastRequest.think, false);
  });

  await check('El cliente Ollama elimina el bloque de razonamiento de Qwen3', async () => {
    responseContent = '<think>razonamiento privado</think>\n\nLa respuesta final.';
    const answer = await chat([{ role: 'user', content: 'Hola' }], { model: 'qwen3:4b' });
    assert.equal(answer, 'La respuesta final.');
  });

  await check('El cliente Ollama elimina el razonamiento Qwen3 aunque falte la etiqueta inicial', async () => {
    responseContent = 'razonamiento privado</think>\n\nLa respuesta final.';
    const answer = await chat([{ role: 'user', content: 'Hola' }], { model: 'qwen3:4b' });
    assert.equal(answer, 'La respuesta final.');
  });

  await check('El cliente Ollama descarta razonamiento incompleto en vez de mostrarlo', async () => {
    responseContent = '<think>razonamiento privado sin cierre';
    const answer = await chat([{ role: 'user', content: 'Hola' }], { model: 'qwen3:4b' });
    assert.equal(answer, '');
  });

  await check('El cliente Ollama descarta una respuesta Qwen3 truncada antes del final', async () => {
    responseContent = 'razonamiento interno incompleto';
    responseDoneReason = 'length';
    const answer = await chat([{ role: 'user', content: 'Hola' }], { model: 'qwen3:4b' });
    responseDoneReason = 'stop';
    assert.equal(answer, '');
  });

  await check('Claw responde solo con la respuesta final generada por Qwen3', async () => {
    responseContent = '<think>razonamiento privado</think>\n\n323.';
    const answer = await clawAnswer({ question: '¿Cuánto son 17 por 19?' });
    assert.equal(answer, '323.');
  });

  await check('Claw usa el modelo de respaldo si Qwen3 no termina la respuesta', async () => {
    const previousModel = config.ollamaModel;
    config.ollamaModel = 'qwen3:4b';
    modelResponses = {
      'qwen3:4b': { content: 'razonamiento incompleto', doneReason: 'length' },
      [config.ollamaFallbackModel]: { content: 'Son 4.', doneReason: 'stop' }
    };
    const firstRequest = requestedModels.length;
    try {
      const answer = await clawAnswer({ question: '¿Cuánto son 2+2?' });
      assert.equal(answer, 'Son 4.');
      assert.deepEqual(requestedModels.slice(firstRequest), ['qwen3:4b', config.ollamaFallbackModel]);
    } finally {
      config.ollamaModel = previousModel;
      modelResponses = null;
    }
  });

  await check('En modo contexto se descarta una nota de voz sin pregunta ni trigger', async () => {
    const result = await routeVoice('La cena está lista');
    assert.equal(result.action, 'silencio');
    assert.equal(result.transcript, null);
    assert.equal(result.replies.length, 0);
  });

  await check('Claw sola, con puntuación o transcrita fonéticamente activa el saludo', async () => {
    for (const transcript of ['Claw', 'Claw...', 'Clau.', 'Clao,']) {
      const result = await routeVoice(transcript);
      assert.equal(result.transcript, transcript);
      assert.equal(result.action, 'claw-saludo', transcript);
      assert.match(result.replies.join('\n'), /Dime, ¿qué necesitas/i);
    }
  });

  await check('Una nota de voz muy corta con Claw no se descarta por su duración', async () => {
    const result = await routeVoice('Claw', 0.2);
    assert.equal(result.transcript, 'Claw');
    assert.equal(result.action, 'claw-saludo');
    assert.match(result.replies.join('\n'), /Dime, ¿qué necesitas/i);
  });

  await check('Una variante fonética y la puntuación de Whisper también activan a Claw', async () => {
    responseContent = 'Son 4.';
    const result = await routeVoice('Clau... ¿cuánto son 2 + 2?');
    assert.equal(result.transcript, 'Clau... ¿cuánto son 2 + 2?');
    assert.equal(result.action, 'claw');
    assert.match(result.replies.join('\n'), /Son 4/);
    assert.equal(lastRequest.messages.at(-1).content, 'cuánto son 2 + 2');
  });

  console.log(`\n${passed} pruebas locales de IA correctas.`);
} finally {
  globalThis.fetch = originalFetch;
  config.storeMessages = originalStoreMessages;
  config.transcribeEnabled = originalTranscribeEnabled;
  config.transcribeMode = originalTranscribeMode;
  config.groupJids = originalGroupJids;
  config.webSearchEnabled = originalWebSearchEnabled;
  memory.close();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(dbPath + suffix, { force: true });
  fs.rmSync(tempDir, { recursive: true, force: true });
}
