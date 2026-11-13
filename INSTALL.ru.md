# Установка Claw

[English](INSTALL.md) · [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · **Русский** · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

Claw — это бот для WhatsApp, который работает на твоём компьютере. Ему нужны две вещи:
**Node.js** (бот, веб-панель и база данных) и **Ollama** (локальный ИИ). Голосовые
сообщения и генерация картинок **необязательны** и требуют небольшого сервиса на Python.

Каждый шаг заканчивается **Проверкой**: если видишь то, что там написано, шаг готов и
можно идти дальше. Если что-то не сходится, переходи к
[Проблемы и решения](#проблемы-и-решения).

---

## Что нужно

| Обязательно | Версия | Зачем |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 22 или новее | Бот, веб-панель, база данных |
| [Ollama](https://ollama.com) | актуальная версия | Локальный текстовый ИИ |
| [Git](https://git-scm.com) | любая | Скачать и обновлять |
| Свободное место | ~6 ГБ | Две модели Ollama |

| Необязательно | Версия | Зачем |
| --- | --- | --- |
| Python | 3.11 или 3.12 | Расшифровка голоса и генерация картинок |
| ffmpeg | актуальная версия | Голос без Python |
| Видеокарта NVIDIA | 4 ГБ видеопамяти | ИИ быстрее; на процессоре тоже работает |

Работает на Linux, macOS и Windows, нужно около 8 ГБ оперативной памяти. С картой на
4 ГБ `qwen3:4b` и `qwen2.5:3b` помещаются свободно; с большей памятью можно взять модели
покрупнее.

---

## Быстрый путь (около 10 минут)

### 1. Установить Node.js

**Linux и macOS** (nvm, рекомендуется):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# закрой и снова открой терминал, затем:
nvm install 22
nvm alias default 22
```

**macOS** с Homebrew: `brew install node`

**Windows**, в PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
```

Закрой и снова открой терминал, чтобы обновился `PATH`.

**Проверка:** `node --version` выводит `v22.` или новее.

### 2. Установить Ollama и модели

```bash
# Linux и macOS
curl -fsSL https://ollama.com/install.sh | sh

# macOS с Homebrew
brew install ollama && brew services start ollama

# Windows (PowerShell)
winget install Ollama.Ollama
```

Затем скачай две модели (около 5 ГБ, один раз):

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

**Проверка:** `ollama list` показывает обе модели, а это отвечает в JSON:

```bash
curl http://127.0.0.1:11434/api/tags
```

В Windows, если не отвечает, открой приложение Ollama из меню «Пуск».

### 3. Скачать проект

```bash
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

**Проверка:** `ls` (в Windows `dir`) показывает `package.json`.

> Скачивай ZIP только если не нужны обновления: теряешь историю и `git pull`.

### 4. Установить зависимости

```bash
npm install
```

В Windows, если PowerShell ругается на `npm.ps1`, используй `npm.cmd install`.

Можно также дважды щёлкнуть по **`arrancar.bat`** (Windows): он доустановит нужное,
создаст `.env`, если его нет, и запустит бота.

**Проверка:** завершается без ошибок.

### 5. Настроить `.env`

```bash
cp .env.example .env          # Linux и macOS
Copy-Item .env.example .env   # Windows (PowerShell)
```

Шаблон уже подходит: он указывает на Ollama на этом компьютере и на две только что
скачанные модели. Править нужно, только если Ollama на другом компьютере, если берёшь
другую модель, или чтобы прописать почту для кодов доступа.

Два важных момента:

- **Не выкладывай `.env` в Git.** Там твой номер, почта и пароли. Он уже в `.gitignore`.
- Если используешь `PICKLEBRAIN_DATA_DIR`, файл `.env` может лежать в этой папке данных.

**Проверка:** `.env` лежит рядом с `package.json`.

### 6. Первый запуск

```bash
npm start
```

В первый раз браузер откроет `http://localhost:3000/setup`, чтобы выбрать язык (их 100).
Выбор сохраняется в базе данных, и бот не подключится к WhatsApp, пока язык не выбран.

Затем в терминале появится **QR-код**. Отсканируй его в
**WhatsApp → Настройки → Связанные устройства → Привязать устройство**.

Сессия хранится в `data/auth/` (или в `PICKLEBRAIN_DATA_DIR/auth`). Не передавай эту
папку никому: это доступ к твоему аккаунту.

**Проверка:** терминал пишет, что подключился, а в телефоне видно привязанное
устройство. Напиши `!claw` в группе — он ответит своим состоянием.

Другие способы запуска:

| Команда | Что запускает |
| --- | --- |
| `npm start` | Всё: WhatsApp, веб-панель и напоминания |
| `npm run web` | Только веб-панель и API, без WhatsApp |
| `npm run sim` | Симулятор в терминале, без WhatsApp и QR |

---

## Привязать группу

В группе напиши:

```
!claw aqui
```

Так сохраняется **идентификатор** группы (никогда не название: оно повторяется, и его
может поменять кто угодно). Можно также указать `WHATSAPP_GROUP_JID` в `.env`.

Если бот молчит — почти всегда так и должно быть: он говорит, только когда спрашивают
про домашку или экзамены, либо когда пишут `Claw` и вопрос.

---

## Необязательно: голос и картинки (сервис Python)

Без этого сервиса бот работает: голос — через ffmpeg и Whisper внутри Node, картинки —
через `sd-cli`. С ним получаешь `faster-whisper` (быстрее) и `diffusers` (картинки
лучше). **Если нужны только ответы про домашку, переходи к
[Проверить, что всё работает](#проверить-что-всё-работает).**

**1. Создать виртуальное окружение** (из папки проекта):

```bash
python3.12 -m venv .venv      # Linux и macOS
py -3.12 -m venv .venv        # Windows
```

Если нет Python 3.12: `sudo apt install python3.12 python3.12-venv` (Debian и Ubuntu) или
`brew install python@3.12` (macOS).

**2. Установить зависимости:**

```bash
.venv/bin/pip install -r python/requirements.txt                  # Linux и macOS
.venv\Scripts\pip.exe install -r python\requirements.txt          # Windows
```

**3. Запустить в другом терминале** и оставить открытым, пока работает бот:

```bash
.venv/bin/python python/server.py                 # Linux и macOS
.venv\Scripts\python.exe python\server.py         # Windows
```

Короткие команды, если `python` есть в `PATH`: `npm run ia` (Windows и macOS) или
`npm run ia:linux`.

**Проверка:** это вернёт `"ok": true` и состояние `voice` и `images`:

```bash
curl http://127.0.0.1:5050/health
```

Бот сам находит сервис при запуске и пишет, какой движок голоса использует. Модели
скачиваются при первом использовании: около 150 МБ для Whisper и около 4 ГБ для
картинок, хранятся в `data/models/`.

Полезные переменные:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

С картой на 4 ГБ оставь `PYTHON_IMAGE_UNLOAD=true`, чтобы Ollama забирал видеопамять
после каждой картинки.

---

## Необязательно: генерация картинок

Картинки выключены по умолчанию, потому что на слабых видеокартах это медленно. Чтобы
включить, добавь в `.env`:

```dotenv
IMAGE_GEN_ENABLED=true
```

и поставь дополнительные зависимости в то же окружение:

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

Без видеокарты NVIDIA сначала поставь версию torch для процессора:

```bash
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
```

Картинки заказываются вручную: `!claw imagen <что нужно>`.

---

## Проверить, что всё работает

| Команда | Что проверяет | Нужна Ollama? |
| --- | --- | --- |
| `npm run doctor` | Ollama, модели, база, голос, диск | Да |
| `npm test` | Весь набор тестов | Да |
| `npm run test:python` | Связку Node ↔ сервис Python | Нет |
| `npm run test:web` | Входы и API | Нет |
| `npm run test:subjects` | Определение предметов | Нет |
| `npm run test:vetados` | Блокировку по номеру и по `@lid` | Нет |
| `npm run test:i18n` | 100 языков | Нет |

Если `doctor` зелёный, всё готово. Попробовать без WhatsApp:

```bash
npm run sim
```

```
какая домашка по математике?
Аня: страницы с 30 по 32
какая домашка по математике?
контрольная по истории 20 октября
Claw, сколько будет 2+2?
```

---

## Установка через Homebrew (macOS и Linux)

Есть tap с формулой, которая ставит команды `claw` и `claw-ia`:

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 и новее
brew install claw
claw
```

При первом запуске зависимости Node скачиваются в `~/.local/share/claw`, а данные
хранятся в `~/.local/share/claw/data`. Если хочешь свою папку:

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

Для сервиса голоса и картинок:

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"  # только картинки
claw-ia
```

> Tap живёт на `Uyruw3/homebrew-claw`, потому что организация проекта не разрешает
> создавать репозитории из того аккаунта. Если переедет в `ClawProject`, команда будет
> `brew tap ClawProject/claw`.

---

## Обновление

```bash
git pull
npm install
```

Если ещё и поменялись `python/requirements*.txt`:

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

Перезапусти Node и сервис Python. С Homebrew: `brew update && brew upgrade claw`.

---

## Проблемы и решения

| Что видишь | Что делать |
| --- | --- |
| `npm start` не находит Ollama | Открой приложение Ollama или запусти `ollama serve`, затем проверь `curl http://127.0.0.1:11434/api/tags` |
| QR-код не появляется | Сначала выбери язык на `http://localhost:3000/setup` |
| Бот молчит в группе | `!claw aqui` в группе, затем `!claw`; с `LOG_LEVEL=debug` видно, почему отброшено каждое сообщение |
| Голосовые не работают | Запусти `python/server.py` и `npm run doctor`; без Python поставь ffmpeg и открой терминал заново |
| `faster-whisper` падает с `metadata_errors` | `.venv/bin/pip install 'av<19'` |
| CUDA не грузится (`libcublas.so.12`) | Whisper сам переходит на процессор; для видеокарты поставь CUDA runtime и torch с CUDA |
| Первая картинка очень долгая | Скачивается модель diffusers (~4 ГБ); следующие будут быстрыми |
| Сайт не присылает коды доступа | Заполни `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` и `SMTP_PASSWORD`; проверь `npm run smtp -- твоя-почта@alu.edu.gva.es` |
| PowerShell блокирует `npm.ps1` | Используй `npm.cmd` или `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` в новом терминале |
| `ollama pull` упирается в место | Моделям нужно ~5 ГБ; освободи место или возьми модель меньше |

Совсем застрял? Запусти `npm run doctor` и покажи вывод:

```bash
npm run doctor > doctor.txt
```

---

## Как выглядит папка

```
TheClawRepo/
├─ src/                 код бота (Node)
├─ python/              сервис голоса и картинок
├─ docs/                сайт и документация
├─ sdserver/            необязательный движок stable-diffusion.cpp
├─ data/                сессия, база, фото и модели (вне Git)
├─ .env                 твоя настройка (вне Git)
├─ package.json
└─ arrancar.bat         запуск двойным щелчком в Windows
```
