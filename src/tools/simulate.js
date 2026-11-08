// Simulator: tries the bot WITHOUT connecting WhatsApp.
// Usage:  npm run sim
//
// Type messages as if you were a student in the group and you will see exactly
// what the bot would do. It uses the same database as the real bot.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { config } from '../config.js';
import { log } from '../logger.js';
import * as memory from '../memory.js';
import * as mediaStore from '../media.js';
import * as ajustes from '../settings.js';
import * as admins from '../admins.js';
import { handleMessage, resetTransientState } from '../router.js';
import { ping } from '../ollama.js';
import { describeToday, longDate } from '../dates.js';
import { subjectLabel } from '../subjects.js';

const SIM_JID = 'simulacion@g.us';
const VOICE_FIXTURE = path.join(config.rootDir, 'src', 'tools', 'fixtures', 'nota-de-voz.ogg');
let senderName = 'Ana';
let comoDueno = false; // write as the owner (to try the settings)
let enPrivado = false; // private chat instead of the group

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m'
};
const c = (color, text) => `${COLORS[color]}${text}${COLORS.reset}`;

function banner() {
  console.log('');
  console.log(c('cyan', '  ╔══════════════════════════════════════════════════╗'));
  console.log(c('cyan', '  ║   PickleBrain · simulador (sin WhatsApp)         ║'));
  console.log(c('cyan', '  ╚══════════════════════════════════════════════════╝'));
  console.log('');
  console.log(`  Claw:     ${c('magenta', config.ollamaModel)}`);
  console.log(`  Apuntes:  ${c('magenta', config.ollamaBrainModel)}`);
  console.log(`  Hoy es:   ${c('magenta', describeToday())}`);
  console.log(`  Base de datos: ${config.dbPath}`);
  console.log('');
  console.log('  Hablas como ' + c('green', senderName) + '. Cambia con  ' + c('dim', '/yo <nombre>'));
  console.log('  Ayuda: ' + c('dim', '/ayuda'));
  console.log('  Salir: ' + c('dim', '/salir'));
  console.log('');
}

function help() {
  console.log('');
  console.log('  ' + c('yellow', 'Comandos del simulador'));
  console.log(`    /yo <nombre>       cambia quien escribe (ahora: ${senderName})`);
  console.log('    /imagen <ruta> [pie]  simula que alguien manda una foto');
  console.log('    /audio [ruta]      simula una nota de voz (sin ruta usa una de ejemplo)');
  console.log('    /ver               muestra todo lo que el bot tiene apuntado');
  console.log('    /archivos          muestra las fotos guardadas y el espacio en disco');
  console.log('    /limpiar           lanza la limpieza automatica a mano');
  console.log(`    /dueno             escribir como el dueño de Claw (ahora: ${comoDueno ? 'SÍ' : 'no'})`);
  console.log(`    /privado           escribir por privado en vez del grupo (ahora: ${enPrivado ? 'SÍ' : 'no'})`);
  console.log('    /vincular          vuelve a vincular el grupo (por si usaste !claw fuera)');
  console.log('    /desvincular       desvincula el grupo, para ver que se calla del todo');
  console.log('    /borrar            borra deberes, examenes, archivos y preguntas');
  console.log('    /hoy               recuerda la fecha actual');
  console.log('    /ayuda             esta ayuda');
  console.log('    /salir             termina');
  console.log('');
}

function showEntries() {
  const entries = memory.listEntries();
  if (!entries.length) {
    console.log(c('dim', '  (vacio)'));
  } else {
    for (const kind of ['examen', 'deberes']) {
      const group = entries.filter((e) => e.kind === kind);
      if (!group.length) continue;
      console.log('  ' + c('yellow', kind === 'examen' ? 'EXÁMENES' : 'DEBERES'));
      for (const e of group) {
        const fecha = e.fecha ? longDate(e.fecha) : e.fechaTexto || 'sin fecha';
        console.log(
          `    #${e.id}  ${c('green', subjectLabel(e.subject) || 'General')} — ${e.content}  ${c('dim', `[${fecha}]`)}`
        );
      }
    }
  }

  const files = memory.allMedia();
  if (files.length) {
    console.log('  ' + c('yellow', 'FOTOS GUARDADAS'));
    for (const m of files) {
      console.log(
        `    #${m.id}  ${c('green', subjectLabel(m.subject) || m.kind || 'General')}  ${c('dim', `${path.basename(
          m.filePath
        )} [se borra el ${String(m.expiresAt || '').slice(0, 10)}]`)}`
      );
    }
  }
}

function showFiles() {
  const rows = memory.allMedia();
  if (!rows.length) console.log(c('dim', '  no hay fotos guardadas'));
  for (const m of rows) {
    console.log(`    #${m.id}  ${m.filePath}  ${c('dim', `${Math.round((m.size || 0) / 1024)} KB`)}`);
  }
  const info = mediaStore.spaceInfo();
  console.log(
    c('dim', `  espacio libre: ${info.freeMb ?? '?'} MB  ·  no guardo si quedan menos de ${info.keepMb} MB`)
  );
}

function printReplies(list, attached = []) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  for (const text of list) {
    console.log('');
    for (const line of String(text).split('\n')) {
      console.log('  ' + c('cyan', `PickleBrain ${hh}:${mm}`) + '  ' + line);
    }
  }
  for (const item of attached) {
    console.log(
      '  ' + c('cyan', `PickleBrain ${hh}:${mm}`) + '  ' + c('magenta', `[envía foto] ${item.caption || ''}`) +
        c('dim', ` ${path.basename(item.filePath)}`)
    );
  }
}

/** Delivers a message to the router (text, and optionally a file). */
async function deliver({ text, media = null, label = null }) {
  const t0 = Date.now();
  const duenoJid = admins.duenoJid();
  const yoJid = comoDueno && duenoJid ? duenoJid : `${senderName.toLowerCase()}@s.whatsapp.net`;
  const chatJid = enPrivado ? yoJid : SIM_JID;
  try {
    const result = await handleMessage({
      chatJid,
      chatName: enPrivado ? null : 'Grupo de prueba',
      isGroup: !enPrivado,
      text,
      senderName,
      senderJid: yoJid,
      msgId: `sim-${Date.now()}`,
      mentionedBot: false,
      fromMe: comoDueno,
      esPrivado: enPrivado,
      esChatPropio: enPrivado && comoDueno,
      media
    });
    const ms = Date.now() - t0;
    console.log(c('dim', `  [${senderName}${comoDueno ? ' (dueño)' : ''}${enPrivado ? ' · privado' : ''}] ${label ?? text}`));
    const texts = [...result.replies, ...(result.notices || [])];
    if (texts.length || result.media?.length) {
      printReplies(texts, result.media || []);
      console.log(c('dim', `  (${result.action}, ${ms} ms)`));
    } else {
      console.log(c('dim', `  (silencio · ${result.action}, ${ms} ms)`));
    }
  } catch (err) {
    console.log(c('yellow', `  Error: ${err.message}`));
    log.debug(err.stack);
  }
}

function mimeFor(file, kind) {
  const ext = path.extname(file).toLowerCase();
  const table = {
    '.ogg': 'audio/ogg',
    '.opus': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
  };
  return table[ext] || (kind === 'audio' ? 'audio/ogg' : 'image/jpeg');
}

/** Splits "/imagen "C:\\ruta con spaces\\foto.jpg" the caption" */
function splitPathAndCaption(rest) {
  const raw = rest.trim();
  if (!raw) return { file: '', caption: '' };
  if (raw.startsWith('"')) {
    const end = raw.indexOf('"', 1);
    if (end !== -1) return { file: raw.slice(1, end), caption: raw.slice(end + 1).trim() };
  }
  const space = raw.indexOf(' ');
  if (space === -1) return { file: raw, caption: '' };
  return { file: raw.slice(0, space), caption: raw.slice(space + 1).trim() };
}

async function simulateMedia(kind, rest) {
  const { file, caption } = splitPathAndCaption(rest);
  let target = file;
  if (!target && kind === 'audio') target = VOICE_FIXTURE;
  if (!target) {
    console.log(c('yellow', '  uso: /imagen <ruta del archivo> [pie de foto]'));
    return;
  }
  const full = path.resolve(target);
  if (!fs.existsSync(full)) {
    console.log(c('yellow', `  no encuentro el archivo: ${full}`));
    return;
  }
  const buffer = fs.readFileSync(full);
  const mime = mimeFor(full, kind);
  const seconds = kind === 'audio' ? Math.max(1, Math.round(buffer.length / 4000)) : 0;
  await deliver({
    text: caption,
    label: kind === 'audio' ? `[nota de voz de ${seconds}s]` : `[foto${caption ? `: ${caption}` : ''}]`,
    media: { kind, mime, size: buffer.length, seconds, download: async () => buffer }
  });
}

async function main() {
  await memory.init();
  ajustes.aplicarTodos();
  resetTransientState();
  memory.setSetting('group_jid', SIM_JID); // simulate an already linked group
  memory.setSetting('group_name', 'Grupo de prueba');
  mediaStore.ensureDirs();

  const health = await ping();
  if (!health.ok) {
    console.log(c('yellow', '\n  Aviso: Ollama no responde. El bot funcionara a medias (solo reglas).\n'));
  }

  banner();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: c('dim', '> ') });
  rl.prompt();

  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text) return rl.prompt();

    if (text.startsWith('/')) {
      const [cmd, ...rest] = text.slice(1).split(' ');
      switch (cmd.toLowerCase()) {
        case 'salir':
        case 'exit':
        case 'q':
          memory.close();
          rl.close();
          process.exit(0);
          break;
        case 'yo': {
          const name = rest.join(' ').trim();
          if (name) senderName = name;
          console.log(c('dim', `  (ahora escribes como ${senderName})`));
          break;
        }
        case 'dueno':
        case 'dueño':
          comoDueno = !comoDueno;
          console.log(
            c('dim', `  (ahora escribes ${comoDueno ? 'COMO EL DUEÑO: puedes tocar los ajustes' : 'como un alumno normal'})`)
          );
          break;
        case 'privado':
        case 'dm':
          enPrivado = !enPrivado;
          console.log(c('dim', `  (ahora escribes ${enPrivado ? 'POR PRIVADO' : 'en el grupo'})`));
          break;
        case 'imagen':
        case 'foto':
          await simulateMedia('image', rest.join(' '));
          break;
        case 'audio':
        case 'voz':
          await simulateMedia('audio', rest.join(' '));
          break;
        case 'ver':
          showEntries();
          break;
        case 'archivos':
          showFiles();
          break;
        case 'limpiar': {
          const result = mediaStore.cleanup();
          console.log(c('dim', `  limpieza: ${mediaStore.summarizeCleanup(result)}`));
          break;
        }
        case 'vincular':
          memory.setSetting('group_jid', SIM_JID);
          memory.setSetting('group_name', 'Grupo de prueba');
          console.log(c('dim', '  (grupo vinculado: el bot vuelve a escuchar aquí)'));
          break;
        case 'desvincular':
          memory.setSetting('group_jid', null);
          memory.setSetting('group_name', null);
          console.log(c('dim', '  (grupo desvinculado: el bot deja de escuchar aquí)'));
          break;
        case 'borrar':
          mediaStore.wipeAll();
          memory.wipeEntries();
          console.log(c('dim', '  (memoria y archivos borrados)'));
          break;
        case 'hoy':
          console.log(c('dim', `  ${describeToday()}`));
          break;
        case 'ayuda':
        case 'help':
          help();
          break;
        default:
          console.log(c('dim', '  comando desconocido, prueba /ayuda'));
      }
      return rl.prompt();
    }

    rl.pause();
    await deliver({ text });
    rl.resume();
    rl.prompt();
  });

  rl.on('close', () => {
    memory.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('No se pudo arrancar el simulador:', err.message);
  process.exitCode = 1;
});
