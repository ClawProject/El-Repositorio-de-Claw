// Own chess engine (minimax with alpha-beta pruning).
//
// Why does this exist? Before, to move, we asked the text AI (a 3B model) to
// choose among the legal moves. Such a small model cannot play chess: it picked
// moves at random and kept moving the knight from h6 to g4 and back ("impossible
// to play"). Now the AI only comments on the game; the moves are decided by this
// engine, which is fast and plays with judgement: material, piece placement,
// captures and mates.
//
// It is not Stockfish, but for a class group it is more than enough.

/** Material value in centipawns. */
const VALOR = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Piece-square tables. They are written "as the board is seen": index 0 is a8
// and 63 is h1. For Black they are mirrored.
const PST = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20
  ]
};

/** A mate is worth more than any material, and the sooner the better. */
export const VALOR_MATE = 100000;

/** Position value from the point of view of the side to move. */
export function evaluarLado(game) {
  let blancas = 0;
  const board = game.board();
  for (let f = 0; f < 8; f++) {
    for (let c = 0; c < 8; c++) {
      const pieza = board[f][c];
      if (!pieza) continue;
      // For White the table is used as is; for Black, flipped.
      const idx = pieza.color === 'w' ? f * 8 + c : (7 - f) * 8 + c;
      const valor = VALOR[pieza.type] + PST[pieza.type][idx];
      blancas += pieza.color === 'w' ? valor : -valor;
    }
  }
  return game.turn() === 'w' ? blancas : -blancas;
}

/** Prioritises captures (MVV-LVA), promotions and checks, to prune sooner. */
function ordenar(movs) {
  return movs
    .map((m) => {
      let p = 0;
      if (m.captured) p += 10000 + VALOR[m.captured] * 10 - VALOR[m.piece];
      if (m.promotion) p += 9000 + VALOR[m.promotion];
      if (m.san.includes('+')) p += 500;
      if (m.san.includes('#')) p += 100000;
      return { m, p: p + Math.random() };
    })
    .sort((a, b) => b.p - a.p)
    .map((x) => x.m);
}

function negamax(game, prof, alfa, beta, ctx) {
  ctx.nodos++;
  if (ctx.nodos > ctx.maxNodos) {
    ctx.abortado = true;
    return 0;
  }
  if ((ctx.nodos & 1023) === 0 && Date.now() > ctx.fin) {
    ctx.abortado = true;
    return 0;
  }

  if (game.isCheckmate()) return -VALOR_MATE + (ctx.profMax - prof);
  if (game.isDraw() || game.isStalemate()) return 0;
  if (prof === 0) return evaluarLado(game);

  let mejor = -Infinity;
  for (const m of ordenar(game.moves({ verbose: true }))) {
    game.move(m.san);
    const v = -negamax(game, prof - 1, -beta, -alfa, ctx);
    game.undo();
    if (ctx.abortado) return mejor === -Infinity ? 0 : mejor;
    if (v > mejor) mejor = v;
    if (v > alfa) alfa = v;
    if (alfa >= beta) break; // prune
  }
  return mejor;
}

/**
 * Picks the best move with iterative deepening.
 * @param {import('chess.js').Chess} game
 * @param {{tiempoMaxMs?:number, maxProfundidad?:number}} opciones
 * @returns {object|null} move (a chess.js verbose move object)
 */
export function eligeJugada(game, { tiempoMaxMs = 1200, maxProfundidad = 4 } = {}) {
  const legales = game.moves({ verbose: true });
  if (!legales.length) return null;
  if (legales.length === 1) return legales[0];

  const ctx = {
    nodos: 0,
    maxNodos: 400000,
    fin: Date.now() + Math.max(80, tiempoMaxMs),
    abortado: false,
    profMax: 1
  };

  let mejor = legales[0];
  for (let prof = 1; prof <= maxProfundidad; prof++) {
    ctx.profMax = prof;
    ctx.abortado = false;
    ctx.nodos = 0;

    const movs = ordenar(legales);
    // Whatever worked in the previous iteration is tried first.
    const i = movs.findIndex((m) => m.san === mejor.san);
    if (i > 0) movs.unshift(movs.splice(i, 1)[0]);

    let alfa = -Infinity;
    let localMejor = null;
    let localPuntos = -Infinity;
    for (const m of movs) {
      game.move(m.san);
      let v = -negamax(game, prof - 1, -Infinity, -alfa, ctx);
      // Shuffling: repeating a position three times is almost never interesting.
      if (game.isThreefoldRepetition()) v -= 60;
      game.undo();
      if (ctx.abortado) break;
      if (v > localPuntos) {
        localPuntos = v;
        localMejor = m;
      }
      if (v > alfa) alfa = v;
    }

    if (localMejor && !ctx.abortado) mejor = localMejor;
    if (ctx.abortado) break;
    if (localPuntos >= VALOR_MATE - 1000) break; // mate found
    if (Date.now() > ctx.fin) break;
  }

  return mejor;
}
