# Changelog

Todos los cambios importantes de **PickleBrain**, en orden cronológico inverso.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/)
y el proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

---

## [Sin publicar]

### Cambiado

- **Dominio fijo del túnel.** La web y el servidor usan siempre
  `dawn-greeter-grazing.ngrok-free.dev`; ya no hay que configurarlo a mano.
- **Registro antes de entrar.** El acceso por correo pide nombre, apellidos,
  curso y grupo, y guarda el perfil en SQLite. El panel de administración puede
  consultarlo y borrarlo.
- **Clasificación con contexto y fechas más fiables.** Las respuestas breves a
  una pregunta pendiente pueden heredar su tipo y asignatura; las correcciones
  explícitas se reconocen y sustituyen el apunte anterior. Las fechas relativas
  se calculan a partir de la frase original, y se evitan confusiones entre fechas
  y listas como `3/5/6`.
- **Física y Química como asignatura conjunta.** Se reconoce también como `FYQ`
  y se consulta con una clave común, sin mezclarla con Física o Química por
  separado.
- **Respuestas de Qwen3 más limpias y robustas.** Se descarta el razonamiento
  interno o una respuesta truncada, y Claw recurre al modelo de respaldo si el
  principal no termina.

### Añadido

- **Guía de instalación y plantilla de configuración.** Nuevo `INSTALL.md` con
  los pasos para Linux, macOS y Windows, `git clone`, Node, Ollama, servicio
  Python, Homebrew y resolución de problemas. Se añade `.env.example` y `.env`
  pasa a estar ignorado por Git.
- **Carpeta de datos configurable.** `PICKLEBRAIN_DATA_DIR` permite guardar la
  sesión, SQLite, fotos y modelos fuera del código (útil con Homebrew). El `.env`
  también se puede colocar dentro de esa carpeta.
- **Servicio Python para voz e imágenes.** `python/server.py` (FastAPI) usa
  faster-whisper para transcribir notas de voz y diffusers para dibujar. Node lo
  llama por HTTP en `127.0.0.1:5050`; si no está arrancado, el bot sigue con los
  motores antiguos (transformers.js y sd-cli). Las imágenes pasan a
  `IMAGE_GEN_BACKEND=auto` por defecto y Whisper cambia solo a CPU si detecta
  CUDA pero faltan `libcublas`/cuDNN. Incluye `npm run ia`, `npm run test:python`
  y pruebas del contrato Node ↔ Python sin descargar modelos.
- **Modo debug con acceso total.** Escribir `0912` (o el código de
  `WEB_DEBUG_CODE`) en el campo del correo de `/entrar/` entra al instante, sin
  correo ni OTP. La sesión lleva `debug: true` y desbloquea una pestaña de
  administración con estadísticas, todos los ajustes del bot y el alumnado
  registrado. Los intentos se limitan por IP y las cuentas normales siguen sin
  acceso a `/api/admin/*`.
- **Apuntar por privado (mensajes directos).** Ahora puedes escribirle al bot por
  privado (mensaje directo o el chat contigo mismo): lo que le digas de deberes o
  exámenes **se apunta en el grupo**, y también puedes preguntarle por ellos por
  ahí. Así se puede dejar un deber a mano sin escribir en el grupo. Para charlar
  con Claw de cualquier otra cosa por privado, se escribe `Claw` + la pregunta
  (antes cualquier mensaje privado iba directo a Claw y no se apuntaba nada). Por
  seguridad, `!claw fuera` ya solo funciona dentro del grupo, para no
  desvincularlo sin querer desde un privado.
- **Búsqueda en internet (DuckDuckGo).** Claw ahora puede buscar en la web cuando
  la pregunta pide algo actual (noticias, precios, resultados deportivos…) o
  cuando se lo piden a la fuerza con `!claw busca <algo>`. Funciona sin
  dependencias nuevas: usa el buscador HTML, luego el "lite" y, si falla, la API
  de respuestas instantáneas. Se activa o desactiva con `!claw ajustes buscar
  si|no` (o `WEB_SEARCH`).
- **Dos modelos de IA según la tarea.** El "cerebro" que apunta deberes y
  exámenes puede usar un modelo distinto (normalmente más pequeño y rápido) que el
  que charla. Nuevo ajuste `modelo_cerebro` / variable `OLLAMA_MODEL_BRAIN`. Por
  defecto los dos usan `qwen2.5:3b`, que cabe entero en la GPU y responde al
  momento.
- **Ajuste `modelo`.** El dueño puede cambiar el modelo de IA de Ollama en
  caliente desde WhatsApp (por ejemplo `!claw ajustes modelo qwen2.5:3b`), sin
  tocar el `.env` ni reiniciar.
- **Firma de Claw.** Las respuestas del asistente llevan ahora una cabecera
  `🪝 Claw` para poder distinguirlas de un vistazo de los avisos de
  deberes/exámenes. Se puede quitar con `!claw ajustes firma no` (o
  `CLAW_SIGNATURE=false`).
- **Ver y borrar de golpe.** Nuevo comando `!claw apuntes` para ver todo lo que
  el bot tiene apuntado (deberes y exámenes) de una vez, y `!claw olvida todo`
  (dueño/admin) para vaciar de golpe todos los apuntes del grupo. El borrado
  respeta los demás grupos y no toca el historial.
- **Apuntar a mano con fecha límite.** Nuevo comando `!claw apunta` para crear o
  corregir un deber o examen y ponerle la fecha a mano, sin esperar a que lo
  digan en el grupo: `!claw apunta deberes mates hacer la ficha 3 para el
  viernes` (también vale cambiarla sola: `!claw apunta deberes mates para el
  lunes`). Por defecto lo puede usar **cualquiera** del grupo; el dueño puede
  restringirlo a dueño y admins con `!claw ajustes apunta no` (o `APUNTA_LIBRE`).
- **Ajuste `apunta`.** Quién puede usar `!claw apunta`: cualquiera (`si`, por
  defecto) o solo el dueño y los administradores (`no`).
- **Marcar deberes como hechos.** `!claw hecho lengua` (o con una palabra del
  enunciado) quita de pendientes lo que ya se ha entregado: deja de salir en
  `!claw deberes`, en `!claw proximo` y en los recordatorios. Sin argumentos
  muestra qué queda pendiente y cómo marcarlo.
- **Aviso de examen con antelación.** Además de la víspera y del mismo día, Claw
  avisa tres días antes (`REMINDER_ADVANCE_DAYS`) para que dé tiempo a repasar.
  Ponlo en `0` si prefieres solo los avisos de siempre.
- **Candado de energía.** Mientras el bot está abierto, impide que Windows duerma
  o hiberne el ordenador (si se suspendía, se caía la conexión con WhatsApp).
  Usa `SetThreadExecutionState` con un pequeño proceso auxiliar: no toca ningún
  ajuste del PC y se suelta solo al cerrar el bot. Se controla con los ajustes
  `despierto` y `pantalla` (y las variables `PREVENT_SLEEP` y `KEEP_DISPLAY`).
- **Quién puede escribirle por privado.** Nuevo ajuste `privado` con cuatro
  opciones: `dueno` (solo tú, por defecto), `admins` (tú y los administradores),
  `todos` (cualquiera) o `nadie`. Se cambia con `!claw ajustes privado <valor>`
  (o `PRIVATE_MODE`). Antes era un simple sí/no y, con el sí, podía escribirle
  cualquiera.
- **Vetar a alguien (prohibirle usar a Claw).** Nuevos comandos `!claw prohibir
  <número>` y `!claw permitir <número>` (dueño/admin), y `!claw vetados` para ver
  la lista. A quien está vetado el bot lo ignora por completo: no le contesta a
  Claw, no le responde a menciones y no le acepta comandos `!claw`. El dueño y los
  administradores no se pueden vetar. También se puede poner de arranque con
  `WHATSAPP_BLOCKED`.
- **Contador de palabrotas.** El bot cuenta los tacos que se dicen en el grupo (por
  persona): además de poder verlo con `!claw palabrotas`, el ranking **sale solo**
  en cuanto alguien suelta una palabrota (con un pequeño margen entre avisos para
  no spamear). Se pone a cero con `!claw palabrotas reset` (dueño/admin) y se
  controla con `!claw ajustes palabrotas`/`palabrotas_aviso`/`palabrotas_espera` o
  las variables `COUNT_SWEARS`/`SWEAR_ALERT`/`SWEAR_COOLDOWN`. Reconoce palabras
  completas (así "computadora" no cuenta como "puta") y no censura ni regaña a nadie.
- **Generación de imágenes (experimental).** Nuevo comando `!claw imagen <qué>`
  que pide la imagen a un endpoint local compatible con OpenAI Images. Se añaden
  los ajustes `imagenes`, `imagen_modelo` y `imagen_endpoint` (y las variables
  `IMAGE_GEN_ENABLED`, `IMAGE_GEN_ENDPOINT`, `IMAGE_GEN_MODEL`, `IMAGE_GEN_API_KEY`,
  `IMAGE_GEN_SIZE` y `IMAGE_GEN_TIMEOUT`). **Está apagada de fábrica a propósito**:
  el bot no genera ninguna imagen por su cuenta (ni si alguien le pide una
  hablando de ello); solo dibujo si alguien escribe `!claw imagen ...` a mano y
  alguien con permiso ha abierto antes el ajuste `imagenes`.
- **La IA de imágenes ya está instalada (y es local).** Se ha puesto en el
  ordenador una IA que dibuja de verdad (Stable Diffusion 1.5, dentro de
  `sdserver\`), así que la generación de imágenes deja de ser un hueco vacío: si
  algún día se enciende, funciona. El motor por defecto es `cli` (llama a
  `sd-cli.exe`, sin tener ningún servidor abierto) y también se puede apuntar a
  un servidor compatible con OpenAI Images con el motor `http`. Ajustes nuevos:
  `imagen_motor`, `imagen_pasos` y `imagen_negativo`; variables nuevas:
  `IMAGE_GEN_BACKEND`, `IMAGE_GEN_BIN`, `IMAGE_GEN_MODEL_PATH`,
  `IMAGE_GEN_STEPS`, `IMAGE_GEN_WIDTH`, `IMAGE_GEN_HEIGHT` y
  `IMAGE_GEN_NEGATIVE`. Sigue **apagada de fábrica**.
- **Aviso de novedades en el grupo.** Cuando se le añade algo al bot, el grupo se
  entera: se manda un resumen de lo nuevo, **una sola vez por novedad** (para no
  spamear en cada reinicio). Se puede volver a ver cuando quieras con `!claw
  novedades` y se controla con el ajuste `novedades` (o `CHANGELOG_NOTIFY`).
- **"Escribiendo…" mientras dibuja.** Dibujar una imagen tarda cerca de un minuto
  y, sin ninguna señal, parecía que el bot se había colgado. Ahora marca
  "escribiendo…" en el grupo mientras trabaja y lo quita al acabar. Y al pedir la
  imagen manda además un **"🎨 Generando, por favor espera…"**.
- **Prompts de imagen traducidos a inglés.** Stable Diffusion está entrenado en
  inglés y le mandábamos el texto en español tal cual, así que malinterpretaba
  muchas peticiones. Ahora el modelo de texto traduce y limpia el pedido **de
  forma literal** (traduce, pero no inventa objetos ni cambia el sujeto) y esa
  versión es la que va al motor. Se desactiva con `IMAGE_GEN_ENHANCE=false`.
- **Ajustes finos de las imágenes.** Nuevas variables `IMAGE_GEN_CFG`,
  `IMAGE_GEN_SAMPLER` (por defecto `dpm++2m`), `IMAGE_GEN_SCHEDULER`
  (`karras`), `IMAGE_GEN_SEED` (por defecto `-1`, **semilla aleatoria**: antes
  salía la misma composición siempre, la 42) y `IMAGE_GEN_NEGATIVE`, cuyo valor
  por defecto pasa a estar en inglés, que es como mejor lo entiende el motor.
- **Motor de ajedrez propio.** Claw ya no usa la IA de texto para jugar: un
  minimax con poda alfa-beta y tablas de posición decide las jugadas. La IA solo
  comenta la partida. Ajustable con `CHESS_THINK_MS` (milisegundos que piensa
  cada jugada, por defecto 1200).
- **Web rediseñada con acceso por código.** La portada (`/`) y el acceso
  (`/entrar/`) se han rehecho: fondo negro verdoso con acentos lima, tipografía
  propia, animaciones suaves, tarjetas de funciones con detalle y una vista previa
  del chat. El acceso pide el correo `@alu.edu.gva.es` y un código de seis dígitos
  en casillas separadas (10 minutos, cinco intentos); después se puede chatear con
  Claw y gestionar deberes y exámenes compartidos. La web la sirve el propio
  PickleBrain, en local o a través de ngrok.

### Cambiado

- **Las respuestas que usan internet dicen de dónde salen.** Cuando Claw busca en
  la web, la respuesta empieza por "Según DuckDuckGo" (lo pide el propio
  asistente y, si se le olvida, se le añade la fuente de forma automática).

- **Claw no insulta ni falta al respeto.** Se ha añadido una regla a las
  instrucciones del asistente (y a los comentarios de ajedrez y a los resúmenes)
  para que nunca use insultos, tacos ni descalificaciones, ni siquiera si le
  provocan. Si le faltan al respeto, responde con educación.
- **Los deberes ahora muestran siempre su plazo.** Antes, si un deber no tenía
  fecha, esa parte ni aparecía y no se sabía si es que no había plazo o es que no
  se mostraba. Ahora `!claw deberes` (y `!claw apuntes`) dicen siempre para
  cuándo es, o "sin fecha" si no se sabe.

- **Claw ya no tiene límite de líneas.** Antes el asistente estaba forzado a
  responder en "1 o 2 frases" y como máximo 300 caracteres (con un tope de salida
  de 260 tokens y un recorte a 900 caracteres). Ahora responde con la extensión
  que haga falta: una frase si la pregunta es corta, o todas las líneas que
  necesite —con listas y numeración— si le piden algo largo o detallado.
- **Claw recuerda más la conversación.** Ahora mira los últimos 10 mensajes
  (antes 6) y guarda hasta 12 (antes 8), así que hay menos que repetirle.
- **Claw dice "No lo sé" en vez de inventar.** A las instrucciones se les ha
  añadido que no invente hechos, que use el contexto que se le da y que responda
  con claridad cuando no sabe algo.

### Arreglado

- **Bucle de error 440 ("Connection Replaced").** Al perderse la conexión, el bot
  abría un socket nuevo *sin cerrar el anterior* y sin evitar reconexiones
  solapadas. Dos sockets con la misma sesión se pisaban entre sí y WhatsApp
  devolvía el 440 en bucle infinito (conectar → 440 → conectar → 440…). Ahora,
  antes de reconectar, el socket viejo se cierra de verdad y solo puede haber una
  reconexión pendiente a la vez.
- **Avisos que se daban por enviados sin haber salido.** Si la conexión aún no
  estaba lista (o se iba internet), el bot daba por enviado el aviso de novedades,
  los recordatorios de exámenes y el resumen semanal **aunque el mensaje no
  hubiera salido**, y ya no lo repetía: se perdían. Ahora solo se dan por enviados
  si salen de verdad, y se reintentan en cuanto vuelva a haber conexión.
- **La IA de imágenes fallaba por falta de memoria gráfica.** La causa de verdad
  de los fallos ("unet segment failed during workspace capacity check" → "generate
  failed") era que en una gráfica de 4 GB **no caben a la vez el modelo de texto de
  Ollama y el de imágenes**: al pedir una imagen con Ollama cargado (2,1 GB de
  VRAM), al motor de imágenes le faltaba memoria y fallaba. Ahora, **antes de
  dibujar, el bot suelta el modelo de texto** para dejar sitio; Ollama lo vuelve a
  cargar solo, en un par de segundos, la próxima vez que se le pregunte algo. Se
  puede desactivar con `IMAGE_GEN_FREE_VRAM=false` si tienes una gráfica grande.
- **La IA de imágenes fallaba si se pedían dos seguidas.** Si alguien pedía una
  imagen y, sin esperar a que acabara, pedía otra, se lanzaban **dos generaciones a
  la vez**, la gráfica se quedaba sin memoria y **fallaban las dos**. Encima los
  procesos se quedaban colgados comiendo CPU y memoria. Ahora se dibuja **de una en
  una**: la segunda espera su turno y, si ya hay cola, se le dice en claro que está
  ocupado ("dame un momento") en vez de soltarle un error que asuste. Y
  si una se pasa de tiempo, se mata de verdad (en Windows `kill()` no bastaba: ahora
  se usa `taskkill`).
- **El error de las imágenes no decía nada útil.** Antes se quedaba con la última
  línea del motor (el genérico `generate failed`). Ahora busca la causa de verdad
  —falta de memoria, modelo mal, etc.— y la muestra.
- **El modo ajedrez era imposible de jugar.** Para mover, el bot le pedía a la IA
  de texto (un modelo de 3B) que eligiera entre las jugadas legales. Ese modelo es
  incapaz de jugar al ajedrez: elegía casi al azar y acababa **moviendo el mismo
  caballo de h6 a g4 y de g4 a h6 sin parar**, así que la partida no iba a
  ninguna parte. Además, si Ollama tardaba, cada jugada suya podía quedarse
  esperando hasta dos minutos. Ahora las jugadas las decide el motor propio
  (rápido, ~1,2 s) y la IA solo comenta.
- **Las imágenes salían siempre con la misma composición.** No se enviaba semilla
  al motor, que usaba siempre la 42 de fábrica: todas las generaciones repetían
  el mismo encuadre. Ahora cada imagen usa una semilla aleatoria.
- **"Castellano" no se reconocía como asignatura.** `!claw apunta deberes
  castellano …` no sabía a qué asignatura pertenecía y respondía con los ejemplos
  en vez de apuntar. Ahora `castellano`, `castellana` y `lengua y castellano` se
  guardan como Lengua; de paso se añadieron otros nombres que faltaban (Dibujo,
  Plástica, Sociología, Deporte, Tutoría…), así que tampoco hace falta poner la
  fecha ni la asignatura "oficial" para que el apunte entre.
- **La web no podía usar la API a través de ngrok.** El navegador envía el dominio
  del túnel como origen y el servidor lo rechazaba con un 403. Ahora los dominios
  de ngrok se aceptan automáticamente y la propia web rellena la dirección del
  servidor con la del túnel, sin que el estudiante tenga que escribirla.
- **ngrok sin instalar ya no llena el registro.** Si falta el binario, Claw avisa
  una sola vez y desactiva el túnel en vez de reintentar cada 5 segundos.

---

## [1.0.0] — 2026-10-15

Primera versión completa y funcional: un bot de WhatsApp con IA local que vive en
el grupo de un instituto, aprende los deberes y los exámenes que se dicen por ahí
y solo habla cuando le preguntas.

### Añadido

- **Escucha silenciosa.** El bot lee todo lo que pasa en el grupo pero no dice
  nada salvo que le pregunten, le mencionen o escriban `Claw ...`.
- **Aprendizaje de deberes y exámenes.** Detecta cuándo alguien *cuenta* algo
  ("el examen de historia es el 20 de octubre") y lo guarda; detecta cuándo
  alguien *pregunta* y abre una **pregunta pendiente** de 15 minutos para captar
  la respuesta del grupo.
- **Respuestas instantáneas.** Si preguntan por deberes o exámenes conocidos,
  contesta al momento desde la base de datos, sin IA y sin esperas.
- **Modo Claw.** Escribiendo `Claw` + lo que sea (`Claw, ¿cuánto son 2+2?`) el
  bot se convierte en un asistente general con IA local.
- **Chat privado y chat propio.** Responde a los mensajes directos y a los
  mensajes del chat "contigo mismo"; en privado todo va al asistente.
- **Menciones.** Contesta cuando le mencionan en el grupo.
- **Notas de voz.** Transcribe los audios en local con Whisper (ffmpeg + modelo
  `Xenova/whisper-base`) y los trata como si fueran texto. También en notas de
  voz, no solo en mensajes escritos.
- **Fotos, PDFs y documentos.** Guarda los que van de deberes o exámenes, los
  enlaza al examen correspondiente y los reenvía cuando alguien lo pide.
- **Aviso de espacio en disco.** Si al disco le queda poco, no guarda y lo avisa
  en vez de fallar en silencio. Limpieza automática de fotos y exámenes caducados.
- **Recordatorios de exámenes.** Avisa la tarde antes y la mañana del examen.
- **Resumen semanal.** Resume lo que se ha hablado y lo apuntado (por defecto,
  los domingos por la tarde).
- **Exportar a calendario.** `!claw calendario` descarga los exámenes en un
  archivo `.ics`.
- **Varios grupos a la vez.** El bot se puede vincular a más de un grupo, y cada
  grupo tiene sus propios deberes y exámenes (los apuntes quedan separados por
  grupo).
- **Modo ajedrez.** `!claw ajedrez` para jugar una partida contra Claw,
  `!claw ajedrez e4` para mover (acepta `Nf3`, `O-O` o `e2e4`) y
  `!claw analiza <FEN>` para analizar una posición con comentarios de gran
  maestro (análisis determinista, sin depender de la IA).
- **Bienvenida con `@todos`.** Al vincularse, el bot se presenta en el grupo
  mencionando a todo el mundo.
- **Ajustes en caliente desde WhatsApp.** El dueño y los administradores pueden
  ver y cambiar los ajustes sin reiniciar, con `!claw ajustes`.
- **Administradores.** El dueño puede añadir o quitar administradores con
  `!claw admins +600111222` / `!claw admins -600111222`.
- **Modo mantenimiento.** `!claw mantenimiento si` deja al bot completamente
  mudo: no contesta, no apunta deberes ni exámenes y no envía recordatorios ni
  resúmenes. Solo los administradores pueden activarlo o quitarlo, con
  `!claw mantenimiento no`.
- **Herramientas de desarrollo.** Simulador sin WhatsApp (`npm run sim`),
  comprobador del sistema (`npm run doctor`), envío manual de mensajes
  (`npm run enviar`) y una batería de **113 pruebas** de integración (`npm test`).
- **Comando `!claw olvida <texto>`** para borrar un apunte equivocado.

### Cambiado

- **Los comandos pasan de `!pickle` a `!claw`.** `!pickle` se mantiene como
  alias para no romper nada.
- **Personalidad de Claw más amable y natural.** Respuestas cortas, en español
  de España y con el tono de WhatsApp.
- **La fecha de hoy se inyecta siempre en el contexto del asistente**, para que
  no se líe con los años.
- **Los datos de deberes y exámenes solo se le pasan a la IA cuando la pregunta
  va de eso**, para que no mezcle información que no viene al caso.
- **La identidad del dueño incluye tanto el número como el `@lid`** de la
  cuenta (ver *Arreglado*).

### Arreglado

- **El dueño no se escuchaba.** Los mensajes propios llegaban con el
  identificador nuevo de WhatsApp (`@lid`) en vez del número, así que el bot no
  reconocía a su dueño y los ignoraba. Ahora reconoce tanto el número como el
  `@lid`, y también se leen bien los campos de identidad alternativos de Baileys.
- **La IA "se rallaba".** Dos fallos en el prompt: la fecha se metía *dentro de
  la pregunta* (el modelo pequeño respondía con la fecha a cualquier cosa) y los
  datos de deberes se le pasaban *siempre* (copiaba el encabezado
  "DEBERES CONOCIDOS:" como respuesta). Ahora la fecha va en el contexto del
  sistema y los datos solo se incluyen si la pregunta va de deberes o exámenes.
- **`stats()` fallaba con error de SQL.** Las consultas de `messages` y `media`
  encadenaban un `AND` sin `WHERE`, lo que rompía el comando de estado. Corregido.
- **ffmpeg no se encontraba.** Se puede fijar su ruta absoluta en `FFMPEG_PATH`,
  así las notas de voz vuelven a funcionar aunque no esté en el PATH.
- **Año incorrecto.** El asistente respondía "2023" a preguntas sobre el año;
  ahora responde correctamente con la fecha inyectada.
- **Movilidad mal calculada en el análisis de ajedrez.** El análisis muestra
  ahora el número correcto de jugadas disponibles para cada bando.
- **Detección de grupos.** La lista de grupos se lee primero de los ajustes y,
  si no, del `.env`; los grupos fijados en el `.env` no se pueden desvincular por
  error desde WhatsApp.
- **Bienvenida por grupo.** El "ya me he presentado" se guarda por grupo, de
  modo que al añadir un grupo nuevo el bot se presenta también ahí.

---

## Notas

- Todo el proyecto funciona **en local**: ni los mensajes ni la IA salen de tu
  ordenador. Lo único que se descarga la primera vez es el modelo de voz. La
  única excepción es la **búsqueda en internet** (DuckDuckGo), que se puede
  desactivar con `WEB_SEARCH=false`.
- El bot **no es un repositorio git**; todos los cambios viven en el disco.
- Para arrancarlo: doble clic en `arrancar.bat` o `npm start`.
