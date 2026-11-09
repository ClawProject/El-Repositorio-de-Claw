<p align="center">
  <img src="assets/logo.png" width="128" height="128" alt="Claw logo">
</p>

<h1 align="center">Claw</h1>

<p align="center">
  <a href="https://github.com/ClawProject/TheClawRepo/releases"><img src="https://img.shields.io/github/v/tag/ClawProject/TheClawRepo?label=release&color=f59e0b" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white" alt="Node.js 22 or newer">
  <img src="https://img.shields.io/badge/platforms-Windows%20%7C%20Linux%20%7C%20macOS-4B5563" alt="Windows, Linux and macOS">
  <img src="https://img.shields.io/badge/AI-local%20with%20Ollama-111827" alt="Local AI with Ollama">
  <img src="https://img.shields.io/badge/voice-Whisper-7c3aed" alt="Voice with Whisper">
  <a href="https://discord.gg/DwbMbEqQ6E"><img src="https://img.shields.io/badge/Discord-join%20the%20server-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://github.com/ClawProject/TheClawRepo/stargazers"><img src="https://img.shields.io/github/stars/ClawProject/TheClawRepo" alt="GitHub stars"></a>
</p>

<p align="center"><strong>Un bot de WhatsApp autoalojado con IA local.</strong></p>

<p align="center">[English](README.md) · **Español** · [Català](README.ca.md) · [Français](README.fr.md) · [Português](README.pt.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [中文](README.zh.md)</p>

Claw es un asistente de WhatsApp con IA local pensado para llevar el control de los deberes, los exámenes, los avisos del instituto y la información importante que se comparte en los grupos.

Funciona en silencio en segundo plano, entiende mensajes de texto, notas de voz e imágenes relevantes, y responde a las preguntas cuando alguien necesita información.

> **Instalación:** consulta [INSTALL.es.md](INSTALL.es.md) para las instrucciones detalladas en Linux, macOS y Windows.
>
> **Documentación técnica:** [Arquitectura, API y seguridad](docs/arquitectura.md).

---

## ✨ Funciones

- **Seguimiento automático de deberes:** detecta y anota los deberes y los próximos exámenes a partir de las conversaciones del grupo.
- **Funcionamiento silencioso:** Claw solo habla cuando alguien pregunta o lo activa explícitamente.
- **Asistente de IA de propósito general:** menciona `Claw` seguido de una pregunta para usar sus capacidades generales de IA.
- **Reconocimiento de voz:** transcribe las notas de voz en local con Whisper.
- **Almacenamiento de imágenes:** guarda las imágenes relacionadas con deberes y exámenes y elimina automáticamente los archivos caducados.
- **Procesamiento de IA local:** usa Ollama para ejecutar los modelos de lenguaje en tu propio ordenador.
- **Configuración de idioma al primer arranque:** en el primer inicio, Claw abre una página web para elegir entre 100 idiomas. La elección se guarda en la base de datos, se aplica a la interfaz y a las respuestas de la IA, y puede cambiarse después con `!claw language en`.
- **Interfaz web:** da a los estudiantes acceso autenticado a la información escolar compartida.
- **Integración con el calendario:** exporta los próximos exámenes como archivos `.ics`.
- **Ajedrez:** juega al ajedrez contra Claw o analiza posiciones.
- **Generación de imágenes opcional:** genera imágenes en local con Stable Diffusion.
- **Mantenimiento automático:** gestiona los archivos multimedia guardados y puede evitar que el ordenador anfitrión se suspenda.

### 🔒 Privacidad

Claw está diseñado alrededor del procesamiento local.

La inferencia de IA, la clasificación y la base de datos se ejecutan en tu ordenador.

Aun así, algunas conexiones externas siguen siendo necesarias:

- WhatsApp: entrega y recepción de mensajes.
- Ollama y Whisper: descarga de modelos.
- DuckDuckGo: búsquedas web opcionales.

Las búsquedas web pueden desactivarse con `WEB_SEARCH=false` o con `!claw ajustes buscar no`.

Consulta la [documentación de privacidad](docs/arquitectura.md#datos-y-privacidad) para más información.

---

## 🧠 Cómo funciona

Claw analiza los mensajes que llegan al grupo y decide qué hacer.

```text
Mensaje entrante del grupo
        |
        +-- ¿Contiene "Claw"?
        |       |
        |       +-- Asistente de IA general
        |
        +-- ¿Es una pregunta de deberes o exámenes?
        |       |
        |       +-- Responde directamente desde la base de datos
        |
        +-- ¿Podría contener información escolar?
                |
                +-- Clasificación con IA local
                        |
                        +-- Pregunta detectada
                        |       |
                        |       +-- Abre una pregunta pendiente de 15 minutos
                        |
                        +-- Información detectada
                                |
                                +-- Guarda en silencio en la base de datos
```

### Preguntas pendientes

Una de las funciones principales de Claw es su sistema de preguntas pendientes.

Por ejemplo:

1. Un estudiante pregunta: «¿Cuáles son los deberes de inglés?»
2. Claw abre una pregunta pendiente de 15 minutos.
3. Otro estudiante responde: «Hacer la página 12.»
4. Claw guarda la información automáticamente.
5. Cualquiera puede preguntar después a Claw por los deberes de inglés.

Las correcciones sustituyen a las entradas anteriores, así que la información desactualizada no se queda en la base de datos.

Claw también entiende el contexto de la conversación a partir de los mensajes recientes del mismo chat, sin mezclar conversaciones.

### 🎙️ Notas de voz

Claw entiende las notas de voz con Whisper.

- El audio se transcribe en local.
- El servicio de Python usa faster-whisper.
- Hay un modo alternativo en Node.js.
- Reconoce otras pronunciaciones del nombre, como «Clau» y «Clao».
- El audio nunca tiene que salir de tu ordenador para transcribirse.

### 🖼️ Imágenes

Claw puede guardar imágenes relacionadas con deberes y exámenes.

- Se almacenan las imágenes escolares relevantes.
- Los memes y las imágenes sin relación se ignoran.
- Los archivos caducados se eliminan automáticamente.
- Las imágenes pueden reenviarse cuando alguien pregunta por un examen.

---

## 🚀 Instalación

Para las instrucciones completas, consulta **[INSTALL.es.md](INSTALL.es.md)**.

### Requisitos

| Dependencia        | Versión / modelo                      |
| ------------------ | ------------------------------------- |
| Node.js            | 24 LTS                                |
| Git                | Última versión                        |
| Ollama             | Última versión                        |
| Modelo principal   | `qwen3:4b`                            |
| Modelo alternativo | `qwen2.5:3b`                          |
| Python             | 3.11 / 3.12 (recomendado)             |
| FFmpeg             | Opcional, para la voz en modo antiguo |

Descarga los modelos:

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

### Clonar el repositorio

```bash
git clone <REPOSITORY_URL>
cd Claw
```

Instala las dependencias:

```bash
npm install
```

Como alternativa, en Windows puedes ejecutar:

```powershell
.\arrancar.bat
```

Ese script instala las dependencias que falten, crea la configuración de entorno y arranca el bot.

### Servicio de Python opcional

El servicio de Python aporta mejor procesamiento de voz y generación de imágenes en local.

Crea un entorno virtual:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

Instala las dependencias:

```bash
pip install -r python/requirements.txt
pip install -r python/requirements-images.txt
```

Arranca el servicio:

```bash
python python/server.py
```

Comprueba su estado:

```bash
curl http://127.0.0.1:5050/health
```

Consulta [python/README.md](python/README.md) para más información.

---

## 🧪 Pruebas

Claw incluye varias herramientas para verificar que la instalación funciona.

```bash
npm run doctor
npm run sim
npm test
```

| Comando                 | Descripción                                              |
| ----------------------- | -------------------------------------------------------- |
| `npm run doctor`        | Comprueba Ollama, los modelos, la base y el clasificador. |
| `npm run sim`           | Arranca un simulador de mensajes sin WhatsApp.           |
| `npm test`              | Ejecuta las pruebas de integración.                      |
| `npm run test:ai`       | Prueba las funciones de IA.                              |
| `npm run test:subjects` | Prueba el reconocimiento de asignaturas sin Ollama.      |
| `npm run test:python`   | Prueba la interfaz Node.js ↔ Python.                     |
| `npm run test:voice`    | Prueba la transcripción con audio local.                 |

### Ejemplo de simulación

```text
Estudiante: ¿Cuáles son los deberes de matemáticas?
Claw: Esperando una respuesta...

Ana: Hacer las páginas 30 a 32.

Estudiante: ¿Cuáles son los deberes de matemáticas?
Claw: Hacer las páginas 30 a 32.

Estudiante: El examen de historia es el 20 de octubre.

Estudiante: Claw, ¿cuánto es 2 + 2?
Claw: 4.
```

---

## 📱 Conectar WhatsApp

Arranca Claw:

```bash
npm start
```

Escanea el código QR desde:

**WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo**

Tu sesión de autenticación se guarda en:

```text
data/auth/
```

**No compartas nunca esta carpeta ni su contenido.**

### Activar Claw en un grupo

Hay dos formas de conectar un grupo:

**Activación manual:**

```text
!claw aqui
```

**Activación automática:**

Indica el identificador interno del grupo en `.env`:

```env
WHATSAPP_GROUP_JID=your-group-id@g.us
```

Claw identifica los grupos por su identificador interno, no por su nombre.

---

## 💬 Comandos

Todos los comandos empiezan por `!claw`. También se admite el alias antiguo `!pickle`.

### Comandos generales

| Comando                      | Descripción                                    |
| ---------------------------- | ---------------------------------------------- |
| `!claw`                      | Muestra el estado del bot.                     |
| `!claw ayuda`                | Muestra los comandos disponibles.              |
| `!claw deberes [asignatura]` | Muestra los deberes pendientes.                |
| `!claw examenes`             | Muestra los próximos exámenes.                 |
| `!claw apuntes`              | Muestra la información guardada.               |
| `!claw proximo`              | Muestra el siguiente examen o trabajo.         |
| `!claw apunta ...`           | Añade o corrige un trabajo.                    |
| `!claw hecho ...`            | Marca un trabajo como hecho.                   |
| `!claw resumen [hoy/semana]` | Resume la información reciente.                |
| `!claw calendario`           | Exporta los exámenes como archivo ICS.         |
| `!claw busca ...`            | Busca en la web.                               |
| `!claw imagen ...`           | Genera una imagen (experimental).              |
| `!claw ajedrez [jugada]`     | Juega al ajedrez contra Claw.                  |
| `!claw analiza [FEN]`        | Analiza una posición de ajedrez.               |
| `!claw novedades`            | Muestra los cambios recientes.                 |

### Comandos del dueño y de administradores

| Comando                      | Descripción                                |
| ---------------------------- | ------------------------------------------ |
| `!claw aqui` / `!claw fuera` | Conecta o desconecta un grupo.             |
| `!claw ajustes`              | Consulta y cambia los ajustes.             |
| `!claw ia`                   | Consulta o cambia el modelo de IA.         |
| `!claw prohibir [número]`    | Bloquea a un usuario.                      |
| `!claw permitir [número]`    | Desbloquea a un usuario.                   |
| `!claw vetados`              | Lista los usuarios bloqueados.             |
| `!claw mantenimiento si/no`  | Activa o desactiva el modo mantenimiento.  |
| `!claw olvida ...`           | Borra información guardada.                |
| `!claw admins`               | Gestiona los administradores (solo dueño). |

El dueño del bot es la cuenta de WhatsApp que ejecuta Claw o `WHATSAPP_OWNER_JID`.

Solo el dueño y los administradores autorizados pueden cambiar ajustes administrativos.

---

## 🌐 Interfaz web

Claw incluye una interfaz web y una API integradas.

Arranca solo el servidor web:

```bash
npm run web
```

Arranca todo:

```bash
npm start
```

La interfaz web la sirve el propio servidor de Claw:

- `/` — Página principal.
- `/entrar/` — Acceso para estudiantes.

### Autenticación de estudiantes

El acceso requiere un código de verificación de un solo uso enviado por correo.

Reglas actuales de autenticación:

- Solo se aceptan direcciones `@alu.edu.gva.es`.
- Los estudiantes registran nombre, apellidos, curso y grupo.
- Los códigos caducan a los 10 minutos.
- Se permiten como máximo cinco intentos de verificación.
- Las sesiones caducan a las ocho horas o cuando se reinicia el servidor.
- Los estudiantes autenticados comparten los mismos registros de deberes y exámenes.

### Acceso desde la red

La web la sirve el propio Claw en `http://127.0.0.1:3000`, así que no hace falta ningún túnel. Si la publicas en otro dominio (un proxy inverso con HTTPS, por ejemplo), añádelo a `WEB_ALLOWED_ORIGINS` separado por comas.

Hacen falta credenciales SMTP para la verificación por correo.

**Aviso de seguridad:** la función de acceso de depuración debe configurarse con cuidado. No dejes nunca un código de depuración por defecto activo en un servidor accesible desde internet.

Consulta la [documentación de arquitectura y seguridad](docs/arquitectura.md).

---

## ⚙️ Configuración

Copia la configuración de ejemplo:

```bash
cp .env.example .env
```

El archivo `.env` contiene las opciones principales.

### Configuración de IA

| Variable                | Valor por defecto |
| ----------------------- | ----------------- |
| `OLLAMA_MODEL`          | `qwen3:4b`        |
| `OLLAMA_MODEL_FALLBACK` | `qwen2.5:3b`      |
| `OLLAMA_MODEL_BRAIN`    | `qwen2.5:3b`      |
| `WEB_SEARCH`            | `true`            |
| `CLAW_TRIGGER`          | `claw`            |
| `CLAW_SIGNATURE`        | `true`            |

### Configuración de WhatsApp

| Variable                | Valor por defecto |
| ----------------------- | ----------------- |
| `WHATSAPP_GROUP_JID`    | Vacío             |
| `WHATSAPP_OWNER_JID`    | Cuenta del bot    |
| `PRIVATE_MODE`          | `dueno`           |
| `APUNTA_LIBRE`          | `true`            |
| `ANSWER_WINDOW_MINUTES` | `15`              |
| `ACK_SAVES`             | `false`           |

### Configuración de archivos multimedia

| Variable               | Valor por defecto |
| ---------------------- | ----------------- |
| `MEDIA_ENABLED`        | `true`            |
| `MEDIA_MODE`           | `contexto`        |
| `MEDIA_MAX_MB`         | `12`              |
| `MEDIA_MAX_TOTAL_MB`   | `2048`            |
| `MEDIA_RETENTION_DAYS` | `14`              |

### Configuración de voz

| Variable                 | Valor por defecto     |
| ------------------------ | --------------------- |
| `TRANSCRIBE_ENABLED`     | `true`                |
| `TRANSCRIBE_MODE`        | `todo`                |
| `TRANSCRIBE_MAX_SECONDS` | `180`                 |
| `WHISPER_MODEL`          | `Xenova/whisper-base` |

### Configuración de la IA en Python

| Variable                | Valor por defecto                             |
| ----------------------- | --------------------------------------------- |
| `PYTHON_AI_ENABLED`     | `true`                                        |
| `PYTHON_AI_URL`         | `http://127.0.0.1:5050`                       |
| `PYTHON_WHISPER_MODEL`  | `base`                                        |
| `PYTHON_WHISPER_DEVICE` | `auto`                                        |
| `PYTHON_IMAGE_MODEL`    | `stable-diffusion-v1-5/stable-diffusion-v1-5` |

Casi todos los ajustes de ejecución también pueden cambiarse con `!claw ajustes`.

Para la referencia completa de configuración, consulta `.env.example` e [INSTALL.es.md](INSTALL.es.md).

---

## 🎨 Generación de imágenes en local (experimental)

Claw admite opcionalmente la generación de imágenes en local.

Motores disponibles:

- **Python + Diffusers:** admite muchos modelos a través de Hugging Face.
- **stable-diffusion.cpp:** generación ligera por línea de comandos.
- **Backend HTTP:** servidores de generación de imágenes compatibles.

La generación de imágenes está desactivada por defecto.

Actívala con:

```text
!claw ajustes imagenes si
```

Genera una imagen:

```text
!claw imagen a futuristic city at night
```

Claw nunca genera imágenes automáticamente.

En equipos con poca memoria de GPU, la generación de imágenes puede descargar temporalmente el modelo de Ollama para liberar VRAM.

---

## 📁 Estructura del proyecto

```text
Claw/
├── arrancar.bat
├── .env.example
├── docs/
│   ├── index.html
│   └── arquitectura.md
├── data/
├── python/
│   ├── server.py
│   ├── requirements.txt
│   └── requirements-images.txt
├── sdserver/
└── src/
    ├── index.js
    ├── web.js
    ├── server.js
    ├── whatsapp.js
    ├── router.js
    ├── signals.js
    ├── brain.js
    ├── claw.js
    ├── search.js
    ├── memory.js
    ├── media.js
    ├── transcribe.js
    ├── python-ai.js
    ├── replies.js
    ├── dates.js
    ├── subjects.js
    ├── ollama.js
    ├── imagegen.js
    ├── presence.js
    ├── changelog.js
    ├── config.js
    └── tools/
```

---

## ❓ Preguntas frecuentes

**¿Claw necesita conexión a internet?**

WhatsApp y los servicios externos opcionales necesitan conexión. La inferencia de IA local y la base de datos funcionan en tu ordenador.

**¿Puedo usar Claw con el móvil apagado?**

Sí, siempre que el ordenador que lo aloja siga encendido y la sesión de dispositivo vinculado de WhatsApp siga siendo válida.

**¿Qué pasa si se apaga el ordenador?**

Claw deja de funcionar, pero la información guardada sigue en `data/picklebrain.db`.

**¿Puede WhatsApp bloquear mi número?**

Hay riesgo real. Claw usa Baileys, una biblioteca no oficial de WhatsApp Web. Los términos de WhatsApp limitan la automatización no autorizada. Se recomienda usar un número aparte.

**¿Claw consume muchos recursos?**

Depende de los modelos y del hardware. Las preguntas habituales se responden directamente desde la base de datos, sin ejecutar un modelo.

**¿Guarda todas las imágenes?**

No. Por defecto solo guarda las imágenes relevantes para el instituto, y los archivos antiguos se eliminan automáticamente.

**¿Por qué no responde Claw?**

1. Comprueba que el grupo está vinculado.
2. Escribe `!claw` para ver su estado.
3. Ejecuta `npm run doctor`.
4. Activa `LOG_LEVEL=debug` para ver cómo procesa los mensajes.

**¿Por qué no funciona el reconocimiento de voz?**

Comprueba que el servicio de Python está en marcha o instala FFmpeg para el motor de transcripción antiguo de Node.js.

---

## ⚠️ Limitaciones y mejoras futuras

- El APK complementario de Android no está en este repositorio. La API espera que el adjunto de la última release se llame `ClawCompanion.apk`.
- Los modelos de lenguaje más grandes mejoran la conversación cuando hay hardware suficiente.
- Los modelos de Whisper más grandes mejoran el reconocimiento de nombres y de grabaciones con ruido.
- La generación de imágenes es experimental y depende del hardware y de la compatibilidad de los modelos.

---

## 📚 Documentación

- [Guía de instalación](INSTALL.es.md)
- [Arquitectura técnica](docs/arquitectura.md)
- [Documentación del servicio de Python](python/README.md)
- [Configuración de entorno](.env.example)
- [Comunidad de Discord](https://discord.gg/DwbMbEqQ6E)

---

**Claw — Tu asistente de IA local para la vida escolar.** 🪝
