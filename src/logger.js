// Logger minimo, sin dependencias, con salida legible en consola.
import { config } from './config.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const current = LEVELS[config.logLevel] ?? LEVELS.info;

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function emit(level, args) {
  if (LEVELS[level] > current) return;
  const line = `[${stamp()}] ${level.toUpperCase().padEnd(5)}`;
  if (level === 'error') console.error(line, ...args);
  else console.log(line, ...args);
}

export const log = {
  error: (...a) => emit('error', a),
  warn: (...a) => emit('warn', a),
  info: (...a) => emit('info', a),
  debug: (...a) => emit('debug', a),
  child: () => log
};
