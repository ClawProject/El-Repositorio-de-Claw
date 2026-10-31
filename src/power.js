// Candado de energía: mientras el bot está abierto, evita que Windows duerma o
// hiberne el ordenador (si se suspendiera, se caería la conexión con WhatsApp).
//
// Usa la API de Windows SetThreadExecutionState con ES_CONTINUOUS. Lo que hace
// es pedirle al sistema "no te duermas" DESDE UN HILO VIVO: si ese proceso
// termina, el sistema vuelve a la normalidad. No cambia ningún ajuste del PC.
// Como hay que mantener un hilo vivo, lanzamos un pequeño PowerShell en segundo
// plano que se queda esperando y, además, se cierra solo si el bot desaparece.
import { spawn } from 'node:child_process';
import { config } from './config.js';
import { log } from './logger.js';

// Flags de SetThreadExecutionState (documentación de Microsoft).
const ES_CONTINUOUS = 0x80000000;
const ES_SYSTEM_REQUIRED = 0x00000001;
const ES_DISPLAY_REQUIRED = 0x00000002;

let child = null;
let childFlags = 0;

function flagsDeseados() {
  // >>> 0 para que salga como entero sin signo (el OR de JS es de 32 bits con signo
  // y 0x80000000 quedaría negativo, que PowerShell rechaza como uint32).
  return (ES_CONTINUOUS | ES_SYSTEM_REQUIRED | (config.keepDisplay ? ES_DISPLAY_REQUIRED : 0)) >>> 0;
}

function iniciar(flags) {
  const padre = process.pid;
  const script = [
    '$ErrorActionPreference = "Stop"',
    "Add-Type -TypeDefinition 'namespace PickleWake { public static class Native { [System.Runtime.InteropServices.DllImport(\"kernel32.dll\")] public static extern uint SetThreadExecutionState(uint esFlags); } }'",
    `$flags = [uint32]${flags}`,
    '[PickleWake.Native]::SetThreadExecutionState($flags) | Out-Null',
    'Write-Output "listo"',
    `$padre = ${padre}`,
    'while ($true) {',
    '  Start-Sleep -Seconds 20',
    // Si el bot ya no existe (p. ej. se cerró a lo bruto), nos vamos y soltamos el candado.
    '  if (-not (Get-Process -Id $padre -ErrorAction SilentlyContinue)) { break }',
    '  [PickleWake.Native]::SetThreadExecutionState($flags) | Out-Null',
    '}'
  ].join('\n');

  let proc;
  try {
    proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', script],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (err) {
    log.warn(`No pude activar el candado de energía: ${err.message}`);
    return;
  }

  proc.on('error', (err) => {
    if (child === proc) { child = null; childFlags = 0; }
    log.warn(`No pude activar el candado de energía: ${err.message}`);
  });
  proc.on('exit', (code) => {
    if (child === proc) { child = null; childFlags = 0; }
    if (code) log.debug(`Candado de energía: terminó (código ${code}).`);
  });
  proc.stdout?.on('data', (buf) => {
    if (String(buf).includes('listo')) {
      log.info(
        `Candado de energía activo: el ordenador no se dormirá${config.keepDisplay ? ' ni apagará la pantalla' : ''} mientras el bot esté abierto.`
      );
    }
  });
  proc.stderr?.on('data', (buf) => log.debug(`Candado de energía (aviso): ${String(buf).trim()}`));

  child = proc;
  childFlags = flags;
}

/** Activa el candado si toca (Windows y ajuste activado). */
export function start() {
  if (child || process.platform !== 'win32' || !config.preventSleep) return;
  iniciar(flagsDeseados());
}

/** Suelta el candado (al cerrar el bot). */
export function stop() {
  if (!child) return;
  const proc = child;
  child = null;
  childFlags = 0;
  try {
    proc.kill();
  } catch {
    /* da igual */
  }
}

/** Pone el candado al día con los ajustes actuales (por si cambian en caliente). */
export function sync() {
  const quiere = process.platform === 'win32' && config.preventSleep;
  if (!quiere) {
    stop();
    return;
  }
  const flags = flagsDeseados();
  if (!child) iniciar(flags);
  else if (flags !== childFlags) {
    stop();
    iniciar(flags);
  }
}

export function activo() {
  return Boolean(child);
}
