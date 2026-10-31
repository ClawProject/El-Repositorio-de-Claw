// Resúmenes de lo que se ha hablado en el grupo.
//
// - Automatico: los domingos por la tarde, el bot cuenta lo importante de la semana.
// - A mano: "!claw resumen" o "!claw resumen semana".
import { config } from './config.js';
import { log } from './logger.js';
import { chat } from './ollama.js';
import * as memory from './memory.js';
import { todayISO, addDays } from './dates.js';

/** Junta los mensajes y le pide a la IA un resumen corto y útil. */
async function resumir({ chatJid, desde, hasta, etiqueta }) {
  const mensajes = memory.messagesSince(chatJid, new Date(desde).toISOString(), config.summaryMaxMessages);
  if (mensajes.length < 3) return null;

  const transcripcion = mensajes
    .map((m) => `${m.author || 'alguien'}: ${String(m.text || '').replace(/\s+/g, ' ').slice(0, 300)}`)
    .join('\n');

  const sistema = [
    'Eres el resumen de un grupo de WhatsApp de un instituto (2º de la ESO, en España).',
    'Recibes mensajes sueltos y devuelves un resumen BREVE en español, en viñetas.',
    'Céntrate en: deberes mandados, exámenes y fechas, trabajos y entregas, y avisos importantes.',
    'Ignora el saludo, las bromas y las conversaciones sin importancia.',
    'No inventes nada que no esté en los mensajes. Si no hay nada relevante, dilo en una línea.',
    'No repitas insultos ni tacos aunque aparezcan en los mensajes, y no faltes al respeto a nadie.',
    'Formato: máximo 6 viñetas, cada una empieza por "• ". Sin títulos ni texto extra.'
  ].join(' ');

  const usuario = `Estos son los mensajes de ${etiqueta}:\n\n${transcripcion}`;

  try {
    const texto = await chat(
      [
        { role: 'system', content: sistema },
        { role: 'user', content: usuario }
      ],
      { temperature: 0.3, numPredict: 350 }
    );
    const limpio = String(texto || '').trim();
    return limpio || null;
  } catch (err) {
    log.warn(`No pude hacer el resumen: ${err.message}`);
    return null;
  }
}

/** Resumen de los últimos `dias` días. Devuelve el texto listo para WhatsApp. */
export async function resumenDeDias(chatJid, dias = 7) {
  const hasta = todayISO();
  const desde = addDays(hasta, -(dias - 1));
  const etiqueta = dias <= 1 ? 'hoy' : `los últimos ${dias} días`;
  const cuerpo = await resumir({ chatJid, desde, hasta, etiqueta });
  if (!cuerpo) return null;
  return [`🗒️ *Resumen de ${etiqueta}* (${desde} → ${hasta})`, '', cuerpo].join('\n');
}

/** Resumen semanal automático. */
export async function resumenSemanal(chatJid) {
  return resumenDeDias(chatJid, 7);
}

/** ¿Toca mandar ya el resumen semanal? (domingo por la tarde, por defecto). */
export function tocaResumenSemanal(now = new Date(), ultimo = null) {
  if (!config.summaryEnabled) return false;
  if (now.getDay() !== config.summaryDay) return false;
  if (now.getHours() < config.summaryHour) return false;
  const hoy = todayISO(now);
  return ultimo !== hoy;
}
