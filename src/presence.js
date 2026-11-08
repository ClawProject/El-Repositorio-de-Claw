// Immediate WhatsApp signals: the "typing…" state and standalone messages.
//
// They make it visible that the bot is still working when a task takes a while
// (for example, drawing an image: it can take over a minute and, without these
// signals, it looks like it has hung).
//
// `whatsapp.js` registers its send functions here and the router uses them when
// it wants, without depending directly on the connection (and without importing
// `whatsapp.js` from the router, which would create an odd import cycle).

let enviar = null;
let enviarTexto = null;
const latidos = new Map();

/** WhatsApp registers here how to send the signal (or `null` on disconnect). */
export function usarEnvio(fn) {
  enviar = typeof fn === 'function' ? fn : null;
  if (!enviar) {
    for (const t of latidos.values()) clearInterval(t);
    latidos.clear();
  }
}

/** WhatsApp registers here how to send a standalone message (or `null` on disconnect). */
export function usarEnvioTexto(fn) {
  enviarTexto = typeof fn === 'function' ? fn : null;
}

/**
 * Sends a standalone message right away, without waiting for the router to
 * finish. It is meant for slow tasks (for example, generating an image). It
 * never throws: returns `false` when no send channel is available.
 */
export function avisarTexto(chatJid, texto) {
  if (!chatJid || !texto || !enviarTexto) return false;
  try {
    const r = enviarTexto(chatJid, texto);
    if (r && typeof r.catch === 'function') r.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Shows (or clears) the "typing…" state in a chat. While active it refreshes it
 * every few seconds, because WhatsApp clears it by itself after a while.
 * It never throws: this is only a decoration and cannot break anything.
 */
export function escribiendo(chatJid, activo = true) {
  if (!chatJid) return;

  const anterior = latidos.get(chatJid);
  if (anterior) {
    clearInterval(anterior);
    latidos.delete(chatJid);
  }
  if (!enviar) return;

  const manda = () => {
    if (!enviar) return;
    try {
      const r = enviar(chatJid, activo ? 'composing' : 'paused');
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch {
      /* ignore */
    }
  };

  manda();
  if (activo) {
    const t = setInterval(manda, 5000);
    t.unref?.();
    latidos.set(chatJid, t);
  }
}

/** Is any signal running? (for tests) */
export function avisando(chatJid) {
  return latidos.has(chatJid);
}
