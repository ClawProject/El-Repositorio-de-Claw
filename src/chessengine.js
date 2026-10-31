// Motor de ajedrez propio (minimax con poda alfa-beta).
//
// ¿Por qué existe esto? Antes, para mover, le pedíamos a la IA de texto (un
// modelo de 3B) que eligiera entre las jugadas legales. Un modelo tan pequeño
// es incapaz de jugar al ajedrez: elegía jugadas al azar y se dedicaba a mover
// el caballo de h6 a g4 y vuelta ("es imposible de jugar"). Ahora la IA solo
// comenta la partida; las jugadas las decide este motor, que es rápido y juega
// con criterio: material, posición de las piezas, capturas y mates.
//
// No es Stockfish, pero para un grupo de clase va sobrado.

/** Valor material en centipeones. */
const VALOR = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Tablas de casillas (piece-square tables). Van escritas "como se ve el
// tablero": el índice 0 es a8 y el 63 es h1. Para las negras se reflejan.
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

/** Un mate vale más que cualquier material, y cuanto antes mejor. */
export const VALOR_MATE = 100000;

/** Valor de la posición desde el punto de vista de quien tiene el turno. */
export function evaluarLado(game) {
  let blancas = 0;
  const board = game.board();
  for (let f = 0; f < 8; f++) {
    for (let c = 0; c < 8; c++) {
      const pieza = board[f][c];
      if (!pieza) continue;
      // Para las blancas la tabla se usa tal cual; para las negras, del revés.
      const idx = pieza.color === 'w' ? f * 8 + c : (7 - f) * 8 + c;
      const valor = VALOR[pieza.type] + PST[pieza.type][idx];
      blancas += pieza.color === 'w' ? valor : -valor;
    }
  }
  return game.turn() === 'w' ? blancas : -blancas;
}

/** Prioriza capturas (MVV-LVA), promociones y jaques, para podar antes. */
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
    if (alfa >= beta) break; // poda
  }
  return mejor;
}

/**
 * Elige la mejor jugada con búsqueda en profundidad creciente.
 * @param {import('chess.js').Chess} game
 * @param {{tiempoMaxMs?:number, maxProfundidad?:number}} opciones
 * @returns {object|null} jugada (objeto verbose de chess.js)
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
    // Lo que funcionó en la vuelta anterior se prueba primero.
    const i = movs.findIndex((m) => m.san === mejor.san);
    if (i > 0) movs.unshift(movs.splice(i, 1)[0]);

    let alfa = -Infinity;
    let localMejor = null;
    let localPuntos = -Infinity;
    for (const m of movs) {
      game.move(m.san);
      let v = -negamax(game, prof - 1, -Infinity, -alfa, ctx);
      // "Bailoteo": repetir posición tres veces no nos interesa casi nunca.
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
    if (localPuntos >= VALOR_MATE - 1000) break; // mate encontrado
    if (Date.now() > ctx.fin) break;
  }

  return mejor;
}
