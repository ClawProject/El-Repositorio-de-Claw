# Instal·lar Claw

[English](INSTALL.md) · [Español](INSTALL.es.md) · **Català** · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

Claw consta de dos processos:

1. **Node.js** (obligatori): el bot de WhatsApp, la interfície web, la base de dades i la lògica.
2. **Python** (opcional, recomanat): transcriu notes de veu amb faster-whisper i
   genera imatges amb diffusers. Si no està en marxa, Node fa servir els seus
   motors antics.

Aquesta guia cobreix Linux, macOS i Windows. Per a informació general sobre el bot,
consulta el [README](README.ca.md); per al servei de Python, [`python/README.md`](python/README.md).

---

## 1. Requisits

| Component | Versió | Per a què |
|---|---|---|
| Git | Qualsevol versió recent | Descarregar i actualitzar el projecte |
| Node.js | 22 o superior (es recomana 24 LTS) | Bot, interfície web i base de dades |
| Ollama | Versió recent | IA de text local |
| Python | 3.11 o 3.12 | Servei de veu i imatges (opcional) |
| ffmpeg | Versió recent | Alternativa de veu si no uses Python (opcional) |

La IA de text necessita descarregar models d'Ollama. Amb una GTX 1650 de 4 GB,
`qwen3:4b` i `qwen2.5:3b` funcionen; amb més memòria pots usar models més grans.

---

## 2. Descarregar el projecte (`git clone`)

### Linux i macOS

```bash
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

### Windows (PowerShell)

```powershell
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

> Si ja l'has descarregat, actualitza'l amb `git pull` dins la carpeta. No descarreguis
> un ZIP: perdràs l'historial i la possibilitat d'actualitzar.

---

## 3. Instal·lar Node.js

### Linux i macOS amb nvm (recomanat)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# tanca i torna a obrir la terminal, o executa:
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

nvm install 22
nvm alias default 22
node --version       # ha de mostrar v22.x o superior
npm --version
```

### macOS amb Homebrew

```bash
brew install node
```

### Windows

Descarrega l'instal·lador LTS des de [nodejs.org](https://nodejs.org/) o fes servir:

```powershell
winget install OpenJS.NodeJS.LTS
```

Tanca i torna a obrir PowerShell perquè s'actualitzi el `PATH`.

---

## 4. Instal·lar Ollama i els models

### Linux i macOS

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

O amb Homebrew:

```bash
brew install ollama
brew services start ollama
```

### Windows

```powershell
winget install Ollama.Ollama
```

Després, en qualsevol terminal:

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

Comprova que respon:

```bash
ollama list
curl http://127.0.0.1:11434/api/tags
```

---

## 5. Instal·lar les dependències de Node

Des de l'arrel del projecte:

```bash
npm install
```

A Windows, si PowerShell es queixa de `npm.ps1`, fes servir `npm.cmd install`.

També pots fer doble clic a **`arrancar.bat`** (Windows): instal·la les
dependències que falten, crea `.env` si no existeix i arrenca el bot.

---

## 6. Configurar `.env`

Copia la plantilla i edita-la:

```bash
cp .env.example .env
```

A Windows:

```powershell
Copy-Item .env.example .env
notepad .env
```

Configuració mínima per començar:

```dotenv
OLLAMA_MODEL=qwen3:4b
OLLAMA_MODEL_BRAIN=qwen2.5:3b
# Identificador del grup (o escriu "!claw aqui" dins del grup)
WHATSAPP_GROUP_JID=120363000000000000@g.us
```

- Pots vincular el grup més tard escrivint `!claw aqui` a WhatsApp; només es
  guarda l'identificador, mai el nom del grup.
- Si uses `PICKLEBRAIN_DATA_DIR`, el fitxer `.env` pot ser dins d'aquesta
  carpeta de dades.
- Gairebé tot es pot canviar amb el bot en marxa des de `!claw ajustes`;
  reinicia després d'editar `.env` a mà.
- **No pugis `.env` a Git**: conté adreces de correu, contrasenyes i el teu número de telèfon.
  Ja està inclòs a `.gitignore`.

Totes les variables estan documentades a [`.env.example`](.env.example) i al
[README](README.ca.md).

---

## 7. Servei de veu i imatges amb Python (opcional, recomanat)

Sense aquest servei Claw continua funcionant: la veu fa servir ffmpeg + Whisper a Node i
les imatges fan servir `sd-cli` o un servidor HTTP. Amb Python obtens
`faster-whisper` (més ràpid) i `diffusers`.

### 7.1 Crear l'entorn virtual

Des de l'arrel del projecte:

```bash
python3.12 -m venv .venv
```

Si el teu sistema no té `python3.12`, instal·la'l:

```bash
# Debian/Ubuntu
sudo apt install python3.12 python3.12-venv

# macOS amb Homebrew
brew install python@3.12
```

A Windows:

```powershell
py -3.12 -m venv .venv
```

### 7.2 Instal·lar dependències

```bash
# Linux/macOS
.venv/bin/pip install -r python/requirements.txt

# Windows
.venv\Scripts\pip.exe install -r python/requirements.txt
```

Només si vols generar imatges amb diffusers:

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

> Sense GPU NVIDIA, instal·la abans la versió CPU de torch:
>
> ```bash
> .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
> ```
>
> Amb GPU NVIDIA, torch ha de ser la versió CUDA. Si Whisper detecta CUDA però
> falten `libcublas`/cuDNN, el servei passa automàticament a CPU.

### 7.3 Arrencar el servei

En **una altra terminal**, des de l'arrel del projecte:

```bash
# Linux/macOS
.venv/bin/python python/server.py

# Windows
.venv\Scripts\python.exe python\server.py
```

També pots fer servir:

```bash
npm run ia          # Windows/macOS si "python" és al PATH
npm run ia:linux    # Linux
```

Comprova que respon:

```bash
curl http://127.0.0.1:5050/health
```

Ha de retornar `"ok": true` i l'estat de `voice` i `images`. El bot el detecta
automàticament en arrencar i mostra quin motor de veu està usant.

### 7.4 Models

La primera transcripció descarrega el model de Whisper (~150 MB amb `base`). La
primera imatge descarrega el model de diffusers (uns 4 GB amb SD 1.5). Es guarden
a `data/models/`, que Git ignora.

Variables útils:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

Amb una GPU de 4 GB, deixa `PYTHON_IMAGE_UNLOAD=true` perquè Ollama recuperi
la VRAM després de cada imatge.

---

## 8. Arrencar Claw

```bash
npm start       # bot complet: WhatsApp + web + recordatoris
npm run web     # només web/API, sense connectar a WhatsApp
npm run sim     # simulador de consola, sense WhatsApp
```

La primera vegada, Claw obre el navegador a `http://localhost:3000/setup` perquè
triïs l'idioma (n'hi ha 100). L'elecció es guarda a la base de dades i el bot no
es connecta a WhatsApp fins que en tries un. Pots canviar-lo després des de
WhatsApp amb `!claw language en` (propietari/administradors) o tornant a `/setup`.

Després, `npm start` mostra un **codi QR**. Escaneja'l a WhatsApp:

**Configuració → Dispositius vinculats → Vincular un dispositiu**

La sessió es guarda a `data/auth/` (o a `PICKLEBRAIN_DATA_DIR/auth`). No
comparteixis aquesta carpeta: dona accés al teu compte.

---

## 9. Verificar la instal·lació

```bash
npm run doctor      # Ollama, models, base de dades, veu, etc.
npm run test:python # contracte entre Node i el servei de Python (sense models)
npm run test:web    # autenticació i API
npm run test:subjects
npm run test:vetados # prohibir per número i per @lid (sense Ollama)
```

`npm test` executa tota la bateria i **necessita Ollama en marxa**.

Prova ràpida al simulador:

```bash
npm run sim
```

```
nois, quins deures de matemàtiques hi ha?
Ana: cal fer les pàgines 30 a 32
quins deures de matemàtiques hi ha?
l'examen d'història és el 20 d'octubre
Claw, quant és 2+2?
```

---

## 10. Instal·lació amb Homebrew (macOS i Linux)

Hi ha un tap amb una fórmula per instal·lar les comandes `claw` i `claw-ia`:

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 i posteriors
brew install claw
```

La primera execució descarrega les dependències de Node a
`~/.local/share/claw` i guarda les dades a `~/.local/share/claw/data`.

```bash
claw
```

Si prefereixes gestionar tu la carpeta:

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

Per al servei de veu i imatges amb Python:

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"

# Només si vols generar imatges:
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"

claw-ia
```

Per actualitzar:

```bash
brew update
brew upgrade claw
```

> El tap és a `Uyruw3/homebrew-claw` perquè l'organització del projecte
> no permet crear repositoris des d'aquest compte. Es pot transferir a
> `ClawProject` més endavant; la comanda seria llavors `brew tap ClawProject/claw`.
>
> La fórmula instal·la l'última versió estable publicada. Quan en surti una de nova,
> el tap s'actualitza amb `brew update && brew upgrade claw`.

---

## 11. Actualitzar el projecte

Si el vas instal·lar amb `git clone`:

```bash
git pull
npm install
```

Si també han canviat els `python/requirements*.txt`:

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

Reinicia Node i el servei de Python després d'actualitzar.

---

## 12. Problemes freqüents

**`npm start` no troba Ollama.**
Obre l'aplicació d'Ollama o executa `ollama serve`. Comprova amb
`curl http://127.0.0.1:11434/api/tags`.

**El bot no diu res al grup.**
1. Comprova que està vinculat: escriu `!claw aqui` dins del grup o posa
   `WHATSAPP_GROUP_JID`.
2. Escriu `!claw` per veure l'estat.
3. Arrenca amb `LOG_LEVEL=debug` per veure per què es descarta cada missatge.

**Les notes de veu no funcionen.**
Arrenca `python/server.py` i comprova `npm run doctor`. Si no uses Python, instal·la
ffmpeg i torna a obrir la terminal.

**`faster-whisper` falla amb `metadata_errors`.**
Tens `av` 19. Fixa la versió:

```bash
.venv/bin/pip install 'av<19'
```

**CUDA no carrega (`libcublas.so.12`).**
Whisper passa automàticament a CPU. Si vols usar la GPU, instal·la el runtime
de CUDA i una versió de torch amb CUDA. Mentrestant, la veu funciona a CPU.

**La primera imatge triga molt.**
S'està descarregant el model de diffusers (~4 GB). Les següents triguen només el
que dura la generació.

**La web no envia codis d'accés.**
Configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` i `SMTP_PASSWORD` a `.env`.
Prova-ho amb `npm run smtp -- el-teu-correu@alu.edu.gva.es`.

**PowerShell bloqueja `npm.ps1`.**
Fes servir `npm.cmd` o executa
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` i obre una altra terminal.

---

## 13. Estructura mínima instal·lada

```
TheClawRepo/
├─ src/                 codi del bot (Node)
├─ python/              servei de veu i imatges
├─ docs/                web estàtica i documentació
├─ sdserver/            motor opcional stable-diffusion.cpp
├─ data/                sessió, base de dades, fotos i models (no ho rastreja Git)
├─ .env                 la teva configuració (no la rastreja Git)
├─ package.json
└─ arrancar.bat         script d'arrencada per a Windows
```
