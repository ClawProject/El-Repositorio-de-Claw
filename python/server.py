"""Claw's local AI service: voice (faster-whisper) and images (diffusers).

It runs separately from the Node bot and listens ONLY on 127.0.0.1. Node calls
it over HTTP; if it is not running, the bot keeps working with its legacy
engines (transformers.js for voice and sd-cli/HTTP for images).

Start it with:
    python python/server.py

Most important environment variables (they can be set in .env):
    PYTHON_AI_HOST / PYTHON_AI_PORT   where it listens (127.0.0.1:5050)
    PYTHON_WHISPER_MODEL              tiny | base | small | medium | large-v3
    PYTHON_WHISPER_DEVICE             auto | cuda | cpu
    PYTHON_WHISPER_COMPUTE            int8 | float16 | int8_float16
    PYTHON_IMAGE_MODEL                Hugging Face model or local path
    PYTHON_IMAGE_DEVICE               auto | cuda | cpu
    PYTHON_IMAGE_UNLOAD               true = free the GPU after each image
"""

from __future__ import annotations

import gc
import importlib.util
import io
import logging
import os
import random
import re
import threading
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response
from PIL import Image
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
    # The .env can also live in the data folder instead of next to the code.
    _data_dir = os.getenv("PICKLEBRAIN_DATA_DIR", "").strip()
    if _data_dir:
        _data_path = Path(_data_dir).expanduser()
        if not _data_path.is_absolute():
            _data_path = ROOT / _data_path
        load_dotenv(_data_path / ".env")
except Exception:
    # python-dotenv is optional: without it, the system variables are used.
    pass


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "si", "sí", "yes", "on"}


def _int(name: str, default: int) -> int:
    try:
        return int(str(os.getenv(name, default)).strip())
    except (TypeError, ValueError):
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(str(os.getenv(name, default)).strip())
    except (TypeError, ValueError):
        return default


def _path(name: str, default: Path) -> Path:
    raw = os.getenv(name, "").strip()
    p = Path(raw).expanduser() if raw else default
    return p if p.is_absolute() else ROOT / p


def _modulo_disponible(nombre: str) -> bool:
    try:
        return importlib.util.find_spec(nombre) is not None
    except (ImportError, ValueError):
        return False


MODELS_DIR = _path("PYTHON_MODELS_DIR", ROOT / "data" / "models")

# ----------------------------------------------------------------- voice
WHISPER_MODEL = os.getenv("PYTHON_WHISPER_MODEL", "base").strip() or "base"
WHISPER_DEVICE = os.getenv("PYTHON_WHISPER_DEVICE", "auto").strip().lower()
WHISPER_COMPUTE = os.getenv("PYTHON_WHISPER_COMPUTE", "").strip()
WHISPER_LANGUAGE = os.getenv("PYTHON_WHISPER_LANGUAGE", "es").strip() or None
WHISPER_BEAM = _int("PYTHON_WHISPER_BEAM", 5)
MAX_UPLOAD_MB = _int("PYTHON_MAX_UPLOAD_MB", 64)
MAX_UPLOAD_BYTES = max(1, MAX_UPLOAD_MB) * 1024 * 1024

# ---------------------------------------------------------------- images
# DreamShaper 8 is a Stable Diffusion 1.5 fine-tune: same pipeline, same size
# (~2 GB in fp16) and far better faces and detail than the plain base model.
IMAGE_MODEL = (
    os.getenv("PYTHON_IMAGE_MODEL", "Lykon/dreamshaper-8").strip()
    or "Lykon/dreamshaper-8"
)
IMAGE_DEVICE = os.getenv("PYTHON_IMAGE_DEVICE", "auto").strip().lower()
# On a 4 GB GPU it is best to release the model after each image so Ollama can
# use the VRAM again. On a large GPU, set it to false.
IMAGE_UNLOAD = _bool("PYTHON_IMAGE_UNLOAD", True)
IMAGE_MAX_SIDE = _int("PYTHON_IMAGE_MAX_SIDE", 1024)
IMAGE_CPU_FALLBACK = _bool("PYTHON_IMAGE_CPU_FALLBACK", False)
# How the pipeline sits on the GPU. SD 1.5 in fp16 takes ~2.5 GB, so a 4 GB card
# fits 512x512 but not much more. "model" offload keeps only the module that is
# running on the GPU (and "sequential" only its layers), which is what lets a
# 4 GB card draw at 768 without running out of memory. It is slower.
#   auto (model offload when VRAM < 6 GB) | model | sequential | none
IMAGE_OFFLOAD = os.getenv("PYTHON_IMAGE_OFFLOAD", "auto").strip().lower()
# Quality tags appended to the prompt: they are what SD 1.5 was trained with to
# get a sharp, well lit picture. They go last, so a very long prompt loses them
# first instead of losing the actual subject.
IMAGE_QUALITY_TAGS = os.getenv(
    "PYTHON_IMAGE_QUALITY_TAGS",
    "masterpiece, best quality, highly detailed, sharp focus, professional lighting",
).strip()
# Extra negatives merged into the ones Node sends (repeated ones are skipped).
IMAGE_NEGATIVE_EXTRA = os.getenv(
    "PYTHON_IMAGE_NEGATIVE_EXTRA",
    "low quality, worst quality, blurry, lowres, jpeg artifacts, watermark, "
    "signature, text, deformed, bad anatomy, extra fingers",
).strip()
# Second pass at a larger size (hires fix): the 512x512 pass cannot draw small
# detail, this one redraws the picture with room to spare. Costs ~1 extra pass.
IMAGE_HIRES = _bool("PYTHON_IMAGE_HIRES", True)
IMAGE_HIRES_SCALE = max(1.0, min(2.0, _float("PYTHON_IMAGE_HIRES_SCALE", 1.5)))
IMAGE_HIRES_STRENGTH = max(0.05, min(0.9, _float("PYTHON_IMAGE_HIRES_STRENGTH", 0.35)))
# 0 = same number of steps as the first pass.
IMAGE_HIRES_STEPS = _int("PYTHON_IMAGE_HIRES_STEPS", 0)

logging.basicConfig(
    level=os.getenv("PYTHON_LOG_LEVEL", "info").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("claw.python")


class ServiceUnavailable(RuntimeError):
    """A dependency is missing or the model cannot be loaded."""


app = FastAPI(title="Claw Python AI", version="1.0.0")


@app.exception_handler(ServiceUnavailable)
async def _service_unavailable(_request, exc: ServiceUnavailable):
    return JSONResponse(status_code=503, content={"error": str(exc)})


# ================================================================ VOICE

_voice_model = None
_voice_device: Optional[str] = None
_voice_load_lock = threading.Lock()


def _elegir_dispositivo_voz() -> str:
    if WHISPER_DEVICE == "cpu":
        return "cpu"
    if WHISPER_DEVICE == "cuda":
        return "cuda"
    try:
        import ctranslate2

        if ctranslate2.get_cuda_device_count() > 0:
            return "cuda"
    except Exception:
        pass
    return "cpu"


def _compute_voz(device: str) -> str:
    if WHISPER_COMPUTE:
        return WHISPER_COMPUTE
    return "float16" if device == "cuda" else "int8"


def _liberar_modelo_voz():
    global _voice_model, _voice_device
    with _voice_load_lock:
        _voice_model = None
        _voice_device = None
        gc.collect()


def _es_error_cuda(exc: Exception) -> bool:
    texto = str(exc).lower()
    return any(
        pista in texto
        for pista in ("cublas", "cudnn", "cuda", "no kernel image", "out of memory")
    )


def get_voice_model(force_cpu: bool = False):
    """Loads Whisper only once. If CUDA fails, it retries on CPU."""
    global _voice_model, _voice_device
    if _voice_model is not None and not force_cpu:
        return _voice_model, _voice_device

    with _voice_load_lock:
        if _voice_model is not None and not force_cpu:
            return _voice_model, _voice_device
        if not _modulo_disponible("faster_whisper"):
            raise ServiceUnavailable(
                "Falta faster-whisper. Instala las dependencias de voz con: "
                "pip install -r python/requirements.txt"
            )

        from faster_whisper import WhisperModel

        device = "cpu" if force_cpu else _elegir_dispositivo_voz()
        compute = "int8" if device == "cpu" else _compute_voz(device)
        log.info("Cargando Whisper %s en %s (%s)...", WHISPER_MODEL, device, compute)
        t0 = time.time()
        try:
            _voice_model = WhisperModel(
                WHISPER_MODEL,
                device=device,
                compute_type=compute,
                download_root=str(MODELS_DIR / "whisper"),
            )
        except Exception:
            if device != "cuda":
                raise
            log.warning("No pude usar CUDA para Whisper; reintento en CPU.", exc_info=True)
            device = "cpu"
            _voice_model = WhisperModel(
                WHISPER_MODEL,
                device="cpu",
                compute_type="int8",
                download_root=str(MODELS_DIR / "whisper"),
            )
        _voice_device = device
        log.info("Whisper listo en %.1f s", time.time() - t0)
        return _voice_model, _voice_device


def _transcribir_audio(model, datos: bytes, opciones: dict):
    segmentos, info = model.transcribe(io.BytesIO(datos), **opciones)
    texto = " ".join(segmento.text.strip() for segmento in segmentos).strip()
    texto = " ".join(texto.split())
    return texto, float(getattr(info, "duration", 0.0) or 0.0)


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    vad: bool = Form(True),
):
    """Transcribes audio (WhatsApp ogg/opus, mp3, wav...)."""
    t0 = time.time()
    datos = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(datos) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, content={"error": "el audio es demasiado grande"})
    if not datos:
        raise HTTPException(status_code=400, content={"error": "el audio está vacío"})

    model, device = get_voice_model()
    opciones = {
        "language": (language or WHISPER_LANGUAGE or None),
        "task": "transcribe",
        "beam_size": max(1, WHISPER_BEAM),
        "condition_on_previous_text": False,
    }
    if vad:
        opciones["vad_filter"] = True
        opciones["vad_parameters"] = {"min_silence_duration_ms": 500}

    try:
        texto, segundos = _transcribir_audio(model, datos, opciones)
    except Exception as exc:
        # ctranslate2 can detect the GPU and then fail if the CUDA libraries
        # (libcublas, cuDNN...) are missing. In that case we switch to CPU.
        if device == "cuda" and _es_error_cuda(exc):
            log.warning("CUDA falló al transcribir (%s); cambio Whisper a CPU.", exc)
            _liberar_modelo_voz()
            model, _ = get_voice_model(force_cpu=True)
            try:
                texto, segundos = _transcribir_audio(model, datos, opciones)
            except Exception as exc2:
                log.exception("Fallo transcribiendo el audio en CPU")
                raise HTTPException(
                    status_code=500,
                    content={"error": f"no pude transcribir el audio: {exc2}"},
                ) from exc2
        else:
            log.exception("Fallo transcribiendo el audio")
            raise HTTPException(
                status_code=500, content={"error": f"no pude transcribir el audio: {exc}"}
            ) from exc

    return {
        "text": texto,
        "seconds": segundos,
        "ms": int((time.time() - t0) * 1000),
    }


# =============================================================== IMAGES

_image_pipe = None
_image_device: Optional[str] = None
_image_offload: Optional[str] = None
_image_hires_pipe = None
_hires_disponible = True
_image_load_lock = threading.Lock()
_image_gen_lock = threading.Lock()


class ImageRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    negative_prompt: str = Field(default="", max_length=2000)
    # 28 steps is where DPM++ 2M + Karras stops improving on SD 1.5; below ~20
    # the result is soft and faces are mush.
    steps: int = Field(default=28, ge=1, le=100)
    width: int = Field(default=512, ge=256, le=1024)
    height: int = Field(default=512, ge=256, le=1024)
    seed: int = -1
    cfg: float = Field(default=7.0, ge=1.0, le=20.0)
    sampler: str = "dpm++2m"
    scheduler: str = "karras"


def _dims_validas(valor: int) -> int:
    """Rounds to a multiple of 8 and caps the size so the VRAM is not blown."""
    valor = max(256, min(IMAGE_MAX_SIDE, int(valor)))
    return max(256, (valor // 8) * 8)


def _vram_gb(torch) -> Optional[float]:
    """Total VRAM in GB, or None when there is no CUDA device."""
    try:
        if not torch.cuda.is_available():
            return None
        return round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 1)
    except Exception:
        return None


def _modo_offload(torch, device: str) -> str:
    """Picks how to place the model: none | model | sequential."""
    pedido = (IMAGE_OFFLOAD or "auto").lower()
    if device != "cuda" or pedido == "none":
        return "none"
    if pedido in {"model", "sequential"}:
        return pedido
    vram = _vram_gb(torch)
    if vram is None:
        return "model"
    if vram < 3.5:
        return "sequential"
    if vram < 6.0:
        return "model"
    return "none"


def _colocar_en_gpu(pipe, modo: str):
    """Applies the offload, degrading to a simpler one if accelerate complains."""
    intentos = [modo] if modo == "sequential" else []
    intentos.append("model")
    for intento in intentos:
        try:
            if intento == "sequential":
                pipe.enable_sequential_cpu_offload()
            else:
                pipe.enable_model_cpu_offload()
            return pipe
        except Exception:
            log.warning(
                "No pude activar el offload '%s'; pruebo de otra forma.", intento, exc_info=True
            )
    return pipe.to("cuda")


def _activar_ajustes(pipe, agresivo: bool = False):
    """Cheap settings that avoid VRAM peaks without touching the quality."""
    for nombre, args in (
        ("enable_attention_slicing", ("max",) if agresivo else ("auto",)),
        ("enable_vae_slicing", ()),
        ("enable_vae_tiling", ()),
    ):
        try:
            getattr(pipe, nombre)(*args)
        except Exception:
            pass
    pipe.set_progress_bar_config(disable=True)


def _tags_de_calidad(prompt: str) -> str:
    """Appends the SD 1.5 quality tags, skipping the ones already in the prompt."""
    texto = str(prompt or "").strip().rstrip(",. ")
    tags = [t.strip() for t in (IMAGE_QUALITY_TAGS or "").split(",") if t.strip()]
    if not tags:
        return texto
    presentes = texto.lower()
    nuevos = [t for t in tags if t.lower() not in presentes]
    if not nuevos:
        return texto
    return ", ".join([texto, *nuevos]) if texto else ", ".join(nuevos)


def _negativos_completos(negativo: str) -> Optional[str]:
    """Merges the negatives from Node with the extra ones, without repeats."""
    partes: list[str] = []
    vistos: set[str] = set()
    for bloque in (negativo or "", IMAGE_NEGATIVE_EXTRA or ""):
        for trozo in str(bloque).split(","):
            clave = trozo.strip().lower()
            if clave and clave not in vistos:
                vistos.add(clave)
                partes.append(trozo.strip())
    return ", ".join(partes) if partes else None


def _aplicar_scheduler(pipe, sampler: str, scheduler: str):
    from diffusers import (
        DDIMScheduler,
        DPMSolverMultistepScheduler,
        EulerAncestralDiscreteScheduler,
        EulerDiscreteScheduler,
        LMSDiscreteScheduler,
        PNDMScheduler,
    )

    clave = "".join(c for c in (sampler or "").lower() if c.isalnum() or c == "+")
    karras = (scheduler or "").lower().startswith("karras")
    cfg = pipe.scheduler.config

    if "dpm" in clave and ("2m" in clave or "++" in clave):
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(
            cfg, use_karras_sigmas=karras, algorithm_type="dpmsolver++"
        )
    elif clave.startswith("euler"):
        ancestral = "ancestral" in clave or clave.endswith("a")
        clase = EulerAncestralDiscreteScheduler if ancestral else EulerDiscreteScheduler
        pipe.scheduler = clase.from_config(cfg, use_karras_sigmas=karras)
    elif "ddim" in clave:
        pipe.scheduler = DDIMScheduler.from_config(cfg)
    elif "lms" in clave:
        pipe.scheduler = LMSDiscreteScheduler.from_config(cfg, use_karras_sigmas=karras)
    elif "pndm" in clave:
        pipe.scheduler = PNDMScheduler.from_config(cfg)
    else:
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(
            cfg, use_karras_sigmas=True, algorithm_type="dpmsolver++"
        )


def get_image_pipeline():
    """Loads the diffusers pipeline only once."""
    global _image_pipe, _image_device
    if _image_pipe is not None:
        return _image_pipe, _image_device

    with _image_load_lock:
        if _image_pipe is not None:
            return _image_pipe, _image_device
        if not (_modulo_disponible("torch") and _modulo_disponible("diffusers")):
            raise ServiceUnavailable(
                "Faltan torch y diffusers. Instálalos con: "
                "pip install -r python/requirements-images.txt"
            )

        import torch
        from diffusers import StableDiffusionPipeline

        device = "cuda" if IMAGE_DEVICE != "cpu" and torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32
        log.info("Cargando modelo de imágenes %s en %s...", IMAGE_MODEL, device)
        t0 = time.time()
        pipe = StableDiffusionPipeline.from_pretrained(
            IMAGE_MODEL,
            torch_dtype=dtype,
            safety_checker=None,
            requires_safety_checker=False,
            cache_dir=str(MODELS_DIR / "diffusers"),
        )
        modo = _modo_offload(torch, device)
        pipe = pipe.to(device) if modo == "none" else _colocar_en_gpu(pipe, modo)
        _activar_ajustes(pipe, agresivo=(modo == "sequential"))
        _image_pipe = pipe
        _image_device = device
        _image_offload = modo
        log.info(
            "Modelo de imágenes listo en %.1f s (%s, VRAM %s GB)",
            time.time() - t0,
            modo,
            _vram_gb(torch),
        )
        return _image_pipe, _image_device


def _pipeline_hires(pipe):
    """img2img pipeline that REUSES the loaded weights (no second model)."""
    global _image_hires_pipe, _hires_disponible
    if _image_hires_pipe is not None:
        return _image_hires_pipe
    if not _hires_disponible:
        return None
    try:
        from diffusers import AutoPipelineForImage2Image

        _image_hires_pipe = AutoPipelineForImage2Image.from_pipe(pipe)
        _image_hires_pipe.set_progress_bar_config(disable=True)
        return _image_hires_pipe
    except Exception:
        _hires_disponible = False
        log.warning(
            "No pude preparar el segundo pase (hires); dibujo solo la primera pasada.",
            exc_info=True,
        )
        return None


def _segundo_pase(pipe, imagen, device, prompt, negativo, cfg, seed, ancho, alto, pasos):
    """Redraws the image larger (hires fix). It never raises: returns None on failure."""
    hires = _pipeline_hires(pipe)
    if hires is None:
        return None
    destino_ancho = _dims_validas(round(ancho * IMAGE_HIRES_SCALE))
    destino_alto = _dims_validas(round(alto * IMAGE_HIRES_SCALE))
    if destino_ancho <= ancho and destino_alto <= alto:
        return None
    try:
        import torch

        subida = imagen.resize((destino_ancho, destino_alto), Image.LANCZOS)
        generador = torch.Generator(device=device).manual_seed(seed)
        resultado = hires(
            prompt=prompt,
            negative_prompt=negativo,
            image=subida,
            strength=IMAGE_HIRES_STRENGTH,
            num_inference_steps=max(8, IMAGE_HIRES_STEPS or pasos),
            guidance_scale=cfg,
            generator=generador,
        )
        return resultado.images[0]
    except Exception as exc:
        log.warning("El segundo pase falló (%s); devuelvo la primera pasada.", exc)
        return None


def _descargar_pipeline():
    """Releases the image model to give the VRAM back to Ollama."""
    global _image_pipe, _image_device, _image_hires_pipe
    with _image_load_lock:
        _image_pipe = None
        _image_device = None
        _image_hires_pipe = None
        gc.collect()
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.ipc_collect()
        except Exception:
            pass


@app.post("/generate")
def generate(req: ImageRequest):
    """Generates a PNG image and returns it as bytes."""
    with _image_gen_lock:
        pipe, device = get_image_pipeline()
        ancho = _dims_validas(req.width)
        alto = _dims_validas(req.height)
        seed = int(req.seed)
        if seed < 0:
            seed = random.randint(0, 2**31 - 1)

        prompt = _tags_de_calidad(req.prompt)
        negativo = _negativos_completos(req.negative_prompt)
        pasos = max(1, min(100, int(req.steps)))

        try:
            import torch

            generator = torch.Generator(device=device).manual_seed(seed)
            _aplicar_scheduler(pipe, req.sampler, req.scheduler)
            resultado = pipe(
                prompt=prompt,
                negative_prompt=negativo,
                num_inference_steps=pasos,
                width=ancho,
                height=alto,
                guidance_scale=float(req.cfg),
                generator=generator,
            )
            imagen = resultado.images[0]
            # Second pass at a larger size: it is what really fixes the soft SD 1.5
            # look, because faces and small details get redrawn with room for them.
            if IMAGE_HIRES and IMAGE_HIRES_SCALE > 1.0:
                refinada = _segundo_pase(
                    pipe, imagen, device, prompt, negativo, float(req.cfg), seed, ancho, alto, pasos
                )
                if refinada is not None:
                    imagen = refinada
            buffer = io.BytesIO()
            imagen.save(buffer, format="PNG")
        except Exception as exc:
            mensaje = str(exc)
            if "out of memory" in mensaje.lower() or "cuda" in mensaje.lower():
                _descargar_pipeline()
                raise HTTPException(
                    status_code=507,
                    content={
                        "error": "sin memoria de GPU para generar la imagen. "
                        "Prueba menos pasos o un tamaño menor, o pon "
                        "PYTHON_IMAGE_OFFLOAD=model (o sequential) en el .env."
                    },
                ) from exc
            log.exception("Fallo generando la imagen")
            raise HTTPException(
                status_code=500, content={"error": f"no pude generar la imagen: {mensaje[:300]}"}
            ) from exc
        finally:
            if IMAGE_UNLOAD:
                _descargar_pipeline()

        return Response(
            content=buffer.getvalue(),
            media_type="image/png",
            headers={"X-Seed": str(seed), "X-Device": device},
        )


# ================================================================ HEALTH


@app.get("/health")
def health():
    return {
        "ok": True,
        "voice": {
            "available": _modulo_disponible("faster_whisper"),
            "model": WHISPER_MODEL,
            "loaded": _voice_model is not None,
            "device": _voice_device,
        },
        "images": {
            "available": _modulo_disponible("torch") and _modulo_disponible("diffusers"),
            "model": IMAGE_MODEL,
            "loaded": _image_pipe is not None,
            "device": _image_device,
            "offload": _image_offload,
            "hires": {
                "enabled": IMAGE_HIRES,
                "scale": IMAGE_HIRES_SCALE,
                "strength": IMAGE_HIRES_STRENGTH,
            },
        },
    }


@app.post("/warmup")
def warmup(target: str = "voice"):
    """Preloads a model so the first request is not too slow."""
    objetivo = (target or "voice").strip().lower()
    if objetivo in {"voice", "voz", "all", "todo"}:
        get_voice_model()
    if objetivo in {"images", "imagenes", "imágenes", "all", "todo"}:
        get_image_pipeline()
    return {"ok": True, "target": objetivo}


@app.get("/")
def root():
    return {"service": "claw-python-ai", "endpoints": ["/health", "/transcribe", "/generate", "/warmup"]}


# ================================================================ MAIN


def _host_y_puerto():
    host = os.getenv("PYTHON_AI_HOST", "127.0.0.1").strip() or "127.0.0.1"
    puerto = _int("PYTHON_AI_PORT", 5050)
    # If Node uses PYTHON_AI_URL, its host/port is respected to stay in sync.
    url = os.getenv("PYTHON_AI_URL", "").strip()
    if url:
        parsed = urlparse(url if "://" in url else f"http://{url}")
        host = parsed.hostname or host
        puerto = parsed.port or puerto
    return host, puerto


if __name__ == "__main__":
    import uvicorn

    host, puerto = _host_y_puerto()
    log.info("Claw Python AI escuchando en http://%s:%s", host, puerto)
    uvicorn.run(app, host=host, port=puerto, log_level=os.getenv("PYTHON_LOG_LEVEL", "info"))
