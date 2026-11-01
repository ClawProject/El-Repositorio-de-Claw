// Avisos inmediatos en WhatsApp: el "está escribiendo…" y mensajes sueltos.
//
// Sirven para que se vea que el bot sigue trabajando cuando una tarea tarda
// (por ejemplo, dibujar una imagen: puede tardar más de un minuto y, sin estos
// avisos, parece que se ha quedado colgado).
//
// `whatsapp.js` nos deja aquí sus formas de mandar el aviso y el router las usa
// cuando quiere, sin depender directamente de la conexión (y sin importar
// `whatsapp.js` desde el router, que daría un ciclo raro de imports).

let enviar = null;
let enviarTexto = null;
const latidos = new Map();

/** WhatsApp nos deja aquí cómo mandar el aviso (o `null` al desconectar). */
export function usarEnvio(fn) {
  enviar = typeof fn === 'function' ? fn : null;
  if (!enviar) {
    for (const t of latidos.values()) clearInterval(t);
    latidos.clear();
  }
}

/** WhatsApp nos deja aquí cómo mandar un mensaje suelto (o `null` al desconectar). */
export function usarEnvioTexto(fn) {
  enviarTexto = typeof fn === 'function' ? fn : null;
}

/**
 * Manda un mensaje suelto ya, sin esperar a que el router termine. Sirve para
 * avisar de tareas lentas (por ejemplo, generar una imagen). Nunca lanza:
 * devuelve `false` si no hay un canal de envío disponible.
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
 * Muestra (o quita) el "escribiendo…" en un chat. Mientras está activo lo
 * refresca cada pocos segundos, porque WhatsApp lo borra solo al rato.
 * Nunca lanza: esto es solo un adorno y no puede romper nada.
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
      /* da igual */
    }
  };

  manda();
  if (activo) {
    const t = setInterval(manda, 5000);
    t.unref?.();
    latidos.set(chatJid, t);
  }
}

/** ¿Hay algún aviso en marcha? (para los tests) */
export function avisando(chatJid) {
  return latidos.has(chatJid);
}
