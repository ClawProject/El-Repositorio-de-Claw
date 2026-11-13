# Installare Claw

[English](INSTALL.md) · [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · **Italiano** · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

Claw è un bot di WhatsApp che gira sul tuo computer. Gli servono due cose: **Node.js** (il
bot, il pannello web e il database) e **Ollama** (l'IA locale). Le note vocali e la
generazione di immagini sono **facoltative** e richiedono un piccolo servizio Python.

Ogni passo finisce con un **Controllo**: se vedi quello che dice, quel passo è fatto e puoi
andare avanti. Se qualcosa non torna, salta a [Problemi e soluzioni](#problemi-e-soluzioni).

---

## Cosa ti serve

| Obbligatorio | Versione | A cosa serve |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 22 o superiore | Bot, pannello web, database |
| [Ollama](https://ollama.com) | versione attuale | IA di testo locale |
| [Git](https://git-scm.com) | qualsiasi | Scaricare e aggiornare |
| Spazio libero | ~6 GB | I due modelli di Ollama |

| Facoltativo | Versione | A cosa serve |
| --- | --- | --- |
| Python | 3.11 o 3.12 | Trascrivere la voce e generare immagini |
| ffmpeg | versione attuale | Voce senza Python |
| GPU NVIDIA | 4 GB di VRAM | IA più veloce; anche con la CPU funziona |

Funziona su Linux, macOS e Windows e richiede circa 8 GB di RAM. Con una GPU da 4 GB,
`qwen3:4b` e `qwen2.5:3b` ci stanno comodi; con più memoria puoi usare modelli più grandi.

---

## Percorso veloce (circa 10 minuti)

### 1. Installare Node.js

**Linux e macOS** (nvm, consigliato):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# chiudi e riapri il terminale, poi:
nvm install 22
nvm alias default 22
```

**macOS** con Homebrew: `brew install node`

**Windows**, in PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
```

Chiudi e riapri il terminale così il `PATH` è aggiornato.

**Controllo:** `node --version` mostra `v22.` o superiore.

### 2. Installare Ollama e i modelli

```bash
# Linux e macOS
curl -fsSL https://ollama.com/install.sh | sh

# macOS con Homebrew
brew install ollama && brew services start ollama

# Windows (PowerShell)
winget install Ollama.Ollama
```

Poi scarica i due modelli (circa 5 GB, una volta sola):

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

**Controllo:** `ollama list` mostra entrambi i modelli, e questo risponde in JSON:

```bash
curl http://127.0.0.1:11434/api/tags
```

Su Windows, se non funziona, apri l'app di Ollama dal menu Start.

### 3. Scaricare il progetto

```bash
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

**Controllo:** `ls` (o `dir` su Windows) mostra `package.json`.

> Scarica lo ZIP solo se non vuoi aggiornamenti: perdi la cronologia e `git pull`.

### 4. Installare le dipendenze

```bash
npm install
```

Su Windows, se PowerShell si lamenta di `npm.ps1`, usa `npm.cmd install`.

Puoi anche fare doppio clic su **`arrancar.bat`** (Windows): installa ciò che manca, crea
`.env` se non c'è e avvia il bot.

**Controllo:** finisce senza errori.

### 5. Configurare `.env`

```bash
cp .env.example .env          # Linux e macOS
Copy-Item .env.example .env   # Windows (PowerShell)
```

Il modello basta così: punta a Ollama su questo computer e ai due modelli appena scaricati.
Devi modificarlo solo se Ollama è altrove, se usi un altro modello, o per mettere l'email
dei codici di accesso.

Due cose da sapere:

- **Non caricare `.env` su Git.** Contiene il tuo numero, la tua email e le password. È già
  in `.gitignore`.
- Se usi `PICKLEBRAIN_DATA_DIR`, il `.env` può stare dentro quella cartella di dati.

**Controllo:** `.env` è accanto a `package.json`.

### 6. Avviarlo la prima volta

```bash
npm start
```

La prima volta il browser apre `http://localhost:3000/setup` per scegliere la lingua (ce ne
sono 100). La scelta viene salvata nel database e il bot non si collega a WhatsApp finché
non ne scegli una.

Poi appare un **codice QR** nel terminale. Inquadralo con
**WhatsApp → Impostazioni → Dispositivi collegati → Collega un dispositivo**.

La sessione è in `data/auth/` (o in `PICKLEBRAIN_DATA_DIR/auth`). Non condividere quella
cartella: è l'accesso al tuo account.

**Controllo:** il terminale dice che è collegato e il telefono mostra il dispositivo
collegato. Scrivi `!claw` nel gruppo e risponde con il suo stato.

Altri modi per avviarlo:

| Comando | Cosa avvia |
| --- | --- |
| `npm start` | Tutto: WhatsApp, pannello web e promemoria |
| `npm run web` | Solo pannello web e API, senza WhatsApp |
| `npm run sim` | Simulatore nel terminale, senza WhatsApp né QR |

---

## Collegare il tuo gruppo

Dentro il gruppo, scrivi:

```
!claw aqui
```

Questo salva l'**identificativo** del gruppo (mai il nome, perché si ripete e chiunque lo
cambia). Puoi anche mettere `WHATSAPP_GROUP_JID` nel `.env`.

Se il bot resta zitto, quasi sempre è normale: parla solo quando qualcuno chiede compiti o
verifiche, o quando si scrive `Claw` e una domanda.

---

## Facoltativo: voce e immagini (servizio Python)

Senza questo servizio il bot funziona lo stesso: la voce usa ffmpeg e Whisper dentro Node,
le immagini usano `sd-cli`. Con il servizio hai `faster-whisper` (più veloce) e `diffusers`
(immagini migliori). **Se vuoi solo le risposte sui compiti, salta a
[Controllare che tutto funzioni](#controllare-che-tutto-funzioni).**

**1. Creare l'ambiente virtuale** (dalla radice del progetto):

```bash
python3.12 -m venv .venv      # Linux e macOS
py -3.12 -m venv .venv        # Windows
```

Se manca Python 3.12: `sudo apt install python3.12 python3.12-venv` (Debian e Ubuntu) o
`brew install python@3.12` (macOS).

**2. Installare le dipendenze:**

```bash
.venv/bin/pip install -r python/requirements.txt                  # Linux e macOS
.venv\Scripts\pip.exe install -r python\requirements.txt          # Windows
```

**3. Avviarlo in un altro terminale** e lasciarlo aperto mentre il bot funziona:

```bash
.venv/bin/python python/server.py                 # Linux e macOS
.venv\Scripts\python.exe python\server.py         # Windows
```

Scorciatoie, se `python` è nel `PATH`: `npm run ia` (Windows e macOS) o `npm run ia:linux`.

**Controllo:** questo restituisce `"ok": true` con lo stato di `voice` e `images`:

```bash
curl http://127.0.0.1:5050/health
```

Il bot riconosce il servizio da solo all'avvio e ti dice quale motore vocale sta usando. I
modelli si scaricano al primo uso: circa 150 MB per Whisper e circa 4 GB per le immagini,
salvati in `data/models/`.

Variabili utili:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

Con una GPU da 4 GB lascia `PYTHON_IMAGE_UNLOAD=true` così Ollama recupera la VRAM dopo
ogni immagine.

---

## Facoltativo: generare immagini

Le immagini sono spente di serie perché su GPU piccole sono lente. Per attivarle, metti nel
`.env`:

```dotenv
IMAGE_GEN_ENABLED=true
```

e installa le dipendenze extra nello stesso ambiente:

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

Senza GPU NVIDIA, installa prima la versione CPU di torch:

```bash
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
```

Le immagini si chiedono a mano con `!claw imagen <quello che vuoi>`.

---

## Controllare che tutto funzioni

| Comando | Cosa controlla | Serve Ollama? |
| --- | --- | --- |
| `npm run doctor` | Ollama, modelli, database, voce, disco | Sì |
| `npm test` | Tutta la batteria di test | Sì |
| `npm run test:python` | Il contratto Node ↔ servizio Python | No |
| `npm run test:web` | Accessi e API | No |
| `npm run test:subjects` | Riconoscimento delle materie | No |
| `npm run test:vetados` | Blocco per numero e per `@lid` | No |
| `npm run test:i18n` | Le 100 lingue | No |

Se `doctor` è verde, hai finito. Per provarlo senza WhatsApp:

```bash
npm run sim
```

```
quali compiti ci sono di matematica?
Ana: pagine da 30 a 32
quali compiti ci sono di matematica?
la verifica di storia è il 20 ottobre
Claw, quanto fa 2+2?
```

---

## Installare con Homebrew (macOS e Linux)

C'è un tap con una formula che installa i comandi `claw` e `claw-ia`:

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 e successivi
brew install claw
claw
```

Il primo avvio scarica le dipendenze Node in `~/.local/share/claw` e salva i dati in
`~/.local/share/claw/data`. Se preferisci la tua cartella:

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

Per il servizio di voce e immagini:

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"  # solo immagini
claw-ia
```

> Il tap è su `Uyruw3/homebrew-claw` perché l'organizzazione del progetto non permette di
> creare repository da quell'account. Se passerà a `ClawProject`, il comando sarà
> `brew tap ClawProject/claw`.

---

## Aggiornare

```bash
git pull
npm install
```

Se sono cambiati anche i `python/requirements*.txt`:

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

Riavvia Node e il servizio Python. Con Homebrew: `brew update && brew upgrade claw`.

---

## Problemi e soluzioni

| Cosa vedi | Cosa fare |
| --- | --- |
| `npm start` non trova Ollama | Apri l'app di Ollama o esegui `ollama serve`, poi controlla `curl http://127.0.0.1:11434/api/tags` |
| Non appare il codice QR | Prima scegli la lingua su `http://localhost:3000/setup` |
| Il bot non dice niente nel gruppo | `!claw aqui` dentro il gruppo e poi `!claw`; con `LOG_LEVEL=debug` vedi perché ogni messaggio viene scartato |
| Le note vocali non vanno | Avvia `python/server.py` ed esegui `npm run doctor`; senza Python installa ffmpeg e riapri il terminale |
| `faster-whisper` fallisce con `metadata_errors` | `.venv/bin/pip install 'av<19'` |
| CUDA non si carica (`libcublas.so.12`) | Whisper passa alla CPU da solo; per la GPU installa il runtime CUDA e un torch con CUDA |
| La prima immagine ci mette una vita | Sta scaricando il modello diffusers (~4 GB); le successive sono rapide |
| Il sito non manda i codici di accesso | Compila `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASSWORD`; prova con `npm run smtp -- la-tua-email@alu.edu.gva.es` |
| PowerShell blocca `npm.ps1` | Usa `npm.cmd`, oppure `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` in un terminale nuovo |
| `ollama pull` finisce lo spazio | I modelli occupano ~5 GB; libera spazio o usa un modello più piccolo |

Se sei ancora bloccato, esegui `npm run doctor` e incolla l'output:

```bash
npm run doctor > doctor.txt
```

---

## Com'è fatta la cartella

```
TheClawRepo/
├─ src/                 codice del bot (Node)
├─ python/              servizio di voce e immagini
├─ docs/                sito e documentazione
├─ sdserver/            motore opzionale stable-diffusion.cpp
├─ data/                sessione, database, foto e modelli (fuori da Git)
├─ .env                 la tua configurazione (fuori da Git)
├─ package.json
└─ arrancar.bat         avvio con doppio clic su Windows
```
