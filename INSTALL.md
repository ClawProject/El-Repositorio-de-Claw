# Installing Claw

Claw consists of two processes:

1. **Node.js** (required): the WhatsApp bot, web interface, database, and logic.
2. **Python** (optional, recommended): transcribes voice messages with faster-whisper and
   generates images with diffusers. If it is not running, Node uses its
   legacy engines.

Claw runs on **Windows 10 or 11**. This guide only covers Windows. For general
information about how the bot works, see the [README](README.md); for the Python
service, see [`python/README.md`](python/README.md).

---

## 1. Requirements

| Component | Version | Purpose |
|---|---|---|
| Git | Any recent version | Downloading and updating the project |
| Node.js | 22 or later (24 LTS recommended) | Bot, web interface, and database |
| Ollama | Recent version | Local text AI |
| Python | 3.11 or 3.12 | Voice and image service (optional) |
| ffmpeg | Recent version | Voice fallback if you do not use Python (optional) |

The text AI needs to download Ollama models. With a 4 GB GTX 1650,
`qwen3:4b` and `qwen2.5:3b` work; with more memory, you can use larger models.

---

## 2. Download the project (`git clone`)

Open **PowerShell** and run:

```powershell
git clone https://github.com/ClawProject/El-Repositorio-de-Claw.git
cd El-Repositorio-de-Claw
```

> If you have already downloaded the project, update it by running `git pull` inside the
> folder. Do not download a ZIP: you will lose the history and update functionality.

---

## 3. Install Node.js

Download the LTS installer from [nodejs.org](https://nodejs.org/) or use:

```powershell
winget install OpenJS.NodeJS.LTS
```

Close and reopen PowerShell so that the `PATH` is updated, then check it:

```powershell
node --version       # should show v22.x or later
npm --version
```

---

## 4. Install Ollama and the models

```powershell
winget install Ollama.Ollama
```

Then, in any terminal:

```powershell
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

Check that it responds:

```powershell
ollama list
curl.exe http://127.0.0.1:11434/api/tags
```

---

## 5. Install Node dependencies

From the project root:

```powershell
npm install
```

If PowerShell complains about `npm.ps1`, use `npm.cmd install`.

You can also double-click **`arrancar.bat`**: it installs any missing
dependencies, creates `.env` if it does not exist, and starts the bot.

---

## 6. Configure `.env`

Copy the template and edit it:

```powershell
Copy-Item .env.example .env
notepad .env
```

The minimum configuration to get started:

```dotenv
OLLAMA_MODEL=qwen3:4b
OLLAMA_MODEL_BRAIN=qwen2.5:3b
# Group identifier (or type "!claw aqui" inside the group)
WHATSAPP_GROUP_JID=120363000000000000@g.us
```

- You can link the group later by typing `!claw aqui` in WhatsApp; only the
  identifier is stored, never the group name.
- If you use `PICKLEBRAIN_DATA_DIR`, the `.env` file can be located inside that
  data folder.
- Almost everything can be changed while the bot is running with `!claw ajustes`;
  restart after manually editing `.env`.
- **Do not upload `.env` to Git**: it contains email addresses, passwords, and your phone number. It is
  already included in `.gitignore`.

All variables are documented in [`.env.example`](.env.example) and in the
[README](README.md#configuración-env).

---

## 7. Python voice and image service (optional, recommended)

Without this service, Claw still works: voice uses ffmpeg + Whisper in Node, and
images use `sd-cli` or an HTTP server. With Python, you get
`faster-whisper` (faster) and `diffusers`.

### 7.1 Create the virtual environment

From the project root:

```powershell
py -3.12 -m venv .venv
```

If your system does not have Python 3.12:

```powershell
winget install Python.Python.3.12
```

### 7.2 Install dependencies

```powershell
.venv\Scripts\pip.exe install -r python\requirements.txt
```

Only if you want to generate images with diffusers:

```powershell
.venv\Scripts\pip.exe install -r python\requirements-images.txt
```

> Without an NVIDIA GPU, install the CPU version of torch first:
>
> ```powershell
> .venv\Scripts\pip.exe install torch --index-url https://download.pytorch.org/whl/cpu
> ```
>
> With an NVIDIA GPU, torch must be the CUDA version. If Whisper detects CUDA but
> the CUDA libraries are missing, the service automatically switches to CPU.

### 7.3 Start the service

In **another terminal**, from the project root:

```powershell
.venv\Scripts\python.exe python\server.py
```

You can also use:

```powershell
npm run ia          # if "python" is in PATH
```

Check that it responds:

```powershell
curl.exe http://127.0.0.1:5050/health
```

It should return `"ok": true` and the status of `voice` and `images`. The bot detects it
automatically at startup and shows which voice engine it is using.

### 7.4 Models

The first transcription downloads the Whisper model (~150 MB with `base`). The
first image downloads the diffusers model (around 2 GB with DreamShaper 8 in fp16).
They are stored in `data/models/`, which is ignored by Git.

Useful variables:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=Lykon/dreamshaper-8
PYTHON_IMAGE_UNLOAD=true
PYTHON_IMAGE_OFFLOAD=auto
PYTHON_IMAGE_HIRES=true
```

With a 4 GB GPU, leave `PYTHON_IMAGE_UNLOAD=true` so Ollama can reclaim VRAM
after each image, and leave `PYTHON_IMAGE_OFFLOAD=auto`: that keeps only the module
being used on the GPU, which is what lets the second (larger) pass fit in memory.
Drawing takes longer, but the picture has real detail instead of the usual soft
Stable Diffusion 1.5 look. If it still runs out of memory, set
`PYTHON_IMAGE_OFFLOAD=sequential` or lower `PYTHON_IMAGE_MAX_SIDE`.

---

## 8. Start Claw

```powershell
npm start       # full bot: WhatsApp + web + reminders
npm run web     # web/API only, without connecting to WhatsApp
npm run sim     # console simulator, without WhatsApp
```

The first time, Claw opens the browser at `http://localhost:3000/setup` so you can
choose the language (100 available). The choice is saved in the database and the
bot does not connect to WhatsApp until you pick one. You can change it later from
WhatsApp with `!claw language en` (owner/admins) or by visiting `/setup` again.

After that, `npm start` displays a **QR code**. Scan it in WhatsApp:

**Settings → Linked devices → Link a device**

The session is saved in `data/auth/` (or in `PICKLEBRAIN_DATA_DIR/auth`). Do not
share this folder: it provides access to your account.

---

## 9. Verify the installation

```powershell
npm run doctor      # Ollama, models, database, voice, etc.
npm run test:python # Node <-> Python service contract (no models)
npm run test:web    # authentication and API
npm run test:subjects
npm run test:i18n   # languages and translations (no Ollama)
npm run test:vetados # ban by number and by @lid (no Ollama)
```

`npm test` runs the full test suite and **requires Ollama to be running**.

Quick test in the simulator:

```powershell
npm run sim
```

```
guys, what math homework do we have?
Ana: we have to do pages 30 to 32
what math homework do we have?
the history exam is on October 20
Claw, what is 2+2?
```

---

## 10. Update the project

If you installed it with `git clone`:

```powershell
git pull
npm install
```

If `python/requirements*.txt` has also changed:

```powershell
.venv\Scripts\pip.exe install -r python\requirements.txt
.venv\Scripts\pip.exe install -r python\requirements-images.txt
```

Restart Node and the Python service after updating.

---

## 11. Common issues

**`npm start` cannot find Ollama.**
Open the Ollama application or run `ollama serve`. Check with
`curl.exe http://127.0.0.1:11434/api/tags`.

**The bot does not say anything in the group.**
1. Check that it is linked: type `!claw aqui` inside the group or set
   `WHATSAPP_GROUP_JID`.
2. Type `!claw` to see the status.
3. Start with `LOG_LEVEL=debug` to see why each message is discarded.

**Voice messages do not work.**
Start `python\server.py` and check `npm run doctor`. If you are not using Python, install
ffmpeg and reopen the terminal.

**`faster-whisper` fails with `metadata_errors`.**
You have `av` 19. Pin the version:

```powershell
.venv\Scripts\pip.exe install "av<19"
```

**CUDA does not load (`cublas64_12.dll` not found).**
Whisper automatically switches to CPU. If you want to use the GPU, install the CUDA
runtime and a CUDA-enabled version of torch. In the meantime, voice works on the CPU.

**The first image takes a long time.**
The diffusers model is being downloaded (~2 GB). Subsequent images take only as long
as the generation itself.

**The website does not send access codes.**
Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD` in `.env`.
Test it with `npm run smtp -- your-email@alu.edu.gva.es`.

**PowerShell blocks `npm.ps1`.**
Use `npm.cmd` or run
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` and open another terminal.

---

## 12. Minimal installed structure

```
El-Repositorio-de-Claw/
├─ src/                 bot code (Node)
├─ python/              voice and image service
├─ docs/                static website and documentation
├─ sdserver/            optional stable-diffusion.cpp engine
├─ data/                session, database, photos, and models (not tracked by Git)
├─ .env                 your configuration (not tracked by Git)
├─ package.json
└─ arrancar.bat         startup script for Windows
```
