# Claw Python service (voice and images)

Node still owns the bot (WhatsApp, database and web). This service only does the
two heavy jobs:

- **Voice:** transcribes audio with [faster-whisper](https://github.com/SYSTRAN/faster-whisper).
- **Images:** generates images with [diffusers](https://github.com/huggingface/diffusers).

It listens only on `127.0.0.1:5050` and is not exposed to the internet.

## Installation

From the project root:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r python\requirements.txt
```

For images (heavy: torch, diffusers and their dependencies):

```powershell
pip install -r python\requirements-images.txt
```

> If you do not have an NVIDIA GPU, install the CPU build of torch first:
>
> ```powershell
> pip install torch --index-url https://download.pytorch.org/whl/cpu
> pip install -r python\requirements-images.txt
> ```

## Starting the service

In a separate terminal, with the virtual environment activated:

```powershell
python python\server.py
```

Or without activating it:

```powershell
.venv\Scripts\python.exe python\server.py
```

The Node bot detects it automatically. If the service is not running, Claw keeps
using the legacy engines (transformers.js and sd-cli/HTTP).

## Checking that it works

```powershell
curl.exe http://127.0.0.1:5050/health
```

It must return `ok: true` plus the status of `voice` and `images`. If
`images.available` is `false`, `torch`/`diffusers` are missing; if
`voice.available` is `false`, `faster-whisper` is missing.

Test a transcription:

```powershell
curl.exe -F "file=@ruta\nota.ogg" http://127.0.0.1:5050/transcribe
```

Test an image (needs the image dependencies):

```powershell
curl.exe -X POST http://127.0.0.1:5050/generate `
  -H "Content-Type: application/json" `
  -d '{"prompt":"a penguin wearing sunglasses","steps":28,"width":512,"height":512}' `
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
| `PYTHON_IMAGE_MODEL` | `Lykon/dreamshaper-8` | Hugging Face model or local path |
| `PYTHON_IMAGE_DEVICE` | `auto` | `auto`, `cuda`, `cpu` |
| `PYTHON_IMAGE_UNLOAD` | `true` | frees the GPU after every image |
| `PYTHON_IMAGE_OFFLOAD` | `auto` | `auto`, `model`, `sequential`, `none` |
| `PYTHON_IMAGE_QUALITY_TAGS` | `masterpiece, best quality, ...` | tags appended to the prompt |
| `PYTHON_IMAGE_NEGATIVE_EXTRA` | `low quality, worst quality, ...` | negatives merged with the ones Node sends |
| `PYTHON_IMAGE_HIRES` | `true` | second, larger pass to recover detail |
| `PYTHON_IMAGE_HIRES_SCALE` | `1.5` | how much bigger the second pass is |
| `PYTHON_IMAGE_HIRES_STRENGTH` | `0.35` | how much of the picture is redrawn |
| `PYTHON_IMAGE_HIRES_STEPS` | `0` | steps for the second pass (`0` = same as the first) |
| `PYTHON_IMAGE_MAX_SIDE` | `1024` | maximum allowed side |
| `PYTHON_IMAGE_CPU_FALLBACK` | `false` | reserved for future versions |

## Image quality on a 4 GB GPU

Stable Diffusion 1.5 in fp16 needs about 2.5 GB, so it fits in 4 GB at 512x512
but there is no room to spare. Three things make the pictures look bad, and each
one has a switch:

1. **The base model.** `stable-diffusion-v1-5` draws poorly. `Lykon/dreamshaper-8`
   is a 1.5 fine-tune (same pipeline, same size) with much better faces and detail,
   and it is the default now.
2. **Too few steps.** At 15-20 steps faces are mush. The bot now asks for 28, which
   is where DPM++ 2M + Karras stops improving.
3. **Too small.** 512x512 cannot hold eyes and hands. The second pass (`hires`)
   redraws the picture at 1.5x, which is the biggest single jump in quality.

On a 4 GB card leave `PYTHON_IMAGE_OFFLOAD=auto`: below 6 GB it switches to model
CPU offload, so only the module being used sits on the GPU and the 1.5x pass fits
in memory. It is slower (roughly twice the time) but it does not run out of memory.
If the card is 3 GB or less, `sequential` offload is used instead: even slower, but
it is the only way it fits. With 6 GB or more, offload is not needed at all.
