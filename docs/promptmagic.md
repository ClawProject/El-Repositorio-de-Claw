# Prompt magic (mejora de prompts)

Cuando `!claw imagen <texto>` genera una imagen con `IMAGE_GEN_BACKEND=cli` y `IMAGE_GEN_ENHANCE=true`, el texto original se traduce a inglés usando el propio modelo de texto (`OLLAMA_MODEL`, por defecto `qwen2.5:3b`).

El objetivo es que Stable Diffusion 1.5 (entrenado en inglés) entienda mejor la petición. Eso solía marcar la mayor diferencia de calidad.

## Ajustes (.env)

- `IMAGE_GEN_ENHANCE` (true/false): si `true`, mejora el prompt antes de dibujar.
- `IMAGE_GEN_SEED`: -1 = semilla aleatoria (recomendado). Puedes poner un número fijo para reproducir una imagen.
- `IMAGE_GEN_CFG`: CFG scale (default 7). Valores entre 6-8 suelen ir bien.
- `IMAGE_GEN_SAMPLER`: método de muestreo (default `dpm++2m`). Otros comunes: `euler_a`, `euler`, `dpm++2s_a`.
- `IMAGE_GEN_SCHEDULER`: scheduler (default `karras`). Otros: `discrete`, `sgm_uniform`, `simple`.
- `IMAGE_GEN_NEGATIVE`: lo que NO queremos (ahora en inglés por defecto).

## Notas

- La mejora consume ~5-15s (y puede cargar el modelo de texto en VRAM). Luego, antes de lanzar sd-cli, soltamos el modelo de texto (`IMAGE_GEN_FREE_VRAM=true`) para dejar VRAM libre para SD.
- El ajuste aplica tanto a `cli` como a `http`. Si `http` apunta a un servidor remoto, igual puedes querer dejarlo en `false` (no hace falta cargar Ollama para mejorar el prompt).
- Si la mejora falla por algún motivo, se usa el prompt original sin romper nada.