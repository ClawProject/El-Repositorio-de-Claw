# Servicio Python de Claw (voz e imágenes)

Node sigue siendo el dueño del bot (WhatsApp, base de datos y web). Este
servicio solo hace las dos tareas pesadas:

- **Voz:** transcribe audio con [faster-whisper](https://github.com/SYSTRAN/faster-whisper).
- **Imágenes:** genera imágenes con [diffusers](https://github.com/huggingface/diffusers).

Escucha únicamente en `127.0.0.1:5050` y no se expone a internet.

## Instalación

Desde la raíz del proyecto:

```bash
python3.12 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r python/requirements.txt
```

Para imágenes (pesado: torch, diffusers y sus dependencias):

```bash
pip install -r python/requirements-images.txt
```

> Si no tienes GPU NVIDIA, instala torch para CPU antes de las imágenes:
>
> ```bash
> pip install torch --index-url https://download.pytorch.org/whl/cpu
> pip install -r python/requirements-images.txt
> ```

## Arranque

En una terminal aparte, con el entorno virtual activado:

```bash
python python/server.py
```

O sin activarlo:

```bash
.venv/bin/python python/server.py       # Linux/macOS
.venv\Scripts\python.exe python\server.py   # Windows
```

El bot de Node lo detecta automáticamente. Si el servicio no está arrancado,
Claw sigue usando los motores antiguos (transformers.js y sd-cli/HTTP).

## Comprobar que funciona

```bash
curl http://127.0.0.1:5050/health
```

Debe devolver `ok: true` y el estado de `voice` e `images`. Si `images.available`
es `false`, faltan `torch`/`diffusers`; si `voice.available` es `false`, falta
`faster-whisper`.

Probar una transcripción:

```bash
curl -F "file=@ruta/a/nota.ogg" http://127.0.0.1:5050/transcribe
```

Probar una imagen (necesita las dependencias de imágenes):

```bash
curl -X POST http://127.0.0.1:5050/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"un pingüino con gafas de sol","steps":20,"width":512,"height":512}' \
  --output imagen.png
```

## Variables de entorno

Se leen del entorno o del `.env` de la raíz (si está instalado `python-dotenv`).

### Servicio

| Variable | Por defecto | Qué hace |
|---|---|---|
| `PYTHON_AI_HOST` | `127.0.0.1` | interfaz donde escucha |
| `PYTHON_AI_PORT` | `5050` | puerto |
| `PYTHON_AI_URL` | vacío | si Node usa otra URL, el servicio toma de aquí host/puerto |
| `PYTHON_MODELS_DIR` | `data/models` | caché de modelos |
| `PYTHON_MAX_UPLOAD_MB` | `64` | tamaño máximo de audio |

### Voz

| Variable | Por defecto | Qué hace |
|---|---|---|
| `PYTHON_WHISPER_MODEL` | `base` | `tiny`, `base`, `small`, `medium`, `large-v3` |
| `PYTHON_WHISPER_DEVICE` | `auto` | `auto`, `cuda`, `cpu` |
| `PYTHON_WHISPER_COMPUTE` | vacío | `int8`, `float16`, `int8_float16` |
| `PYTHON_WHISPER_LANGUAGE` | `es` | idioma de transcripción |
| `PYTHON_WHISPER_BEAM` | `5` | precisión/velocidad |

### Imágenes

| Variable | Por defecto | Qué hace |
|---|---|---|
| `PYTHON_IMAGE_MODEL` | `stable-diffusion-v1-5/stable-diffusion-v1-5` | modelo de Hugging Face o ruta local |
| `PYTHON_IMAGE_DEVICE` | `auto` | `auto`, `cuda`, `cpu` |
| `PYTHON_IMAGE_UNLOAD` | `true` | libera la GPU después de cada imagen |
| `PYTHON_IMAGE_MAX_SIDE` | `1024` | lado máximo permitido |
| `PYTHON_IMAGE_CPU_FALLBACK` | `false` | reservado para futuras versiones |

Con una GTX 1650 de 4 GB, deja `PYTHON_IMAGE_UNLOAD=true`: así Ollama recupera
la VRAM cuando termina de dibujar.
