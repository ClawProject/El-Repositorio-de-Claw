# Changelog

All notable changes to **PickleBrain**, in reverse chronological order.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Changed

- **Fixed tunnel domain.** The website and the server always use
  `dawn-greeter-grazing.ngrok-free.dev`; it no longer has to be configured by
  hand.
- **Register before entering.** Email access now asks for name, surname, course
  and group, and stores the profile in SQLite. The administration panel can view
  and delete it.
- **Classification with context and more reliable dates.** Short answers to a
  pending question can inherit its type and subject; explicit corrections are
  recognised and replace the previous note. Relative dates are calculated from
  the original sentence, and confusion between dates and lists such as `3/5/6`
  is avoided.
- **Physics and Chemistry as a joint subject.** It is also recognised as `FYQ`
  and queried through a shared key, without mixing it with Physics or Chemistry
  separately.
- **Cleaner and more robust Qwen3 replies.** Internal reasoning or a truncated
  answer is discarded, and Claw falls back to the backup model if the primary one
  does not finish.

### Added

- **Initial language setup.** On first start Claw opens
  `http://localhost:3000/setup` and asks you to choose among **100 languages**; it
  does not connect to WhatsApp until a choice has been made. The language is
  stored in the database, applied live to the fixed texts, the setup website and
  the AI prompt, and can be changed later with `!claw idioma en` (owner/admins).
  The fixed texts are translated into Spanish, English, Catalan, French,
  Portuguese, German, Italian, Russian, Arabic and Chinese; for the rest English
  is used as a fallback and the AI still replies in the chosen language.
- **Installation guide and configuration template.** New `INSTALL.md` with the
  steps for Windows, `git clone`, Node, Ollama, the Python service and
  troubleshooting. `.env.example` is added and `.env` is now ignored by Git.
- **Configurable data folder.** `PICKLEBRAIN_DATA_DIR` allows keeping the
  session, SQLite, photos and models outside the code. The `.env` can also be
  placed inside that folder.
- **Python service for voice and images.** `python/server.py` (FastAPI) uses
  faster-whisper to transcribe voice notes and diffusers to draw. Node calls it
  over HTTP on `127.0.0.1:5050`; if it is not running, the bot keeps using the
  legacy engines (transformers.js and sd-cli). Images switch to
  `IMAGE_GEN_BACKEND=auto` by default and Whisper falls back to CPU by itself if
  it detects CUDA but `libcublas`/cuDNN are missing. Includes `npm run ia`,
  `npm run test:python` and Node ↔ Python contract tests without downloading
  models.
- **Debug mode with full access.** Typing `0912` (or the `WEB_DEBUG_CODE` value)
  in the email field of `/entrar/` enters instantly, with no email or OTP. The
  session carries `debug: true` and unlocks an administration tab with
  statistics, all bot settings and the registered students. Attempts are limited
  per IP and normal accounts still have no access to `/api/admin/*`.
- **Recording from private messages.** You can now message the bot privately
  (direct message or the chat with yourself): whatever you tell it about
  homework or exams **is recorded in the group**, and you can also ask it about
  them from there. That way a task can be left at hand without writing in the
  group. To chat with Claw about anything else privately, write `Claw` plus your
  question (before, any private message went straight to Claw and nothing was
  recorded). For safety, `!claw fuera` now only works inside the group, so it
  cannot be unlinked by accident from a private chat.
- **Web search (DuckDuckGo).** Claw can now search the web when the question asks
  for something current (news, prices, sports results…) or when it is forced with
  `!claw busca <something>`. It works without new dependencies: it uses the HTML
  search engine, then "lite", and if that fails the instant answers API. It is
  enabled or disabled with `!claw ajustes buscar si|no` (or `WEB_SEARCH`).
- **Two AI models depending on the task.** The "brain" that records homework and
  exams can use a different model (usually smaller and faster) than the one that
  chats. New `modelo_cerebro` setting / `OLLAMA_MODEL_BRAIN` variable. By default
  both use `qwen2.5:3b`, which fits entirely in the GPU and replies instantly.
- **`modelo` setting.** The owner can change the Ollama AI model live from
  WhatsApp (for example `!claw ajustes modelo qwen2.5:3b`), without editing
  `.env` or restarting.
- **Claw signature.** Assistant replies now carry a `🪝 Claw` header so they can
  be told apart at a glance from homework/exam notices. It can be removed with
  `!claw ajustes firma no` (or `CLAW_SIGNATURE=false`).
- **View and delete in one go.** New `!claw apuntes` command to see everything the
  bot has recorded (homework and exams) at once, and `!claw olvida todo`
  (owner/admin) to wipe all the notes in the group at once. Deletion respects the
  other groups and does not touch the history.
- **Record by hand with a deadline.** New `!claw apunta` command to create or
  correct a task or exam and set the date by hand, without waiting for someone to
  say it in the group: `!claw apunta deberes mates hacer la ficha 3 para el
  viernes` (it also works to change just the date: `!claw apunta deberes mates
  para el lunes`). By default **anyone** in the group can use it; the owner can
  restrict it to owner and admins with `!claw ajustes apunta no` (or
  `APUNTA_LIBRE`).
- **`apunta` setting.** Who can use `!claw apunta`: anyone (`si`, default) or only
  the owner and the administrators (`no`).
- **Mark homework as done.** `!claw hecho lengua` (or with a word from the
  description) removes what has already been handed in from the pending list: it
  stops appearing in `!claw deberes`, in `!claw proximo` and in the reminders.
  With no arguments it shows what is still pending and how to mark it.
- **Exam notice in advance.** Besides the evening before and the same day, Claw
  now warns three days ahead (`REMINDER_ADVANCE_DAYS`) so there is time to revise.
  Set it to `0` if you prefer only the usual notices.
- **Power lock.** While the bot is open, it prevents Windows from sleeping or
  hibernating the computer (if it suspended, the WhatsApp connection dropped).
  It uses `SetThreadExecutionState` with a small helper process: it does not
  change any PC setting and releases itself when the bot closes. Controlled by
  the `despierto` and `pantalla` settings (and the `PREVENT_SLEEP` and
  `KEEP_DISPLAY` variables).
- **Who can message it privately.** New `privado` setting with four options:
  `dueno` (only you, by default), `admins` (you and the administrators), `todos`
  (anyone) or `nadie`. Changed with `!claw ajustes privado <value>` (or
  `PRIVATE_MODE`). Before it was a simple yes/no and, with yes, anyone could
  message it.
- **Banning someone (stopping them from using Claw).** New `!claw prohibir
  <number>` and `!claw permitir <number>` commands (owner/admin), and `!claw
  vetados` to see the list. The bot ignores a banned person completely: it does
  not answer Claw, does not reply to mentions and does not accept `!claw`
  commands from them. The owner and administrators cannot be banned. It can also
  be set at startup with `WHATSAPP_BLOCKED`.
- **Swear counter.** The bot counts the swear words said in the group (per
  person): besides being viewable with `!claw palabrotas`, the ranking **appears
  on its own** as soon as someone swears (with a small margin between notices so
  it does not spam). It is reset with `!claw palabrotas reset` (owner/admin) and
  controlled with `!claw ajustes palabrotas`/`palabrotas_aviso`/`palabrotas_espera`
  or the `COUNT_SWEARS`/`SWEAR_ALERT`/`SWEAR_COOLDOWN` variables. It recognises
  whole words (so "computadora" does not count as "puta") and it does not censor
  or scold anyone.
- **Image generation (experimental).** New `!claw imagen <what>` command that
  requests the image from a local endpoint compatible with OpenAI Images. The
  `imagenes`, `imagen_modelo` and `imagen_endpoint` settings are added (and the
  `IMAGE_GEN_ENABLED`, `IMAGE_GEN_ENDPOINT`, `IMAGE_GEN_MODEL`,
  `IMAGE_GEN_API_KEY`, `IMAGE_GEN_SIZE` and `IMAGE_GEN_TIMEOUT` variables). **It
  is off out of the box on purpose**: the bot does not generate any image on its
  own (not even if someone asks for one while talking); it only draws if someone
  types `!claw imagen ...` by hand and someone with permission has enabled the
  `imagenes` setting beforehand.
- **The image AI is already installed (and it is local).** An AI that really
  draws has been set up on the computer (Stable Diffusion 1.5, inside
  `sdserver\`), so image generation is no longer an empty gap: if it is ever
  switched on, it works. The default engine is `cli` (it calls `sd-cli.exe`, with
  no server open) and it can also point to an OpenAI Images compatible server
  with the `http` engine. New settings: `imagen_motor`, `imagen_pasos` and
  `imagen_negativo`; new variables: `IMAGE_GEN_BACKEND`, `IMAGE_GEN_BIN`,
  `IMAGE_GEN_MODEL_PATH`, `IMAGE_GEN_STEPS`, `IMAGE_GEN_WIDTH`,
  `IMAGE_GEN_HEIGHT` and `IMAGE_GEN_NEGATIVE`. It is still **off out of the box**.
- **Changelog notice in the group.** When something is added to the bot, the
  group finds out: a summary of what is new is sent, **once per change** (so it
  does not spam on every restart). It can be seen again at any time with `!claw
  novedades` and is controlled by the `novedades` setting (or
  `CHANGELOG_NOTIFY`).
- **"Typing…" while it draws.** Drawing an image takes close to a minute and,
  with no signal at all, it looked like the bot had hung. It now shows
  "typing…" in the group while it works and clears it when done. And when the
  image is requested it also sends a **"🎨 Generating, please wait…"**.
- **Image prompts translated into English.** Stable Diffusion is trained in
  English and we were sending it the text in Spanish as-is, so it
  misinterpreted many requests. The text model now translates and cleans up the
  request **literally** (it translates, but does not invent objects or change the
  subject) and that version is what goes to the engine. Disabled with
  `IMAGE_GEN_ENHANCE=false`.
- **Fine image settings.** New `IMAGE_GEN_CFG`, `IMAGE_GEN_SAMPLER` (default
  `dpm++2m`), `IMAGE_GEN_SCHEDULER` (`karras`), `IMAGE_GEN_SEED` (default `-1`,
  **random seed**: before, the same composition always came out, 42) and
  `IMAGE_GEN_NEGATIVE`, whose default value is now in English, which is how the
  engine understands it best.
- **Own chess engine.** Claw no longer uses the text AI to play: a minimax with
  alpha-beta pruning and position tables decides the moves. The AI only comments
  on the game. Configurable with `CHESS_THINK_MS` (milliseconds it thinks per
  move, 1200 by default).
- **Redesigned website with code access.** The landing page (`/`) and the login
  (`/entrar/`) have been rebuilt: black-green background with lime accents, its
  own typography, smooth animations, feature cards with detail and a chat
  preview. Login asks for the `@alu.edu.gva.es` email and a six-digit code in
  separate boxes (10 minutes, five attempts); afterwards you can chat with Claw
  and manage shared homework and exams. The website is served by PickleBrain
  itself, locally or through ngrok.

### Changed

- **Replies that use the internet say where they come from.** When Claw searches
  the web, the reply starts with "According to DuckDuckGo" (the assistant is
  asked to do so and, if it forgets, the source is added automatically).

- **Claw does not insult or show disrespect.** A rule has been added to the
  assistant instructions (and to the chess comments and the summaries) so it
  never uses insults, swear words or put-downs, not even if provoked. If someone
  is disrespectful to it, it replies politely.
- **Homework now always shows its deadline.** Before, if a task had no date, that
  part did not appear at all and it was impossible to tell whether there was no
  deadline or it was simply not shown. Now `!claw deberes` (and `!claw apuntes`)
  always say when it is due, or "no date" if it is unknown.

- **Claw no longer has a line limit.** Before, the assistant was forced to reply
  in "1 or 2 sentences" and at most 300 characters (with an output cap of 260
  tokens and a cut at 900 characters). Now it replies with whatever length is
  needed: one sentence if the question is short, or as many lines as necessary —
  with lists and numbering — if it is asked for something long or detailed.
- **Claw remembers more of the conversation.** It now looks at the last 10
  messages (before 6) and keeps up to 12 (before 8), so there is less to repeat.
- **Claw says "I don't know" instead of making things up.** The instructions now
  say not to invent facts, to use the context it is given and to answer clearly
  when it does not know something.

### Fixed

- **440 error loop ("Connection Replaced").** When the connection was lost, the
  bot opened a new socket *without closing the previous one* and without
  preventing overlapping reconnects. Two sockets with the same session stepped on
  each other and WhatsApp returned 440 in an infinite loop (connect → 440 →
  connect → 440…). Now, before reconnecting, the old socket is really closed and
  only one pending reconnect can exist at a time.
- **Notices marked as sent without having gone out.** If the connection was not
  ready yet (or the internet dropped), the bot considered the changelog notice,
  the exam reminders and the weekly summary **sent even though the message had
  not gone out**, and never repeated them: they were lost. Now they are only
  marked as sent if they really go out, and they are retried as soon as the
  connection is back.
- **Image AI failed for lack of graphics memory.** The real cause of the failures
  ("unet segment failed during workspace capacity check" → "generate failed") was
  that on a 4 GB card **the Ollama text model and the image model do not fit at
  the same time**: when asking for an image with Ollama loaded (2.1 GB of VRAM),
  the image engine ran out of memory and failed. Now, **before drawing, the bot
  releases the text model** to make room; Ollama loads it again by itself, in a
  couple of seconds, the next time it is asked something. It can be disabled with
  `IMAGE_GEN_FREE_VRAM=false` if you have a large card.
- **Image AI failed if two were requested in a row.** If someone asked for an
  image and, without waiting for it to finish, asked for another, **two
  generations ran at once**, the card ran out of memory and **both failed**. On
  top of that the processes stayed hung, eating CPU and memory. Now it draws
  **one at a time**: the second waits its turn and, if there is already a queue,
  it is told clearly that it is busy ("give me a moment") instead of throwing a
  scary error. And if one takes too long, it is really killed (on Windows
  `kill()` was not enough: now `taskkill` is used).
- **The image error said nothing useful.** It kept the last line from the engine
  (the generic `generate failed`). Now it looks for the real cause — lack of
  memory, wrong model, etc. — and shows it.
- **Chess mode was impossible to play.** To move, the bot asked the text AI (a 3B
  model) to choose among the legal moves. That model is incapable of playing
  chess: it chose almost at random and ended up **moving the same knight from h6
  to g4 and from g4 to h6 non-stop**, so the game went nowhere. Also, if Ollama
  was slow, each of its moves could wait up to two minutes. Now the moves are
  decided by the engine itself (fast, ~1.2 s) and the AI only comments.
- **Images always came out with the same composition.** No seed was sent to the
  engine, which always used the factory 42: every generation repeated the same
  framing. Now each image uses a random seed.
- **"Castellano" was not recognised as a subject.** `!claw apunta deberes
  castellano …` did not know which subject it belonged to and replied with the
  examples instead of recording it. Now `castellano`, `castellana` and `lengua y
  castellano` are stored as Lengua; while at it, other missing names were added
  (Dibujo, Plástica, Sociología, Deporte, Tutoría…), so there is no need to enter
  the date or the "official" subject for the note to be saved.
- **The website could not use the API through ngrok.** The browser sends the
  tunnel domain as the origin and the server rejected it with a 403. Now ngrok
  domains are accepted automatically and the website itself fills in the server
  address with the tunnel one, without the student having to type it.
- **Ngrok not installed no longer floods the log.** If the binary is missing,
  Claw warns once and disables the tunnel instead of retrying every 5 seconds.

---

## [1.0.0] — 2026-10-15

First complete and functional version: a WhatsApp bot with local AI that lives in
a high school group, learns the homework and exams mentioned there and only
speaks when asked.

### Added

- **Silent listening.** The bot reads everything that happens in the group but
  says nothing unless asked, mentioned or addressed with `Claw ...`.
- **Learning homework and exams.** It detects when someone *states* something
  ("the history exam is on October 20") and stores it; it detects when someone
  *asks* and opens a 15-minute **pending question** to capture the group's
  answer.
- **Instant replies.** If someone asks about known homework or exams, it answers
  immediately from the database, with no AI and no waiting.
- **Claw mode.** By writing `Claw` plus anything (`Claw, what is 2+2?`) the bot
  becomes a general assistant with local AI.
- **Private chat and own chat.** It replies to direct messages and to messages in
  the "message yourself" chat; privately everything goes to the assistant.
- **Mentions.** It replies when mentioned in the group.
- **Voice notes.** It transcribes audio locally with Whisper (ffmpeg + the
  `Xenova/whisper-base` model) and treats it as text. Also in voice notes, not
  just written messages.
- **Photos, PDFs and documents.** It stores those related to homework or exams,
  links them to the corresponding exam and forwards them when asked.
- **Disk space warning.** If the disk is running out, it does not save and warns
  instead of failing silently. Automatic cleanup of expired photos and exams.
- **Exam reminders.** It warns the evening before and the morning of the exam.
- **Weekly summary.** It summarises what has been talked about and recorded (by
  default, Sunday afternoons).
- **Export to calendar.** `!claw calendario` downloads the exams as an `.ics`
  file.
- **Several groups at once.** The bot can be linked to more than one group, and
  each group has its own homework and exams (notes are kept separate per group).
- **Chess mode.** `!claw ajedrez` to play a game against Claw, `!claw ajedrez e4`
  to move (it accepts `Nf3`, `O-O` or `e2e4`) and `!claw analiza <FEN>` to
  analyse a position with grandmaster comments (deterministic analysis, without
  relying on the AI).
- **Welcome with `@todos`.** When linked, the bot introduces itself in the group
  mentioning everyone.
- **Live settings from WhatsApp.** The owner and the administrators can view and
  change the settings without restarting, with `!claw ajustes`.
- **Administrators.** The owner can add or remove administrators with `!claw
  admins +600111222` / `!claw admins -600111222`.
- **Maintenance mode.** `!claw mantenimiento si` leaves the bot completely mute:
  it does not reply, does not record homework or exams and does not send
  reminders or summaries. Only the administrators can turn it on or off, with
  `!claw mantenimiento no`.
- **Development tools.** WhatsApp-free simulator (`npm run sim`), system checker
  (`npm run doctor`), manual message sending (`npm run enviar`) and a battery of
  **113 integration tests** (`npm test`).
- **`!claw olvida <text>` command** to delete a wrong note.

### Changed

- **Commands go from `!pickle` to `!claw`.** `!pickle` is kept as an alias so
  nothing breaks.
- **Friendlier and more natural Claw personality.** Short replies, in Spanish
  from Spain and with a WhatsApp tone.
- **Today's date is always injected into the assistant context**, so it does not
  get the years wrong.
- **Homework and exam data is only passed to the AI when the question is about
  that**, so it does not mix in irrelevant information.
- **The owner identity includes both the number and the `@lid`** of the account
  (see *Fixed*).

### Fixed

- **The owner could not hear itself.** Its own messages arrived with the new
  WhatsApp identifier (`@lid`) instead of the number, so the bot did not
  recognise its owner and ignored them. It now recognises both the number and the
  `@lid`, and the alternative identity fields from Baileys are read correctly
  too.
- **The AI "went off the rails".** Two prompt bugs: the date was inserted *inside
  the question* (the small model answered with the date to anything) and the
  homework data was passed *always* (it copied the "KNOWN HOMEWORK:" header as
  the reply). Now the date goes in the system context and the data is only
  included if the question is about homework or exams.
- **`stats()` failed with an SQL error.** The `messages` and `media` queries
  chained an `AND` without a `WHERE`, which broke the status command. Fixed.
- **ffmpeg was not found.** Its absolute path can be set in `FFMPEG_PATH`, so
  voice notes work again even when it is not on the PATH.
- **Wrong year.** The assistant answered "2023" to questions about the year; it
  now answers correctly with the injected date.
- **Mobility miscalculated in chess analysis.** The analysis now shows the
  correct number of available moves for each side.
- **Group detection.** The group list is read first from the settings and, if not,
  from the `.env`; groups fixed in the `.env` cannot be unlinked by mistake from
  WhatsApp.
- **Welcome per group.** The "already introduced myself" flag is stored per
  group, so when a new group is added the bot introduces itself there too.

---

## Notes

- The whole project runs **locally**: neither the messages nor the AI leave your
  computer. The only thing downloaded the first time is the voice model. The only
  exception is **web search** (DuckDuckGo), which can be disabled with
  `WEB_SEARCH=false`.
- The bot **is not a git repository**; all changes live on disk.
- To start it: double click `arrancar.bat` or `npm start`.
