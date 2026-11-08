// Initial setup: on first start, Claw asks in the browser which language it
// should speak and does not connect to WhatsApp until it has an answer. The
// choice is stored in the database.
import { spawn } from 'node:child_process';
import { log } from './logger.js';
import * as i18n from './i18n.js';

const PORT = Number(process.env.PORT || 3000);

function abrirNavegador(url) {
  if (process.env.CLAW_SKIP_SETUP_BROWSER === '1') return;
  try {
    // Claw only runs on Windows: `start` is a cmd.exe built-in and the first ""
    // is the window title.
    const child = spawn('cmd', ['/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.once('error', (err) => log.warn(`No pude abrir el navegador: ${err.message}`));
    child.unref();
  } catch (err) {
    log.warn(`No pude abrir el navegador: ${err.message}`);
  }
}

/**
 * Loads the saved language and, on first start, waits for it to be chosen in
 * the web page (/setup). Returns the final language code.
 *
 * @param {{ timeoutMs?: number, abrir?: boolean }} options
 *   timeoutMs: 0 = wait indefinitely (the normal case).
 *   abrir: false to avoid launching the browser (tests).
 */
export async function prepararIdioma({ timeoutMs = 0, abrir = true } = {}) {
  i18n.cargarIdioma();
  if (!i18n.necesitaSetup()) {
    log.info(`Idioma de Claw: ${i18n.infoIdioma().name} (${i18n.idioma()}).`);
    return i18n.idioma();
  }

  const url = `http://localhost:${PORT}/setup`;
  log.info('Primera vez: elige el idioma de Claw en el navegador.');
  log.info(`Si no se abre solo, entra en ${url}`);
  if (abrir) abrirNavegador(url);

  const inicio = Date.now();
  while (i18n.necesitaSetup()) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (timeoutMs && Date.now() - inicio >= timeoutMs) {
      log.warn('Se acabó el tiempo de espera para elegir el idioma.');
      break;
    }
  }

  if (i18n.necesitaSetup()) {
    log.warn('Todavía no hay idioma elegido; arranco con español por defecto.');
  } else {
    log.info(`Idioma de Claw: ${i18n.infoIdioma().name} (${i18n.idioma()}).`);
  }
  return i18n.idioma();
}
