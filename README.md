<p align="center">
  <img src="assets/logo.png" width="128" height="128" alt="Claw logo">
</p>

<h1 align="center">Claw — WhatsApp assistant with local AI for your class group</h1>

<p align="center">
  <a href="https://github.com/ClawProject/TheClawRepo/releases"><img src="https://img.shields.io/github/v/tag/ClawProject/TheClawRepo?label=release&color=f59e0b" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white" alt="Node.js 22 or newer">
  <img src="https://img.shields.io/badge/platforms-Windows%20%7C%20Linux%20%7C%20macOS-4B5563" alt="Windows, Linux and macOS">
  <img src="https://img.shields.io/badge/AI-local%20with%20Ollama-111827" alt="Local AI with Ollama">
  <img src="https://img.shields.io/badge/voice-Whisper-7c3aed" alt="Voice with Whisper">
  <a href="https://discord.gg/DwbMbEqQ6E"><img src="https://img.shields.io/badge/Discord-join%20the%20server-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://github.com/ClawProject/TheClawRepo/stargazers"><img src="https://img.shields.io/github/stars/ClawProject/TheClawRepo" alt="GitHub stars"></a>
</p>

<p align="center"><strong>A self-hosted WhatsApp bot powered by local AI.</strong><br>
It keeps track of homework, exams and school announcements in a class group chat, and answers when someone asks.</p>

> 🌍 **Read this in your language:** [Español](README.es.md) · [Català](README.ca.md) · [Français](README.fr.md) · [Português](README.pt.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [中文](README.zh.md)
>
> 📘 **Installation guide:** [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

Claw is a local AI-powered WhatsApp assistant designed to keep track of homework, exams, school announcements and important information shared in group chats.

It works quietly in the background, understands text messages, voice notes and relevant images, and answers questions whenever someone needs information.

> ⚠️ **Unofficial project.** Claw is not affiliated with, endorsed by or sponsored by WhatsApp or Meta. It connects through [Baileys](https://github.com/WhiskeySockets/Baileys), an unofficial WhatsApp Web library, so using it may violate WhatsApp's terms of service. Run it on a separate number.

> **Installation:** See [INSTALL.md](INSTALL.md) for detailed instructions for Linux, macOS and Windows.
>
> **Technical documentation:** [Architecture, API and Security](docs/arquitectura.md).

---

## ✨ Features

- **Automatic homework tracking:** Detects and records homework assignments and upcoming exams from group conversations.
- **Silent operation:** Claw only speaks when someone asks a question or explicitly activates it.
- **General-purpose AI assistant:** Mention `Claw` followed by a question to use its general AI capabilities.
- **Voice recognition:** Transcribes voice messages locally using Whisper.
- **Image storage:** Saves relevant images associated with homework and exams, automatically removing expired files.
- **Local AI processing:** Uses Ollama to run language models on your own computer.
- **First-run language setup:** On the first start, Claw opens a web page to choose one of 100 languages. The choice is stored in the database, applied to the interface and AI replies, and can be changed later with `!claw language en`.
- **Web interface:** Provides students with authenticated access to shared school information.
- **Calendar integration:** Exports upcoming exams as `.ics` calendar files.
- **Chess:** Play chess against Claw or analyze positions.
- **Optional image generation:** Generate images locally using Stable Diffusion.
- **Automatic maintenance:** Manages stored media and can prevent the host computer from sleeping.

### 🔒 Privacy

Claw is designed around local processing.

AI inference, classification and the database run on your computer.

Some external connections are still required:

- WhatsApp: Message delivery and reception.
- Ollama and Whisper: Model downloads.
- DuckDuckGo: Optional web searches.

Web searches can be disabled using `WEB_SEARCH=false` or `!claw ajustes buscar no`.

Read the [Privacy Documentation](docs/arquitectura.md#datos-y-privacidad) for more information.

---

## 🧠 How it works

Claw analyzes incoming group messages and determines what action to take.

```text
Incoming group message
        |
        +-- Contains "Claw"?
        |       |
        |       +-- General AI assistant
        |
        +-- Is it a homework/exam question?
        |       |
        |       +-- Answer directly from the database
        |
        +-- Could it contain school information?
                |
                +-- Local AI classification
                        |
                        +-- Question detected
                        |       |
                        |       +-- Open a 15-minute pending question
                        |
                        +-- Information detected
                                |
                                +-- Save silently to the database
```

### Pending questions

One of Claw's main features is its pending-question system.

For example:

1. A student asks: "What is the English homework?"
2. Claw opens a 15-minute pending question.
3. Another student replies: "Complete page 12."
4. Claw saves the information automatically.
5. Anyone can later ask Claw about the English homework.

Corrections replace previous entries, so outdated information does not remain in the database.

Claw also understands conversational context using recent messages from the same chat, without mixing conversations.

### 🎙️ Voice messages

Claw can understand voice messages using Whisper.

- Audio is transcribed locally.
- The Python service uses faster-whisper.
- A Node.js fallback is available.
- It recognizes alternative trigger pronunciations such as "Clau" and "Clao".
- Audio never needs to leave your computer for transcription.

### 🖼️ Images

Claw can save images associated with homework and exams.

- Relevant school images are stored.
- Memes and unrelated images are ignored.
- Expired media is automatically deleted.
- Images can be sent back when someone asks about an exam.

---

## 🚀 Installation

For complete installation instructions, see **[INSTALL.md](INSTALL.md)**.

### Requirements

| Dependency        | Version / Model                       |
| ----------------- | ------------------------------------- |
| Node.js           | 22 or newer (24 LTS recommended)      |
| Git               | Latest                                |
| Ollama            | Latest                                |
| Primary AI model  | `qwen3:4b`                            |
| Fallback AI model | `qwen2.5:3b`                          |
| Python            | 3.11 / 3.12 (recommended)             |
| FFmpeg            | Optional, for legacy voice processing |

Download the models:

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

### Clone the repository

```bash
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

Install dependencies:

```bash
npm install
```

Alternatively, Windows users can run:

```powershell
.\arrancar.bat
```

This script installs missing dependencies, creates the environment configuration and starts the bot.

### Optional Python service

The Python service provides improved voice processing and local image generation.

Create a virtual environment:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r python/requirements.txt
pip install -r python/requirements-images.txt
```

Start the service:

```bash
python python/server.py
```

Check its status:

```bash
curl http://127.0.0.1:5050/health
```

See [python/README.md](python/README.md) for additional information.

---

## 🧪 Testing

Claw includes several tools to verify that the installation is working correctly.

```bash
npm run doctor
npm run sim
npm test
```

| Command                 | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `npm run doctor`        | Checks Ollama, models, database and classifier. |
| `npm run sim`           | Starts a WhatsApp-free message simulator.       |
| `npm test`              | Runs integration tests.                         |
| `npm run test:ai`       | Tests AI functionality.                         |
| `npm run test:subjects` | Tests subject recognition without Ollama.       |
| `npm run test:python`   | Tests the Node.js ↔ Python service interface.   |
| `npm run test:voice`    | Tests voice transcription using local audio.    |

### Example simulation

```text
Student: What is the math homework?
Claw: Waiting for an answer...

Ana: Complete pages 30 to 32.

Student: What is the math homework?
Claw: Complete pages 30 to 32.

Student: The history exam is on October 20.

Student: Claw, what is 2 + 2?
Claw: 4.
```

---

## 📱 Connecting WhatsApp

Start Claw:

```bash
npm start
```

Scan the QR code using:

**WhatsApp → Settings → Linked Devices → Link a Device**

Your authentication session is stored in:

```text
data/auth/
```

**Never share this directory or its contents.**

### Activating Claw in a group

There are two ways to connect a group:

**Manual activation:**

```text
!claw aqui
```

**Automatic activation:**

Set the group's internal identifier in `.env`:

```env
WHATSAPP_GROUP_JID=your-group-id@g.us
```

Claw identifies groups using their internal IDs rather than their names.

---

## 💬 Commands

All commands start with `!claw`. The legacy `!pickle` alias is also supported.

### General commands

| Command                      | Description                                |
| ---------------------------- | ------------------------------------------ |
| `!claw`                      | Show bot status.                           |
| `!claw ayuda`                | Display available commands.                |
| `!claw deberes [subject]`    | Show pending homework.                     |
| `!claw examenes`             | Show upcoming exams.                       |
| `!claw apuntes`              | Display saved information.                 |
| `!claw proximo`              | Show the next upcoming exam or assignment. |
| `!claw apunta ...`           | Add or correct an assignment.              |
| `!claw hecho ...`            | Mark an assignment as completed.           |
| `!claw resumen [hoy/semana]` | Summarize recent information.              |
| `!claw calendario`           | Export exams as an ICS file.               |
| `!claw busca ...`            | Search the web.                            |
| `!claw imagen ...`           | Generate an image (experimental).          |
| `!claw ajedrez [move]`       | Play chess against Claw.                   |
| `!claw analiza [FEN]`        | Analyze a chess position.                  |
| `!claw novedades`            | Show recent changes.                       |

### Owner and administrator commands

| Command                      | Description                         |
| ---------------------------- | ----------------------------------- |
| `!claw aqui` / `!claw fuera` | Connect or disconnect a group.      |
| `!claw ajustes`              | View and change settings.           |
| `!claw ia`                   | View or change the AI model.        |
| `!claw prohibir [number]`    | Block a user.                       |
| `!claw permitir [number]`    | Unblock a user.                     |
| `!claw vetados`              | List blocked users.                 |
| `!claw mantenimiento si/no`  | Enable or disable maintenance mode. |
| `!claw olvida ...`           | Delete stored information.          |
| `!claw admins`               | Manage administrators (owner only). |

The bot owner is identified by the WhatsApp account running Claw or `WHATSAPP_OWNER_JID`.

Only the owner and authorized administrators can manage administrative settings.

---

## 🌐 Web interface

Claw includes a built-in web interface and API.

Start only the web server:

```bash
npm run web
```

Start everything:

```bash
npm start
```

The web interface is served by the Claw server:

- `/` — Main page.
- `/entrar/` — Student login.

### Student authentication

Access requires an email-based, one-time verification code.

Current authentication rules:

- Only `@alu.edu.gva.es` email addresses are accepted.
- Students register their name, surname, course and group.
- Verification codes expire after 10 minutes.
- A maximum of five verification attempts is allowed.
- Sessions expire after eight hours or when the server restarts.
- Authenticated students share the same homework and exam records.

### Access from the network

Claw serves the web page itself at `http://127.0.0.1:3000`, so no tunnel is needed. If you publish it on another domain (an HTTPS reverse proxy, for example), add it to `WEB_ALLOWED_ORIGINS`, comma-separated.

SMTP credentials are required for email verification.

**Security warning:** The debug access feature must be configured carefully. Never leave a default debug code enabled on an externally accessible server.

See the [Architecture and Security Documentation](docs/arquitectura.md).

---

## ⚙️ Configuration

Copy the example configuration:

```bash
cp .env.example .env
```

The `.env` file contains the main configuration options.

### AI configuration

| Variable                | Default      |
| ----------------------- | ------------ |
| `OLLAMA_MODEL`          | `qwen3:4b`   |
| `OLLAMA_MODEL_FALLBACK` | `qwen2.5:3b` |
| `OLLAMA_MODEL_BRAIN`    | `qwen2.5:3b` |
| `WEB_SEARCH`            | `true`       |
| `CLAW_TRIGGER`          | `claw`       |
| `CLAW_SIGNATURE`        | `true`       |

### WhatsApp configuration

| Variable                | Default     |
| ----------------------- | ----------- |
| `WHATSAPP_GROUP_JID`    | Empty       |
| `WHATSAPP_OWNER_JID`    | Bot account |
| `PRIVATE_MODE`          | `dueno`     |
| `APUNTA_LIBRE`          | `true`      |
| `ANSWER_WINDOW_MINUTES` | `15`        |
| `ACK_SAVES`             | `false`     |

### Media configuration

| Variable               | Default    |
| ---------------------- | ---------- |
| `MEDIA_ENABLED`        | `true`     |
| `MEDIA_MODE`           | `contexto` |
| `MEDIA_MAX_MB`         | `12`       |
| `MEDIA_MAX_TOTAL_MB`   | `2048`     |
| `MEDIA_RETENTION_DAYS` | `14`       |

### Voice configuration

| Variable                 | Default               |
| ------------------------ | --------------------- |
| `TRANSCRIBE_ENABLED`     | `true`                |
| `TRANSCRIBE_MODE`        | `todo`                |
| `TRANSCRIBE_MAX_SECONDS` | `180`                 |
| `WHISPER_MODEL`          | `Xenova/whisper-base` |

### Python AI configuration

| Variable                | Default                                       |
| ----------------------- | --------------------------------------------- |
| `PYTHON_AI_ENABLED`     | `true`                                        |
| `PYTHON_AI_URL`         | `http://127.0.0.1:5050`                       |
| `PYTHON_WHISPER_MODEL`  | `base`                                        |
| `PYTHON_WHISPER_DEVICE` | `auto`                                        |
| `PYTHON_IMAGE_MODEL`    | `stable-diffusion-v1-5/stable-diffusion-v1-5` |

Most runtime settings can also be changed using `!claw ajustes`.

For the complete configuration reference, consult `.env.example` and [INSTALL.md](INSTALL.md).

---

## 🎨 Local image generation (Experimental)

Claw optionally supports local image generation.

Available backends:

- **Python + Diffusers:** Flexible model support through Hugging Face.
- **stable-diffusion.cpp:** Lightweight command-line generation.
- **HTTP backend:** Compatible image-generation servers.

Image generation is disabled by default.

Enable it using:

```text
!claw ajustes imagenes si
```

Generate an image:

```text
!claw imagen a futuristic city at night
```

Claw never generates images automatically.

For systems with limited GPU memory, image generation can unload the Ollama model temporarily to free VRAM.

---

## 📁 Project structure

```text
Claw/
├── arrancar.bat
├── .env.example
├── assets/
│   └── logo.png
├── docs/
│   ├── index.html
│   └── arquitectura.md
├── data/
├── python/
│   ├── server.py
│   ├── requirements.txt
│   └── requirements-images.txt
├── sdserver/
└── src/
    ├── index.js
    ├── web.js
    ├── server.js
    ├── whatsapp.js
    ├── router.js
    ├── signals.js
    ├── brain.js
    ├── claw.js
    ├── search.js
    ├── memory.js
    ├── media.js
    ├── transcribe.js
    ├── python-ai.js
    ├── replies.js
    ├── dates.js
    ├── subjects.js
    ├── ollama.js
    ├── imagegen.js
    ├── presence.js
    ├── changelog.js
    ├── config.js
    └── tools/
```

---

## ❓ FAQ

**Does Claw require an internet connection?**

WhatsApp and optional external services require connectivity. Local AI inference and database operations run on your computer.

**Can I use Claw while my phone is switched off?**

Yes, as long as the host computer remains powered on and the WhatsApp linked-device session stays valid.

**What happens if my computer shuts down?**

Claw stops running, but its stored information remains in `data/picklebrain.db`.

**Can WhatsApp ban my number?**

There is a real risk. Claw uses Baileys, an unofficial WhatsApp Web library. WhatsApp's terms restrict unauthorized automation. Using a separate number is recommended.

**Does Claw consume many resources?**

It depends on the AI models and hardware. Typical questions are answered directly from the database without running an AI model.

**Does it store every image?**

No. By default, only relevant school-related images are stored, and old files are automatically removed.

**Why is Claw not responding?**

1. Check that the group is linked.
2. Run `!claw` to inspect its status.
3. Run `npm run doctor`.
4. Enable `LOG_LEVEL=debug` to inspect message processing.

**Why is voice recognition not working?**

Check that the Python service is running or install FFmpeg for the legacy Node.js transcription engine.

---

## ⚠️ Limitations and future improvements

- The Android companion APK is not included in this repository. The API expects the latest release attachment to be named `ClawCompanion.apk`.
- Larger language models can improve conversation quality when sufficient hardware is available.
- Larger Whisper models can improve recognition of names and noisy recordings.
- Image generation is experimental and depends on available hardware and model compatibility.

---

## 📚 Documentation

- [Installation Guide](INSTALL.md)
- [Technical Architecture](docs/arquitectura.md)
- [Python Service Documentation](python/README.md)
- [Environment Configuration](.env.example)
- [Discord community](https://discord.gg/DwbMbEqQ6E)

---

**Claw — Your local AI assistant for school life.** 🪝

