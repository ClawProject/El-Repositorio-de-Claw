# Claw installieren

[English](INSTALL.md) · [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · **Deutsch** · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

Claw ist ein WhatsApp-Bot, der auf deinem eigenen Rechner läuft. Er braucht zwei Dinge:
**Node.js** (Bot, Web-Oberfläche und Datenbank) und **Ollama** (die lokale KI). Sprachnachrichten
und Bildgenerierung sind **optional** und brauchen einen kleinen Python-Dienst.

Jeder Schritt endet mit einer **Prüfung**: Wenn du das siehst, was dort steht, ist der
Schritt fertig und du kannst weiter. Wenn etwas nicht passt, spring zu
[Probleme und Lösungen](#probleme-und-lösungen).

---

## Was du brauchst

| Pflicht | Version | Wofür |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 22 oder neuer | Bot, Web-Oberfläche, Datenbank |
| [Ollama](https://ollama.com) | aktuelle Version | Lokale Text-KI |
| [Git](https://git-scm.com) | beliebig | Herunterladen und aktualisieren |
| Freier Speicher | ~6 GB | Die beiden Ollama-Modelle |

| Optional | Version | Wofür |
| --- | --- | --- |
| Python | 3.11 oder 3.12 | Sprache transkribieren, Bilder erzeugen |
| ffmpeg | aktuelle Version | Sprache ohne Python |
| NVIDIA-GPU | 4 GB VRAM | Schnellere KI; die CPU reicht auch |

Läuft unter Linux, macOS und Windows und braucht etwa 8 GB RAM. Mit einer 4-GB-GPU passen
`qwen3:4b` und `qwen2.5:3b` bequem; mit mehr Speicher gehen auch größere Modelle.

---

## Schnellweg (etwa 10 Minuten)

### 1. Node.js installieren

**Linux und macOS** (nvm, empfohlen):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# Terminal schließen und neu öffnen, dann:
nvm install 22
nvm alias default 22
```

**macOS** mit Homebrew: `brew install node`

**Windows**, in PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
```

Terminal schließen und neu öffnen, damit der `PATH` aktuell ist.

**Prüfung:** `node --version` zeigt `v22.` oder höher.

### 2. Ollama und die Modelle installieren

```bash
# Linux und macOS
curl -fsSL https://ollama.com/install.sh | sh

# macOS mit Homebrew
brew install ollama && brew services start ollama

# Windows (PowerShell)
winget install Ollama.Ollama
```

Dann die beiden Modelle laden (etwa 5 GB, einmalig):

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

**Prüfung:** `ollama list` zeigt beide Modelle, und das hier antwortet mit JSON:

```bash
curl http://127.0.0.1:11434/api/tags
```

Unter Windows: Wenn das fehlschlägt, öffne die Ollama-App im Startmenü.

### 3. Projekt herunterladen

```bash
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

**Prüfung:** `ls` (unter Windows `dir`) zeigt `package.json`.

> Nimm das ZIP nur, wenn du keine Updates willst: du verlierst die Historie und `git pull`.

### 4. Abhängigkeiten installieren

```bash
npm install
```

Unter Windows, wenn PowerShell sich über `npm.ps1` beschwert: `npm.cmd install`.

Du kannst auch doppelt auf **`arrancar.bat`** klicken (Windows): es installiert Fehlendes,
legt `.env` an, falls nötig, und startet den Bot.

**Prüfung:** endet ohne Fehler.

### 5. `.env` einrichten

```bash
cp .env.example .env          # Linux und macOS
Copy-Item .env.example .env   # Windows (PowerShell)
```

Die Vorlage passt schon: sie zeigt auf Ollama auf diesem Rechner und auf die beiden Modelle,
die du gerade geladen hast. Bearbeiten musst du sie nur, wenn Ollama woanders läuft, wenn du
ein anderes Modell nutzt, oder für die E-Mail der Zugangscodes.

Zwei Dinge, die du wissen solltest:

- **`.env` nicht zu Git hochladen.** Darin stehen deine Nummer, deine E-Mail und Passwörter.
  Sie ist schon in `.gitignore`.
- Wenn du `PICKLEBRAIN_DATA_DIR` nutzt, darf die `.env` in diesem Datenordner liegen.

**Prüfung:** `.env` liegt neben `package.json`.

### 6. Zum ersten Mal starten

```bash
npm start
```

Beim ersten Mal öffnet der Browser `http://localhost:3000/setup`, um die Sprache zu wählen
(es gibt 100). Die Wahl wird in der Datenbank gespeichert, und der Bot verbindet sich erst
mit WhatsApp, wenn du eine gewählt hast.

Danach erscheint ein **QR-Code** im Terminal. Scanne ihn mit
**WhatsApp → Einstellungen → Verknüpfte Geräte → Gerät verknüpfen**.

Die Sitzung liegt in `data/auth/` (oder `PICKLEBRAIN_DATA_DIR/auth`). Teile diesen Ordner
nicht: er ist der Zugang zu deinem Konto.

**Prüfung:** Das Terminal meldet, dass es verbunden ist, und das Handy zeigt das verknüpfte
Gerät. Schreib `!claw` in die Gruppe, und er antwortet mit seinem Status.

Andere Startarten:

| Befehl | Was startet |
| --- | --- |
| `npm start` | Alles: WhatsApp, Web-Oberfläche und Erinnerungen |
| `npm run web` | Nur Web-Oberfläche und API, ohne WhatsApp |
| `npm run sim` | Simulator im Terminal, ohne WhatsApp und QR |

---

## Gruppe verbinden

Schreib in der Gruppe:

```
!claw aqui
```

Das speichert die **Kennung** der Gruppe (nie den Namen, denn der wiederholt sich und jeder
kann ihn ändern). Du kannst auch `WHATSAPP_GROUP_JID` in der `.env` setzen.

Wenn der Bot still bleibt, ist das meistens richtig: er spricht nur, wenn jemand nach
Hausaufgaben oder Prüfungen fragt, oder wenn `Claw` plus eine Frage kommt.

---

## Optional: Sprache und Bilder (Python-Dienst)

Ohne diesen Dienst läuft der Bot weiter: Sprache nutzt ffmpeg und Whisper in Node, Bilder
nutzen `sd-cli`. Mit ihm bekommst du `faster-whisper` (schneller) und `diffusers` (bessere
Bilder). **Wenn du nur Antworten zu Hausaufgaben willst, spring zu
[Prüfen, ob alles läuft](#prüfen-ob-alles-läuft).**

**1. Virtuelle Umgebung anlegen** (im Projektordner):

```bash
python3.12 -m venv .venv      # Linux und macOS
py -3.12 -m venv .venv        # Windows
```

Ohne Python 3.12: `sudo apt install python3.12 python3.12-venv` (Debian und Ubuntu) oder
`brew install python@3.12` (macOS).

**2. Abhängigkeiten installieren:**

```bash
.venv/bin/pip install -r python/requirements.txt                  # Linux und macOS
.venv\Scripts\pip.exe install -r python\requirements.txt          # Windows
```

**3. In einem zweiten Terminal starten** und offen lassen, solange der Bot läuft:

```bash
.venv/bin/python python/server.py                 # Linux und macOS
.venv\Scripts\python.exe python\server.py         # Windows
```

Abkürzungen, wenn `python` im `PATH` liegt: `npm run ia` (Windows und macOS) oder
`npm run ia:linux`.

**Prüfung:** Das hier liefert `"ok": true` mit dem Zustand von `voice` und `images`:

```bash
curl http://127.0.0.1:5050/health
```

Der Bot erkennt den Dienst beim Start selbst und sagt dir, welche Sprach-Engine er nutzt.
Die Modelle werden beim ersten Einsatz geladen: etwa 150 MB für Whisper und etwa 4 GB für
Bilder, gespeichert in `data/models/`.

Nützliche Variablen:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

Mit einer 4-GB-GPU lass `PYTHON_IMAGE_UNLOAD=true`, damit Ollama die VRAM nach jedem Bild
zurückbekommt.

---

## Optional: Bilder erzeugen

Bilder sind standardmäßig aus, weil sie auf kleinen GPUs langsam sind. Zum Einschalten in
der `.env`:

```dotenv
IMAGE_GEN_ENABLED=true
```

und die zusätzlichen Abhängigkeiten in derselben Umgebung installieren:

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

Ohne NVIDIA-GPU zuerst die CPU-Version von torch installieren:

```bash
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
```

Bilder werden von Hand angefordert: `!claw imagen <was du willst>`.

---

## Prüfen, ob alles läuft

| Befehl | Was er prüft | Ollama nötig? |
| --- | --- | --- |
| `npm run doctor` | Ollama, Modelle, Datenbank, Sprache, Speicher | Ja |
| `npm test` | Die komplette Testreihe | Ja |
| `npm run test:python` | Den Vertrag Node ↔ Python-Dienst | Nein |
| `npm run test:web` | Anmeldungen und API | Nein |
| `npm run test:subjects` | Fächererkennung | Nein |
| `npm run test:vetados` | Sperren per Nummer und per `@lid` | Nein |
| `npm run test:i18n` | Die 100 Sprachen | Nein |

Wenn `doctor` grün ist, bist du fertig. Zum Ausprobieren ohne WhatsApp:

```bash
npm run sim
```

```
welche Mathe-Hausaufgaben gibt es?
Ana: Seiten 30 bis 32
welche Mathe-Hausaufgaben gibt es?
die Geschichtsklausur ist am 20. Oktober
Claw, wie viel ist 2+2?
```

---

## Mit Homebrew installieren (macOS und Linux)

Es gibt einen Tap mit einer Formel für die Befehle `claw` und `claw-ia`:

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 und neuer
brew install claw
claw
```

Der erste Start lädt die Node-Abhängigkeiten nach `~/.local/share/claw` und legt die Daten
in `~/.local/share/claw/data` ab. Wenn du deinen eigenen Ordner willst:

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

Für den Sprach- und Bilddienst:

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"  # nur Bilder
claw-ia
```

> Der Tap liegt bei `Uyruw3/homebrew-claw`, weil die Projektorganisation keine Repos von
> diesem Konto aus erlaubt. Zieht er zu `ClawProject` um, lautet der Befehl
> `brew tap ClawProject/claw`.

---

## Aktualisieren

```bash
git pull
npm install
```

Wenn sich die `python/requirements*.txt` auch geändert haben:

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

Node und den Python-Dienst neu starten. Mit Homebrew: `brew update && brew upgrade claw`.

---

## Probleme und Lösungen

| Was du siehst | Was zu tun ist |
| --- | --- |
| `npm start` findet Ollama nicht | Ollama-App öffnen oder `ollama serve` starten, dann `curl http://127.0.0.1:11434/api/tags` prüfen |
| Kein QR-Code erscheint | Zuerst die Sprache unter `http://localhost:3000/setup` wählen |
| Der Bot sagt nichts in der Gruppe | `!claw aqui` in der Gruppe, dann `!claw`; mit `LOG_LEVEL=debug` siehst du, warum jede Nachricht verworfen wird |
| Sprachnachrichten gehen nicht | `python/server.py` starten und `npm run doctor` laufen lassen; ohne Python ffmpeg installieren und Terminal neu öffnen |
| `faster-whisper` scheitert mit `metadata_errors` | `.venv/bin/pip install 'av<19'` |
| CUDA lädt nicht (`libcublas.so.12`) | Whisper wechselt selbst auf CPU; für die GPU CUDA-Runtime und ein torch mit CUDA installieren |
| Das erste Bild dauert ewig | Es lädt das diffusers-Modell (~4 GB); danach geht es schnell |
| Die Webseite schickt keine Zugangscodes | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` und `SMTP_PASSWORD` ausfüllen; testen mit `npm run smtp -- deine-mail@alu.edu.gva.es` |
| PowerShell blockiert `npm.ps1` | `npm.cmd` nutzen oder `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` in einem neuen Terminal |
| `ollama pull` hat keinen Platz mehr | Die Modelle brauchen ~5 GB; Platz freimachen oder ein kleineres Modell nehmen |

Immer noch festgefahren? `npm run doctor` laufen lassen und die Ausgabe zeigen:

```bash
npm run doctor > doctor.txt
```

---

## Wie der Ordner aussieht

```
TheClawRepo/
├─ src/                 Bot-Code (Node)
├─ python/              Sprach- und Bilddienst
├─ docs/                Webseite und Dokumentation
├─ sdserver/            optionaler stable-diffusion.cpp-Motor
├─ data/                Sitzung, Datenbank, Fotos und Modelle (nicht in Git)
├─ .env                 deine Konfiguration (nicht in Git)
├─ package.json
└─ arrancar.bat         Start mit Doppelklick unter Windows
```
