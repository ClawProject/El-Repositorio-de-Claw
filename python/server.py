#!/usr/bin/env python3
"""Servicio local de IA de Claw: voz (faster-whisper) e imágenes (diffusers).

Se ejecuta aparte del bot de Node y escucha SOLO en 127.0.0.1. Node lo llama
por HTTP; si no está arrancado, el bot sigue funcionando con sus motores
antiguos (transformers.js para voz y sd-cli/HTTP para imágenes).

Arranque:
    python python/server.py

Variables de entorno más importantes (se pueden poner en .env):
    PYTHON_AI_HOST / PYTHON_AI_PORT   dónde escucha (127.0.0.1:5050)
    PYTHON_WHISPER_MODEL              tiny | base | small | medium | large-v3
    PYTHON_WHISPER_DEVICE             auto | cuda | cpu
    PYTHON_WHISPER_COMPUTE            int8 | float16 | int8_float16
    PYTHON_IMAGE_MODEL                modelo de Hugging Face o ruta local
    PYTHON_IMAGE_DEVICE               auto | cuda | cpu
    PYTHON_IMAGE_UNLOAD               true = libera la GPU tras cada imagen
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
from pydantic import BaseModel, Field

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except Exception:
    # python-dotenv es opcional: si no está, se usan las variables del sistema.
    pass


ROOT = Path(__file__).resolve().parent.parent


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

# ------------------------------------------------------------------ voz
WHISPER_MODEL = os.getenv("PYTHON_WHISPER_MODEL", "base").strip() or "base"
WHISPER_DEVICE = os.getenv("PYTHON_WHISPER_DEVICE", "auto").strip().lower()
WHISPER_COMPUTE = os.getenv("PYTHON_WHISPER_COMPUTE", "").strip()
WHISPER_LANGUAGE = os.getenv("PYTHON_WHISPER_LANGUAGE", "es").strip() or None
WHISPER_BEAM = _int("PYTHON_WHISPER_BEAM", 5)
MAX_UPLOAD_MB = _int("PYTHON_MAX_UPLOAD_MB", 64)
MAX_UPLOAD_BYTES = max(1, MAX_UPLOAD_MB) * 1024 * 1024

# --------------------------------------------------------------- imágenes
IMAGE_MODEL = (
    os.getenv("PYTHON_IMAGE_MODEL", "stable-diffusion-v1-5/stable-diffusion-v1-5").strip()
    or "stable-diffusion-v1-5/stable-diffusion-v1-5"
)
IMAGE_DEVICE = os.getenv("PYTHON_IMAGE_DEVICE", "auto").strip().lower()
# Con una GPU de 4 GB conviene liberar el modelo después de cada imagen para
# que Ollama pueda volver a usar la VRAM. Con una GPU grande, ponlo en false.
IMAGE_UNLOAD = _bool("PYTHON_IMAGE_UNLOAD", True)
IMAGE_MAX_SIDE = _int("PYTHON_IMAGE_MAX_SIDE", 1024)
IMAGE_CPU_FALLBACK = _bool("PYTHON_IMAGE_CPU_FALLBACK", False)

logging.basicConfig(
    level=os.getenv("PYTHON_LOG_LEVEL", "info").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("claw.python")


class ServiceUnavailable(RuntimeError):
    """Falta una dependencia o el modelo no se puede cargar."""


app = FastAPI(title="Claw Python AI", version="1.0.0")


@app.exception_handler(ServiceUnavailable)
async def _service_unavailable(_request, exc: ServiceUnavailable):
    return JSONResponse(status_code=503, content={"error": str(exc)})


# ================================================================ VOZ

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
    """Carga Whisper una sola vez. Si CUDA falla, reintenta en CPU."""
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
    """Transcribe un audio (ogg/opus de WhatsApp, mp3, wav...)."""
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
        # ctranslate2 puede detectar la GPU y fallar después si faltan las
        # librerías CUDA (libcublas, cuDNN...). En ese caso pasamos a CPU.
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


# ============================================================ IMÁGENES

_image_pipe = None
_image_device: Optional[str] = None
_image_load_lock = threading.Lock()
_image_gen_lock = threading.Lock()


class ImageRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    negative_prompt: str = Field(default="", max_length=2000)
    steps: int = Field(default=20, ge=1, le=100)
    width: int = Field(default=512, ge=256, le=1024)
    height: int = Field(default=512, ge=256, le=1024)
    seed: int = -1
    cfg: float = Field(default=7.0, ge=1.0, le=20.0)
    sampler: str = "dpm++2m"
    scheduler: str = "karras"


def _dims_validas(valor: int) -> int:
    """Redondea a múltiplo de 8 y limita el tamaño para no reventar la VRAM."""
    valor = max(256, min(IMAGE_MAX_SIDE, int(valor)))
    return max(256, (valor // 8) * 8)


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
    """Carga el pipeline de diffusers una sola vez."""
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
        pipe = pipe.to(device)
        try:
            pipe.enable_attention_slicing()
        except Exception:
            pass
        try:
            pipe.enable_vae_slicing()
        except Exception:
            pass
        pipe.set_progress_bar_config(disable=True)
        _image_pipe = pipe
        _image_device = device
        log.info("Modelo de imágenes listo en %.1f s", time.time() - t0)
        return _image_pipe, _image_device


def _descargar_pipeline():
    """Suelta el modelo de imágenes para devolver la VRAM a Ollama."""
    global _image_pipe, _image_device
    with _image_load_lock:
        _image_pipe = None
        _image_device = None
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
    """Genera una imagen PNG y la devuelve como bytes."""
    with _image_gen_lock:
        pipe, device = get_image_pipeline()
        ancho = _dims_validas(req.width)
        alto = _dims_validas(req.height)
        seed = int(req.seed)
        if seed < 0:
            seed = random.randint(0, 2**31 - 1)

        try:
            import torch

            generator = torch.Generator(device=device).manual_seed(seed)
            _aplicar_scheduler(pipe, req.sampler, req.scheduler)
            resultado = pipe(
                prompt=req.prompt,
                negative_prompt=req.negative_prompt or None,
                num_inference_steps=max(1, int(req.steps)),
                width=ancho,
                height=alto,
                guidance_scale=float(req.cfg),
                generator=generator,
            )
            imagen = resultado.images[0]
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
                        "Prueba menos pasos o un tamaño menor, o libera VRAM."
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


# ================================================================ SALUD


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
        },
    }


@app.post("/warmup")
def warmup(target: str = "voice"):
    """Precarga un modelo para que la primera petición no tarde de más."""
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
    # Si Node usa PYTHON_AI_URL, respetamos su host/puerto para no desincronizarnos.
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
