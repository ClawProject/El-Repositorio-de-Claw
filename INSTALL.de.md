# Claw installieren

[English](INSTALL.md) · [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · **Deutsch** · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

Claw besteht aus zwei Prozessen:

1. **Node.js** (erforderlich): der WhatsApp-Bot, die Weboberfläche, die Datenbank und die Logik.
2. **Python** (optional, empfohlen): transkribiert Sprachnachrichten mit faster-whisper und
   erzeugt Bilder mit diffusers. Läuft er nicht, nutzt Node seine
   alten Engines.

Diese Anleitung gilt für Linux, macOS und Windows. Allgemeine Informationen zum Bot
stehen im [README](README.de.md); zum Python-Dienst in [`python/README.md`](python/README.md).

---

## 1. Voraussetzungen

| Komponente | Version | Zweck |
|---|---|---|
| Git | Beliebige aktuelle Version | Projekt herunterladen und aktualisieren |
| Node.js | 22 oder neuer (24 LTS empfohlen) | Bot, Weboberfläche und Datenbank |
| Ollama | Aktuelle Version | Lokale Text-KI |
| Python | 3.11 oder 3.12 | Sprach- und Bilddienst (optional) |
| ffmpeg | Aktuelle Version | Sprach-Fallback ohne Python (optional) |

Die Text-KI muss Ollama-Modelle herunterladen. Mit einer GTX 1650 mit 4 GB
laufen `qwen3:4b` und `qwen2.5:3b`; mit mehr Speicher sind größere Modelle möglich.

---

## 2. Projekt herunterladen (`git clone`)

### Linux und macOS

```bash
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

### Windows (PowerShell)

```powershell
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

> Wenn du das Projekt schon hast, aktualisiere es mit `git pull` im Ordner.
> Lade kein ZIP herunter: dabei gehen Verlauf und Update-Funktion verloren.

---

## 3. Node.js installieren

### Linux und macOS mit nvm (empfohlen)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# Terminal schließen und neu öffnen, oder:
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

nvm install 22
nvm alias default 22
node --version       # sollte v22.x oder neuer zeigen
npm --version
```

### macOS mit Homebrew

```bash
brew install node
```

### Windows

Lade den LTS-Installer von [nodejs.org](https://nodejs.org/) oder nutze:

```powershell
winget install OpenJS.NodeJS.LTS
```

Schließe PowerShell und öffne sie neu, damit der `PATH` aktualisiert wird.

---

## 4. Ollama und die Modelle installieren

### Linux und macOS

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Oder mit Homebrew:

```bash
brew install ollama
brew services start ollama
```

### Windows

```powershell
winget install Ollama.Ollama
```

Dann in einem beliebigen Terminal:

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

Prüfen, ob es antwortet:

```bash
ollama list
curl http://127.0.0.1:11434/api/tags
```

---

## 5. Node-Abhängigkeiten installieren

Im Projektordner:

```bash
npm install
```

Wenn PowerShell unter Windows bei `npm.ps1` meckert, `npm.cmd install` verwenden.

Unter Windows kann man auch **`arrancar.bat`** doppelklicken: es installiert fehlende
Abhängigkeiten, erstellt `.env` falls nötig und startet den Bot.

---

## 6. `.env` konfigurieren

Vorlage kopieren und bearbeiten:

```bash
cp .env.example .env
```

Unter Windows:

```powershell
Copy-Item .env.example .env
notepad .env
```

Minimalkonfiguration:

```dotenv
OLLAMA_MODEL=qwen3:4b
OLLAMA_MODEL_BRAIN=qwen2.5:3b
# Gruppenkennung (oder "!claw aqui" in der Gruppe schreiben)
WHATSAPP_GROUP_JID=120363000000000000@g.us
```

- Die Gruppe lässt sich später mit `!claw aqui` in WhatsApp verbinden; gespeichert wird nur
  die Kennung, nie der Gruppenname.
- Mit `PICKLEBRAIN_DATA_DIR` kann die `.env` in diesem Datenordner liegen.
- Fast alles lässt sich im laufenden Betrieb mit `!claw ajustes` ändern;
  nach manuellen Änderungen an `.env` neu starten.
- **`.env` nicht in Git hochladen**: sie enthält E-Mail-Adressen, Passwörter und deine Telefonnummer.
  Sie steht bereits in `.gitignore`.

Alle Variablen sind in [`.env.example`](.env.example) und im
[README](README.de.md) dokumentiert.

---

## 7. Python-Dienst für Sprache und Bilder (optional, empfohlen)

Ohne diesen Dienst funktioniert Claw weiter: Sprache nutzt ffmpeg + Whisper in Node und
Bilder nutzen `sd-cli` oder einen HTTP-Server. Mit Python gibt es
`faster-whisper` (schneller) und `diffusers`.

### 7.1 Virtuelle Umgebung anlegen

Im Projektordner:

```bash
python3.12 -m venv .venv
```

Falls `python3.12` fehlt:

```bash
# Debian/Ubuntu
sudo apt install python3.12 python3.12-venv

# macOS mit Homebrew
brew install python@3.12
```

Unter Windows:

```powershell
py -3.12 -m venv .venv
```

### 7.2 Abhängigkeiten installieren

```bash
# Linux/macOS
.venv/bin/pip install -r python/requirements.txt

# Windows
.venv\Scripts\pip.exe install -r python/requirements.txt
```

Nur für Bildgenerierung mit diffusers:

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

> Ohne NVIDIA-GPU zuerst die CPU-Version von torch installieren:
>
> ```bash
> .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
> ```
>
> Mit NVIDIA-GPU muss torch die CUDA-Version sein. Erkennt Whisper CUDA, fehlen aber
> `libcublas`/cuDNN, wechselt der Dienst automatisch auf CPU.

### 7.3 Dienst starten

In einem **anderen Terminal**, im Projektordner:

```bash
# Linux/macOS
.venv/bin/python python/server.py

# Windows
.venv\Scripts\python.exe python\server.py
```

Alternativ:

```bash
npm run ia          # Windows/macOS, wenn "python" im PATH ist
npm run ia:linux    # Linux
```

Prüfen, ob es antwortet:

```bash
curl http://127.0.0.1:5050/health
```

Es sollte `"ok": true` sowie den Status von `voice` und `images` liefern. Der Bot erkennt
ihn beim Start automatisch und zeigt, welche Sprach-Engine verwendet wird.

### 7.4 Modelle

Die erste Transkription lädt das Whisper-Modell (~150 MB mit `base`). Das erste Bild
lädt das diffusers-Modell (ca. 4 GB mit SD 1.5). Sie liegen in
`data/models/`, das Git ignoriert.

Nützliche Variablen:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

Bei einer 4-GB-GPU `PYTHON_IMAGE_UNLOAD=true` lassen, damit Ollama den
VRAM nach jedem Bild zurückbekommt.

---

## 8. Claw starten

```bash
npm start       # kompletter Bot: WhatsApp + Web + Erinnerungen
npm run web     # nur Web/API, ohne WhatsApp
npm run sim     # Konsolensimulator, ohne WhatsApp
```

Beim ersten Mal öffnet Claw den Browser unter `http://localhost:3000/setup` zur
Sprachwahl (100 Sprachen). Die Wahl wird in der Datenbank gespeichert und der Bot
verbindet sich erst mit WhatsApp, wenn eine gewählt wurde. Später änderbar über
WhatsApp mit `!claw language en` (Besitzer/Admins) oder erneut über `/setup`.

Danach zeigt `npm start` einen **QR-Code**. In WhatsApp scannen:

**Einstellungen → Verknüpfte Geräte → Gerät verknüpfen**

Die Sitzung wird in `data/auth/` gespeichert (oder `PICKLEBRAIN_DATA_DIR/auth`).
Diesen Ordner nicht weitergeben: er gibt Zugriff auf das Konto.

---

## 9. Installation prüfen

```bash
npm run doctor      # Ollama, Modelle, Datenbank, Sprache usw.
npm run test:python # Vertrag Node <-> Python-Dienst (ohne Modelle)
npm run test:web    # Anmeldung und API
npm run test:subjects
npm run test:vetados # Sperren per Nummer und per @lid (ohne Ollama)
```

`npm test` führt die ganze Suite aus und **braucht laufendes Ollama**.

Schneller Test im Simulator:

```bash
npm run sim
```

```
Leute, welche Mathe-Hausaufgaben haben wir?
Ana: Seiten 30 bis 32
welche Mathe-Hausaufgaben haben wir?
die Geschichtsprüfung ist am 20. Oktober
Claw, wie viel ist 2+2?
```

---

## 10. Installation mit Homebrew (macOS und Linux)

Es gibt einen Tap mit einer Formel für `claw` und `claw-ia`:

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 und neuer
brew install claw
```

Der erste Lauf lädt die Node-Abhängigkeiten nach
`~/.local/share/claw` und speichert Daten in `~/.local/share/claw/data`.

```bash
claw
```

Wenn du den Ordner selbst verwalten willst:

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

Für den Python-Dienst:

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"

# Nur für Bildgenerierung:
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"

claw-ia
```

Zum Aktualisieren:

```bash
brew update
brew upgrade claw
```

> Der Tap liegt unter `Uyruw3/homebrew-claw`, weil die Projektorganisation
> keine Repos aus diesem Konto erstellen lässt. Er kann später zu
> `ClawProject` übertragen werden; der Befehl wäre dann `brew tap ClawProject/claw`.
>
> Die Formel installiert die letzte veröffentlichte stabile Version. Bei einer neuen
> Version wird der Tap mit `brew update && brew upgrade claw` aktualisiert.

---

## 11. Projekt aktualisieren

Bei einer `git clone`-Installation:

```bash
git pull
npm install
```

Wenn sich `python/requirements*.txt` geändert hat:

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

Nach dem Update Node und den Python-Dienst neu starten.

---

## 12. Häufige Probleme

**`npm start` findet Ollama nicht.**
Ollama-App öffnen oder `ollama serve` ausführen. Prüfen mit
`curl http://127.0.0.1:11434/api/tags`.

**Der Bot sagt nichts in der Gruppe.**
1. Prüfen, ob sie verbunden ist: `!claw aqui` in der Gruppe oder
   `WHATSAPP_GROUP_JID` setzen.
2. `!claw` für den Status eingeben.
3. Mit `LOG_LEVEL=debug` starten, um zu sehen, warum Nachrichten verworfen werden.

**Sprachnachrichten funktionieren nicht.**
`python/server.py` starten und `npm run doctor` prüfen. Ohne Python
ffmpeg installieren und das Terminal neu öffnen.

**`faster-whisper` scheitert mit `metadata_errors`.**
`av` 19 ist installiert. Version festlegen:

```bash
.venv/bin/pip install 'av<19'
```

**CUDA lädt nicht (`libcublas.so.12`).**
Whisper wechselt automatisch auf CPU. Für die GPU die CUDA-Runtime und eine
CUDA-fähige torch-Version installieren. Bis dahin läuft Sprache auf der CPU.

**Das erste Bild dauert lange.**
Das diffusers-Modell wird geladen (~4 GB). Danach dauert es nur die
Generierungszeit.

**Die Webseite sendet keine Zugangscodes.**
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` und `SMTP_PASSWORD` in `.env` setzen.
Test mit `npm run smtp -- deine-mail@alu.edu.gva.es`.

**PowerShell blockiert `npm.ps1`.**
`npm.cmd` verwenden oder
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` ausführen und ein neues Terminal öffnen.

---

## 13. Minimale installierte Struktur

```
TheClawRepo/
├─ src/                 Bot-Code (Node)
├─ python/              Sprach- und Bilddienst
├─ docs/                statische Website und Dokumentation
├─ sdserver/            optionaler stable-diffusion.cpp-Motor
├─ data/                Sitzung, Datenbank, Fotos und Modelle (nicht in Git)
├─ .env                 deine Konfiguration (nicht in Git)
├─ package.json
└─ arrancar.bat         Startskript für Windows
```
