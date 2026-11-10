// Initial setup page: choosing the Claw language.
//
// It is served by the bot itself (GET /setup) and opens by itself the first
// time it starts. The language is stored in the database, so next time it does
// not ask again.
import { LANGUAGES, SOPORTADOS, idioma, t } from './i18n.js';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {{ sugerido?: string|null, actual?: string|null }} options
 * @returns {string} complete HTML
 */
export function setupPage({ sugerido = null, actual = null } = {}) {
  const elegido = actual || idioma();
  const idiomas = LANGUAGES.map((l) => {
    const marcado = l.code === elegido;
    const recomendado = SOPORTADOS.includes(l.code);
    const clases = ['lang'];
    if (marcado) clases.push('is-selected');
    if (recomendado) clases.push('is-recommended');
    return (
      `<button type="button" class="${clases.join(' ')}" data-code="${esc(l.code)}" ` +
      `data-search="${esc(`${l.code} ${l.name} ${l.en}`.toLowerCase())}" ` +
      `lang="${esc(l.code)}" role="option" aria-selected="${marcado ? 'true' : 'false'}">` +
      `<span class="lang-code">${esc(l.code)}</span>` +
      `<span class="lang-name">${esc(l.name)}</span>` +
      `<span class="lang-en">${esc(l.en)}</span>` +
      `</button>`
    );
  }).join('');

  const sugeridoValido = sugerido && LANGUAGES.some((l) => l.code === sugerido) ? sugerido : null;
  const preseleccion = elegido || sugeridoValido || 'es';

  return `<!doctype html>
<html lang="${esc(preseleccion)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#060806">
<title>${esc(t('setupTitle', {}, preseleccion))} — PickleBrain</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%23d7ff6b'/%3E%3Cg fill='none' stroke='%230a0f06' stroke-width='2.6' stroke-linecap='round'%3E%3Cpath d='M10.5 24.5c0-6.5 3-11.5 8-14'/%3E%3Cpath d='M16.5 25c0-5 2-9 6.5-11'/%3E%3Cpath d='M22 25.5c0-3 1.2-5.5 3.5-6.8'/%3E%3C/g%3E%3C/svg%3E">
<style>
  :root {
    color-scheme: dark;
    --bg: #060806;
    --card: #0d120c;
    --line: #20281d;
    --ink: #f3f5ee;
    --muted: #9aa392;
    --accent: #d7ff6b;
    --accent-ink: #0a0f06;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    background:
      radial-gradient(900px 500px at 50% -10%, rgba(215, 255, 107, .12), transparent 60%),
      var(--bg);
    color: var(--ink);
    font-family: Inter, "Segoe UI", system-ui, -apple-system, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px 96px;
  }
  .card {
    width: 100%;
    max-width: 880px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 24px;
    padding: 32px;
    box-shadow: 0 30px 80px rgba(0, 0, 0, .45);
  }
  .eyebrow {
    display: inline-block;
    font-size: 12px;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--accent);
    background: rgba(215, 255, 107, .1);
    border: 1px solid rgba(215, 255, 107, .25);
    padding: 6px 12px;
    border-radius: 999px;
    margin-bottom: 18px;
  }
  h1 { margin: 0 0 8px; font-size: clamp(26px, 5vw, 40px); letter-spacing: -.02em; }
  p.sub { margin: 0 0 24px; color: var(--muted); font-size: 15px; line-height: 1.5; }
  .search {
    width: 100%;
    padding: 14px 16px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: #080b07;
    color: var(--ink);
    font-size: 15px;
    outline: none;
    margin-bottom: 18px;
  }
  .search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(215, 255, 107, .15); }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 10px;
    max-height: 46vh;
    overflow-y: auto;
    padding: 4px 6px 4px 2px;
    scrollbar-width: thin;
    scrollbar-color: #2c3627 transparent;
  }
  .lang {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: #0a0f09;
    color: var(--ink);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: border-color .15s, background .15s, transform .15s;
  }
  .lang:hover { border-color: #3b4a33; background: #10160e; transform: translateY(-1px); }
  .lang.is-selected { border-color: var(--accent); background: rgba(215, 255, 107, .1); }
  .lang.is-recommended::after {
    content: "★";
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 11px;
    color: var(--accent);
    opacity: .8;
  }
  .lang-code { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
  .lang-name { font-size: 16px; font-weight: 600; line-height: 1.25; }
  .lang-en { font-size: 12px; color: var(--muted); }
  .empty { display: none; color: var(--muted); padding: 24px 4px; }
  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: 22px;
    flex-wrap: wrap;
  }
  .note { color: var(--muted); font-size: 13px; line-height: 1.45; flex: 1 1 260px; }
  .go {
    appearance: none;
    border: 0;
    border-radius: 14px;
    padding: 14px 26px;
    background: var(--accent);
    color: var(--accent-ink);
    font-family: inherit;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: filter .15s, transform .15s;
  }
  .go:hover { filter: brightness(1.06); transform: translateY(-1px); }
  .go:disabled { opacity: .6; cursor: wait; transform: none; }
  .error { color: #ff8f8f; font-size: 13px; min-height: 18px; margin-top: 10px; }
  @media (max-width: 560px) {
    .card { padding: 22px; border-radius: 18px; }
    .grid { max-height: 50vh; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
    .go { width: 100%; }
  }
</style>
</head>
<body>
  <main class="card">
    <span class="eyebrow">${esc(t('setupFirstRun', {}, preseleccion))}</span>
    <h1>${esc(t('setupTitle', {}, preseleccion))}</h1>
    <p class="sub">${esc(t('setupSubtitle', {}, preseleccion))}</p>

    <input id="search" class="search" type="search" autocomplete="off"
      placeholder="${esc(t('setupSearch', {}, preseleccion))}" aria-label="${esc(t('setupSearch', {}, preseleccion))}">

    <div id="grid" class="grid" role="listbox" aria-label="${esc(t('setupTitle', {}, preseleccion))}">
      ${idiomas}
    </div>
    <div id="empty" class="empty">${esc(t('setupNoResults', {}, preseleccion))}</div>

    <div class="footer">
      <span class="note">${esc(t('setupNote', {}, preseleccion))}<br>${esc(t('setupChangeLater', {}, preseleccion))}</span>
      <button id="go" class="go" type="button">${esc(t('setupButton', {}, preseleccion))}</button>
    </div>
    <div id="error" class="error" role="alert"></div>
  </main>

<script>
(function () {
  var selected = ${JSON.stringify(preseleccion)};
  var grid = document.getElementById('grid');
  var search = document.getElementById('search');
  var empty = document.getElementById('empty');
  var go = document.getElementById('go');
  var errorBox = document.getElementById('error');

  function choose(button) {
    var all = grid.querySelectorAll('.lang');
    for (var i = 0; i < all.length; i++) {
      all[i].classList.remove('is-selected');
      all[i].setAttribute('aria-selected', 'false');
    }
    button.classList.add('is-selected');
    button.setAttribute('aria-selected', 'true');
    selected = button.getAttribute('data-code');
    document.documentElement.lang = selected;
    errorBox.textContent = '';
  }

  grid.addEventListener('click', function (event) {
    var button = event.target.closest('.lang');
    if (button) choose(button);
  });

  search.addEventListener('input', function () {
    var q = search.value.trim().toLowerCase();
    var shown = 0;
    var all = grid.querySelectorAll('.lang');
    for (var i = 0; i < all.length; i++) {
      var match = !q || all[i].getAttribute('data-search').indexOf(q) !== -1;
      all[i].style.display = match ? '' : 'none';
      if (match) shown++;
    }
    empty.style.display = shown ? 'none' : 'block';
  });

  go.addEventListener('click', function () {
    go.disabled = true;
    errorBox.textContent = '';
    fetch('/api/setup/language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: selected })
    })
      .then(function (response) { return response.json().catch(function () { return {}; }).then(function (body) { return { ok: response.ok, body: body }; }); })
      .then(function (result) {
        if (!result.ok || !result.body.ok) throw new Error(result.body.error || 'Error');
        window.location.href = '/';
      })
      .catch(function (err) {
        go.disabled = false;
        errorBox.textContent = err.message || 'Error';
      });
  });

  search.focus();
})();
</script>
</body>
</html>`;
}
