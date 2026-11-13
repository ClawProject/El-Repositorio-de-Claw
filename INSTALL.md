# Installing Claw

**English** · [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

Claw is a WhatsApp bot that runs on your own computer. It needs two things:
**Node.js** (the bot, the web panel and the database) and **Ollama** (the local AI).
Voice notes and image generation are **optional** and need a small Python service.

Every step below ends with a **Checkpoint**: if you see what it says, that step is
done and you can move on. If something does not match, jump to
[Problems and fixes](#problems-and-fixes).

---

## What you need

| Required | Version | What for |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 22 or later | Bot, web panel, database |
| [Ollama](https://ollama.com) | current version | Local text AI |
| [Git](https://git-scm.com) | any | Downloading and updating |
| Free disk space | ~6 GB | The two Ollama models |

| Optional | Version | What for |
| --- | --- | --- |
| Python | 3.11 or 3.12 | Voice transcription and image generation |
| ffmpeg | current version | Voice without Python |
| NVIDIA GPU | 4 GB of VRAM | Faster AI; the CPU also works |

It runs on Linux, macOS and Windows and needs about 8 GB of RAM. With a 4 GB GPU,
`qwen3:4b` and `qwen2.5:3b` fit comfortably; with more memory you can use bigger models.

---

## Quick path (about 10 minutes)

### 1. Install Node.js

**Linux and macOS** (nvm, recommended):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# close and reopen the terminal, then:
nvm install 22
nvm alias default 22
```

**macOS** with Homebrew: `brew install node`

**Windows**, in PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
```

Close and reopen the terminal so the `PATH` is updated.

**Checkpoint:** `node --version` prints `v22.` or higher.

### 2. Install Ollama and the models

```bash
# Linux and macOS
curl -fsSL https://ollama.com/install.sh | sh

# macOS with Homebrew
brew install ollama && brew services start ollama

# Windows (PowerShell)
winget install Ollama.Ollama
```

Then download the two models (about 5 GB, once):

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

**Checkpoint:** `ollama list` shows both models, and this answers with JSON:

```bash
curl http://127.0.0.1:11434/api/tags
```

On Windows, if that fails, open the Ollama app from the Start menu.

### 3. Download the project

```bash
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

**Checkpoint:** `ls` (or `dir` on Windows) shows `package.json`.

> Download the ZIP only if you do not want updates: you lose the history and
> `git pull`.

### 4. Install dependencies

```bash
npm install
```

On Windows, if PowerShell complains about `npm.ps1`, use `npm.cmd install`.

You can also double-click **`arrancar.bat`** (Windows): it installs missing
dependencies, creates `.env` if needed and starts the bot.

**Checkpoint:** it finishes without errors.

### 5. Configure `.env`

```bash
cp .env.example .env          # Linux and macOS
Copy-Item .env.example .env   # Windows (PowerShell)
```

The template already works: it points to Ollama on this computer and to the two
models you just downloaded. You only need to edit it if Ollama runs elsewhere, if
you use another model, or to set email for student access codes.

Two things worth knowing:

- **Do not upload `.env` to Git.** It holds your phone number, email and passwords.
  It is already in `.gitignore`.
- If you use `PICKLEBRAIN_DATA_DIR`, the `.env` can live inside that data folder.

**Checkpoint:** `.env` sits next to `package.json`.

### 6. Start it for the first time

```bash
npm start
```

The first time, the browser opens `http://localhost:3000/setup` to choose the
language (100 available). The choice is saved in the database, and the bot does not
connect to WhatsApp until you pick one.

Then a **QR code** appears in the terminal. Scan it with
**WhatsApp → Settings → Linked devices → Link a device**.

The session is stored in `data/auth/` (or `PICKLEBRAIN_DATA_DIR/auth`). Do not share
that folder: it is access to your account.

**Checkpoint:** the terminal says it is connected and your phone shows the linked
device. Write `!claw` in the group and it answers with its status.

Other ways to run it:

| Command | What it starts |
| --- | --- |
| `npm start` | Everything: WhatsApp, web panel and reminders |
| `npm run web` | Web panel and API only, without WhatsApp |
| `npm run sim` | Console simulator, without WhatsApp or QR |

---

## Link your group

Inside the group, write:

```
!claw aqui
```

That stores the group **identifier** (never the name, because names repeat and
anyone can change them). You can also set `WHATSAPP_GROUP_JID` in `.env`.

If the bot stays quiet, that is usually correct: it only speaks when someone asks
about homework or exams, or says `Claw` plus a question.

---

## Optional: voice and images (Python service)

Without this service the bot still works: voice uses ffmpeg and Whisper inside
Node, and images use `sd-cli`. With it you get `faster-whisper` (faster) and
`diffusers` (better images). **If you only want the bot answering homework, skip to
[Check everything works](#check-everything-works).**

**1. Create the virtual environment** (from the project root):

```bash
python3.12 -m venv .venv      # Linux and macOS
py -3.12 -m venv .venv        # Windows
```

If Python 3.12 is missing: `sudo apt install python3.12 python3.12-venv` (Debian
and Ubuntu) or `brew install python@3.12` (macOS).

**2. Install the dependencies:**

```bash
.venv/bin/pip install -r python/requirements.txt                  # Linux and macOS
.venv\Scripts\pip.exe install -r python\requirements.txt          # Windows
```

**3. Start it in another terminal**, and leave it running while the bot runs:

```bash
.venv/bin/python python/server.py                 # Linux and macOS
.venv\Scripts\python.exe python\server.py         # Windows
```

Shortcuts, if `python` is in your `PATH`: `npm run ia` (Windows and macOS) or
`npm run ia:linux`.

**Checkpoint:** this returns `"ok": true` with the state of `voice` and `images`:

```bash
curl http://127.0.0.1:5050/health
```

The bot detects the service on its own when it starts and tells you which voice
engine it is using. Models download on first use: about 150 MB for Whisper and
about 4 GB for images, stored in `data/models/`.

Useful variables:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

With a 4 GB GPU, keep `PYTHON_IMAGE_UNLOAD=true` so Ollama gets the VRAM back
after each image.

---

## Optional: image generation

Images are off by default because they are slow on small GPUs. To turn them on, set
in `.env`:

```dotenv
IMAGE_GEN_ENABLED=true
```

and install the extra dependencies in the same environment:

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

Without an NVIDIA GPU, install the CPU build of torch first:

```bash
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
```

Images are requested by hand with `!claw imagen <what you want>`.

---

## Check everything works

| Command | What it checks | Needs Ollama? |
| --- | --- | --- |
| `npm run doctor` | Ollama, models, database, voice, disk | Yes |
| `npm test` | Full test suite | Yes |
| `npm run test:python` | Node ↔ Python service contract | No |
| `npm run test:web` | Logins and API | No |
| `npm run test:subjects` | Subject detection | No |
| `npm run test:vetados` | Blocking by number and by `@lid` | No |
| `npm run test:i18n` | The 100 languages | No |

If `doctor` is green, you are done. To try it without WhatsApp:

```bash
npm run sim
```

```
what math homework do we have?
Ana: pages 30 to 32
what math homework do we have?
the history exam is on October 20
Claw, what is 2+2?
```

---

## Install with Homebrew (macOS and Linux)

There is a tap with a formula that provides the `claw` and `claw-ia` commands:

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 and later
brew install claw
claw
```

The first run downloads the Node dependencies to `~/.local/share/claw` and stores
data in `~/.local/share/claw/data`. To use your own folder:

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

For the Python voice and image service:

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"  # images only
claw-ia
```

> The tap lives at `Uyruw3/homebrew-claw` because the project organization does not
> allow repositories from that account. If it moves to `ClawProject`, the command
> becomes `brew tap ClawProject/claw`.

---

## Updating

```bash
git pull
npm install
```

If `python/requirements*.txt` changed too:

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

Restart Node and the Python service. With Homebrew: `brew update && brew upgrade claw`.

---

## Problems and fixes

| What you see | What to do |
| --- | --- |
| `npm start` cannot reach Ollama | Open the Ollama app or run `ollama serve`, then check `curl http://127.0.0.1:11434/api/tags` |
| No QR code appears | Choose the language at `http://localhost:3000/setup` first |
| The bot says nothing in the group | `!claw aqui` inside the group, then `!claw`; with `LOG_LEVEL=debug` you see why each message is dropped |
| Voice notes do not work | Start `python/server.py` and run `npm run doctor`; without Python, install ffmpeg and reopen the terminal |
| `faster-whisper` fails with `metadata_errors` | `.venv/bin/pip install 'av<19'` |
| CUDA does not load (`libcublas.so.12`) | Whisper switches to the CPU by itself; for the GPU, install the CUDA runtime and a CUDA build of torch |
| The first image takes ages | It is downloading the diffusers model (~4 GB); later images are fast |
| The website sends no access codes | Fill `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` and `SMTP_PASSWORD`; test with `npm run smtp -- your-email@alu.edu.gva.es` |
| PowerShell blocks `npm.ps1` | Use `npm.cmd`, or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` in a new terminal |
| `ollama pull` runs out of space | The models need ~5 GB; free space or use a smaller model |

Still stuck? Run `npm run doctor` and paste its output:

```bash
npm run doctor > doctor.txt
```

---

## Folder layout

```
TheClawRepo/
├─ src/                 bot code (Node)
├─ python/              voice and image service
├─ docs/                website and documentation
├─ sdserver/            optional stable-diffusion.cpp engine
├─ data/                session, database, photos and models (not in Git)
├─ .env                 your configuration (not in Git)
├─ package.json
└─ arrancar.bat         one-click start for Windows
```
