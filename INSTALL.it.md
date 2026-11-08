# Installare Claw

[English](INSTALL.md) · [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · **Italiano** · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

Claw è composto da due processi:

1. **Node.js** (obbligatorio): il bot WhatsApp, l'interfaccia web, il database e la logica.
2. **Python** (opzionale, consigliato): trascrive le note vocali con faster-whisper e
   genera immagini con diffusers. Se non è attivo, Node usa i suoi
   motori precedenti.

Questa guida copre Linux, macOS e Windows. Per informazioni generali sul bot
vedi il [README](README.it.md); per il servizio Python, [`python/README.md`](python/README.md).

---

## 1. Requisiti

| Componente | Versione | A cosa serve |
|---|---|---|
| Git | Qualsiasi versione recente | Scaricare e aggiornare il progetto |
| Node.js | 22 o superiore (consigliato 24 LTS) | Bot, interfaccia web e database |
| Ollama | Versione recente | IA di testo locale |
| Python | 3.11 o 3.12 | Servizio voce e immagini (opzionale) |
| ffmpeg | Versione recente | Alternativa per la voce senza Python (opzionale) |

L'IA di testo deve scaricare i modelli di Ollama. Con una GTX 1650 da 4 GB,
`qwen3:4b` e `qwen2.5:3b` funzionano; con più memoria puoi usare modelli più grandi.

---

## 2. Scaricare il progetto (`git clone`)

### Linux e macOS

```bash
git clone https://github.com/ClawProject/El-Repositorio-de-Claw.git
cd El-Repositorio-de-Claw
```

### Windows (PowerShell)

```powershell
git clone https://github.com/ClawProject/El-Repositorio-de-Claw.git
cd El-Repositorio-de-Claw
```

> Se l'hai già scaricato, aggiornalo con `git pull` nella cartella. Non scaricare
> uno ZIP: perderesti la cronologia e la possibilità di aggiornare.

---

## 3. Installare Node.js

### Linux e macOS con nvm (consigliato)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# chiudi e riapri il terminale, oppure esegui:
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

nvm install 22
nvm alias default 22
node --version       # deve mostrare v22.x o superiore
npm --version
```

### macOS con Homebrew

```bash
brew install node
```

### Windows

Scarica l'installer LTS da [nodejs.org](https://nodejs.org/) oppure usa:

```powershell
winget install OpenJS.NodeJS.LTS
```

Chiudi e riapri PowerShell per aggiornare il `PATH`.

---

## 4. Installare Ollama e i modelli

### Linux e macOS

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Oppure con Homebrew:

```bash
brew install ollama
brew services start ollama
```

### Windows

```powershell
winget install Ollama.Ollama
```

Poi, in un terminale qualsiasi:

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

Verifica che risponda:

```bash
ollama list
curl http://127.0.0.1:11434/api/tags
```

---

## 5. Installare le dipendenze Node

Dalla radice del progetto:

```bash
npm install
```

Su Windows, se PowerShell si lamenta di `npm.ps1`, usa `npm.cmd install`.

Puoi anche fare doppio clic su **`arrancar.bat`** (Windows): installa le
dipendenze mancanti, crea `.env` se non esiste e avvia il bot.

---

## 6. Configurare `.env`

Copia il modello e modificalo:

```bash
cp .env.example .env
```

Su Windows:

```powershell
Copy-Item .env.example .env
notepad .env
```

Configurazione minima per iniziare:

```dotenv
OLLAMA_MODEL=qwen3:4b
OLLAMA_MODEL_BRAIN=qwen2.5:3b
# Identificatore del gruppo (o scrivi "!claw aqui" nel gruppo)
WHATSAPP_GROUP_JID=120363000000000000@g.us
```

- Puoi collegare il gruppo più tardi scrivendo `!claw aqui` su WhatsApp; viene
  salvato solo l'identificatore, mai il nome del gruppo.
- Se usi `PICKLEBRAIN_DATA_DIR`, il file `.env` può stare in quella
  cartella dati.
- Quasi tutto si può cambiare con il bot in esecuzione da `!claw ajustes`;
  riavvia dopo aver modificato `.env` a mano.
- **Non caricare `.env` su Git**: contiene indirizzi email, password e il tuo numero di telefono.
  È già incluso in `.gitignore`.

Tutte le variabili sono documentate in [`.env.example`](.env.example) e nel
[README](README.it.md).

---

## 7. Servizio voce e immagini con Python (opzionale, consigliato)

Senza questo servizio Claw funziona comunque: la voce usa ffmpeg + Whisper in Node e
le immagini usano `sd-cli` o un server HTTP. Con Python ottieni
`faster-whisper` (più veloce) e `diffusers`.

### 7.1 Creare l'ambiente virtuale

Dalla radice del progetto:

```bash
python3.12 -m venv .venv
```

Se il sistema non ha `python3.12`, installalo:

```bash
# Debian/Ubuntu
sudo apt install python3.12 python3.12-venv

# macOS con Homebrew
brew install python@3.12
```

Su Windows:

```powershell
py -3.12 -m venv .venv
```

### 7.2 Installare le dipendenze

```bash
# Linux/macOS
.venv/bin/pip install -r python/requirements.txt

# Windows
.venv\Scripts\pip.exe install -r python/requirements.txt
```

Solo se vuoi generare immagini con diffusers:

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

> Senza GPU NVIDIA, installa prima la versione CPU di torch:
>
> ```bash
> .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
> ```
>
> Con GPU NVIDIA, torch deve essere la versione CUDA. Se Whisper rileva CUDA ma
> mancano `libcublas`/cuDNN, il servizio passa automaticamente a CPU.

### 7.3 Avviare il servizio

In **un altro terminale**, dalla radice del progetto:

```bash
# Linux/macOS
.venv/bin/python python/server.py

# Windows
.venv\Scripts\python.exe python\server.py
```

Puoi anche usare:

```bash
npm run ia          # Windows/macOS se "python" è nel PATH
npm run ia:linux    # Linux
```

Verifica che risponda:

```bash
curl http://127.0.0.1:5050/health
```

Deve restituire `"ok": true` e lo stato di `voice` e `images`. Il bot lo rileva
automaticamente all'avvio e mostra quale motore vocale sta usando.

### 7.4 Modelli

La prima trascrizione scarica il modello Whisper (~150 MB con `base`). La
prima immagine scarica il modello diffusers (circa 4 GB con SD 1.5). Sono salvati
in `data/models/`, ignorato da Git.

Variabili utili:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

Con una GPU da 4 GB, lascia `PYTHON_IMAGE_UNLOAD=true` così Ollama recupera
la VRAM dopo ogni immagine.

---

## 8. Avviare Claw

```bash
npm start       # bot completo: WhatsApp + web + promemoria
npm run web     # solo web/API, senza WhatsApp
npm run sim     # simulatore console, senza WhatsApp
```

La prima volta Claw apre il browser su `http://localhost:3000/setup` per
scegliere la lingua (100 disponibili). La scelta viene salvata nel database e il
bot non si collega a WhatsApp finché non ne scegli una. Puoi cambiarla dopo da
WhatsApp con `!claw language en` (proprietario/amministratori) o tornando su `/setup`.

Poi `npm start` mostra un **codice QR**. Scansionalo in WhatsApp:

**Impostazioni → Dispositivi collegati → Collega un dispositivo**

La sessione viene salvata in `data/auth/` (o `PICKLEBRAIN_DATA_DIR/auth`). Non
condividere quella cartella: dà accesso al tuo account.

---

## 9. Verificare l'installazione

```bash
npm run doctor      # Ollama, modelli, database, voce, ecc.
npm run test:python # contratto Node <-> servizio Python (senza modelli)
npm run test:web    # autenticazione e API
npm run test:subjects
npm run test:vetados # blocco per numero e per @lid (senza Ollama)
```

`npm test` esegue tutta la suite e **richiede Ollama in esecuzione**.

Test rapido nel simulatore:

```bash
npm run sim
```

```
ragazzi, quali compiti di matematica ci sono?
Ana: dobbiamo fare le pagine da 30 a 32
quali compiti di matematica ci sono?
la verifica di storia è il 20 ottobre
Claw, quanto fa 2+2?
```

---

## 10. Installazione con Homebrew (macOS e Linux)

C'è un tap con una formula per installare i comandi `claw` e `claw-ia`:

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 e successivi
brew install claw
```

Il primo avvio scarica le dipendenze Node in
`~/.local/share/claw` e salva i dati in `~/.local/share/claw/data`.

```bash
claw
```

Se preferisci gestire tu la cartella:

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

Per il servizio voce e immagini con Python:

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"

# Solo se vuoi generare immagini:
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"

claw-ia
```

Per aggiornare:

```bash
brew update
brew upgrade claw
```

> Il tap è su `Uyruw3/homebrew-claw` perché l'organizzazione del progetto
> non permette di creare repository da questo account. Potrà essere trasferito a
> `ClawProject` in futuro; il comando sarebbe allora `brew tap ClawProject/claw`.
>
> La formula installa l'ultima versione stabile pubblicata. Quando ne esce una nuova,
> il tap viene aggiornato con `brew update && brew upgrade claw`.

---

## 11. Aggiornare il progetto

Se l'hai installato con `git clone`:

```bash
git pull
npm install
```

Se sono cambiati anche i `python/requirements*.txt`:

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

Riavvia Node e il servizio Python dopo l'aggiornamento.

---

## 12. Problemi comuni

**`npm start` non trova Ollama.**
Apri l'app Ollama o esegui `ollama serve`. Controlla con
`curl http://127.0.0.1:11434/api/tags`.

**Il bot non dice nulla nel gruppo.**
1. Controlla che sia collegato: scrivi `!claw aqui` nel gruppo o imposta
   `WHATSAPP_GROUP_JID`.
2. Scrivi `!claw` per vedere lo stato.
3. Avvia con `LOG_LEVEL=debug` per vedere perché ogni messaggio viene scartato.

**Le note vocali non funzionano.**
Avvia `python/server.py` e controlla `npm run doctor`. Se non usi Python, installa
ffmpeg e riapri il terminale.

**`faster-whisper` fallisce con `metadata_errors`.**
Hai `av` 19. Blocca la versione:

```bash
.venv/bin/pip install 'av<19'
```

**CUDA non si carica (`libcublas.so.12`).**
Whisper passa automaticamente a CPU. Se vuoi usare la GPU, installa il runtime
CUDA e una versione di torch con CUDA. Nel frattempo la voce funziona su CPU.

**La prima immagine richiede molto tempo.**
Sta scaricando il modello diffusers (~4 GB). Le successive richiedono solo il
tempo della generazione.

**Il sito non invia codici di accesso.**
Configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASSWORD` in `.env`.
Prova con `npm run smtp -- tua-email@alu.edu.gva.es`.

**PowerShell blocca `npm.ps1`.**
Usa `npm.cmd` oppure esegui
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` e apri un altro terminale.

---

## 13. Struttura minima installata

```
El-Repositorio-de-Claw/
├─ src/                 codice del bot (Node)
├─ python/              servizio voce e immagini
├─ docs/                sito statico e documentazione
├─ sdserver/            motore opzionale stable-diffusion.cpp
├─ data/                sessione, database, foto e modelli (non tracciati da Git)
├─ .env                 la tua configurazione (non tracciata da Git)
├─ package.json
└─ arrancar.bat         script di avvio per Windows
```
