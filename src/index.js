// Punto de entrada de PickleBrain.
import { config } from './config.js';
import { log } from './logger.js';
import * as memory from './memory.js';
import * as media from './media.js';
import * as ajustes from './settings.js';
import { ping } from './ollama.js';
import { resetTransientState, boundGroupJids } from './router.js';
import { ffmpegAvailable, warmup as warmupVoice } from './transcribe.js';
import { avisosPendientes } from './reminders.js';
import { resumenSemanal, tocaResumenSemanal } from './summary.js';
import { textoNovedades, marcadorNovedades } from './changelog.js';
import { start, stop, sendReplies, estaConectado, cuandoConecte } from './whatsapp.js';
import * as power from './power.js';
import { startServer } from './server.js';

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

/** Recordatorios de exámenes y deberes: avisa la tarde antes y la mañana del día. */
async function runAvisos(reason = 'periódica') {
  try {
    if (config.maintenance) return; // en mantenimiento no molestamos
    if (!estaConectado()) return; // sin conexión no hay nada que mandar (se reintenta luego)
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
        // Solo se da por enviado si de verdad salió (si no, se reintenta).
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

/** Resumen semanal automático (por defecto, domingos por la tarde). */
async function runResumen() {
  try {
    if (config.maintenance) return; // en mantenimiento no molestamos
    if (!config.summaryEnabled) return;
    if (!estaConectado()) return; // sin conexión no hay nada que mandar
    const grupos = boundGroupJids();
    if (!grupos.length) return;
    for (const grupo of grupos) {
      const ultima = memory.getSetting(`resumen_semanal:${grupo}`);
      if (!tocaResumenSemanal(new Date(), ultima)) continue;
      const texto = await resumenSemanal(grupo);
      if (texto && (await sendReplies(grupo, [texto]))) {
        // Se marca solo si salió de verdad, para no perder el resumen de la semana.
        memory.setSetting(`resumen_semanal:${grupo}`, new Date().toISOString().slice(0, 10));
        log.info(`Resumen semanal enviado a ${grupo}.`);
      }
    }
  } catch (err) {
    log.warn(`No pude mandar el resumen semanal: ${err.message}`);
  }
}

/** Novedades del bot: se cuentan al grupo una sola vez por cambio. */
async function runNovedades() {
  try {
    if (!config.changelogNotify) return;
    if (config.maintenance) return; // en mantenimiento no molestamos
    if (!estaConectado()) return; // si no hay conexión, lo intentamos más tarde
    const grupos = boundGroupJids();
    if (!grupos.length) return;
    const clave = marcadorNovedades();
    if (!clave || memory.getSetting(clave)) return; // ya se contó esta novedad
    const texto = textoNovedades();
    if (!texto) return;
    const enviados = [];
    for (const grupo of grupos) {
      // Solo marcamos los grupos donde SÍ se pudo enviar, para reintentar el resto.
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
  resetTransientState(); // no arrastrar preguntas abiertas de la ejecucion anterior
  media.ensureDirs();
  startServer();
  log.info(
    `Ajustes cargados. Claw: ${config.ollamaModel} | Apuntes: ${config.ollamaBrainModel} | Zona horaria: ${config.timezone}`
  );

  // Candado de energía: que el ordenador no se duerma mientras el bot está abierto.
  power.start();
  const asignados = boundGroupJids();
  if (asignados.length) {
    log.info(`Grupos ya asignados: ${asignados.join(', ')}`);
  } else if (config.groupJids?.length) {
    log.info(`Grupos fijados por el .env: ${config.groupJids.join(', ')}`);
  } else if (config.groupNames?.length) {
    log.info(`Me vincularé solo a los grupos llamados: ${config.groupNames.join(' / ')} (en cuanto hable alguien en alguno).`);
  } else if (config.groupName) {
    log.info(`Me vincularé solo al grupo llamado "${config.groupName}" (en cuanto hable alguien en él).`);
  } else {
    log.info('Sin grupo asignado. Escribe "!claw aqui" dentro del grupo del instituto.');
  }

  // --- Extras: fotos y notas de voz ---
  const voiceOn = config.transcribeEnabled && config.transcribeMode !== 'nada';
  if (voiceOn) {
    if (await ffmpegAvailable()) {
      log.info(`Notas de voz activadas (modelo ${config.whisperModel}).`);
      // Lo dejamos cargando en segundo plano: la primera nota de voz ya irá rápida.
      warmupVoice().catch(() => {});
    } else {
      log.warn('No encuentro ffmpeg, así que no podré entender las notas de voz.');
      log.warn('Instálalo con:  winget install Gyan.FFmpeg   (y vuelve a abrir la consola)');
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

  // --- Limpieza automatica: borra lo que ya caduco ---
  runCleanup('arranque');
  const everyMs = Math.max(5, config.cleanupIntervalMinutes) * 60000;
  cleanupTimer = setInterval(() => runCleanup('periódica'), everyMs);
  cleanupTimer.unref?.();

  await start();

  // --- Avisos de exámenes, novedades y resumen semanal ---
  // `start()` termina antes de que la conexión esté abierta, así que nos
  // apuntamos a "cuando conecte" para no mandar nada antes de tiempo (y para
  // reintentarlo solo cuando de verdad haya conexión).
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
// Suelta el candado de energía pase lo que pase al cerrar.
process.on('exit', () => power.stop());

main().catch((err) => {
  log.error('No se pudo arrancar:', err.message);
  process.exitCode = 1;
});
