// Diagnostics: checks that everything needed works.
// Usage:  npm run doctor
import fs from 'node:fs';
import { config } from '../config.js';
import { log } from '../logger.js';
import * as memory from '../memory.js';
import { ping, chat } from '../ollama.js';
import { describeToday, todayISO } from '../dates.js';
import { fastRoute, looksRelevant, clawQuestion } from '../signals.js';
import { analyze } from '../brain.js';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const icon = ok === true ? 'OK  ' : ok === false ? 'FALLA' : 'AVISO';
  console.log(`[${icon}] ${name}${detail ? ` -> ${detail}` : ''}`);
}

async function main() {
  console.log('\n=== PickleBrain: diagnostico ===\n');

  // 1. Node
  const [major, minor] = process.versions.node.split('.').map(Number);
  const nodeOk = major > 22 || (major === 22 && minor >= 5);
  check('Node.js', nodeOk, `v${process.versions.node}`);

  // 2. node:sqlite
  try {
    const mod = await import('node:sqlite');
    check('Modulo node:sqlite', Boolean(mod.DatabaseSync), 'disponible');
  } catch (err) {
    check('Modulo node:sqlite', false, err.message);
  }

  // 3. Data folder
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
    const probe = `${config.dataDir}/.probe`;
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    check('Carpeta de datos escribible', true, config.dataDir);
  } catch (err) {
    check('Carpeta de datos escribible', false, err.message);
  }

  // 4. Database
  try {
    await memory.init();
    const s = memory.stats();
    check('Base de datos SQLite', true, `${s.deberes} deberes, ${s.examenes} examenes, ${s.archivos} archivos, ${s.mensajes} mensajes`);
  } catch (err) {
    check('Base de datos SQLite', false, err.message);
    return summary();
  }

  // 5. Ollama
  const health = await ping();
  check('Ollama en marcha', health.ok, health.ok ? config.ollamaUrl : health.error);
  if (!health.ok) return summary();

  const hasModel = health.models.some((m) => m === config.ollamaModel || m.startsWith(`${config.ollamaModel}:`));
  check(
    `Modelo "${config.ollamaModel}"`,
    hasModel,
    hasModel ? 'instalado' : `ejecuta:  ollama pull ${config.ollamaModel}`
  );
  console.log(`         Modelos disponibles: ${health.models.join(', ') || '(ninguno)'}`);

  if (!hasModel) return summary();

  // 6. Real inference
  const t0 = Date.now();
  let warm = false;
  try {
    const out = await chat(
      [
        { role: 'system', content: 'Responde solo con la palabra OK.' },
        { role: 'user', content: 'di OK' }
      ],
      { temperature: 0, numPredict: 8 }
    );
    warm = /ok/i.test(out);
    check('Inferencia del modelo', warm, `${Date.now() - t0} ms (primera vez puede tardar mas)`);
  } catch (err) {
    check('Inferencia del modelo', false, err.message);
  }

  // 7. Classifier with real examples
  const samples = [
    { text: 'chicos que deberes hay de mates?', esperado: 'pregunta_deberes' },
    { text: 'el examen de historia es el 20 de octubre', esperado: 'dato_examen' },
    { text: 'hay que hacer las paginas 30 a 32 de lengua para el lunes', esperado: 'dato_deberes' },
    { text: 'jajaja que risa', esperado: 'otro' }
  ];
  let aciertos = 0;
  for (const s of samples) {
    const r = await analyze({ text: s.text, recent: [], senderName: 'prueba' });
    const ok = r.tipo === s.esperado;
    if (ok) aciertos += 1;
    console.log(
      `         ${ok ? 'ok ' : 'mal'} "${s.text}" -> ${r.tipo}${r.subject ? ` [${r.subject}]` : ''}${
        r.fecha ? ` (${r.fecha})` : ''
      } (esperado: ${s.esperado})`
    );
  }
  check('Clasificador', aciertos >= 3, `${aciertos}/${samples.length} aciertos`);

  // 8. Filters without AI
  const hola = todayISO();
  console.log(`\n         Hoy es ${describeToday(hola)}`);
  check(
    'Deteccion de preguntas tipicas',
    fastRoute('que deberes hay de mates?')?.kind === 'deberes' &&
      fastRoute('cuando es el examen de historia?')?.kind === 'examen',
    'ok'
  );
  check('Filtro de ruido', !looksRelevant('jajaja que risa'), 'los memes no despiertan al bot');
  check('Modo Claw', clawQuestion('Claw cuanto son 2+2') === 'cuanto son 2+2', 'Claw cuanto son 2+2 -> "cuanto son 2+2"');

  // 9. Photos and disk space
  console.log('');
  const mediaLib = await import('../media.js');
  try {
    mediaLib.ensureDirs();
    const probe = `${config.mediaDir}/.probe`;
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    check('Carpeta de archivos escribible', true, config.mediaDir);
  } catch (err) {
    check('Carpeta de archivos escribible', false, err.message);
  }
  const espacio = mediaLib.spaceInfo();
  check(
    'Espacio en disco',
    espacio.freeMb === null ? null : espacio.freeMb >= espacio.keepMb,
    espacio.freeMb === null ? 'no lo puedo medir' : `${espacio.freeMb} MB libres (mínimo exigido ${espacio.keepMb} MB)`
  );
  check(
    'Recordar fotos',
    config.mediaEnabled && config.mediaMode !== 'nada',
    `modo "${config.mediaMode}" · se borran solas pasados ${config.cleanupExamGraceDays} días del examen`
  );
  const guardado = mediaLib.dirStats();
  check('Archivos guardados ahora', true, `${guardado.files} archivo(s), ${guardado.mb} MB`);

  // 10. Voice notes
  console.log('');
  if (!config.transcribeEnabled || config.transcribeMode === 'nada') {
    check('Entender notas de voz', null, 'desactivado en la configuracion');
    summary();
    return;
  }
  const { voiceEngine, warmup, transcribeFile } = await import('../transcribe.js');
  const motorVoz = await voiceEngine();
  check(
    'Motor de voz',
    Boolean(motorVoz),
    motorVoz === 'python'
      ? 'servicio Python (faster-whisper)'
      : motorVoz === 'node'
        ? `Whisper local (${config.whisperModel})`
        : 'arranca python/server.py o instala ffmpeg'
  );
  if (motorVoz) {
    console.log('         Cargando el modelo de voz (la primera vez se descarga)...');
    const t1 = Date.now();
    const listo = await warmup();
    check('Modelo de voz', listo, listo ? `listo en ${((Date.now() - t1) / 1000).toFixed(1)} s` : 'no se pudo cargar');
    const muestra = `${config.rootDir}/src/tools/fixtures/nota-de-voz.ogg`;
    if (listo && fs.existsSync(muestra)) {
      const res = await transcribeFile(muestra);
      check(
        'Transcripcion real',
        /examen/i.test(res.text),
        `"${res.text.slice(0, 70)}..." en ${(res.ms / 1000).toFixed(1)} s`
      );
    }
  }

  summary();
}

function summary() {
  const fallos = results.filter((r) => r.ok === false);
  console.log('\n=== Resumen ===');
  if (!fallos.length) {
    console.log('Todo correcto. Puedes arrancar con:  npm start\n');
  } else {
    console.log(`Hay ${fallos.length} problema(s):`);
    for (const f of fallos) console.log(` - ${f.name}: ${f.detail}`);
    console.log('');
  }
  memory.close();
  process.exitCode = fallos.length ? 1 : 0;
}

main().catch((err) => {
  log.error('El diagnostico fallo:', err.message);
  process.exitCode = 1;
});
