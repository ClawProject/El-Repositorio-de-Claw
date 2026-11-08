// PickleBrain entry point.
import { config } from './config.js';
import { log } from './logger.js';
import * as memory from './memory.js';
import * as media from './media.js';
import * as ajustes from './settings.js';
import { ping } from './ollama.js';
import { resetTransientState, boundGroupJids } from './router.js';
import { voiceEngine, warmup as warmupVoice } from './transcribe.js';
import { avisosPendientes } from './reminders.js';
import { resumenSemanal, tocaResumenSemanal } from './summary.js';
import { textoNovedades, marcadorNovedades } from './changelog.js';
import { start, stop, sendReplies, estaConectado, cuandoConecte } from './whatsapp.js';
import * as power from './power.js';
import { startServer } from './server.js';
import { prepararIdioma } from './setup.js';

let cleanupTimer = null;
let avisosTimer = null;

function runCleanup(reason) {
  try {
    const result = media.cleanup();
    const summary = media.summarizeCleanup(result);
    if (reason === 'arranque' || summary !== 'nada que borrar') {
      log.info(`Limpieza (${reason}): ${summary}.`);
    }
  } catch (err) {
    log.error('La limpieza automática falló:', err.message);
  }
}

/** Exam and homework reminders: warns the evening before and on the morning of the day. */
async function runAvisos(reason = 'periódica') {
  try {
    if (config.maintenance) return; // do not disturb while in maintenance
    if (!estaConectado()) return; // with no connection there is nothing to send (retried later)
    const grupos = boundGroupJids();
    if (!grupos.length) return;
    let enviados = 0;
    for (const grupo of grupos) {
      const exams = memory.findPending({ kind: 'examen', chatJid: grupo });
      const deberes = memory.findPending({ kind: 'deberes', chatJid: grupo });
      const pendientes = avisosPendientes({
        exams,
        deberes,
        yaEnviado: (clave) => Boolean(memory.getSetting(clave))
      });
      for (const aviso of pendientes) {
        // Only counts as sent if it really went out (otherwise it is retried).
        if (!(await sendReplies(grupo, [aviso.texto]))) continue;
        memory.setSetting(aviso.clave, new Date().toISOString());
        log.info(`Recordatorio (${aviso.cuando}) enviado a ${grupo}.`);
        enviados++;
      }
    }
    if (reason === 'arranque' && !enviados) log.debug('Sin recordatorios pendientes.');
  } catch (err) {
    log.warn(`No pude mandar los recordatorios: ${err.message}`);
  }
}

/** Automatic weekly summary (Sunday afternoons by default). */
async function runResumen() {
  try {
    if (config.maintenance) return; // do not disturb while in maintenance
    if (!config.summaryEnabled) return;
    if (!estaConectado()) return; // with no connection there is nothing to send
    const grupos = boundGroupJids();
    if (!grupos.length) return;
    for (const grupo of grupos) {
      const ultima = memory.getSetting(`resumen_semanal:${grupo}`);
      if (!tocaResumenSemanal(new Date(), ultima)) continue;
      const texto = await resumenSemanal(grupo);
      if (texto && (await sendReplies(grupo, [texto]))) {
        // Only marked if it really went out, so the week's summary is not lost.
        memory.setSetting(`resumen_semanal:${grupo}`, new Date().toISOString().slice(0, 10));
        log.info(`Resumen semanal enviado a ${grupo}.`);
      }
    }
  } catch (err) {
    log.warn(`No pude mandar el resumen semanal: ${err.message}`);
  }
}

/** Bot changelog: told to the group only once per change. */
async function runNovedades() {
  try {
    if (!config.changelogNotify) return;
    if (config.maintenance) return; // do not disturb while in maintenance
    if (!estaConectado()) return; // if there is no connection, we try again later
    const grupos = boundGroupJids();
    if (!grupos.length) return;
    const clave = marcadorNovedades();
    if (!clave || memory.getSetting(clave)) return; // this change was already announced
    const texto = textoNovedades();
    if (!texto) return;
    const enviados = [];
    for (const grupo of grupos) {
      // Only mark the groups where it WAS sent, so the rest are retried.
      if (await sendReplies(grupo, [texto])) enviados.push(grupo);
    }
    if (enviados.length === grupos.length) {
      memory.setSetting(clave, new Date().toISOString());
      log.info(`Novedades enviadas a ${enviados.length} grupo(s).`);
    } else {
      log.warn(
        `No pude contar las novedades en ${grupos.length - enviados.length} grupo(s); lo reintentaré.`
      );
    }
  } catch (err) {
    log.warn(`No pude mandar las novedades: ${err.message}`);
  }
}

async function main() {
  log.info('Arrancando PickleBrain...');
  log.info(`Base de datos: ${config.dbPath}`);

  await memory.init();
  ajustes.aplicarTodos();
  resetTransientState(); // do not carry over open questions from the previous run
  media.ensureDirs();
  startServer();
  // First start: the bot does not connect to WhatsApp until a language is chosen.
  await prepararIdioma();
  log.info(
    `Ajustes cargados. Claw: ${config.ollamaModel} | Apuntes: ${config.ollamaBrainModel} | Zona horaria: ${config.timezone}`
  );

  // Power lock: keep the computer awake while the bot is running.
  power.start();
  const asignados = boundGroupJids();
  if (asignados.length) {
    log.info(`Grupos ya asignados: ${asignados.join(', ')}`);
  } else if (config.groupJids?.length) {
    log.info(`Grupos fijados por el .env: ${config.groupJids.join(', ')}`);
  } else {
    log.info('Sin grupo asignado. Escribe "!claw aqui" dentro del grupo del instituto.');
  }

  // --- Extras: photos and voice notes ---
  const voiceOn = config.transcribeEnabled && config.transcribeMode !== 'nada';
  if (voiceOn) {
    const motorVoz = await voiceEngine();
    if (motorVoz) {
      log.info(
        motorVoz === 'python'
          ? 'Notas de voz activadas con Python/faster-whisper.'
          : `Notas de voz activadas con Whisper local (modelo ${config.whisperModel}).`
      );
      // Load it in the background: the first voice note will then be fast.
      warmupVoice().catch(() => {});
    } else {
      log.warn('No encuentro el servicio Python de voz ni ffmpeg: no podré entender notas de voz.');
      log.warn('Arranca python/server.py o instala ffmpeg:  winget install Gyan.FFmpeg');
    }
  }

  if (config.mediaEnabled && config.mediaMode !== 'nada') {
    const info = media.spaceInfo();
    log.info(`Fotos activadas (modo "${config.mediaMode}"). Espacio libre en disco: ${info.freeMb ?? '?'} MB.`);
    if (info.freeMb !== null && info.freeMb < config.mediaMinFreeMb) {
      log.warn(`Quedan menos de ${config.mediaMinFreeMb} MB: de momento no guardaré fotos.`);
    }
  }

  const health = await ping();
  if (!health.ok) {
    log.error('No puedo hablar con Ollama:', health.error);
    log.error('Abre la aplicacion Ollama y vuelve a intentarlo.');
    process.exitCode = 1;
    return;
  }
  if (!health.models.some((m) => m === config.ollamaModel || m.startsWith(config.ollamaModel + ':'))) {
    log.warn(`El modelo "${config.ollamaModel}" no aparece en Ollama.`);
    log.warn(`Descargalo con:  ollama pull ${config.ollamaModel}`);
  } else {
    log.info(`Ollama responde. Modelo "${config.ollamaModel}" disponible.`);
  }

  // --- Automatic cleanup: deletes whatever has expired ---
  runCleanup('arranque');
  const everyMs = Math.max(5, config.cleanupIntervalMinutes) * 60000;
  cleanupTimer = setInterval(() => runCleanup('periódica'), everyMs);
  cleanupTimer.unref?.();

  await start();

  // --- Exam notices, changelog and weekly summary ---
  // `start()` returns before the connection is open, so we subscribe to
  // "when it connects" to avoid sending anything too early (and to retry only
  // when there really is a connection).
  cuandoConecte(() => {
    runNovedades();
    runAvisos('arranque');
  });
  await runNovedades();
  await runAvisos('arranque');
  await runResumen();
  avisosTimer = setInterval(() => {
    runNovedades();
    runAvisos();
    runResumen();
  }, 10 * 60000);
  avisosTimer.unref?.();

  const shutdown = async () => {
    log.info('Cerrando...');
    if (cleanupTimer) clearInterval(cleanupTimer);
    if (avisosTimer) clearInterval(avisosTimer);
    power.stop();
    stop();
    memory.close();
    setTimeout(() => process.exit(0), 500);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

process.on('unhandledRejection', (reason) => {
  log.error('Promesa rechazada sin capturar:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  log.error('Error no capturado:', err?.message || err);
  log.debug(err?.stack);
});
// Release the power lock no matter how it closes.
process.on('exit', () => power.stop());

main().catch((err) => {
  log.error('No se pudo arrancar:', err.message);
  process.exitCode = 1;
});
