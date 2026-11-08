# Claw Python service (voice and images)

Node still owns the bot (WhatsApp, database and web). This service only does the
two heavy jobs:

- **Voice:** transcribes audio with [faster-whisper](https://github.com/SYSTRAN/faster-whisper).
- **Images:** generates images with [diffusers](https://github.com/huggingface/diffusers).

It listens only on `127.0.0.1:5050` and is not exposed to the internet.

## Installation

From the project root:

```bash
python3.12 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r python/requirements.txt
```

For images (heavy: torch, diffusers and their dependencies):

```bash
pip install -r python/requirements-images.txt
```

> If you do not have an NVIDIA GPU, install the CPU build of torch first:
>
> ```bash
> pip install torch --index-url https://download.pytorch.org/whl/cpu
> pip install -r python/requirements-images.txt
> ```

## Starting the service

In a separate terminal, with the virtual environment activated:

```bash
python python/server.py
```

Or without activating it:

```bash
.venv/bin/python python/server.py       # Linux/macOS
.venv\Scripts\python.exe python\server.py   # Windows
```

The Node bot detects it automatically. If the service is not running, Claw keeps
using the legacy engines (transformers.js and sd-cli/HTTP).

## Checking that it works

```bash
curl http://127.0.0.1:5050/health
```

It must return `ok: true` plus the status of `voice` and `images`. If
`images.available` is `false`, `torch`/`diffusers` are missing; if
`voice.available` is `false`, `faster-whisper` is missing.

Test a transcription:

```bash
curl -F "file=@path/to/note.ogg" http://127.0.0.1:5050/transcribe
```

Test an image (needs the image dependencies):

```bash
curl -X POST http://127.0.0.1:5050/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a penguin wearing sunglasses","steps":20,"width":512,"height":512}' \
  --output image.png
```

## Environment variables

They are read from the environment or from the root `.env` (if `python-dotenv` is
installed).

### Service

| Variable | Default | What it does |
|---|---|---|
| `PYTHON_AI_HOST` | `127.0.0.1` | interface it listens on |
| `PYTHON_AI_PORT` | `5050` | port |
| `PYTHON_AI_URL` | empty | if Node uses another URL, the service takes host/port from here |
| `PYTHON_MODELS_DIR` | `data/models` | model cache |
| `PICKLEBRAIN_DATA_DIR` | empty | if set, it also reads the `.env` from that folder |
| `PYTHON_MAX_UPLOAD_MB` | `64` | maximum audio size |

### Voice

| Variable | Default | What it does |
|---|---|---|
| `PYTHON_WHISPER_MODEL` | `base` | `tiny`, `base`, `small`, `medium`, `large-v3` |
| `PYTHON_WHISPER_DEVICE` | `auto` | `auto`, `cuda`, `cpu` |
| `PYTHON_WHISPER_COMPUTE` | empty | `int8`, `float16`, `int8_float16` |
| `PYTHON_WHISPER_LANGUAGE` | `es` | transcription language |
| `PYTHON_WHISPER_BEAM` | `5` | accuracy/speed |

### Images

| Variable | Default | What it does |
|---|---|---|
| `PYTHON_IMAGE_MODEL` | `stable-diffusion-v1-5/stable-diffusion-v1-5` | Hugging Face model or local path |
| `PYTHON_IMAGE_DEVICE` | `auto` | `auto`, `cuda`, `cpu` |
| `PYTHON_IMAGE_UNLOAD` | `true` | frees the GPU after every image |
| `PYTHON_IMAGE_MAX_SIDE` | `1024` | maximum allowed side |
| `PYTHON_IMAGE_CPU_FALLBACK` | `false` | reserved for future versions |

With a 4 GB GTX 1650, leave `PYTHON_IMAGE_UNLOAD=true`: that way Ollama gets its
VRAM back once the drawing is done.
