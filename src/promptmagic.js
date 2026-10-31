// Mejorador de prompts para Stable Diffusion (local).
// Traduce y enriquece el prompt del usuario a inglés, que entiende mucho mejor SD 1.5.
import { chat } from './ollama.js';
import { config } from './config.js';
import { log } from './logger.js';

const SYSTEM_PROMPT = `You rewrite a user's image request (usually in Spanish) into a clear, visually specific English prompt for Stable Diffusion 1.5.

Rules:
- Output ONLY one prompt, without quotes, markdown, explanations or line breaks.
- Translate the full request into natural English. Keep all requested objects, attributes, actions and relationships.
- Put the main subject and action first, followed by requested setting, style, composition and lighting.
- Use concrete visual language and useful details from the request; make the described subject, pose and scene easy to picture.
- Never replace, omit or contradict the requested subject. "Un pingüino rojo" means a red penguin.
- Do not invent people, objects, animals, colors, actions, locations or a style that the user did not request.
- If composition or lighting is not specified, keep it neutral instead of inventing a new scene.
- If not drawable, translate literally and neutrally.
- Keep the prompt concise, with a maximum of about 70 words.`;

const QUALITY_TAGS = ['high quality', 'highly detailed', 'balanced composition', 'sharp focus'];

/** Añade etiquetas visuales compatibles con SD 1.5 sin cambiar el contenido pedido. */
export function prepararPromptImagen(texto) {
  const prompt = String(texto || '').trim();
  if (!prompt) return '';
  const existing = prompt.toLowerCase();
  const missing = QUALITY_TAGS.filter((tag) => !existing.includes(tag));
  return missing.length ? `${prompt}, ${missing.join(', ')}` : prompt;
}

/**
 * Mejora un prompt de imagen: traduce a inglés y lo hace más efectivo.
 * Si falla por cualquier razón, devuelve el prompt original intacto.
 * @param {string} texto
 */
export async function mejorarPrompt(texto) {
  const prompt = String(texto || '').trim();
  if (!prompt) return prompt;
  try {
    const answer = await chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      {
        model: config.ollamaModel,
        temperature: 0.2,
        numPredict: 512,
        numCtx: 2048,
        timeoutMs: 60000
      }
    );
    let improved = String(answer || '').trim();
    if (!improved) return prompt;
    // Quita comillas típicas si el modelo las mete por error.
    improved = improved.replace(/^["']|["']$/g, '').trim();
    // Limita longitud razonable.
    if (improved.length > 800) improved = improved.slice(0, 800);
    log.info(`Prompt mejorado (${prompt.length}->${improved.length}): "${prompt.slice(0, 60)}..." -> "${improved.slice(0, 60)}..."`);
    return improved;
  } catch (err) {
    log.warn(`No se pudo mejorar el prompt: ${err.message}`);
    return prompt;
  }
}