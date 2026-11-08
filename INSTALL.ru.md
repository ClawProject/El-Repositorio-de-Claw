# Установка Claw

[English](INSTALL.md) · [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · **Русский** · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

Claw состоит из двух процессов:

1. **Node.js** (обязательно): бот WhatsApp, веб-интерфейс, база данных и логика.
2. **Python** (необязательно, рекомендуется): расшифровывает голосовые сообщения через faster-whisper и
   генерирует изображения через diffusers. Если он не запущен, Node использует
   прежние движки.

Инструкция подходит для Linux, macOS и Windows. Общая информация о боте —
в [README](README.ru.md), о службе Python — в [`python/README.md`](python/README.md).

---

## 1. Требования

| Компонент | Версия | Назначение |
|---|---|---|
| Git | Любая актуальная версия | Загрузка и обновление проекта |
| Node.js | 22 или новее (рекомендуется 24 LTS) | Бот, веб-интерфейс и база данных |
| Ollama | Актуальная версия | Локальный текстовый ИИ |
| Python | 3.11 или 3.12 | Служба речи и изображений (необязательно) |
| ffmpeg | Актуальная версия | Речь без Python (необязательно) |

Текстовому ИИ нужно загрузить модели Ollama. На GTX 1650 с 4 ГБ
работают `qwen3:4b` и `qwen2.5:3b`; при большем объёме памяти можно использовать крупнее модели.

---

## 2. Загрузка проекта (`git clone`)

### Linux и macOS

```bash
git clone https://github.com/ClawProject/El-Repositorio-de-Claw.git
cd El-Repositorio-de-Claw
```

### Windows (PowerShell)

```powershell
git clone https://github.com/ClawProject/El-Repositorio-de-Claw.git
cd El-Repositorio-de-Claw
```

> Если проект уже загружен, обновите его командой `git pull` в папке.
> Не скачивайте ZIP: так вы потеряете историю и возможность обновления.

---

## 3. Установка Node.js

### Linux и macOS через nvm (рекомендуется)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# закройте и снова откройте терминал, либо выполните:
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

nvm install 22
nvm alias default 22
node --version       # должно быть v22.x или новее
npm --version
```

### macOS через Homebrew

```bash
brew install node
```

### Windows

Скачайте установщик LTS с [nodejs.org](https://nodejs.org/) или выполните:

```powershell
winget install OpenJS.NodeJS.LTS
```

Закройте и снова откройте PowerShell, чтобы обновился `PATH`.

---

## 4. Установка Ollama и моделей

### Linux и macOS

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Или через Homebrew:

```bash
brew install ollama
brew services start ollama
```

### Windows

```powershell
winget install Ollama.Ollama
```

Затем в любом терминале:

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

Проверьте, что он отвечает:

```bash
ollama list
curl http://127.0.0.1:11434/api/tags
```

---

## 5. Установка зависимостей Node

Из корня проекта:

```bash
npm install
```

Если в Windows PowerShell ругается на `npm.ps1`, используйте `npm.cmd install`.

В Windows можно дважды щёлкнуть **`arrancar.bat`**: он установит недостающие
зависимости, создаст `.env` при необходимости и запустит бота.

---

## 6. Настройка `.env`

Скопируйте шаблон и отредактируйте его:

```bash
cp .env.example .env
```

В Windows:

```powershell
Copy-Item .env.example .env
notepad .env
```

Минимальная конфигурация для начала:

```dotenv
OLLAMA_MODEL=qwen3:4b
OLLAMA_MODEL_BRAIN=qwen2.5:3b
# Идентификатор группы (или напишите "!claw aqui" в группе)
WHATSAPP_GROUP_JID=120363000000000000@g.us
```

- Группу можно подключить позже, написав `!claw aqui` в WhatsApp; сохраняется
  только идентификатор, никогда название группы.
- Если задан `PICKLEBRAIN_DATA_DIR`, файл `.env` может находиться в этой
  папке данных.
- Почти всё можно менять на работающем боте командой `!claw ajustes`;
  после ручного изменения `.env` перезапустите бота.
- **Не загружайте `.env` в Git**: в нём адреса почты, пароли и ваш номер телефона.
  Он уже указан в `.gitignore`.

Все переменные описаны в [`.env.example`](.env.example) и в
[README](README.ru.md).

---

## 7. Служба речи и изображений на Python (необязательно, рекомендуется)

Без этой службы Claw тоже работает: речь использует ffmpeg + Whisper в Node, а
изображения — `sd-cli` или HTTP-сервер. С Python вы получаете
`faster-whisper` (быстрее) и `diffusers`.

### 7.1 Создание виртуального окружения

Из корня проекта:

```bash
python3.12 -m venv .venv
```

Если `python3.12` нет в системе:

```bash
# Debian/Ubuntu
sudo apt install python3.12 python3.12-venv

# macOS с Homebrew
brew install python@3.12
```

В Windows:

```powershell
py -3.12 -m venv .venv
```

### 7.2 Установка зависимостей

```bash
# Linux/macOS
.venv/bin/pip install -r python/requirements.txt

# Windows
.venv\Scripts\pip.exe install -r python/requirements.txt
```

Только если нужна генерация изображений через diffusers:

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

> Без GPU NVIDIA сначала установите версию torch для CPU:
>
> ```bash
> .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
> ```
>
> С GPU NVIDIA torch должен быть версией с CUDA. Если Whisper обнаруживает CUDA, но
> нет `libcublas`/cuDNN, служба автоматически переключается на CPU.

### 7.3 Запуск службы

В **другом терминале**, из корня проекта:

```bash
# Linux/macOS
.venv/bin/python python/server.py

# Windows
.venv\Scripts\python.exe python\server.py
```

Также можно использовать:

```bash
npm run ia          # Windows/macOS, если "python" есть в PATH
npm run ia:linux    # Linux
```

Проверьте, что она отвечает:

```bash
curl http://127.0.0.1:5050/health
```

Должно вернуться `"ok": true` и состояние `voice` и `images`. Бот обнаруживает
её автоматически при запуске и показывает, какой движок речи используется.

### 7.4 Модели

При первой расшифровке загружается модель Whisper (~150 МБ с `base`). Первое
изображение загружает модель diffusers (около 4 ГБ с SD 1.5). Они хранятся
в `data/models/`, которую Git игнорирует.

Полезные переменные:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

На GPU с 4 ГБ оставьте `PYTHON_IMAGE_UNLOAD=true`, чтобы Ollama возвращала
VRAM после каждого изображения.

---

## 8. Запуск Claw

```bash
npm start       # полный бот: WhatsApp + веб + напоминания
npm run web     # только веб/API, без WhatsApp
npm run sim     # консольный симулятор, без WhatsApp
```

При первом запуске Claw открывает браузер на `http://localhost:3000/setup` для
выбора языка (100 вариантов). Выбор сохраняется в базе данных, и бот
подключается к WhatsApp только после него. Позже язык меняется из WhatsApp
командой `!claw language en` (владелец/администраторы) или снова через `/setup`.

После этого `npm start` показывает **QR-код**. Отсканируйте его в WhatsApp:

**Настройки → Связанные устройства → Привязка устройства**

Сессия сохраняется в `data/auth/` (или `PICKLEBRAIN_DATA_DIR/auth`). Не
передавайте эту папку: она даёт доступ к аккаунту.

---

## 9. Проверка установки

```bash
npm run doctor      # Ollama, модели, база, речь и т. д.
npm run test:python # контракт Node <-> служба Python (без моделей)
npm run test:web    # авторизация и API
npm run test:subjects
npm run test:vetados # блокировка по номеру и по @lid (без Ollama)
```

`npm test` запускает весь набор и **требует запущенный Ollama**.

Быстрая проверка в симуляторе:

```bash
npm run sim
```

```
ребята, какое домашнее задание по математике?
Ана: надо сделать страницы с 30 по 32
какое домашнее задание по математике?
контрольная по истории 20 октября
Claw, сколько будет 2+2?
```

---

## 10. Установка через Homebrew (macOS и Linux)

Есть tap с формулой для установки команд `claw` и `claw-ia`:

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 и новее
brew install claw
```

При первом запуске зависимости Node загружаются в
`~/.local/share/claw`, а данные сохраняются в `~/.local/share/claw/data`.

```bash
claw
```

Если хотите управлять папкой сами:

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

Для службы речи и изображений на Python:

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"

# Только для генерации изображений:
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"

claw-ia
```

Обновление:

```bash
brew update
brew upgrade claw
```

> Tap находится на `Uyruw3/homebrew-claw`, потому что организация проекта
> не позволяет создавать репозитории с этого аккаунта. Позже его можно перенести в
> `ClawProject`; тогда команда будет `brew tap ClawProject/claw`.
>
> Формула устанавливает последнюю опубликованную стабильную версию. При выходе новой
> версии tap обновляется командой `brew update && brew upgrade claw`.

---

## 11. Обновление проекта

Если проект установлен через `git clone`:

```bash
git pull
npm install
```

Если изменились `python/requirements*.txt`:

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

После обновления перезапустите Node и службу Python.

---

## 12. Частые проблемы

**`npm start` не находит Ollama.**
Откройте приложение Ollama или выполните `ollama serve`. Проверьте командой
`curl http://127.0.0.1:11434/api/tags`.

**Бот ничего не пишет в группе.**
1. Проверьте, что группа подключена: напишите `!claw aqui` в группе или задайте
   `WHATSAPP_GROUP_JID`.
2. Введите `!claw`, чтобы увидеть состояние.
3. Запустите с `LOG_LEVEL=debug`, чтобы понять, почему сообщения отбрасываются.

**Голосовые сообщения не работают.**
Запустите `python/server.py` и проверьте `npm run doctor`. Без Python установите
ffmpeg и откройте терминал заново.

**`faster-whisper` падает с `metadata_errors`.**
Установлен `av` 19. Зафиксируйте версию:

```bash
.venv/bin/pip install 'av<19'
```

**CUDA не загружается (`libcublas.so.12`).**
Whisper автоматически переходит на CPU. Чтобы использовать GPU, установите
CUDA-рантайм и версию torch с CUDA. До этого речь работает на CPU.

**Первое изображение занимает много времени.**
Загружается модель diffusers (~4 ГБ). Последующие требуют только времени
генерации.

**Сайт не отправляет коды доступа.**
Настройте `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` и `SMTP_PASSWORD` в `.env`.
Проверьте командой `npm run smtp -- ваша-почта@alu.edu.gva.es`.

**PowerShell блокирует `npm.ps1`.**
Используйте `npm.cmd` или выполните
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` и откройте другой терминал.

---

## 13. Минимальная структура установки

```
El-Repositorio-de-Claw/
├─ src/                 код бота (Node)
├─ python/              служба речи и изображений
├─ docs/                статический сайт и документация
├─ sdserver/            необязательный движок stable-diffusion.cpp
├─ data/                сессия, база, фото и модели (не в Git)
├─ .env                 ваша конфигурация (не в Git)
├─ package.json
└─ arrancar.bat         скрипт запуска для Windows
```
