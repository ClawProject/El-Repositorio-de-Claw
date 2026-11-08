// Claw's chess mode: play games, analyse positions (FEN or photo) and talk
// like a grandmaster.
//
// All the heavy logic (rules, legal moves, board) comes from chess.js; the
// MOVES are decided by our own engine (chessengine.js: minimax with pruning),
// because the 3B text AI played at random. The AI only comments on the game. If
// the engine failed, there is a simple fallback heuristic: the mode never breaks.
import { log } from './logger.js';
import { chat } from './ollama.js';
import * as memory from './memory.js';
import { config } from './config.js';
import { eligeJugada as motorEligeJugada } from './chessengine.js';
import { Chess } from 'chess.js';

// ---------------------------------------------------------------- board

const GLIFOS = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};
const LETRAS = { k: 'rey', q: 'dama', r: 'torre', b: 'alfil', n: 'caballo', p: 'peón' };

/** Board as text, WhatsApp style. */
export function tableroTexto(game) {
  const board = game.board();
  const filas = [];
  for (let i = 0; i < 8; i++) {
    const fila = board[i].map((c) => (c ? GLIFOS[c.color][c.type] : '·')).join(' ');
    filas.push(`${8 - i} ${fila}`);
  }
  filas.push('  a b c d e f g h');
  return filas.join('\n');
}

/** Piece on a square, for comments ("the knight on f3"). */
export function piezaEn(game, casilla) {
  const p = game.get(casilla);
  if (!p) return null;
  return { nombre: LETRAS[p.type], color: p.color === 'w' ? 'blancas' : 'negras' };
}

// ---------------------------------------------------------------- games

const PARTIDAS = new Map(); // chatJid -> {game, colorUsuario, movimientos}

function guarda(chatJid, estado) {
  PARTIDAS.set(chatJid, estado);
  try {
    memory.setSetting(
      `chess:${chatJid}`,
      JSON.stringify({ fen: estado.game.fen(), colorUsuario: estado.colorUsuario, mov: estado.movimientos })
    );
  } catch {
    /* the chess mode does not depend on persisting */
  }
  return estado;
}

/** Restores a saved game (in case the bot restarted). */
export function carga(chatJid) {
  if (PARTIDAS.has(chatJid)) return PARTIDAS.get(chatJid);
  try {
    const raw = memory.getSetting(`chess:${chatJid}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const game = new Chess();
    game.load(data.fen);
    const estado = { game, colorUsuario: data.colorUsuario || 'w', movimientos: data.mov || [] };
    PARTIDAS.set(chatJid, estado);
    return estado;
  } catch {
    return null;
  }
}

/** Starts a game (by default the user plays White). */
export function empieza(chatJid, { colorUsuario = 'w' } = {}) {
  const game = new Chess();
  const movimientos = [];
  if (colorUsuario === 'b') {
    // Claw plays White: opens with something reasonable.
    const apertura = ['e4', 'd4', 'Nf3', 'c4', 'g3'];
    const m = game.move(apertura[Math.floor(Math.random() * apertura.length)]);
    movimientos.push(m.san);
  }
  const estado = { game, colorUsuario, movimientos };
  return guarda(chatJid, estado);
}

export function partida(chatJid) {
  return PARTIDAS.get(chatJid) || carga(chatJid);
}

export function borraPartida(chatJid) {
  PARTIDAS.delete(chatJid);
  try {
    memory.setSetting(`chess:${chatJid}`, null);
  } catch {
    /* does not matter */
  }
}

/** Is it a move like "e4", "Nf3", "O-O", "e2e4"? */
export function esJugada(texto) {
  const t = String(texto || '').trim();
  if (!t || t.length > 12) return false;
  return /^[a-hKQRBNO0-8x+#=\-\s]+$/i.test(t) && /[a-hKQRBNO0-9]/i.test(t);
}

/** Applies a move text (SAN or UCI style) to the board. */
function aSan(game, texto) {
  const t = String(texto || '').trim();
  try {
    const m = game.move(t, { strict: false });
    if (m) return m;
  } catch {
    /* it was not SAN */
  }
  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(t)) {
    try {
      return game.move({ from: t.slice(0, 2), to: t.slice(2, 4), promotion: t[4] || undefined });
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Moves the user's piece.
 * @returns {{ok:boolean, texto?:string, gameOver?:boolean, error?:string}}
 */
export function mueve(chatJid, texto) {
  const estado = PARTIDAS.get(chatJid);
  if (!estado) return { ok: false, error: 'no-hay-partida' };
  const { game, colorUsuario } = estado;
  if (game.isGameOver()) return { ok: false, error: 'terminada', texto: finDePartida(game) };
  if (game.turn() !== colorUsuario) return { ok: false, error: 'no-es-tu-turno' };

  const mov = aSan(game, texto);
  if (!mov) return { ok: false, error: 'jugada-ilegal' };

  estado.movimientos.push(mov.san);
  guarda(chatJid, estado);
  if (game.isGameOver()) return { ok: true, texto: resumenTrasMovimiento(game, estado), gameOver: true };
  return { ok: true, texto: resumenTrasMovimiento(game, estado) };
}

function resumenTrasMovimiento(game, estado) {
  const nombreTurno = game.turn() === 'w' ? 'blancas' : 'negras';
  const soyYo = estado.colorUsuario === game.turn();
  const lineas = [
    `Jugada ${estado.movimientos.length}: *${estado.movimientos[estado.movimientos.length - 1]}*`,
    '',
    tableroTexto(game)
  ];
  if (game.isCheck()) lineas.push('', '⚠️ ¡Jaque!');
  lineas.push('', soyYo ? '▶️ Te toca. Dime tu jugada.' : `⏳ Mueven las ${nombreTurno} (Claw).`);
  return lineas.join('\n');
}

/** Claw picks its move. AI when possible; otherwise a decent heuristic. */
export async function jugadaDelBot(chatJid) {
  const estado = PARTIDAS.get(chatJid);
  if (!estado) return { ok: false };
  const { game } = estado;
  const legales = game.moves({ verbose: true });
  if (!legales.length) return { ok: false, error: 'fin' };

  let mov = null;
  try {
    mov = motorEligeJugada(game, { tiempoMaxMs: config.chessThinkMs });
  } catch (err) {
    log.debug(`Motor de ajedrez falló: ${err.message}`);
  }
  if (!mov) mov = elegirConHeuristica(game, legales);

  const jugada = game.move(mov.san);
  estado.movimientos.push(jugada.san);
  guarda(chatJid, estado);

  const gameOver = game.isGameOver();
  const lineas = [`🪝 Claw juega: *${jugada.san}*`, '', tableroTexto(game)];
  if (game.isCheck()) lineas.push('', '⚠️ ¡Jaque!');
  if (gameOver) lineas.push('', finDePartida(game));
  else lineas.push('', '▶️ Te toca. Dime tu jugada.');
  return { ok: true, texto: lineas.join('\n'), gameOver, san: jugada.san };
}

/** Emergency heuristic: it prefers captures, checks and the centre. */
function elegirConHeuristica(game, legales) {
  const VALOR = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const CENTRO = new Set(['d4', 'e4', 'd5', 'e5', 'c4', 'f4', 'c5', 'f5']);
  let mejor = legales[0];
  let mejorPuntos = -Infinity;
  for (const m of legales) {
    let puntos = Math.random() * 0.4; // a bit of variety
    if (m.captured) puntos += VALOR[m.captured] * 2 - VALOR[m.piece] * 0.3;
    if (m.promotion) puntos += 6;
    if (CENTRO.has(m.to)) puntos += 0.6;
    if (m.piece !== 'p' && ['b8', 'g8', 'c8', 'f8', 'b1', 'g1', 'c1', 'f1'].includes(m.from)) puntos += 0.5;
    game.move(m.san);
    if (game.isCheckmate()) puntos += 100;
    else if (game.isCheck()) puntos += 2;
    game.undo();
    if (puntos > mejorPuntos) {
      mejorPuntos = puntos;
      mejor = m;
    }
  }
  return mejor;
}

/** Final diagnosis of the game. */
export function finDePartida(game) {
  if (game.isCheckmate()) {
    const ganaBlancas = game.turn() === 'b';
    return `🏁 *¡Jaque mate!* Ganan las ${ganaBlancas ? 'blancas' : 'negras'}.`;
  }
  if (game.isStalemate()) return '🏁 *Tablas por ahogado.* Buen juego.';
  if (game.isThreefoldRepetition()) return '🏁 *Tablas por repetición.*';
  if (game.isInsufficientMaterial()) return '🏁 *Tablas por material insuficiente.*';
  if (game.isDraw()) return '🏁 *Tablas.*';
  return '🏁 La partida ha terminado.';
}

// ---------------------------------------------------------------- analysis

export const FEN_RE = /([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+\s+[wb]\s+(K?Q?k?q?|-)\s+([a-h][1-8]|-)\s+\d+\s+\d+/;

/** Extracts a FEN from a text, if there is one. */
export function extraeFen(texto) {
  const m = FEN_RE.exec(String(texto || ''));
  if (!m) return null;
  const completo = m[0].replace(/\s+/g, ' ').trim();
  try {
    return new Chess(completo).fen();
  } catch {
    return completo;
  }
}

/** Static value of the position, so the "grandmaster" can comment on it. */
export function evaluar(game) {
  const VALOR = { p: 1, n: 3.1, b: 3.3, r: 5, q: 9, k: 0 };
  let material = 0;
  for (const fila of game.board()) {
    for (const c of fila) {
      if (!c) continue;
      material += c.color === 'w' ? VALOR[c.type] : -VALOR[c.type];
    }
  }
  const movilidadBlancas = game.turn() === 'w' ? game.moves().length : movilidadDe(game, 'w');
  const movilidadNegras = game.turn() === 'b' ? game.moves().length : movilidadDe(game, 'b');
  return { material, movilidadBlancas, movilidadNegras };
}

/** Number of legal moves for one side, switching the turn in the FEN. */
function movilidadDe(game, color) {
  try {
    const fen = game.fen().replace(/^(\S+) \S+ (.*)$/, `$1 ${color} $2`);
    return new Chess(fen).moves().length;
  } catch {
    return 0;
  }
}

/** Analysis of a position (FEN) in a grandmaster tone. */
export function analiza(fen) {
  let game;
  try {
    game = new Chess(fen);
  } catch {
    return '🤔 Ese FEN no me cuadra: revísalo y mándamelo otra vez.';
  }
  const { material, movilidadBlancas, movilidadNegras } = evaluar(game);
  const lineas = ['♟ *Posición analizada*'];

  if (game.isCheckmate()) {
    return [lineas[0], '', '¡Es *jaque mate*! La partida ya está decidida.'].join('\n');
  }
  if (game.isStalemate()) {
    return [lineas[0], '', 'Esto es *tablas por ahogado*: no hay jugadas legales.'].join('\n');
  }

  const ventaja =
    material > 1.5
      ? 'las blancas mandan'
      : material < -1.5
        ? 'las negras mandan'
        : 'la posición está equilibrada';
  const materialTxt =
    Math.abs(material) < 0.5
      ? 'igualdad'
      : material > 0
        ? `+${material.toFixed(1)} para las blancas`
        : `+${(-material).toFixed(1)} para las negras`;

  lineas.push(
    '',
    `*Material:* ${materialTxt}.`,
    `*Movilidad:* ${n(movilidadBlancas)} jugadas blancas, ${n(movilidadNegras)} negras.`,
    `*Sensación:* ${ventaja}.`
  );
  if (game.inCheck()) {
    const turno = game.turn() === 'w' ? 'blancas' : 'negras';
    lineas.push(`*¡Jaque al rey de las ${turno}!*`);
  }
  lineas.push(
    '',
    Math.abs(material) < 0.5
      ? 'Aquí todo se decide por detalles: desarrollo, casillas fuertes y paciencia.'
      : 'La ventaja material no basta: hay que activar piezas y no regalar contrajuego.',
    '',
    'Si quieres, jugamos:  _!claw ajedrez_'
  );
  return lineas.join('\n');
}

function n(x) {
  return Number.isFinite(x) && x > 0 ? String(x) : '—';
}

/** Short grandmaster comment about the current game. */
export async function comentarioGM(chatJid) {
  const estado = PARTIDAS.get(chatJid);
  if (!estado) return '';
  try {
    const messages = [
      {
        role: 'system',
        content:
          'Eres un gran maestro de ajedrez comentando una partida en WhatsApp. Una sola frase, en español, con personalidad de maestro veterano. Máximo 160 caracteres. Nunca insultes ni faltes al respeto: comenta el ajedrez, no a las personas.'
      },
      { role: 'user', content: `FEN: ${estado.game.fen()}\nJugadas: ${estado.movimientos.slice(-8).join(' ')}` }
    ];
    const r = await chat(messages, { temperature: 0.6, numPredict: 60, numCtx: 2048, timeoutMs: 5000 });
    return String(r || '').trim().slice(0, 200);
  } catch {
    return '';
  }
}

/** Detects that people want to play/analyse chess (for Claw mode). */
export function mencionaAjedrez(texto) {
  const t = String(texto || '').toLowerCase();
  return /\bajedrez\b|\bfen\b|\btablero\b/.test(t);
}
