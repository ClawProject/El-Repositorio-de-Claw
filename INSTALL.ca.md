# Instal·lar Claw

[English](INSTALL.md) · [Español](INSTALL.es.md) · **Català** · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

Claw és un bot de WhatsApp que funciona al teu propi ordinador. Necessita dues coses:
**Node.js** (el bot, el panell web i la base de dades) i **Ollama** (la IA local).
Les notes de veu i la generació d'imatges són **opcionals** i necessiten un petit
servei de Python.

Cada pas acaba amb una **Comprovació**: si veus el que diu, aquell pas està fet i pots
seguir. Si alguna cosa no quadra, salta a [Problemes i solucions](#problemes-i-solucions).

---

## Què necessites

| Obligatori | Versió | Per a què |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 22 o superior | Bot, panell web, base de dades |
| [Ollama](https://ollama.com) | versió actual | IA de text local |
| [Git](https://git-scm.com) | qualsevol | Descarregar i actualitzar |
| Espai lliure | ~6 GB | Els dos models d'Ollama |

| Opcional | Versió | Per a què |
| --- | --- | --- |
| Python | 3.11 o 3.12 | Transcriure veu i generar imatges |
| ffmpeg | versió actual | Veu sense Python |
| GPU NVIDIA | 4 GB de VRAM | IA més ràpida; amb CPU també va |

Funciona a Linux, macOS i Windows, i necessita uns 8 GB de RAM. Amb una GPU de 4 GB,
`qwen3:4b` i `qwen2.5:3b` hi caben de sobres; amb més memòria pots fer servir models més grans.

---

## Camí ràpid (uns 10 minuts)

### 1. Instal·lar Node.js

**Linux i macOS** (nvm, recomanat):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# tanca i torna a obrir el terminal, i després:
nvm install 22
nvm alias default 22
```

**macOS** amb Homebrew: `brew install node`

**Windows**, a PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
```

Tanca i torna a obrir el terminal perquè s'actualitzi el `PATH`.

**Comprovació:** `node --version` imprimeix `v22.` o superior.

### 2. Instal·lar Ollama i els models

```bash
# Linux i macOS
curl -fsSL https://ollama.com/install.sh | sh

# macOS amb Homebrew
brew install ollama && brew services start ollama

# Windows (PowerShell)
winget install Ollama.Ollama
```

Després baixa els dos models (uns 5 GB, només una vegada):

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

**Comprovació:** `ollama list` mostra els dos models, i això respon amb JSON:

```bash
curl http://127.0.0.1:11434/api/tags
```

A Windows, si falla, obre l'aplicació d'Ollama des del menú d'inici.

### 3. Descarregar el projecte

```bash
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

**Comprovació:** `ls` (o `dir` a Windows) mostra `package.json`.

> Baixa't el ZIP només si no vols actualitzacions: perds l'historial i `git pull`.

### 4. Instal·lar les dependències

```bash
npm install
```

A Windows, si PowerShell es queixa de `npm.ps1`, fes servir `npm.cmd install`.

També pots fer doble clic a **`arrancar.bat`** (Windows): instal·la el que falti, crea
`.env` si no existeix i arrenca el bot.

**Comprovació:** acaba sense errors.

### 5. Configurar `.env`

```bash
cp .env.example .env          # Linux i macOS
Copy-Item .env.example .env   # Windows (PowerShell)
```

La plantilla ja serveix: apunta a Ollama en aquest ordinador i als dos models que acabes
de baixar. Només cal editar-la si Ollama és en un altre lloc, si fas servir un altre
model, o per posar el correu dels codis d'accés.

Dues coses que convé saber:

- **No pugis `.env` a Git.** Porta el teu número, el teu correu i contrasenyes. Ja és a
  `.gitignore`.
- Si fas servir `PICKLEBRAIN_DATA_DIR`, el `.env` pot ser dins d'aquella carpeta de dades.

**Comprovació:** `.env` és al costat de `package.json`.

### 6. Arrencar-lo per primera vegada

```bash
npm start
```

El primer cop, el navegador obre `http://localhost:3000/setup` per triar l'idioma (n'hi ha
100). L'elecció es guarda a la base de dades i el bot no es connecta a WhatsApp fins que
tries un.

Després apareix un **codi QR** al terminal. Escaneja'l amb
**WhatsApp → Configuració → Dispositius vinculats → Vincular un dispositiu**.

La sessió es guarda a `data/auth/` (o a `PICKLEBRAIN_DATA_DIR/auth`). No comparteixis
aquesta carpeta: és l'accés al teu compte.

**Comprovació:** el terminal diu que està connectat i el mòbil mostra el dispositiu
vinculat. Escriu `!claw` al grup i contesta amb el seu estat.

Altres maneres d'arrencar-lo:

| Ordre | Què arrenca |
| --- | --- |
| `npm start` | Tot: WhatsApp, panell web i recordatoris |
| `npm run web` | Només el panell web i l'API, sense WhatsApp |
| `npm run sim` | Simulador al terminal, sense WhatsApp ni QR |

---

## Vincular el teu grup

Dins del grup, escriu:

```
!claw aqui
```

Això guarda l'**identificador** del grup (mai el nom, perquè es repeteix i qualsevol el
pot canviar). També pots posar `WHATSAPP_GROUP_JID` al `.env`.

Si el bot es queda callat, gairebé sempre és el normal: només parla quan algú pregunta
per deures o exàmens, o quan s'escriu `Claw` i una pregunta.

---

## Opcional: veu i imatges (servei de Python)

Sense aquest servei el bot continua funcionant: la veu fa servir ffmpeg i Whisper dins de
Node, i les imatges fan servir `sd-cli`. Amb ell tens `faster-whisper` (més ràpid) i
`diffusers` (millors imatges). **Si només vols que contesti deures, salta a
[Comprovar que tot va](#comprovar-que-tot-va).**

**1. Crear l'entorn virtual** (des de l'arrel del projecte):

```bash
python3.12 -m venv .venv      # Linux i macOS
py -3.12 -m venv .venv        # Windows
```

Si no tens Python 3.12: `sudo apt install python3.12 python3.12-venv` (Debian i Ubuntu)
o `brew install python@3.12` (macOS).

**2. Instal·lar les dependències:**

```bash
.venv/bin/pip install -r python/requirements.txt                  # Linux i macOS
.venv\Scripts\pip.exe install -r python\requirements.txt          # Windows
```

**3. Arrencar-lo en un altre terminal** i deixar-lo obert mentre el bot funciona:

```bash
.venv/bin/python python/server.py                 # Linux i macOS
.venv\Scripts\python.exe python\server.py         # Windows
```

Dreceres, si `python` és al `PATH`: `npm run ia` (Windows i macOS) o `npm run ia:linux`.

**Comprovació:** això retorna `"ok": true` amb l'estat de `voice` i `images`:

```bash
curl http://127.0.0.1:5050/health
```

El bot detecta el servei sol en arrencar i et diu quin motor de veu està fent servir. Els
models es baixen el primer cop que es fan servir: uns 150 MB el de Whisper i uns 4 GB el
d'imatges, guardats a `data/models/`.

Variables útils:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

Amb una GPU de 4 GB, deixa `PYTHON_IMAGE_UNLOAD=true` perquè Ollama recuperi la VRAM
després de cada imatge.

---

## Opcional: generar imatges

Les imatges estan apagades de fàbrica perquè en GPU petites van lentes. Per activar-les,
posa a `.env`:

```dotenv
IMAGE_GEN_ENABLED=true
```

i instal·la les dependències extra al mateix entorn:

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

Sense GPU NVIDIA, instal·la abans la versió de CPU de torch:

```bash
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
```

Les imatges es demanen a mà amb `!claw imagen <el que vulguis>`.

---

## Comprovar que tot va

| Ordre | Què comprova | Necessita Ollama? |
| --- | --- | --- |
| `npm run doctor` | Ollama, models, base de dades, veu, disc | Sí |
| `npm test` | Tota la bateria de proves | Sí |
| `npm run test:python` | El contracte Node ↔ servei de Python | No |
| `npm run test:web` | Accessos i API | No |
| `npm run test:subjects` | Detecció d'assignatures | No |
| `npm run test:vetados` | Vedar per número i per `@lid` | No |
| `npm run test:i18n` | Els 100 idiomes | No |

Si `doctor` surt en verd, ja està. Per provar-lo sense WhatsApp:

```bash
npm run sim
```

```
quins deures hi ha de mates?
Ana: pàgines 30 a 32
quins deures hi ha de mates?
l'examen d'història és el 20 d'octubre
Claw, quant són 2+2?
```

---

## Instal·lar amb Homebrew (macOS i Linux)

Hi ha un tap amb una fórmula que instal·la les ordres `claw` i `claw-ia`:

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 i posteriors
brew install claw
claw
```

El primer cop baixa les dependències de Node a `~/.local/share/claw` i guarda les dades a
`~/.local/share/claw/data`. Si prefereixes la teva carpeta:

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

Per al servei de veu i imatges:

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"  # només imatges
claw-ia
```

> El tap és a `Uyruw3/homebrew-claw` perquè l'organització del projecte no permet crear
> repositoris des d'aquell compte. Si passa a `ClawProject`, l'ordre serà
> `brew tap ClawProject/claw`.

---

## Actualitzar

```bash
git pull
npm install
```

Si també han canviat els `python/requirements*.txt`:

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

Reinicia Node i el servei de Python. Amb Homebrew: `brew update && brew upgrade claw`.

---

## Problemes i solucions

| Què veus | Què fer |
| --- | --- |
| `npm start` no troba Ollama | Obre l'aplicació d'Ollama o executa `ollama serve`, i comprova `curl http://127.0.0.1:11434/api/tags` |
| No apareix el codi QR | Tria abans l'idioma a `http://localhost:3000/setup` |
| El bot no diu res al grup | `!claw aqui` dins del grup i després `!claw`; amb `LOG_LEVEL=debug` veus per què es descarta cada missatge |
| Les notes de veu no van | Arrenca `python/server.py` i executa `npm run doctor`; sense Python, instal·la ffmpeg i torna a obrir el terminal |
| `faster-whisper` falla amb `metadata_errors` | `.venv/bin/pip install 'av<19'` |
| CUDA no carrega (`libcublas.so.12`) | Whisper passa a CPU sol; per fer servir la GPU, instal·la el runtime de CUDA i un torch amb CUDA |
| La primera imatge triga moltíssim | Està baixant el model de diffusers (~4 GB); les següents van ràpid |
| La web no envia codis d'accés | Omple `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` i `SMTP_PASSWORD`; prova-ho amb `npm run smtp -- el-teu-correu@alu.edu.gva.es` |
| PowerShell bloqueja `npm.ps1` | Fes servir `npm.cmd`, o `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` en un terminal nou |
| `ollama pull` es queda sense espai | Els models ocupen ~5 GB; allibera espai o fes servir un model més petit |

Si segueixes encallat, executa `npm run doctor` i enganxa el que surti:

```bash
npm run doctor > doctor.txt
```

---

## Com queda la carpeta

```
TheClawRepo/
├─ src/                 codi del bot (Node)
├─ python/              servei de veu i imatges
├─ docs/                web i documentació
├─ sdserver/            motor opcional stable-diffusion.cpp
├─ data/                sessió, base de dades, fotos i models (fora de Git)
├─ .env                 la teva configuració (fora de Git)
├─ package.json
└─ arrancar.bat         arrencada d'un doble clic a Windows
```
