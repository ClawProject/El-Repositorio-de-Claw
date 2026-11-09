# Instalar Claw

[English](INSTALL.md) · **Español** · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

Claw consta de dos procesos:

1. **Node.js** (obligatorio): el bot de WhatsApp, la interfaz web, la base de datos y la lógica.
2. **Python** (opcional, recomendado): transcribe notas de voz con faster-whisper y
   genera imágenes con diffusers. Si no está en marcha, Node usa sus
   motores antiguos.

Esta guía cubre Linux, macOS y Windows. Para información general sobre el bot,
consulta el [README](README.es.md); para el servicio de Python, [`python/README.md`](python/README.md).

---

## 1. Requisitos

| Componente | Versión | Para qué |
|---|---|---|
| Git | Cualquier versión reciente | Descargar y actualizar el proyecto |
| Node.js | 22 o superior (se recomienda 24 LTS) | Bot, interfaz web y base de datos |
| Ollama | Versión reciente | IA de texto local |
| Python | 3.11 o 3.12 | Servicio de voz e imágenes (opcional) |
| ffmpeg | Versión reciente | Alternativa de voz si no usas Python (opcional) |

La IA de texto necesita descargar modelos de Ollama. Con una GTX 1650 de 4 GB,
`qwen3:4b` y `qwen2.5:3b` funcionan; con más memoria puedes usar modelos más grandes.

---

## 2. Descargar el proyecto (`git clone`)

### Linux y macOS

```bash
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

### Windows (PowerShell)

```powershell
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

> Si ya lo descargaste, actualízalo con `git pull` dentro de la carpeta. No descargues
> un ZIP: perderás el historial y la posibilidad de actualizar.

---

## 3. Instalar Node.js

### Linux y macOS con nvm (recomendado)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# cierra y vuelve a abrir la terminal, o ejecuta:
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

nvm install 22
nvm alias default 22
node --version       # debe mostrar v22.x o superior
npm --version
```

### macOS con Homebrew

```bash
brew install node
```

### Windows

Descarga el instalador LTS desde [nodejs.org](https://nodejs.org/) o usa:

```powershell
winget install OpenJS.NodeJS.LTS
```

Cierra y vuelve a abrir PowerShell para que se actualice el `PATH`.

---

## 4. Instalar Ollama y los modelos

### Linux y macOS

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

O con Homebrew:

```bash
brew install ollama
brew services start ollama
```

### Windows

```powershell
winget install Ollama.Ollama
```

Después, en cualquier terminal:

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

Comprueba que responde:

```bash
ollama list
curl http://127.0.0.1:11434/api/tags
```

---

## 5. Instalar las dependencias de Node

Desde la raíz del proyecto:

```bash
npm install
```

En Windows, si PowerShell se queja de `npm.ps1`, usa `npm.cmd install`.

También puedes hacer doble clic en **`arrancar.bat`** (Windows): instala las
dependencias que falten, crea `.env` si no existe y arranca el bot.

---

## 6. Configurar `.env`

Copia la plantilla y edítala:

```bash
cp .env.example .env
```

En Windows:

```powershell
Copy-Item .env.example .env
notepad .env
```

Configuración mínima para empezar:

```dotenv
OLLAMA_MODEL=qwen3:4b
OLLAMA_MODEL_BRAIN=qwen2.5:3b
# Identificador del grupo (o escribe "!claw aqui" dentro del grupo)
WHATSAPP_GROUP_JID=120363000000000000@g.us
```

- Puedes vincular el grupo más tarde escribiendo `!claw aqui` en WhatsApp; solo se
  guarda el identificador, nunca el nombre del grupo.
- Si usas `PICKLEBRAIN_DATA_DIR`, el archivo `.env` puede estar dentro de esa
  carpeta de datos.
- Casi todo se puede cambiar con el bot en marcha desde `!claw ajustes`;
  reinicia después de editar `.env` a mano.
- **No subas `.env` a Git**: contiene direcciones de correo, contraseñas y tu número de teléfono.
  Ya está incluido en `.gitignore`.

Todas las variables están documentadas en [`.env.example`](.env.example) y en el
[README](README.es.md).

---

## 7. Servicio de voz e imágenes con Python (opcional, recomendado)

Sin este servicio Claw sigue funcionando: la voz usa ffmpeg + Whisper en Node y
las imágenes usan `sd-cli` o un servidor HTTP. Con Python obtienes
`faster-whisper` (más rápido) y `diffusers`.

### 7.1 Crear el entorno virtual

Desde la raíz del proyecto:

```bash
python3.12 -m venv .venv
```

Si tu sistema no tiene `python3.12`, instálalo:

```bash
# Debian/Ubuntu
sudo apt install python3.12 python3.12-venv

# macOS con Homebrew
brew install python@3.12
```

En Windows:

```powershell
py -3.12 -m venv .venv
```

### 7.2 Instalar dependencias

```bash
# Linux/macOS
.venv/bin/pip install -r python/requirements.txt

# Windows
.venv\Scripts\pip.exe install -r python/requirements.txt
```

Solo si quieres generar imágenes con diffusers:

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

> Sin GPU NVIDIA, instala antes la versión CPU de torch:
>
> ```bash
> .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
> ```
>
> Con GPU NVIDIA, torch debe ser la versión CUDA. Si Whisper detecta CUDA pero
> faltan `libcublas`/cuDNN, el servicio pasa automáticamente a CPU.

### 7.3 Arrancar el servicio

En **otra terminal**, desde la raíz del proyecto:

```bash
# Linux/macOS
.venv/bin/python python/server.py

# Windows
.venv\Scripts\python.exe python\server.py
```

También puedes usar:

```bash
npm run ia          # Windows/macOS si "python" está en el PATH
npm run ia:linux    # Linux
```

Comprueba que responde:

```bash
curl http://127.0.0.1:5050/health
```

Debe devolver `"ok": true` y el estado de `voice` e `images`. El bot lo detecta
automáticamente al arrancar y muestra qué motor de voz está usando.

### 7.4 Modelos

La primera transcripción descarga el modelo de Whisper (~150 MB con `base`). La
primera imagen descarga el modelo de diffusers (unos 4 GB con SD 1.5). Se guardan
en `data/models/`, que Git ignora.

Variables útiles:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

Con una GPU de 4 GB, deja `PYTHON_IMAGE_UNLOAD=true` para que Ollama recupere
la VRAM después de cada imagen.

---

## 8. Arrancar Claw

```bash
npm start       # bot completo: WhatsApp + web + recordatorios
npm run web     # solo web/API, sin conectar a WhatsApp
npm run sim     # simulador de consola, sin WhatsApp
```

La primera vez, Claw abre el navegador en `http://localhost:3000/setup` para que
elija el idioma (hay 100). La elección se guarda en la base de datos y el bot no
se conecta a WhatsApp hasta que eliges uno. Puedes cambiarlo después desde
WhatsApp con `!claw language en` (dueño/administradores) o volviendo a `/setup`.

Después, `npm start` muestra un **código QR**. Escanéalo en WhatsApp:

**Ajustes → Dispositivos vinculados → Vincular un dispositivo**

La sesión se guarda en `data/auth/` (o en `PICKLEBRAIN_DATA_DIR/auth`). No
compartas esa carpeta: da acceso a tu cuenta.

---

## 9. Verificar la instalación

```bash
npm run doctor      # Ollama, modelos, base de datos, voz, etc.
npm run test:python # contrato entre Node y el servicio de Python (sin modelos)
npm run test:web    # autenticación y API
npm run test:subjects
npm run test:vetados # prohibir por número y por @lid (sin Ollama)
```

`npm test` ejecuta toda la batería y **necesita Ollama en marcha**.

Prueba rápida en el simulador:

```bash
npm run sim
```

```
chicos, ¿qué deberes de matemáticas hay?
Ana: hay que hacer las páginas 30 a 32
¿qué deberes de matemáticas hay?
el examen de historia es el 20 de octubre
Claw, ¿cuánto es 2+2?
```

---

## 10. Instalación con Homebrew (macOS y Linux)

Hay un tap con una fórmula para instalar los comandos `claw` y `claw-ia`:

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 y posteriores
brew install claw
```

La primera ejecución descarga las dependencias de Node en
`~/.local/share/claw` y guarda los datos en `~/.local/share/claw/data`.

```bash
claw
```

Si prefieres gestionar tú la carpeta:

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

Para el servicio de voz e imágenes con Python:

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"

# Solo si quieres generar imágenes:
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"

claw-ia
```

Para actualizar:

```bash
brew update
brew upgrade claw
```

> El tap está en `Uyruw3/homebrew-claw` porque la organización del proyecto
> no permite crear repositorios desde esta cuenta. Se puede transferir a
> `ClawProject` más adelante; el comando sería entonces `brew tap ClawProject/claw`.
>
> La fórmula instala la última versión estable publicada. Cuando salga una nueva,
> el tap se actualiza con `brew update && brew upgrade claw`.

---

## 11. Actualizar el proyecto

Si lo instalaste con `git clone`:

```bash
git pull
npm install
```

Si también han cambiado los `python/requirements*.txt`:

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

Reinicia Node y el servicio de Python después de actualizar.

---

## 12. Problemas frecuentes

**`npm start` no encuentra Ollama.**
Abre la aplicación de Ollama o ejecuta `ollama serve`. Comprueba con
`curl http://127.0.0.1:11434/api/tags`.

**El bot no dice nada en el grupo.**
1. Comprueba que está vinculado: escribe `!claw aqui` dentro del grupo o pon
   `WHATSAPP_GROUP_JID`.
2. Escribe `!claw` para ver el estado.
3. Arranca con `LOG_LEVEL=debug` para ver por qué se descarta cada mensaje.

**Las notas de voz no funcionan.**
Arranca `python/server.py` y comprueba `npm run doctor`. Si no usas Python, instala
ffmpeg y vuelve a abrir la terminal.

**`faster-whisper` falla con `metadata_errors`.**
Tienes `av` 19. Fija la versión:

```bash
.venv/bin/pip install 'av<19'
```

**CUDA no carga (`libcublas.so.12`).**
Whisper pasa automáticamente a CPU. Si quieres usar la GPU, instala el runtime
de CUDA y una versión de torch con CUDA. Mientras tanto, la voz funciona en CPU.

**La primera imagen tarda mucho.**
Se está descargando el modelo de diffusers (~4 GB). Las siguientes tardan solo lo
que dura la generación.

**La web no envía códigos de acceso.**
Configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` y `SMTP_PASSWORD` en `.env`.
Pruébalo con `npm run smtp -- tu-correo@alu.edu.gva.es`.

**PowerShell bloquea `npm.ps1`.**
Usa `npm.cmd` o ejecuta
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y abre otra terminal.

---

## 13. Estructura mínima instalada

```
TheClawRepo/
├─ src/                 código del bot (Node)
├─ python/              servicio de voz e imágenes
├─ docs/                web estática y documentación
├─ sdserver/            motor opcional stable-diffusion.cpp
├─ data/                sesión, base de datos, fotos y modelos (no lo rastrea Git)
├─ .env                 tu configuración (no la rastrea Git)
├─ package.json
└─ arrancar.bat         script de arranque para Windows
```
