// Web search with DuckDuckGo (no dependencies: it uses fetch).
//
// CAREFUL: this DOES go to the internet, but only when needed: when someone
// explicitly asks for a search ("!claw busca ...") or when the question asks
// for current information (news, prices, results...). The rest of the time the
// bot stays 100% local and sends nothing out.
import { log } from './logger.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const DDG_HTML = 'https://html.duckduckgo.com/html/';
const DDG_LITE = 'https://lite.duckduckgo.com/lite/';
const DDG_API = 'https://api.duckduckgo.com/';

function sinAcentos(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Words that indicate the question asks for something worth checking online.
// Be careful not to overdo it: only things that really change (news, prices,
// weather, sports results...). Words like "hoy" or "resultado" on their own
// would give too many false positives and the bot would go online needlessly.
const RE_BUSCAR =
  /\b(busca|buscame|buscar|busquemos|googlea|google|internet|en la web|en internet|noticias|actualidad|ultima hora|quien gano|quien va ganando|marcador|clasificacion|resultado del|resultado de la|resultados del|precio|cuanto cuesta|cuanto vale|a como esta|clima|temperatura|tiempo que hace|cotizacion|bitcoin|dolar|euro esta|tipo de cambio|inflacion|cartelera|taquilla|estreno de|horario de)\b/;

/** Does this question ask for information worth searching online? */
export function necesitaBuscar(texto) {
  return RE_BUSCAR.test(sinAcentos(texto));
}

function quitarHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Turns a DuckDuckGo link (//duckduckgo.com/l/?uddg=...) into the real URL. */
function urlReal(href) {
  let h = String(href || '');
  const m = h.match(/[?&]uddg=([^&]+)/);
  if (m) {
    try {
      h = decodeURIComponent(m[1]);
    } catch {
      /* leave it as is */
    }
  }
  if (h.startsWith('//')) h = `https:${h}`;
  return h;
}

function parsearHtml(html, max) {
  const out = [];
  const titulos = [
    ...String(html).matchAll(
      /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    )
  ];
  const snippets = [
    ...String(html).matchAll(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g)
  ];
  titulos.forEach((m, i) => {
    const url = urlReal(m[1]);
    const title = quitarHtml(m[2]);
    const snippet = snippets[i] ? quitarHtml(snippets[i][1]) : '';
    if (title && url && !/duckduckgo\.com\/y\.js/.test(url)) out.push({ title, url, snippet });
  });
  return out.slice(0, max);
}

function parsearLite(html, max) {
  const out = [];
  const links = [
    ...String(html).matchAll(
      /<a[^>]*href="([^"]+)"[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/g
    )
  ];
  const snippets = [
    ...String(html).matchAll(/<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/g)
  ];
  links.forEach((m, i) => {
    const url = urlReal(m[1]);
    const title = quitarHtml(m[2]);
    const snippet = snippets[i] ? quitarHtml(snippets[i][1]) : '';
    if (title && url) out.push({ title, url, snippet });
  });
  return out.slice(0, max);
}

function parsearInstant(data, max) {
  const out = [];
  if (!data) return out;
  if (data.Answer) out.push({ title: 'Respuesta', url: '', snippet: quitarHtml(data.Answer) });
  if (data.AbstractText) {
    out.push({
      title: quitarHtml(data.Heading || 'Resumen'),
      url: data.AbstractURL || '',
      snippet: quitarHtml(data.AbstractText)
    });
  }
  const push = (t) => {
    if (t?.Text && t?.FirstURL) {
      const texto = quitarHtml(t.Text);
      out.push({ title: texto.slice(0, 90), url: t.FirstURL, snippet: texto });
    }
  };
  for (const t of data.RelatedTopics || []) {
    if (Array.isArray(t.Topics)) t.Topics.forEach(push);
    else push(t);
  }
  return out.slice(0, max);
}

/** Recognises both formats (html and lite) so it can be tested without network. */
export function parsearResultadosDDG(html, max = 6) {
  const text = String(html || '');
  if (text.includes('result__a')) return parsearHtml(text, max);
  if (text.includes('result-link')) return parsearLite(text, max);
  return [];
}

async function pedir(url, opts = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Searches DuckDuckGo. Returns [{title, url, snippet}] (possibly empty).
 * It tries the HTML search, then "lite" and, if everything fails, the instant
 * answers API. It never throws: with no network it returns [].
 */
export async function buscarWeb(consulta, { max = 5, timeoutMs = 8000 } = {}) {
  const q = String(consulta || '').trim();
  if (!q) return [];

  // 1) HTML search (POST, the one that returns real results best).
  try {
    const res = await pedir(
      DDG_HTML,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': UA,
          accept: 'text/html'
        },
        body: new URLSearchParams({ q, kl: 'es-es' }).toString()
      },
      timeoutMs
    );
    if (res.ok) {
      const r = parsearResultadosDDG(await res.text(), max);
      if (r.length) return r;
    }
  } catch (err) {
    log.warn(`DuckDuckGo (html) fallo: ${err.message}`);
  }

  // 2) Lightweight version (GET).
  try {
    const res = await pedir(
      `${DDG_LITE}?q=${encodeURIComponent(q)}&kl=es-es`,
      { headers: { 'user-agent': UA, accept: 'text/html' } },
      timeoutMs
    );
    if (res.ok) {
      const r = parsearResultadosDDG(await res.text(), max);
      if (r.length) return r;
    }
  } catch (err) {
    log.warn(`DuckDuckGo (lite) fallo: ${err.message}`);
  }

  // 3) Instant answers API (no scraping).
  try {
    const res = await pedir(
      `${DDG_API}?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { 'user-agent': UA, accept: 'application/json' } },
      timeoutMs
    );
    if (res.ok) return parsearInstant(await res.json(), max);
  } catch (err) {
    log.warn(`DuckDuckGo (API) fallo: ${err.message}`);
  }

  return [];
}
