# 🥒 PickleBrain

Bot de WhatsApp con **IA local** para el grupo de un instituto.

> **Documentación:** [arquitectura, recorridos, API y límites de seguridad](docs/arquitectura.md).

Escucha siempre, en silencio. Va apuntando los **deberes** y los **exámenes** que
se dicen en el grupo, y **solo habla cuando le preguntan**. Además, si alguien
escribe o dice **`Claw`** seguido de cualquier cosa, se convierte en un asistente
general (*"Claw, ¿cuánto son 2+2?"*).

También **entiende las notas de voz** (las transcribe en tu ordenador) y
**guarda las fotos** de lo que entra en cada examen, para reenviarlas cuando
alguien pregunte. Cuando el examen ya ha pasado, borra las fotos solo. Si el
disco está lleno, lo dice en vez de fallar en silencio.

La IA conversacional, la clasificación y la base de datos corren en tu
ordenador. **No todo el tráfico es local:** WhatsApp transporta los mensajes;
ngrok expone la API y la web cuando estás fuera de casa;
Ollama y Whisper pueden descargar modelos; y, con la búsqueda activada, las
consultas actuales se envían a DuckDuckGo. Para desactivar esta última salida,
pon `WEB_SEARCH=false` en `.env` (o `!claw ajustes buscar no`). Más detalles en
[privacidad y arquitectura](docs/arquitectura.md#datos-y-privacidad).

Mientras el bot está abierto, **evita que el ordenador se duerma o se hiberne**
(si se durmiera, se caería la conexión con WhatsApp). No cambia nada de tu PC: el
"candado" se suelta solo al cerrar el bot. Se controla con `PREVENT_SLEEP` y, si
quieres que tampoco se apague la pantalla, con `KEEP_DISPLAY=true` (o desde
WhatsApp: `!claw ajustes despierto si|no` y `!claw ajustes pantalla si|no`).

---

## Cómo funciona

```
                 mensaje del grupo
                        │
                        ▼
          ┌──────────────────────────┐
          │  ¿Dicen "Claw"?          │──sí──► asistente general (IA libre)
          └──────────────────────────┘
                        │ no
                        ▼
          ┌──────────────────────────┐
          │  ¿Preguntan por deberes  │──sí──► responde AL INSTANTE desde la BD
          │  o exámenes?             │        (sin IA, en milisegundos)
          └──────────────────────────┘
                        │ no
                        ▼
          ┌──────────────────────────┐
          │  ¿Suena a deberes/examen │──sí──► la IA lo clasifica
          │  o hay pregunta abierta? │
          └──────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
   alguien PREGUNTA            alguien CUENTA
   → se abre una "pregunta     → se guarda en la base
     pendiente" 15 min           de datos (en silencio)
   → si sabemos la respuesta,
     la suelta
```

La clave es la **pregunta pendiente**: cuando alguien pregunta *"¿qué deberes
hay de inglés?"*, el bot abre una ventana de 15 minutos. Si durante esa ventana
alguien contesta (*"hay que hacer la página 12"*), lo guarda. Así aprende del
propio grupo sin que nadie se lo pida. Si alguien rectifica explícitamente un
deber (*"no era la página 12, es la 14"*), Claw sustituye el apunte anterior;
los mensajes que añaden tareas distintas no se tratan como correcciones.

Claw también puede usar los últimos mensajes del mismo chat para entender
preguntas de seguimiento como *"¿y qué entra?"*. Ese contexto solo se lee del
historial local existente y respeta `STORE_MESSAGES`; nunca mezcla chats.
Si hay una pregunta pendiente, una respuesta breve con fecha o una rectificación
explícita puede heredar su tipo y asignatura; las rectificaciones sustituyen el
apunte anterior. Las fechas relativas se calculan desde la frase original.
Física y Química también se reconoce como `FYQ` y se mantiene separada de Física
o Química por separado.

### Las notas de voz y las fotos van por otro camino

```
       mensaje del grupo
              │
    ┌─────────┼──────────────────┐
    ▼         ▼                  ▼
 texto   nota de voz           foto
    │         │                  │
    │    ffmpeg la convierte     │
    │    en sonido y Whisper     │
    │    la escribe en texto     │
    │         │                  │
    └────► el texto sigue ◄──────┘
           el camino normal        └─► ¿va de deberes/exámenes?
                                        ├─ sí → se guarda y se enlaza
                                        │       al examen correspondiente
                                        └─ no → se ignora (no llena el disco)
```

Una nota de voz que dice *"el examen de historia es el 20 de octubre"* se
aprende exactamente igual que si estuviera escrita. Si dice *"Claw"* seguido de
una pregunta general, Claw responde aunque no haya deberes ni exámenes pendientes;
si solo dice *"Claw"*, recibe el saludo del asistente. También se reconocen las
transcripciones fonéticas *"Clau"* y *"Clao"*. Las notas muy cortas se rellenan
con un breve silencio antes de Whisper para no perder una invocación de una sola
palabra. La voz se filtra y normaliza localmente antes de Whisper. El audio no
se envía a servicios externos; la transcripción sigue las mismas reglas de
privacidad que un mensaje escrito: si la pregunta requiere una búsqueda y
`WEB_SEARCH` está activo, ese texto puede enviarse a DuckDuckGo.

Con `TRANSCRIBE_MODE=contexto`, el bot también transcribe localmente las notas
para poder detectar el trigger hablado *"Claw"*, pero descarta el resto si no hay
una pregunta escolar abierta. `TRANSCRIBE_MODE=nada` o `TRANSCRIBE_ENABLED=false`
desactiva también la activación por voz. El modelo continúa fijado a español
(`WHISPER_MODEL` permite elegir `Xenova/whisper-small` para más precisión a
cambio de más memoria y tiempo).

Las fotos solo se guardan si tienen que ver con deberes o exámenes: porque hay
una pregunta abierta, porque el pie de foto lo menciona, o porque están
enlazadas a un examen. Los memes se ignoran.

---

## Instalación

### 1. Requisitos

| Cosa | Estado |
|---|---|
| Node.js 24 LTS | se instala con `winget install OpenJS.NodeJS.LTS` |
| Git | se instala con `winget install Git.Git` (una dependencia de Baileys se descarga de GitHub) |
| Ollama | se instala con `winget install Ollama.Ollama` |
| Modelo principal `qwen3:4b` | `ollama pull qwen3:4b` |
| Modelo de respaldo `qwen2.5:3b` | `ollama pull qwen2.5:3b` |
| **ffmpeg** (para las notas de voz) | `winget install Gyan.FFmpeg` |

> **ffmpeg** hace falta solo para las notas de voz: convierte el audio de
> WhatsApp en algo que el transcriptor entienda. Si no lo instalas, el bot
> funciona igual, pero no escuchará los audios.
>
> En Windows, si PowerShell se queja de que no puede ejecutar `npm.ps1`, usa
> `npm.cmd` en vez de `npm`. Es una restricción de seguridad de Windows.

### 2. Dependencias del proyecto

```powershell
npm install
```

> **Nota:** si PowerShell te da `no se puede cargar npm.ps1 porque la ejecución
> de scripts está deshabilitada`, usa `npm.cmd install`. Es una restricción de
> seguridad de Windows, no un fallo del proyecto.

Todo se puede hacer también con doble clic en **`arrancar.bat`**, que instala
lo que falte, crea el `.env` y arranca el bot.

### 3. Comprueba que todo está bien

```powershell
npm run doctor
```

Te dirá si Ollama responde, si el modelo está instalado, si la base de datos
funciona y si el clasificador acierta. Arregla lo que salga en rojo antes de
seguir.

### 4. Pruébalo sin WhatsApp

```powershell
npm run sim
```

Es un simulador: escribes mensajes como si fueras del grupo y ves qué haría el
bot. Prueba esto:

```
chicos que deberes hay de mates?        ← silencio + abre pregunta pendiente
Ana: hay que hacer las paginas 30 a 32   ← (cambia de nombre con /yo Marcos)
que deberes hay de mates?                ← te responde al instante
el examen de historia es el 20 de octubre
cuando es el examen de historia?
Claw cuanto son 2+2
```

Y también puedes simular fotos y notas de voz:

```
/imagen C:\ruta\a\una\foto.jpg esto entra en el examen de historia
/audio                                   ← si hay muestra local (no incluida en el repo)
/audio C:\ruta\a\mi\nota.ogg             ← o una tuya de verdad
/ver                                     ← ver todo lo que sabe
/limpiar                                 ← probar la limpieza automática
```

Si quieres comprobar que todo funciona de verdad (IA incluida):

```powershell
npm test
```

La suite comprueba que no hable cuando no toca, que aprenda lo que dicen,
calcule bien las fechas ("el lunes", "mañana"), responda al instante, se
actualice si cambian un examen, guarde las fotos y las reenvíe, avise si no hay
espacio en disco, transcriba una nota de voz de verdad (hay una de ejemplo en
`src/tools/fixtures/` local o en `WHISPER_TEST_AUDIO`), limpie lo caducado, se vincule solo al grupo correcto,
juegue y analice partidas de ajedrez, deje el modo mantenimiento mudo y aguante
si Ollama se apaga. También verifica los comandos de selección de modelo.

Las comprobaciones focalizadas de contexto de Claw, fechas y correcciones no
necesitan Ollama:

```powershell
npm run test:ai
npm run test:subjects
```

`npm run test:voice` prueba Whisper con una muestra local autorizada y una
versión con ruido. No se distribuye ninguna grabación en el repositorio; si no
dispones de una muestra, la prueba se omite. Puedes indicar una ruta local con
`WHISPER_TEST_AUDIO`; solo carga el modelo que ya esté en la caché local y no
lo descarga.

### La web, servida por el propio PickleBrain

La web no se publica en ningún sitio externo: **la sirve el mismo servidor** que
atiende la API. La portada está en `docs/index.html` y se abre en `/`; el acceso
está en `/entrar/` (`docs/entrar/index.html`). La IA y la base de datos siguen en
tu ordenador, y ngrok solo hace de puente cuando entras desde fuera de casa.

Para ejecutar solo el servidor web, abre una consola y ejecuta `npm run web`; no
hace falta conectar WhatsApp. También puedes usar `arrancar.bat`: ese lanzador
inicia el bot completo con `node src/index.js`, que ya incluye el mismo servidor
web, pero también conecta WhatsApp. Mantén Ollama encendido; la web solo
funcionará mientras el ordenador y el proceso elegido estén activos.

### Acceso de estudiantes por correo

La web y **todos los endpoints de la API** requieren una sesión iniciada con un
código de un solo uso enviado por email. Solo se aceptan direcciones
`@alu.edu.gva.es`. Antes de pedir el código, el estudiante completa su registro
(nombre, apellidos, curso y grupo); esos datos se guardan solo en el servidor y
se muestran en el panel de administración. El código dura 10 minutos, permite
cinco intentos y la sesión caduca a las ocho horas o al reiniciar el servidor.
No hay contraseñas de estudiantes.

1. Configura el SMTP de AsterMail en `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_SECURE`, `SMTP_USER` y `SMTP_PASSWORD`. El remitente predeterminado
   es `ClawBot <clawbot@astermail.org>`. La contraseña SMTP solo va en `.env`;
   no la publiques ni la pongas en la página. Sin estos datos, la web abre pero
   no puede enviar códigos.
2. El dominio del túnel es fijo: `dawn-greeter-grazing.ngrok-free.dev`. El
   servidor arranca ngrok con ese dominio y sirve la web por HTTPS. El campo
   **Servidor PickleBrain (ngrok)** se rellena solo. Si algún día cambiara, se
   puede sobreescribir con `NGROK_DOMAIN`, pero la web y los orígenes permitidos
   ya apuntan al dominio fijo.
3. Si quieres permitir otros orígenes (por ejemplo, un cliente propio), añádelos
   a `WEB_ALLOWED_ORIGINS`, separados por comas y sin `/` final.
4. Inicia el servidor con `npm run web` o el bot completo con `npm start`.
   Comprueba antes que el correo funciona con
   `npm run smtp -- tu-correo@alu.edu.gva.es`: conecta con AsterMail y envía un
   código de prueba (sin destinatario solo verifica las credenciales).

#### Modo debug (solo para el dueño)

Escribir el código corto configurado en `WEB_DEBUG_CODE` (por defecto `0912`) en
el campo del correo de `/entrar/` entra directamente, sin correo ni OTP, con una
sesión marcada como `debug`. Esa sesión ve una pestaña **Administración** con
estadísticas, todos los ajustes del bot y el alumnado registrado. Los intentos
están limitados por IP y el código se valida en el servidor; la web nunca lo
guarda.

**Seguridad:** `0912` es una puerta trasera deliberada. Cámbialo por un código
privado en `.env` (`WEB_DEBUG_CODE=...`), no lo compartas y deja
`WEB_DEBUG_CODE=` vacío para desactivarlo. Las sesiones normales de estudiantes
siguen recibiendo 403 en `/api/admin/*` y en las rutas antiguas de ajustes.

El backend verifica los códigos y las sesiones; ocultar pantallas en el
navegador no protege la API. Todas las rutas operativas de la API exigen el
token de sesión; solo solicitar/verificar el código y el acceso debug quedan
abiertos para iniciar sesión. Esto también se aplica a clientes sin cabecera
`Origin`; el control de origen limita qué páginas web pueden llamar al servidor,
pero no sustituye la autenticación. Las sesiones se mantienen en memoria y se
invalidan al reiniciar el servidor. Los apuntes de deberes/exámenes son
compartidos entre los estudiantes autenticados. **La versión Android existente no
se autentica con este flujo y dejará de poder usar la API hasta actualizar su
cliente.**

Las respuestas de Claw usan Ollama local. La búsqueda opcional depende de
`WEB_SEARCH`: pon `WEB_SEARCH=false` si no quieres enviar consultas a
DuckDuckGo. Reinicia el proceso después de cambiar `.env`.

El servidor intenta iniciar ngrok automáticamente al arrancar
(`NGROK_ENABLED=true`) con el dominio fijo
`dawn-greeter-grazing.ngrok-free.dev`, y lo mantiene activo mientras PickleBrain
siga ejecutándose. Reenvía al puerto 3000, para que Claw Companion pueda
conectarse desde fuera de casa. Si ngrok se desconecta, se reintenta cada 5
segundos; al apagar el servidor, se cierra también el túnel. Todas las llamadas
operativas a la API, incluidos los ajustes heredados, exigen una sesión
institucional válida; solo las rutas para solicitar/verificar el código y el
acceso debug son públicas. Revisa los detalles y las rutas disponibles en
[la guía de arquitectura](docs/arquitectura.md#publicación-y-seguridad).

### 5. Conéctalo a WhatsApp

```powershell
npm start
```

Aparecerá un **código QR** en la terminal:

1. Abre WhatsApp en el móvil del número que va a ser el bot.
2. **Ajustes → Dispositivos vinculados → Vincular un dispositivo**.
3. Escanea el QR.

La sesión se guarda en `data/auth/`, así que solo hay que escanear una vez.

### 6. Actívalo en el grupo

**Opción automática:** configura `WHATSAPP_GROUP_NAME` en `.env` con el nombre
exacto de tu grupo. El bot se vincula cuando alguien escribe en ese grupo. No
compartas el valor real del nombre del grupo al publicar tu configuración.

**Opción manual:** entra al grupo y escribe:

```
!claw aqui
```

El bot se vincula a ese grupo y responde confirmándolo. A partir de ahí
solo actuará ahí.

> Los comandos empiezan por `!claw`. `!pickle` sigue funcionando igual, por si
> ya te habías acostumbrado.

Comandos, de un vistazo:

| Comando | Quién | Qué hace |
|---|---|---|
| `!claw` | todos | estado (grupo, modelo, cuántas cosas sabe) |
| `!claw ayuda` | todos | la lista de comandos |
| `!claw deberes [asignatura]` | todos | los deberes pendientes |
| `!claw examenes` | todos | los próximos exámenes |
| `!claw apuntes` | todos | todo lo que tiene apuntado (deberes y exámenes) |
| `!claw apunta deberes mates hacer la ficha para el viernes` | todos | apunta o corrige un deber/examen con su fecha límite (se puede restringir con `!claw ajustes apunta no`) |
| `!claw proximo` | todos | lo próximo que cae, con los días que quedan |
| `!claw hecho <asignatura o texto>` | todos | marca como hecho lo ya entregado: deja de salir como pendiente y no genera recordatorios |
| `!claw resumen [hoy/semana]` | todos | resume lo hablado y lo apuntado |
| `!claw calendario` | todos | descarga los exámenes en un archivo `.ics` |
| `!claw busca <algo>` | todos | busca en internet (DuckDuckGo) y lo resume |
| `!claw imagen <qué>` | todos | genera una imagen — **experimental y apagada de fábrica**; solo funciona si el dueño/admin la ha abierto con `!claw ajustes imagenes si`, y **nunca** genera una imagen sin que se lo pidan a mano |
| `!claw novedades` | todos | cuenta todo lo nuevo que se le ha añadido al bot |
| `!claw palabrotas` | todos | ranking de quién dice más tacos; además, al decir una palabrota el ranking **sale solo** (con un pequeño margen para no spamear) |
| `!claw palabrotas reset` | dueño/admin | pone el contador de palabrotas a cero |
| `!claw ajedrez` | todos | juega una partida de ajedrez contra Claw |
| `!claw ajedrez e4` | todos | mueve (vale `Nf3`, `O-O` o `e2e4`) |
| `!claw analiza <FEN>` | todos | analiza una posición como un gran maestro |
| `!claw aqui` | dueño/admin | vincula el bot a este grupo |
| `!claw fuera` | dueño/admin | lo desvincula de este grupo |
| `!claw ajustes` | dueño/admin | ver y cambiar los ajustes de Claw |
| `!claw ia` | dueño/admin | consultar el modelo activo y los instalados |
| `!claw ia fallback` / `!claw ia principal` | dueño/admin | cambiar al modelo ligero o volver a Qwen3; queda guardado |
| `!claw ia <modelo>` | dueño/admin | seleccionar otro modelo instalado |
| `!claw admins [+número / -número]` | dueño | ver o cambiar los administradores |
| `!claw prohibir <número>` | dueño/admin | veta a alguien: no podrá usar a Claw (ni hablarle ni comandos) |
| `!claw permitir <número>` | dueño/admin | le levanta el veto |
| `!claw vetados` | dueño/admin | ver la lista de vetados |
| `!claw mantenimiento si\|no` | dueño/admin | modo mantenimiento: el bot se queda callado |
| `!claw olvida <texto>` | dueño/admin | borra un apunte equivocado |
| `!claw olvida todo` | dueño/admin | borra **todos** los apuntes del grupo |

Cualquier otra cosa detrás de `!claw` es una pregunta para el asistente:
`!claw cuanto son 2+2`.

> Si has puesto `WHATSAPP_GROUP_NAME`, `!claw aqui` solo funciona en ese
> grupo: en cualquier otro te avisa de que ya está asignado a otro. Y aunque
> alguien escriba `!claw fuera` para gastar una broma, el bot se vuelve a
> vincular solo al siguiente mensaje del grupo correcto.

> ⚠️ El **nombre** del grupo no es un identificador fiable: si alguien lo
> renombra, el vínculo por nombre deja de coincidir. El bot guarda el
> identificador interno (`...@g.us`) en cuanto se vincula una vez, así que una
> vez dentro ya no le afectan los cambios de nombre.

### 6-bis. Quién manda: el dueño y los administradores

El **dueño** es tu número: el de la cuenta con la que va el bot (o el que
pongas en `WHATSAPP_OWNER_JID`). Solo el dueño y los **administradores** que él
nombre pueden tocar los ajustes. Todo lo demás (preguntar deberes, hablar con
Claw…) lo puede usar cualquiera.

Los **mensajes privados**, en cambio, son solo para el dueño por defecto (así
nadie más puede usar al bot a escondidas). Se cambia con `!claw ajustes privado`
(`dueno`, `admins`, `todos` o `nadie`).

Y si alguien abusa del bot, el dueño o un admin pueden **vetarlo**:
`!claw prohibir +600111222` hace que a esa persona el bot la ignore por completo
(no le contesta a Claw, no le responde a menciones y no le acepta comandos). Con
`!claw permitir +600111222` se le quita el veto. El dueño y los administradores
nunca se pueden vetar.

Como el bot va con tu propio número, para darle órdenes cómodamente tiene dos
sitios:

- El **chat contigo mismo** (WhatsApp → *Mensajes contigo mismo*): ahí puedes
  escribir `!claw ajustes` y cambiar lo que quieras sin que lo vea nadie.
- El **grupo**: lo que escribes tú en el grupo también le llega (aunque vaya con
  tu cuenta), así que `!claw deberes` funciona igual.

Para nombrar a alguien administrador:

```
!claw admins +600111222
```

y para quitarlo, `!claw admins -600111222`.

### 7. El mensaje de bienvenida

La **primera vez** que se arranca el bot, se presenta solo en el grupo:

```
👋 ¡Hola! Soy *PickleBrain*, el bot que se ha colado en este grupo.

Me quedo escuchando en silencio e iré apuntando los *deberes* y los *exámenes*
que se digan por aquí: fechas, temas, y las fotos o PDFs de lo que entra.

Solo hablo si me preguntáis algo. Para verme el estado: *!claw*
Y para pedirme cualquier cosa, escribid *Claw* + lo que sea:  _Claw cuánto son 2+2_

_(Si molesto, se me quita con *!claw fuera*.)_
```

Solo se manda **una vez** (queda apuntado en la base de datos). Si quieres que
se presente en cada arranque, pon `WELCOME_ALWAYS=true`. Si no lo quieres,
`WELCOME_ENABLED=false`.

Para cambiar el texto, escribe tu versión en `WELCOME_MESSAGE` del `.env`.

Y si quieres volver a mandarla a mano (o mandar cualquier otra cosa):

```powershell
npm run enviar -- --bienvenida
npm run enviar "un mensaje cualquiera"
```

(Esos comandos hablan con tu cuenta de WhatsApp, así que hay que tener el bot
cerrado mientras se ejecutan.)

---

## Uso diario

Una vez funcionando, **no hay que hacer nada**. El bot:

- Apunta los deberes y exámenes que se mencionan en el grupo.
- Escucha las notas de voz y aprende lo que dicen.
- Guarda las fotos y PDFs que van de deberes/exámenes, y los reenvía si preguntan.
- Responde cuando preguntan por ellos.
- Responde como asistente si escriben `Claw ...`.
- El resto del tiempo, silencio absoluto.

Para consultar o cambiar el modelo conversacional, el dueño/admin puede usar
`!claw ia`. `!claw ia fallback` cambia al respaldo ligero y `!claw ia principal`
vuelve a Qwen3; el cambio queda guardado. También acepta `!claw ia <modelo>`
para seleccionar otro modelo que ya esté instalado en Ollama. El modelo del
cerebro escolar no se cambia.

Y cuando se lo pidas, con comandos `!claw`:

- `!claw deberes` · `!claw examenes` · `!claw proximo` — consultar lo apuntado.
- `!claw` — estado y ayuda.
- El dueño puede ver y cambiar los ajustes con `!claw ajustes`.

### Por privado (mensajes directos)

También le puedes escribir **por privado** (mensaje directo al bot o el chat
contigo mismo). Lo que le digas por ahí de deberes o exámenes **se apunta en el
grupo**, y puedes preguntarle por ellos igual que en el grupo. Así puedes dejar
un deber "a mano" sin escribir en el grupo, y luego el resto lo ve cuando
pregunte. Para charlar con Claw de cualquier otra cosa por privado, escríbele
`Claw` + tu pregunta.

Por defecto los privados son **solo para el dueño** (para que nadie más pueda
usar al bot a escondidas). El dueño lo cambia cuando quiera con
`!claw ajustes privado dueno | admins | todos | nadie`:

- `dueno` — solo tú (por defecto).
- `admins` — tú y los administradores.
- `todos` — cualquiera que le escriba por privado.
- `nadie` — ignora todos los privados (el chat contigo mismo sigue funcionando).

### Ejemplos reales

```
Marcos: el examen de historia es el 20 de octubre, entra el tema 4
        → (silencio, lo guarda)

Lucía:  cuando es el examen de historia?
PickleBrain: 📝 Examen de Historia
             • Historia — miércoles 20 de octubre — entra el tema 4
             Según lo que se ha dicho en el grupo.

Ana:    que deberes hay de lengua?
PickleBrain: 🤔 No tengo apuntado nada de lengua sobre los deberes.
             Si alguien lo dice en el grupo, lo guardo y lo recordaré.

Pablo:  hay que leer el capitulo 4 y hacer la ficha
        → (silencio, pero lo guarda porque había una pregunta abierta)

Ana:    que deberes hay de lengua?
PickleBrain: 📚 Deberes de Lengua
             • Lengua: leer el capítulo 4 y hacer la ficha
             Según lo que se ha dicho en el grupo.

Javi:   🎤 [nota de voz] "pues el examen de historia es el veinte de octubre
        y entra el tema cuatro y el cinco"
        → (silencio, lo apunta como si lo hubiera escrito)

Marcos: [foto del temario] "esto entra en el examen de historia"
        → (silencio, guarda la foto y la enlaza al examen)

Alguien: que entra en el examen de historia?
PickleBrain: 📝 Examen de Historia
             • Historia — miércoles 20 de octubre — el tema 4 y el tema 5
             Según lo que se ha dicho en el grupo.
             📎 [reenvía la foto del temario]

Javi:   Claw cuanto son 2+2
PickleBrain: 🪝 4

Dueno:  (en privado, mensaje directo) hay examen de filosofia el martes, tema 3
        → (silencio, lo apunta EN EL GRUPO)
```

---

## Configuración

Copia `.env.example` a `.env` y edita lo que necesites.

| Variable | Por defecto | Qué hace |
|---|---|---|
| `OLLAMA_MODEL` | `qwen3:4b` | modelo conversacional principal de Claw, con mejor razonamiento y adecuado para 4 GB de VRAM |
| `OLLAMA_MODEL_FALLBACK` | `qwen2.5:3b` | modelo de respaldo más ligero |
| `OLLAMA_MODEL_BRAIN` | `qwen2.5:3b` | modelo rápido para clasificar deberes/exámenes en JSON |
| `WEB_SEARCH` | `true` | buscar en internet (DuckDuckGo) cuando haga falta |
| `WEB_ALLOWED_ORIGINS` | *(vacío)* | orígenes extra (separados por comas) autorizados a llamar a la API; localhost y ngrok se aceptan siempre |
| `NGROK_ENABLED` | `true` | iniciar y mantener el túnel ngrok al arrancar el servidor |
| `NGROK_DOMAIN` | `dawn-greeter-grazing.ngrok-free.dev` | dominio fijo del túnel; solo cámbialo si el túnel cambia de verdad |
| `WEB_DEBUG_CODE` | `0912` | código corto de acceso debug con administración total; vacío = desactivado |
| `SMTP_HOST` | *(vacío)* | servidor SMTP de AsterMail para enviar códigos |
| `SMTP_PORT` | `465` | puerto SMTP |
| `SMTP_SECURE` | `true` | usar TLS implícito; ajusta al modo recomendado por el proveedor |
| `SMTP_USER` | `clawbot@astermail.org` | usuario SMTP |
| `SMTP_PASSWORD` | *(vacío)* | contraseña SMTP, solo en `.env` |
| `SMTP_FROM` | `ClawBot <clawbot@astermail.org>` | remitente verificado para los códigos |
| `TZ` | `Europe/Madrid` | zona horaria para entender "mañana", "el lunes" |
| `WHATSAPP_GROUP_JID` | *(vacío)* | fija el grupo desde aquí en vez de con `!claw aqui` |
| `WHATSAPP_GROUP_NAME` | *(vacío)* | se vincula solo al grupo que se llame así (vacíalo para desactivarlo) |
| `WHATSAPP_OWNER_JID` | *(el del bot)* | el número del dueño (el que toca los ajustes) |
| `WHATSAPP_ADMINS` | *(vacío)* | administradores de arranque, separados por comas |
| `WHATSAPP_BLOCKED` | *(vacío)* | personas vetadas de arranque (no pueden usar a Claw), separadas por comas |
| `PRIVATE_CHAT` | `true` | *(antiguo)* contestar a los mensajes privados; hoy se usa `PRIVATE_MODE` |
| `PRIVATE_MODE` | `dueno` | quién puede escribirle por privado: `dueno` (por defecto), `admins`, `todos` o `nadie`. Lo que se diga por privado de deberes/exámenes se apunta en el grupo |
| `REPLY_TO_MENTIONS` | `true` | contestar cuando le mencionan en el grupo |
| `WELCOME_ENABLED` | `true` | presentarse en el grupo la primera vez que arranca |
| `WELCOME_ALWAYS` | `false` | `true` = se presenta en *cada* arranque |
| `WELCOME_MESSAGE` | *(vacío)* | texto propio para la bienvenida |
| `CLAW_TRIGGER` | `claw` | palabra que activa al asistente |
| `CLAW_SIGNATURE` | `true` | poner la cabecera "🪝 Claw" en las respuestas del asistente (para distinguirlas de los avisos) |
| `APUNTA_LIBRE` | `true` | si `true`, **cualquiera** del grupo puede usar `!claw apunta`; si `false`, solo el dueño y los admins |
| `COUNT_SWEARS` | `true` | llevar la cuenta de las palabrotas del grupo (ranking con `!claw palabrotas`) |
| `SWEAR_ALERT` | `true` | sacar el ranking en cuanto alguien dice una palabrota |
| `SWEAR_COOLDOWN` | `30` | segundos mínimos entre avisos de palabrotas en el mismo grupo (para no spamear) |
| `REMINDER_ADVANCE_DAYS` | `3` | días de antelación del primer aviso de un examen (`0` o `1` lo desactivan; la víspera y el mismo día se avisa igual) |
| `IMAGE_GEN_ENABLED` | `false` | **generación de imágenes (experimental)**: `true` la abre; aun así solo genera si alguien escribe `!claw imagen ...` a mano, y **nunca** por su cuenta |
| `IMAGE_GEN_BACKEND` | `cli` | motor de imágenes: `cli` (llama a `sd-cli.exe`, sin servidores abiertos — lo recomendado) o `http` (servidor compatible con OpenAI Images) |
| `IMAGE_GEN_BIN` | `sdserver\sd-cli.exe` | ejecutable de stable-diffusion.cpp (el motor `cli`) |
| `IMAGE_GEN_MODEL_PATH` | `sdserver\models\v1-5-pruned_Q4_K.gguf` | modelo de imágenes (`.gguf`) del motor `cli` |
| `IMAGE_GEN_STEPS` | `20` | pasos de difusión: más = mejor y más lento (20 ≈ 1 min en una GTX 1650; 8 es rapidísimo) |
| `IMAGE_GEN_WIDTH` | `512` | ancho de la imagen |
| `IMAGE_GEN_HEIGHT` | `512` | alto de la imagen |
| `IMAGE_GEN_NEGATIVE` | `blurry, low quality, …` | lo que NO debe salir (incluye objetos duplicados y errores comunes de manos/dedos; mejor en inglés) |
| `IMAGE_GEN_ENHANCE` | `true` | traduce y reordena tu petición para Stable Diffusion 1.5, sin inventar objetos |
| `IMAGE_GEN_SEED` | `-1` | semilla de la generación; `-1` = aleatoria (con un número fijo se repite la misma imagen) |
| `IMAGE_GEN_CFG` | `7` | fuerza del prompt (`--cfg-scale`): 6–8 es lo normal |
| `IMAGE_GEN_SAMPLER` | `dpm++2m` | método de muestreo (`--sampling-method`); también `euler_a`, `euler`, `dpm++2s_a`… |
| `IMAGE_GEN_SCHEDULER` | `karras` | programador de sigmas (`--scheduler`); también `discrete`, `sgm_uniform`, `simple`… |
| `IMAGE_GEN_FREE_VRAM` | `true` | antes de dibujar, suelta el modelo de texto de Ollama para dejar sitio en la VRAM (necesario en gráficas de 4 GB); `false` en gráficas grandes |
| `IMAGE_GEN_ENDPOINT` | `http://127.0.0.1:1234/v1/images/generations` | (solo motor `http`) endpoint compatible con OpenAI Images |
| `IMAGE_GEN_MODEL` | *(vacío)* | (solo motor `http`) modelo que usa ese endpoint |
| `IMAGE_GEN_API_KEY` | *(vacío)* | token si el endpoint lo necesita (lo normal: vacío, todo local) |
| `IMAGE_GEN_TIMEOUT` | `300` | segundos que espera antes de rendirse mientras dibuja |
| `CHANGELOG_NOTIFY` | `true` | contar en el grupo lo nuevo que se le añade al bot, una sola vez por novedad (con `!claw novedades` se ve cuando quieras) |
| `PREVENT_SLEEP` | `true` | mientras el bot está abierto, evita que el ordenador se duerma o se hiberne (se suelta al cerrar) |
| `KEEP_DISPLAY` | `false` | si `true`, además no deja que se apague la pantalla |
| `ANSWER_WINDOW_MINUTES` | `15` | minutos que una pregunta queda abierta esperando respuesta |
| `ACK_SAVES` | `false` | si `true`, el bot confirma en el grupo cada vez que apunta algo |
| `MIN_SECONDS_BETWEEN_REPLIES` | `30` | anti-repetición |
| `MAINTENANCE` | `false` | `true` = el bot se queda callado (también con `!claw mantenimiento si`) |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info` o `debug` |

> Todos estos ajustes (y varios más) se pueden cambiar **en caliente** desde
> WhatsApp sin reiniciar, con `!claw ajustes`. Mira la lista completa con
> `!claw ajustes` y cambia uno con, por ejemplo, `!claw ajustes ack si`.

Qwen3 puede tardar más que el modelo de respaldo en la primera respuesta. En
Ollama reciente se solicita el modo sin razonamiento; PickleBrain no muestra
bloques `<think>` ni respuestas truncadas. Si Qwen3 no termina una respuesta,
Claw prueba el modelo de respaldo para ese mensaje sin cambiar la selección
guardada. Si prefieres menor consumo o respuestas más rápidas, usa
`!claw ia fallback` para dejarlo seleccionado.

### Fotos y disco

| Variable | Por defecto | Qué hace |
|---|---|---|
| `MEDIA_ENABLED` | `true` | guardar fotos de lo que entra en los exámenes |
| `MEDIA_MODE` | `contexto` | `contexto` = solo si van de deberes/exámenes · `todo` = todas · `nada` = ninguna |
| `MEDIA_MAX_MB` | `12` | no descargar archivos más grandes que esto |
| `MEDIA_MIN_FREE_MB` | `800` | si al disco le quedan menos MB que esto, no guarda y avisa |
| `MEDIA_MAX_TOTAL_MB` | `2048` | tope de la carpeta de fotos; al superarlo borra las más antiguas |
| `MEDIA_RETENTION_DAYS` | `14` | días que se guarda una foto no asociada a un examen |
| `MEDIA_SEND_MAX` | `3` | cuántas fotos se reenvían como máximo al preguntar |

### Limpieza automática

| Variable | Por defecto | Qué hace |
|---|---|---|
| `CLEANUP_EXAM_GRACE_DAYS` | `3` | días de margen tras el examen antes de borrar sus fotos y olvidarlo |
| `CLEANUP_REMOVE_ENTRIES` | `true` | borrar también el apunte del examen que ya pasó |
| `CLEANUP_INTERVAL_MINUTES` | `60` | cada cuánto se hace la limpieza |

### Notas de voz

| Variable | Por defecto | Qué hace |
|---|---|---|
| `TRANSCRIBE_ENABLED` | `true` | entender notas de voz |
| `TRANSCRIBE_MODE` | `todo` | `todo` = todas · `contexto` = detecta "Claw" y procesa si hay pregunta abierta · `nada` |
| `TRANSCRIBE_MAX_SECONDS` | `180` | no escuchar audios más largos que esto |
| `WHISPER_MODEL` | `Xenova/whisper-base` | `whisper-tiny` (más rápido) · `whisper-base` · `whisper-small` (mejor) |
| `SHOW_TRANSCRIPTIONS` | `false` | mostrar en el grupo lo que ha entendido de cada audio |
| `FFMPEG_PATH` | `ffmpeg` | ruta a ffmpeg, si no está en el PATH |

---

## Estructura del proyecto

```
PickleBrain/
├─ arrancar.bat           doble clic para arrancar
├─ .env.example           plantilla de configuración
├─ docs/
│  ├─ index.html          portada y app web servidas en /
│  ├─ entrar/
│  │  └─ index.html      inicio de sesión de estudiantes (/entrar/)
│  └─ arquitectura.md     componentes, flujos, API y seguridad
├─ data/                  se crea sola
│  ├─ auth/               sesión de WhatsApp (¡no la compartas!)
│  ├─ media/              fotos guardadas (se borran solas)
│  ├─ tmp/                audios temporales mientras se transcriben
│  └─ picklebrain.db      deberes, exámenes y fotos
├─ sdserver/              IA de imágenes local (opcional, experimental)
│  ├─ sd-cli.exe          motor de imágenes (stable-diffusion.cpp)
│  └─ models/             modelo de imágenes (.gguf)
└─ src/
   ├─ index.js            arranque completo: WhatsApp y servidor
   ├─ web.js              arranque solo de la web/API
   ├─ server.js           API HTTP, CORS y túnel ngrok
   ├─ config.js           carga de configuración
   ├─ whatsapp.js         conexión con WhatsApp (Baileys)
   ├─ router.js           decide qué hacer con cada mensaje
   ├─ signals.js          reglas rápidas sin IA
   ├─ brain.js            clasificador con la IA local
   ├─ claw.js             modo asistente general
   ├─ search.js           búsqueda en internet (DuckDuckGo)
   ├─ memory.js           base de datos SQLite
   ├─ media.js            guardar fotos, espacio en disco y limpieza
   ├─ transcribe.js       notas de voz con Whisper (local)
   ├─ replies.js          cómo redacta las respuestas
   ├─ dates.js            fechas en español
   ├─ subjects.js         asignaturas ("mates" = "matemáticas")
   ├─ ollama.js           cliente de la IA local
   ├─ imagegen.js         generar imágenes (experimental, apagado)
   ├─ presence.js         aviso de "escribiendo…" en el grupo
   ├─ changelog.js        resumen de novedades para el grupo
   ├─ tools/
   │  ├─ doctor.js        diagnóstico del sistema
   │  ├─ simulate.js      simulador sin WhatsApp (npm run sim)
   │  ├─ test.js          pruebas de integración (npm test)
   │  ├─ server-test.js   pruebas de la API web (npm run test:web)
   │  ├─ web-auth-test.js pruebas de códigos y sesiones de estudiantes
   │  ├─ smtp-test.js     prueba del correo de AsterMail (npm run smtp)
   │  ├─ fixtures/        muestras locales opcionales (no incluidas)
   │  ├─ qr-test.js       comprueba la conexión con WhatsApp (npm run qr)
   │  └─ smoke.js         comprobación rápida de módulos
   └─ ...
```

---

## IA de imágenes (experimental, local)

El bot puede **dibujar** imágenes con una IA que vive en tu propio ordenador
(**stable-diffusion.cpp**, con Stable Diffusion 1.5). Todo va en local: no se
manda nada a internet.

Lo importante, para que quede claro:

- Está **apagada de fábrica** (`IMAGE_GEN_ENABLED=false`).
- El bot **nunca** genera una imagen por su cuenta: ni hablando de imágenes, ni
  pidiéndoselo a Claw de forma normal. Solo se genera si alguien escribe
  `!claw imagen <qué>` **a mano** y el ajuste `imagenes` está encendido.
- Para encenderla (dueño/admin): `!claw ajustes imagenes si`.

Cómo está montado (carpeta `sdserver\`):

```
sdserver\
├─ sd-cli.exe                              motor (stable-diffusion.cpp, build CUDA 12)
├─ *.dll                                  librerías (incluida ggml-cuda.dll para la GPU)
└─ models\
   └─ v1-5-pruned_Q4_K.gguf               modelo SD 1.5 cuantizado (Q4_K)
```

El motor por defecto es **`cli`**: cada vez que se pide una imagen, el bot llama
a `sd-cli.exe`, espera a que termine y manda el PNG. No hace falta tener ningún
servidor abierto (más robusto y no gasta VRAM en reposo). Si prefieres un
servidor compatible con OpenAI Images, pon `!claw ajustes imagen_motor http` y
apunta `IMAGE_GEN_ENDPOINT` a su dirección.

Rendimiento de referencia (GTX 1650, 4 GB):

| Pasos | Tiempo aprox. | Notas |
| ----- | ------------- | ----- |
| 8     | ~35 s         | rapidísimo, algo más borroso |
| 20    | ~65 s         | va bien (por defecto) |

Se ajusta con `!claw ajustes imagen_pasos <n>` (o `IMAGE_GEN_STEPS`). Cuantos
menos pasos, más rápido. Cabe tanto con el modelo de Ollama cargado como sin él.
El mejorador local conserva los detalles de la petición, pone primero el sujeto y
la acción y añade etiquetas breves de calidad/composición que entiende SD 1.5.
Si `IMAGE_GEN_ENHANCE=false` (o falla Ollama), sigue aplicando esas etiquetas y
envía el texto original sin traducir.

**La clave en una gráfica pequeña (4 GB):** el modelo de texto de Ollama y el de
imágenes **no caben a la vez**. Por eso, antes de dibujar, el bot **suelta el
modelo de texto** para dejar sitio (Ollama lo recarga solo, en un par de segundos,
cuando se le vuelve a preguntar algo). Si no se hace esto, el motor de imágenes
falla con "unet segment failed during workspace capacity check". Con una gráfica
grande puedes desactivarlo con `IMAGE_GEN_FREE_VRAM=false`.

Además, las imágenes se hacen **de una en una**: si se piden dos seguidas, la
segunda espera a que acabe la primera (a la vez se quedarían sin memoria y
fallarían las dos). Mientras dibuja, el bot marca "escribiendo…" en el grupo para
que no parezca que se ha colgado, y si una generación se pasa de tiempo se mata el
proceso de verdad (`taskkill` en Windows).

Si no tienes la carpeta `sdserver\` o te falta el modelo, la generación
simplemente avisa de que no encuentra el motor; el resto del bot sigue igual.

---

## Preguntas frecuentes

### ¿Me pueden banear el número?

Sí, es un riesgo real. Baileys usa la API no oficial de WhatsApp Web, y WhatsApp
lo prohíbe en sus términos de uso. En la práctica, para un bot tranquilo que
responde pocas veces y no manda spam, el riesgo es bajo, pero **no es cero**.

**Consejo importante:** usa un **número aparte** para el bot, no tu número
personal. Con la misma cuenta que usas tú, el bot escribe *como si fueras tú* y
todo el grupo ve tus mensajes en tu nombre. Con un número dedicado (una SIM
vieja, o un número virtual) queda limpio y separado.

### ¿Funciona con el móvil apagado?

Sí, mientras el ordenador esté encendido. Baileys es multi-dispositivo: una vez
vinculado, no necesita el móvil. La sesión caduca si no abres WhatsApp en el
móvil en unos 14 días.

### ¿Y si el ordenador se apaga?

El bot deja de funcionar, pero no pierde nada: todo está en `data/picklebrain.db`.
Al volver a arrancar, sigue donde lo dejó.

### ¿Consume mucho?

Con Qwen3 4B como modelo conversacional y Qwen2.5 3B para clasificar deberes y
exámenes, la IA solo se despierta cuando hay algo relacionado con
deberes/exámenes. Las preguntas típicas se responden **sin IA** (milisegundos).
El resto del tiempo está escuchando casi sin gastar nada. La primera respuesta
tras un rato tarda unos segundos porque el modelo tiene que cargarse en memoria;
después responde rápido.

El modelo de voz (Whisper) solo trabaja cuando llega una nota de voz, y se queda
cargado en memoria (unos 90 MB) para ir rápido. Transcribir 10 segundos de audio
tarda unos 2-3 segundos en este ordenador.

### ¿Entiende notas de voz?

Sí. Las descarga, las transcribe **en tu ordenador** con Whisper y luego las
trata igual que un mensaje escrito: si dicen *"el examen de historia es el 20 de
octubre"*, lo aprende y lo responde cuando preguntes.

Necesita **ffmpeg** instalado (`winget install Gyan.FFmpeg`) para poder leer el
audio de WhatsApp. Si no lo tienes, el bot te lo avisa al arrancar y sigue
funcionando, pero sin escuchar los audios.

### ¿Se llena el disco con las fotos?

No debería. Hay tres frenos:

1. **Solo guarda fotos que van de deberes o exámenes.** Los memes y el resto se
   ignoran, así que no se descargan siquiera.
2. **Antes de bajar nada mira el espacio libre.** Si quedan menos de
   `MEDIA_MIN_FREE_MB` (800 MB por defecto), no la guarda y lo dice en el grupo:

   > 😣 No he podido guardar la foto: no queda espacio en el disco.

3. **Borra solo lo que ya no sirve.** Cada hora revisa y elimina:
   - las fotos de exámenes que ya pasaron (con 3 días de margen, `CLEANUP_EXAM_GRACE_DAYS`),
   - las fotos sueltas de más de 14 días,
   - todo lo que supere `MEDIA_MAX_TOTAL_MB` (2 GB por defecto), empezando por lo más antiguo.

### ¿Guarda todas las fotos del grupo?

No, por defecto solo las que tienen que ver con deberes o exámenes
(`MEDIA_MODE=contexto`): las que llegan mientras hay una pregunta abierta, las
que llevan un pie de foto que lo menciona, o las que se enganchan a un examen
conocido.

Si de verdad quieres que lo guarde *todo*, pon `MEDIA_MODE=todo`, pero ojo: eso
sí llena el disco y guarda fotos privadas que no tienen nada que ver.

### El bot no dice nada en el grupo

1. ¿Está el grupo en la lista? Si pusiste `WHATSAPP_GROUP_NAME`, tiene que
   llamarse **exactamente** así (lo verás en la consola: el bot te dice a qué
   grupo está mirando y cómo se llama el grupo real). Si no, escribe
   `!claw aqui` dentro.
2. Ejecuta `!claw` para ver el estado.
3. Mira la consola: con `LOG_LEVEL=debug` verás por qué descarta cada mensaje.

### "Ollama no responde"

Abre la aplicación **Ollama** (tiene que estar corriendo) y comprueba con
`ollama list` que el modelo está descargado.

### "No encuentro ffmpeg" / las notas de voz no funcionan

Instálalo y **vuelve a abrir la consola** (para que Windows coja el PATH nuevo):

```powershell
winget install Gyan.FFmpeg
```

Comprueba con `npm run doctor`: la línea de ffmpeg y la de "Transcripción real"
deberían salir en verde.

### La primera nota de voz tarda mucho

La primera vez, Whisper tiene que **descargar el modelo** (~75 MB) y cargarlo en
memoria: puede tardar medio minuto. A partir de ahí, unos segundos. Al arrancar,
el bot lo va cargando solo en segundo plano.

Si te va lento, cambia en el `.env`:

```
WHISPER_MODEL=Xenova/whisper-tiny
```

---

## Límites actuales y posibles mejoras

- **APK Android:** el proyecto Android no forma parte de este repositorio. La
  API anuncia el APK de la última release de GitHub, que debe adjuntarse como
  `ClawCompanion.apk`.
- **Modelo más grande**: si cambias de tarjeta, `qwen2.5:7b` o `llama3.1:8b`
  hablan mucho mejor. Ponlo en `OLLAMA_MODEL` (el que charla) y deja un modelo
  pequeño en `OLLAMA_MODEL_BRAIN` (el que apunta deberes), que va más rápido y
  obedece mejor el formato.
- **Voz mejor entendida**: `WHISPER_MODEL=Xenova/whisper-small` (más lento,
  mucho más fino con nombres propios y ruido de fondo).
