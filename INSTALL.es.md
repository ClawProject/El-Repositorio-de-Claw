# Instalar Claw

[English](INSTALL.md) · **Español** · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

Claw es un bot de WhatsApp que funciona en tu propio ordenador. Necesita dos cosas:
**Node.js** (el bot, el panel web y la base de datos) y **Ollama** (la IA local).
Las notas de voz y la generación de imágenes son **opcionales** y necesitan un
pequeño servicio de Python.

Cada paso termina con un **Comprobación**: si ves lo que dice, ese paso está hecho y
puedes seguir. Si algo no cuadra, salta a [Problemas y soluciones](#problemas-y-soluciones).

---

## Qué necesitas

| Obligatorio | Versión | Para qué |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 22 o superior | Bot, panel web, base de datos |
| [Ollama](https://ollama.com) | versión actual | IA de texto local |
| [Git](https://git-scm.com) | cualquiera | Descargar y actualizar |
| Espacio libre | ~6 GB | Los dos modelos de Ollama |

| Opcional | Versión | Para qué |
| --- | --- | --- |
| Python | 3.11 o 3.12 | Transcribir voz y generar imágenes |
| ffmpeg | versión actual | Voz sin Python |
| GPU NVIDIA | 4 GB de VRAM | IA más rápida; con CPU también va |

Funciona en Linux, macOS y Windows, y necesita unos 8 GB de RAM. Con una GPU de 4 GB,
`qwen3:4b` y `qwen2.5:3b` entran de sobra; con más memoria puedes usar modelos mayores.

---

## Camino rápido (unos 10 minutos)

### 1. Instalar Node.js

**Linux y macOS** (nvm, recomendado):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# cierra y vuelve a abrir el terminal, y después:
nvm install 22
nvm alias default 22
```

**macOS** con Homebrew: `brew install node`

**Windows**, en PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
```

Cierra y vuelve a abrir el terminal para que se actualice el `PATH`.

**Comprobación:** `node --version` imprime `v22.` o superior.

### 2. Instalar Ollama y los modelos

```bash
# Linux y macOS
curl -fsSL https://ollama.com/install.sh | sh

# macOS con Homebrew
brew install ollama && brew services start ollama

# Windows (PowerShell)
winget install Ollama.Ollama
```

Después descarga los dos modelos (unos 5 GB, solo una vez):

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

**Comprobación:** `ollama list` enseña los dos modelos, y esto responde con JSON:

```bash
curl http://127.0.0.1:11434/api/tags
```

En Windows, si falla, abre la aplicación de Ollama desde el menú de inicio.

### 3. Descargar el proyecto

```bash
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

**Comprobación:** `ls` (o `dir` en Windows) enseña `package.json`.

> Descarga el ZIP solo si no quieres actualizaciones: pierdes el historial y `git pull`.

### 4. Instalar las dependencias

```bash
npm install
```

En Windows, si PowerShell se queja de `npm.ps1`, usa `npm.cmd install`.

También puedes hacer doble clic en **`arrancar.bat`** (Windows): instala lo que falte,
crea `.env` si no existe y arranca el bot.

**Comprobación:** termina sin errores.

### 5. Configurar `.env`

```bash
cp .env.example .env          # Linux y macOS
Copy-Item .env.example .env   # Windows (PowerShell)
```

La plantilla ya vale: apunta a Ollama en este ordenador y a los dos modelos que acabas
de descargar. Solo hay que editarla si Ollama está en otro sitio, si usas otro modelo,
o para poner el correo de los códigos de acceso.

Dos cosas que conviene saber:

- **No subas `.env` a Git.** Lleva tu número, tu correo y contraseñas. Ya está en
  `.gitignore`.
- Si usas `PICKLEBRAIN_DATA_DIR`, el `.env` puede estar dentro de esa carpeta de datos.

**Comprobación:** `.env` está junto a `package.json`.

### 6. Arrancarlo por primera vez

```bash
npm start
```

La primera vez, el navegador abre `http://localhost:3000/setup` para elegir el idioma
(hay 100). La elección se guarda en la base de datos y el bot no se conecta a WhatsApp
hasta que elijas uno.

Después aparece un **código QR** en el terminal. Escanéalo con
**WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo**.

La sesión se guarda en `data/auth/` (o en `PICKLEBRAIN_DATA_DIR/auth`). No compartas esa
carpeta: es el acceso a tu cuenta.

**Comprobación:** el terminal dice que está conectado y el móvil enseña el dispositivo
vinculado. Escribe `!claw` en el grupo y contesta con su estado.

Otras formas de arrancarlo:

| Comando | Qué arranca |
| --- | --- |
| `npm start` | Todo: WhatsApp, panel web y recordatorios |
| `npm run web` | Solo el panel web y la API, sin WhatsApp |
| `npm run sim` | Simulador en el terminal, sin WhatsApp ni QR |

---

## Vincular tu grupo

Dentro del grupo, escribe:

```
!claw aqui
```

Eso guarda el **identificador** del grupo (nunca el nombre, porque se repite y cualquiera
lo cambia). También puedes poner `WHATSAPP_GROUP_JID` en el `.env`.

Si el bot se queda callado, casi siempre es lo normal: solo habla cuando alguien pregunta
por deberes o exámenes, o cuando se escribe `Claw` y una pregunta.

---

## Opcional: voz e imágenes (servicio de Python)

Sin este servicio el bot sigue funcionando: la voz usa ffmpeg y Whisper dentro de Node,
y las imágenes usan `sd-cli`. Con él tienes `faster-whisper` (más rápido) y `diffusers`
(mejores imágenes). **Si solo quieres que conteste deberes, salta a
[Comprobar que todo va](#comprobar-que-todo-va).**

**1. Crear el entorno virtual** (desde la raíz del proyecto):

```bash
python3.12 -m venv .venv      # Linux y macOS
py -3.12 -m venv .venv        # Windows
```

Si no tienes Python 3.12: `sudo apt install python3.12 python3.12-venv` (Debian y Ubuntu)
o `brew install python@3.12` (macOS).

**2. Instalar las dependencias:**

```bash
.venv/bin/pip install -r python/requirements.txt                  # Linux y macOS
.venv\Scripts\pip.exe install -r python\requirements.txt          # Windows
```

**3. Arrancarlo en otro terminal** y dejarlo abierto mientras el bot funciona:

```bash
.venv/bin/python python/server.py                 # Linux y macOS
.venv\Scripts\python.exe python\server.py         # Windows
```

Atajos, si `python` está en el `PATH`: `npm run ia` (Windows y macOS) o `npm run ia:linux`.

**Comprobación:** esto devuelve `"ok": true` con el estado de `voice` e `images`:

```bash
curl http://127.0.0.1:5050/health
```

El bot detecta el servicio solo al arrancar y te dice qué motor de voz está usando. Los
modelos se descargan la primera vez que se usan: unos 150 MB el de Whisper y unos 4 GB
el de imágenes, guardados en `data/models/`.

Variables útiles:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

Con una GPU de 4 GB, deja `PYTHON_IMAGE_UNLOAD=true` para que Ollama recupere la VRAM
después de cada imagen.

---

## Opcional: generar imágenes

Las imágenes están apagadas de fábrica porque en GPU pequeñas van lentas. Para activarlas,
pon en `.env`:

```dotenv
IMAGE_GEN_ENABLED=true
```

e instala las dependencias extra en el mismo entorno:

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

Sin GPU NVIDIA, instala antes la versión de CPU de torch:

```bash
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
```

Las imágenes se piden a mano con `!claw imagen <lo que quieras>`.

---

## Comprobar que todo va

| Comando | Qué comprueba | ¿Necesita Ollama? |
| --- | --- | --- |
| `npm run doctor` | Ollama, modelos, base de datos, voz, disco | Sí |
| `npm test` | Toda la batería de pruebas | Sí |
| `npm run test:python` | El contrato Node ↔ servicio de Python | No |
| `npm run test:web` | Accesos y API | No |
| `npm run test:subjects` | Detección de asignaturas | No |
| `npm run test:vetados` | Vetar por número y por `@lid` | No |
| `npm run test:i18n` | Los 100 idiomas | No |

Si `doctor` sale en verde, ya está. Para probarlo sin WhatsApp:

```bash
npm run sim
```

```
¿qué deberes hay de mates?
Ana: páginas 30 a 32
¿qué deberes hay de mates?
el examen de historia es el 20 de octubre
Claw, ¿cuánto son 2+2?
```

---

## Instalar con Homebrew (macOS y Linux)

Hay un tap con una fórmula que instala los comandos `claw` y `claw-ia`:

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 y posteriores
brew install claw
claw
```

La primera vez descarga las dependencias de Node a `~/.local/share/claw` y guarda los
datos en `~/.local/share/claw/data`. Si prefieres tu propia carpeta:

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

Para el servicio de voz e imágenes:

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"  # solo imágenes
claw-ia
```

> El tap está en `Uyruw3/homebrew-claw` porque la organización del proyecto no permite
> crear repositorios desde esa cuenta. Si pasa a `ClawProject`, el comando será
> `brew tap ClawProject/claw`.

---

## Actualizar

```bash
git pull
npm install
```

Si también han cambiado los `python/requirements*.txt`:

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

Reinicia Node y el servicio de Python. Con Homebrew: `brew update && brew upgrade claw`.

---

## Problemas y soluciones

| Lo que ves | Qué hacer |
| --- | --- |
| `npm start` no encuentra Ollama | Abre la aplicación de Ollama o ejecuta `ollama serve`, y comprueba `curl http://127.0.0.1:11434/api/tags` |
| No aparece el código QR | Elige antes el idioma en `http://localhost:3000/setup` |
| El bot no dice nada en el grupo | `!claw aqui` dentro del grupo y luego `!claw`; con `LOG_LEVEL=debug` ves por qué se descarta cada mensaje |
| Las notas de voz no van | Arranca `python/server.py` y ejecuta `npm run doctor`; sin Python, instala ffmpeg y reabre el terminal |
| `faster-whisper` falla con `metadata_errors` | `.venv/bin/pip install 'av<19'` |
| CUDA no carga (`libcublas.so.12`) | Whisper pasa a CPU solo; para usar la GPU, instala el runtime de CUDA y un torch con CUDA |
| La primera imagen tarda muchísimo | Está descargando el modelo de diffusers (~4 GB); las siguientes van rápidas |
| La web no manda códigos de acceso | Rellena `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` y `SMTP_PASSWORD`; pruébalo con `npm run smtp -- tu-correo@alu.edu.gva.es` |
| PowerShell bloquea `npm.ps1` | Usa `npm.cmd`, o `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` en un terminal nuevo |
| `ollama pull` se queda sin espacio | Los modelos ocupan ~5 GB; libera espacio o usa un modelo más pequeño |

Si sigues atascado, ejecuta `npm run doctor` y pega lo que salga:

```bash
npm run doctor > doctor.txt
```

---

## Cómo queda la carpeta

```
TheClawRepo/
├─ src/                 código del bot (Node)
├─ python/              servicio de voz e imágenes
├─ docs/                web y documentación
├─ sdserver/            motor opcional stable-diffusion.cpp
├─ data/                sesión, base de datos, fotos y modelos (fuera de Git)
├─ .env                 tu configuración (fuera de Git)
├─ package.json
└─ arrancar.bat         arranque de un doble clic en Windows
```
