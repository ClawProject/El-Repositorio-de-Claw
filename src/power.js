// Power lock: while the bot is open, it keeps Windows from sleeping or
// hibernating the computer (if it suspended, the WhatsApp connection would drop).
//
// It uses the Windows SetThreadExecutionState API with ES_CONTINUOUS. What it does
// is ask the system "do not sleep" FROM A LIVE THREAD: if that process ends, the
// system goes back to normal. It changes no PC setting at all.
// Since a live thread has to be kept, we launch a small PowerShell in the
// background that waits and also closes itself if the bot disappears.
import { spawn } from 'node:child_process';
import { config } from './config.js';
import { log } from './logger.js';

// SetThreadExecutionState flags (Microsoft documentation).
const ES_CONTINUOUS = 0x80000000;
const ES_SYSTEM_REQUIRED = 0x00000001;
const ES_DISPLAY_REQUIRED = 0x00000002;

let child = null;
let childFlags = 0;

function flagsDeseados() {
  // >>> 0 so it comes out as an unsigned integer (JS OR is signed 32-bit and
  // 0x80000000 would end up negative, which PowerShell rejects as uint32).
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
    // If the bot no longer exists (e.g. it was force-closed), we leave and drop the lock.
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

/** Enables the lock when appropriate (Windows and the setting enabled). */
export function start() {
  if (child || process.platform !== 'win32' || !config.preventSleep) return;
  iniciar(flagsDeseados());
}

/** Releases the lock (when the bot closes). */
export function stop() {
  if (!child) return;
  const proc = child;
  child = null;
  childFlags = 0;
  try {
    proc.kill();
  } catch {
    /* ignore */
  }
}

/** Brings the lock in line with the current settings (in case they change live). */
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
