# 🪝 Claw

Bot de WhatsApp con **IA local**

> Documentación técnica: [arquitectura, API y seguridad](docs/arquitectura.md).

## Qué hace

- **Escucha en silencio** y apunta los **deberes** y **exámenes** que se dicen en el grupo.
- **Solo habla cuando le preguntan** (*"¿qué deberes hay de mates?"*).
- Si escribes o dices **`Claw`** + lo que sea, se vuelve un asistente general (*"Claw, ¿cuánto son 2+2?"*).
- **Entiende notas de voz** (las transcribe en tu ordenador con Whisper).
- **Guarda las fotos** de lo que entra en cada examen y las reenvía al preguntar. Borra las caducadas solo.
- Evita que el ordenador se duerma mientras está abierto (`PREVENT_SLEEP`, y `KEEP_DISPLAY` para la pantalla).

**Privacidad:** la IA, la clasificación y la base de datos corren en tu PC. Salen a internet WhatsApp (mensajes), ngrok (API y web), Ollama y Whisper (descarga de modelos) y, si `WEB_SEARCH=true`, las búsquedas a DuckDuckGo. Desactívala con `WEB_SEARCH=false` o `!claw ajustes buscar no`. Más en [privacidad](docs/arquitectura.md#datos-y-privacidad).

---

## Cómo funciona

```
mensaje del grupo
   │
   ├─ ¿dicen "Claw"? ───────────► asistente general (IA libre)
   ├─ ¿preguntan deberes/examen? ► responde al instante desde la BD (sin IA)
   └─ ¿suena a deberes/examen? ──► la IA lo clasifica
         ├─ alguien PREGUNTA → abre una "pregunta pendiente" de 15 min
         └─ alguien CUENTA   → se guarda en la base de datos, en silencio
```

La clave es la **pregunta pendiente**: si alguien pregunta *"¿qué deberes hay de inglés?"*, durante 15 minutos Claw guarda lo que conteste el grupo (*"hay que hacer la página 12"*). Así aprende sin que nadie se lo pida. Las rectificaciones (*"no era la 12, es la 14"*) sustituyen el apunte anterior.

Detalles útiles:

- Usa los últimos mensajes **del mismo chat** para entender seguimientos como *"¿y qué entra?"* (respeta `STORE_MESSAGES`, nunca mezcla chats).
- Las fechas relativas ("el lunes", "mañana") se calculan desde la frase original.
- Física y Química (`FYQ`) se mantiene separada de Física y de Química.

### Notas de voz y fotos

- **Voz:** ffmpeg convierte el audio, Whisper lo transcribe y el texto sigue el camino normal. También reconoce *"Clau"* y *"Clao"* como el trigger. El audio nunca sale de tu PC.
- **Fotos:** solo se guardan si van de deberes/exámenes (hay pregunta abierta, el pie lo menciona o se enlazan a un examen). Los memes se ignoran.
- `TRANSCRIBE_MODE=contexto` transcribe para detectar "Claw" pero descarta el resto si no hay pregunta escolar abierta; `nada` desactiva la voz.

---

## Instalación

### 1. Requisitos

| Cosa | Instalación |
|---|---|
| Node.js 24 LTS | `winget install OpenJS.NodeJS.LTS` |
| Git | `winget install Git.Git` |
| Ollama | `winget install Ollama.Ollama` |
| Modelo principal | `ollama pull qwen3:4b` |
| Modelo de respaldo | `ollama pull qwen2.5:3b` |
| ffmpeg (solo para voz) | `winget install Gyan.FFmpeg` |

> Si PowerShell protesta por `npm.ps1`, usa `npm.cmd` en vez de `npm`. Es una restricción de Windows, no un fallo del proyecto.

### 2. Dependencias

```powershell
npm install
```

O haz doble clic en **`arrancar.bat`**: instala lo que falte, crea el `.env` y arranca el bot.

### 3. Comprueba que todo va bien

```powershell
npm run doctor     # diagnóstico: Ollama, modelo, base de datos, clasificador
npm run sim        # simulador sin WhatsApp
npm test           # pruebas de integración (con IA)
```

Prueba en el simulador:

```
chicos que deberes hay de mates?          ← abre pregunta pendiente
Ana: hay que hacer las paginas 30 a 32    ← (cambia de nombre con /yo Marcos)
que deberes hay de mates?                 ← responde al instante
el examen de historia es el 20 de octubre
Claw cuanto son 2+2
```

Extras del simulador: `/imagen <ruta> <pie>`, `/audio [ruta]`, `/ver`, `/limpiar`.

Otras pruebas: `npm run test:ai`, `npm run test:subjects` (sin Ollama) y `npm run test:voice` (necesita una muestra local; se omite si no hay, y se puede indicar con `WHISPER_TEST_AUDIO`).

### 4. Conéctalo a WhatsApp

```powershell
npm start
```

Escanea el **QR** en *Ajustes → Dispositivos vinculados → Vincular un dispositivo*. La sesión se guarda en `data/auth/` (¡no la compartas!).

### 5. Actívalo en el grupo

- **Automático:** pon el nombre exacto del grupo en `WHATSAPP_GROUP_NAME`. Se vincula al primer mensaje.
- **Manual:** escribe `!claw aqui` dentro del grupo.

Tras vincularse guarda el identificador interno (`...@g.us`), así que renombrar el grupo ya no le afecta. Con `WHATSAPP_GROUP_NAME` puesto, `!claw aqui` solo funciona en ese grupo y, si alguien lo desvincula, se vuelve a vincular solo.

### 6. Mensaje de bienvenida

La primera vez que arranca se presenta en el grupo (una sola vez). Opciones: `WELCOME_ALWAYS=true` (en cada arranque), `WELCOME_ENABLED=false` (nunca), `WELCOME_MESSAGE` (texto propio). Para enviarlo a mano, con el bot cerrado:

```powershell
npm run enviar -- --bienvenida
npm run enviar "un mensaje cualquiera"
```

---

## Comandos

Empiezan por `!claw` (`!pickle` sigue funcionando como alias antiguo). Cualquier otra cosa detrás es una pregunta al asistente: `!claw cuanto son 2+2`.

### Para todos

| Comando | Qué hace |
|---|---|
| `!claw` / `!claw ayuda` | estado / lista de comandos |
| `!claw deberes [asignatura]` | deberes pendientes |
| `!claw examenes` | próximos exámenes |
| `!claw apuntes` | todo lo apuntado |
| `!claw proximo` | lo próximo que cae, con los días que quedan |
| `!claw apunta deberes mates ficha para el viernes` | apunta o corrige un deber/examen (restringible con `APUNTA_LIBRE`) |
| `!claw hecho <asignatura o texto>` | marca como entregado, sin más recordatorios |
| `!claw resumen [hoy/semana]` | resume lo hablado y apuntado |
| `!claw calendario` | exámenes en un archivo `.ics` |
| `!claw busca <algo>` | busca en DuckDuckGo y resume |
| `!claw imagen <qué>` | genera una imagen (experimental, apagada de fábrica) |
| `!claw palabrotas` | ranking de tacos (sale solo al decir una) |
| `!claw ajedrez [jugada]` | partida de ajedrez contra Claw (`e4`, `Nf3`, `O-O`, `e2e4`) |
| `!claw analiza <FEN>` | analiza una posición |
| `!claw novedades` | lo nuevo del bot |

### Solo dueño / administradores

| Comando | Qué hace |
|---|---|
| `!claw aqui` / `!claw fuera` | vincula / desvincula el grupo |
| `!claw ajustes` | ver y cambiar ajustes (en caliente) |
| `!claw ia [fallback / principal / <modelo>]` | ver o cambiar el modelo de conversación (queda guardado) |
| `!claw prohibir <número>` / `permitir <número>` / `vetados` | vetar, perdonar, listar |
| `!claw mantenimiento si\|no` | el bot se queda mudo |
| `!claw olvida <texto>` / `olvida todo` | borra un apunte / todos los apuntes |
| `!claw palabrotas reset` | pone el contador a cero |
| `!claw admins [+número / -número]` | **solo el dueño**: gestiona administradores |

### Quién manda

- El **dueño** es el número del bot (o `WHATSAPP_OWNER_JID`). Solo él y sus **administradores** tocan los ajustes.
- Los **vetados** son ignorados por completo. Dueño y admins no se pueden vetar.
- Para dar órdenes cómodamente: el chat *Mensajes contigo mismo* o el propio grupo.

### Mensajes privados

Lo que le digas por privado sobre deberes/exámenes **se apunta en el grupo**. Para charlar, escribe `Claw` + tu pregunta. Quién puede escribirle lo decide `!claw ajustes privado`:

`dueno` (por defecto) · `admins` · `todos` · `nadie`

---

## La web y el acceso de estudiantes

La web la sirve **el propio servidor de Claw** (no se publica fuera): portada en `/` (`docs/index.html`), acceso en `/entrar/`. ngrok solo hace de puente desde fuera de casa.

```powershell
npm run web     # solo la web/API, sin WhatsApp
npm start       # bot completo (incluye la web)
```

### Cómo se entra

Toda la web y **todos los endpoints de la API** exigen sesión con un **código de un solo uso por email**, solo para `@alu.edu.gva.es`.

- Antes del código, el estudiante se registra (nombre, apellidos, curso, grupo). Los datos quedan solo en el servidor.
- El código dura 10 min y permite 5 intentos. La sesión caduca a las 8 h o al reiniciar.
- Los apuntes son compartidos entre estudiantes autenticados.
- ⚠️ **La app Android actual no usa este flujo y dejará de funcionar** hasta actualizar su cliente.

### Configuración

1. **SMTP (AsterMail):** `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`. La contraseña solo va en `.env`. Sin esto la web abre pero no envía códigos. Pruébalo con `npm run smtp -- tu-correo@alu.edu.gva.es`.
2. **ngrok:** dominio fijo `dawn-greeter-grazing.ngrok-free.dev` (sobrescribible con `NGROK_DOMAIN`). Se inicia solo al arrancar, reenvía al puerto 3000 y reintenta cada 5 s si cae.
3. **Otros orígenes:** añádelos a `WEB_ALLOWED_ORIGINS`, separados por comas y sin `/` final.

Detalles de rutas y seguridad: [guía de arquitectura](docs/arquitectura.md#publicación-y-seguridad).

### Modo debug (solo dueño)

Escribir `WEB_DEBUG_CODE` (por defecto `0912`) en el campo de correo de `/entrar/` da una sesión `debug` con pestaña **Administración** (estadísticas, ajustes y alumnado). Los intentos se limitan por IP y el código se valida en el servidor.

> ⚠️ `0912` es una puerta trasera deliberada. **Cámbialo** en `.env` (`WEB_DEBUG_CODE=...`), no lo compartas, o déjalo vacío para desactivarlo.

---

## Configuración (`.env`)

Copia `.env.example` a `.env`. Casi todo se cambia en caliente con `!claw ajustes` (p. ej. `!claw ajustes ack si`). Reinicia tras editar `.env` a mano.

### Esenciales

| Variable | Por defecto | Qué hace |
|---|---|---|
| `OLLAMA_MODEL` | `qwen3:4b` | modelo de conversación |
| `OLLAMA_MODEL_FALLBACK` | `qwen2.5:3b` | respaldo más ligero |
| `OLLAMA_MODEL_BRAIN` | `qwen2.5:3b` | clasifica deberes/exámenes |
| `WEB_SEARCH` | `true` | buscar en DuckDuckGo |
| `TZ` | `Europe/Madrid` | zona horaria |
| `CLAW_TRIGGER` | `claw` | palabra que activa al asistente |
| `CLAW_SIGNATURE` | `true` | cabecera "🪝 Claw" en las respuestas |
| `MAINTENANCE` | `false` | `true` = bot mudo |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info`, `debug` |

### WhatsApp y permisos

| Variable | Por defecto | Qué hace |
|---|---|---|
| `WHATSAPP_GROUP_JID` | vacío | fija el grupo por identificador |
| `WHATSAPP_GROUP_NAME` | vacío | vincula por nombre exacto |
| `WHATSAPP_OWNER_JID` | el del bot | dueño |
| `WHATSAPP_ADMINS` / `WHATSAPP_BLOCKED` | vacío | admins / vetados de arranque |
| `PRIVATE_MODE` | `dueno` | quién puede escribir por privado |
| `REPLY_TO_MENTIONS` | `true` | contesta a menciones |
| `APUNTA_LIBRE` | `true` | cualquiera puede usar `!claw apunta` |
| `ANSWER_WINDOW_MINUTES` | `15` | duración de la pregunta pendiente |
| `ACK_SAVES` | `false` | confirma cada apunte en el grupo |
| `MIN_SECONDS_BETWEEN_REPLIES` | `30` | anti-repetición |
| `REMINDER_ADVANCE_DAYS` | `3` | días de antelación del primer aviso de examen |
| `COUNT_SWEARS` / `SWEAR_ALERT` / `SWEAR_COOLDOWN` | `true` / `true` / `30` | ranking de palabrotas, aviso automático y margen (s) |
| `CHANGELOG_NOTIFY` | `true` | cuenta las novedades una vez |
| `PREVENT_SLEEP` / `KEEP_DISPLAY` | `true` / `false` | evita suspensión / apagado de pantalla |

### Web y correo

| Variable | Por defecto | Qué hace |
|---|---|---|
| `WEB_ALLOWED_ORIGINS` | vacío | orígenes extra para la API |
| `WEB_DEBUG_CODE` | `0912` | acceso debug (vacío = off) |
| `NGROK_ENABLED` / `NGROK_DOMAIN` | `true` / dominio fijo | túnel |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | vacío / `465` / `true` | servidor de correo |
| `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | ver `.env.example` | credenciales y remitente |

### Fotos, disco y limpieza

| Variable | Por defecto | Qué hace |
|---|---|---|
| `MEDIA_ENABLED` | `true` | guardar fotos |
| `MEDIA_MODE` | `contexto` | `contexto` · `todo` · `nada` |
| `MEDIA_MAX_MB` | `12` | tamaño máximo por archivo |
| `MEDIA_MIN_FREE_MB` | `800` | si hay menos libre, no guarda y avisa |
| `MEDIA_MAX_TOTAL_MB` | `2048` | tope de la carpeta; borra lo más antiguo |
| `MEDIA_RETENTION_DAYS` | `14` | días que se guarda una foto sin examen |
| `MEDIA_SEND_MAX` | `3` | fotos reenviadas como máximo |
| `CLEANUP_EXAM_GRACE_DAYS` | `3` | margen tras el examen antes de borrar |
| `CLEANUP_REMOVE_ENTRIES` | `true` | borra también el apunte del examen pasado |
| `CLEANUP_INTERVAL_MINUTES` | `60` | frecuencia de limpieza |

### Notas de voz

| Variable | Por defecto | Qué hace |
|---|---|---|
| `TRANSCRIBE_ENABLED` | `true` | entender voz |
| `TRANSCRIBE_MODE` | `todo` | `todo` · `contexto` · `nada` |
| `TRANSCRIBE_MAX_SECONDS` | `180` | no escucha audios más largos |
| `WHISPER_MODEL` | `Xenova/whisper-base` | `tiny` (rápido) · `base` · `small` (mejor) |
| `SHOW_TRANSCRIPTIONS` | `false` | muestra lo entendido en el grupo |
| `FFMPEG_PATH` | `ffmpeg` | ruta a ffmpeg si no está en el PATH |

### Imágenes (experimental)

Todas empiezan por `IMAGE_GEN_`: `ENABLED` (`false`), `BACKEND` (`cli`), `BIN`, `MODEL_PATH`, `STEPS` (`20`), `WIDTH`/`HEIGHT` (`512`), `NEGATIVE`, `ENHANCE` (`true`), `SEED` (`-1`), `CFG` (`7`), `SAMPLER`, `SCHEDULER`, `FREE_VRAM` (`true`), `TIMEOUT` (`300`) y, solo para el motor `http`, `ENDPOINT`, `MODEL` y `API_KEY`. Valores completos en `.env.example`.

> **Qwen3** puede tardar más en la primera respuesta. Si no termina, Claw prueba el respaldo para ese mensaje sin cambiar el modelo guardado. Para respuestas más rápidas usa `!claw ia fallback`.

---

## IA de imágenes (experimental, local)

Dibuja con **stable-diffusion.cpp** + Stable Diffusion 1.5, todo en tu PC.

- **Apagada de fábrica.** Para encenderla: `!claw ajustes imagenes si`.
- **Nunca** genera nada por su cuenta: solo con `!claw imagen <qué>` escrito a mano.
- Una a la vez; mientras dibuja marca "escribiendo…". Si se pasa de tiempo, mata el proceso.
- Si falta `sdserver\` o el modelo, avisa y el resto del bot sigue igual.

```
sdserver\
├─ sd-cli.exe                 motor (build CUDA 12) + sus .dll
└─ models\v1-5-pruned_Q4_K.gguf
```

El motor `cli` llama a `sd-cli.exe` en cada petición (sin servidores abiertos). Para un servidor compatible con OpenAI Images: `!claw ajustes imagen_motor http` y apunta `IMAGE_GEN_ENDPOINT`.

Con una GTX 1650 (4 GB): 8 pasos ≈ 35 s (algo borroso), 20 pasos ≈ 65 s (por defecto). Se ajusta con `!claw ajustes imagen_pasos <n>`. En 4 GB el modelo de texto y el de imágenes no caben juntos, así que antes de dibujar Claw suelta el de Ollama (se recarga solo después). Con una gráfica grande, `IMAGE_GEN_FREE_VRAM=false`.

---

## Estructura del proyecto

```
Claw/
├─ arrancar.bat        doble clic para arrancar
├─ .env.example        plantilla de configuración
├─ docs/               portada, /entrar/ y arquitectura.md
├─ data/               se crea sola (auth/, media/, tmp/, picklebrain.db)
├─ sdserver/           IA de imágenes (opcional)
└─ src/
   ├─ index.js         arranque completo (WhatsApp + servidor)
   ├─ web.js           solo web/API
   ├─ server.js        API HTTP, CORS y ngrok
   ├─ whatsapp.js      conexión (Baileys)
   ├─ router.js        decide qué hacer con cada mensaje
   ├─ signals.js       reglas rápidas sin IA
   ├─ brain.js         clasificador con IA local
   ├─ claw.js          asistente general
   ├─ search.js        búsqueda DuckDuckGo
   ├─ memory.js        base de datos SQLite
   ├─ media.js         fotos, disco y limpieza
   ├─ transcribe.js    voz con Whisper
   ├─ replies.js · dates.js · subjects.js · ollama.js
   ├─ imagegen.js · presence.js · changelog.js · config.js
   └─ tools/           doctor, simulador y pruebas
```

---

## Preguntas frecuentes

**¿Me pueden banear el número?** Sí, es un riesgo real: Baileys usa la API no oficial de WhatsApp Web, que sus términos prohíben. Para un bot tranquilo el riesgo es bajo, pero no es cero. **Usa un número aparte**: con tu número personal, el bot escribe como si fueras tú.

**¿Funciona con el móvil apagado?** Sí, mientras el PC esté encendido. La sesión caduca si no abres WhatsApp en el móvil en unos 14 días.

**¿Y si el PC se apaga?** El bot para, pero no pierde nada: todo está en `data/picklebrain.db`.

**¿Consume mucho?** No. La IA solo despierta con algo de deberes/exámenes, y las preguntas típicas se responden **sin IA**. La primera respuesta tras un rato tarda unos segundos (carga del modelo). Whisper ocupa unos 90 MB y tarda 2-3 s por cada 10 s de audio.

**¿Se llena el disco con las fotos?** No debería: solo guarda las relevantes, mira el espacio libre antes de bajar nada (y avisa si no hay) y borra cada hora lo caducado (exámenes pasados, fotos sueltas viejas y lo que supere el tope). Con `MEDIA_MODE=todo` guarda todo, incluidas fotos privadas: no lo recomiendo.

**El bot no dice nada en el grupo.** 1) Comprueba que el grupo está vinculado (nombre exacto en `WHATSAPP_GROUP_NAME` o `!claw aqui`). 2) Escribe `!claw` para ver el estado. 3) Con `LOG_LEVEL=debug` verás por qué descarta cada mensaje.

**"Ollama no responde".** Abre la aplicación Ollama y comprueba con `ollama list` que el modelo está descargado.

**Las notas de voz no funcionan.** Instala ffmpeg, **reabre la consola** (para refrescar el PATH) y mira `npm run doctor`.

**La primera nota de voz tarda mucho.** Whisper descarga el modelo (~75 MB) la primera vez, hasta medio minuto. Si va lento, usa `WHISPER_MODEL=Xenova/whisper-tiny`.

---

## Límites y mejoras posibles

- **APK Android:** no forma parte de este repositorio. La API anuncia el APK de la última release de GitHub, que debe adjuntarse como `ClawCompanion.apk`.
- **Modelo más grande:** con otra tarjeta, `qwen2.5:7b` o `llama3.1:8b` hablan mucho mejor. Ponlo en `OLLAMA_MODEL` y deja uno pequeño en `OLLAMA_MODEL_BRAIN`.
- **Mejor voz:** `WHISPER_MODEL=Xenova/whisper-small` (más lento, mucho mejor con nombres propios y ruido).
