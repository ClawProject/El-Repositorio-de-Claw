Claw is a WhatsApp bot with local AI that runs on the machine of whoever uses it, not on a server. There is no infrastructure, no account to configure and no deployment: if it works on your computer, it works.

Before you start
You need Node.js 22 or newer (24 LTS recommended), Git, and Ollama with the qwen3:4b and qwen2.5:3b models. Python 3.11/3.12 is optional: it only improves voice and images.

bash
Copy
npm install
cp .env.example .env
npm run doctor
To try things without WhatsApp or a phone: npm run sim. It is the fastest way to understand the router flow without risking a real session.

What never gets committed
.env: it holds emails, SMTP passwords and your phone number.
data/: WhatsApp session, SQLite database, photos, downloaded models.
.venv/, *.gguf, executables and binaries.
Do not paste credentials into an issue, a screenshot or a PR either. If your change touches security, check the debug access path (WEB_DEBUG_CODE, off by default) and the allowed origins list (WEB_ALLOWED_ORIGINS) while you are there.

Branches and pull requests
main is the published branch and the landing page is deployed from it. Commits have gone straight to it before, but branch + PR is the comfortable path, like the ones already merged:

feat/servicio-python-voz-imagenes
perf/triage-sin-nombres
Use clear prefixes (feat/, fix/, perf/, docs/) and a short lowercase description. One PR, one thing: if the change fits in a sentence, it belongs in one PR; if it needs two paragraphs, it is probably two.

In the PR, say what changes, why, and how you tested it. With the exact commands you ran, not with "it works".

Code style
JavaScript with ES modules, no bundler, no TypeScript, no transpiling. What you write is what runs.
Names and comments in Spanish, following what is already there (memory.js, normalizarJid, findPending). Comments explain the why, not the what: the code already says what it does.
Before adding a dependency, check whether the standard library can do it. .env is parsed by hand and web search scrapes DuckDuckGo's HTML precisely for that reason.
There is no linter or formatter configured: copy the style of the file you are editing (2 spaces, single quotes, semicolons).
Windows is the primary platform (paths, arrancar.bat, SetThreadExecutionState), but everything must keep working on Linux and macOS.
Tests
Before opening a PR, these should be green and they do not need Ollama:

bash
Copy
npm run test:web       # session, CORS, API, admin
npm run test:python    # Node <-> Python service contract
npm run test:subjects  # subject recognition
npm run test:vetados   # blocking numbers and @lid
npm test, npm run test:ai and npm run test:voice do require Ollama and downloaded models; use them if your change touches classification or conversation.

Two rules that have already bitten us:

No fixed dates in tests. A fixture dated 2026-11-02 made the suite fail on its own the next day. Compute relative dates.
If you change the Python contract, update test:python in the same PR. That is what stops the bot from going silent without saying why.
Documentation
Documentation exists in 10 languages: es, en, ca, fr, pt, de, it, ru, ar and zh, with README.<code>.md and INSTALL.<code>.md per language.

If you change an environment variable, a command or a requirement, update all ten versions and .env.example. Keep the link block at the top and make sure each README points to its own INSTALL.

CHANGELOG.md follows Keep a Changelog with semantic versioning, in Spanish, and new entries go under [Sin publicar] before a release.

Commits
Short message, one line. The history mixes English and Spanish: either is fine, as long as it is clear.
Before committing, look at git status and git diff. That is the only real barrier against pushing .env or data/.
Security
Never leave a known default value in .env.example for anything that grants access (the debug code is already off by default for exactly this reason).
Every new /api/* route requires a session and respects the allowed origin.
This project handles data about minors: do not move it off the machine, do not paste it into issues, and do not use it in examples.
Where help is needed
Persisting web sessions (today they live in memory and a restart logs every student out), adding CI with the offline tests, picking a license, and tuning VRAM usage when Ollama and the image engine share a small GPU.

