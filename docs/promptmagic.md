# Prompt magic (prompt enhancement)

When `!claw imagen <text>` generates an image with `IMAGE_GEN_BACKEND=cli` and
`IMAGE_GEN_ENHANCE=true`, the original text is translated into English using the
text model itself (`OLLAMA_MODEL`, `qwen2.5:3b` by default).

The goal is for Stable Diffusion 1.5 (trained in English) to understand the
request better. That used to make the biggest quality difference.

## Settings (.env)

- `IMAGE_GEN_ENHANCE` (true/false): when `true`, it improves the prompt before drawing.
- `IMAGE_GEN_SEED`: -1 = random seed (recommended). You can set a fixed number to reproduce an image.
- `IMAGE_GEN_CFG`: CFG scale (default 7). Values between 6 and 8 usually work well.
- `IMAGE_GEN_SAMPLER`: sampling method (default `dpm++2m`). Other common ones: `euler_a`, `euler`, `dpm++2s_a`.
- `IMAGE_GEN_SCHEDULER`: scheduler (default `karras`). Others: `discrete`, `sgm_uniform`, `simple`.
- `IMAGE_GEN_NEGATIVE`: what we do NOT want (now in English by default).

## Notes

- The enhancement takes ~5-15s (and may load the text model into VRAM). Then, before launching sd-cli, we release the text model (`IMAGE_GEN_FREE_VRAM=true`) to leave VRAM free for SD.
- The setting applies to both `cli` and `http`. If `http` points to a remote server, you may still want to leave it at `false` (there is no need to load Ollama to enhance the prompt).
- If the enhancement fails for any reason, the original prompt is used and nothing breaks.
