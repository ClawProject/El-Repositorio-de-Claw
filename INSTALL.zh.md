# 安装 Claw

[English](INSTALL.md) · [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · **中文**

Claw 是一个运行在你自己电脑上的 WhatsApp 机器人。它需要两样东西：**Node.js**（机器人、
网页面板和数据库）和 **Ollama**（本地 AI）。语音消息和图片生成是**可选的**，需要一个
小的 Python 服务。

每一步都以**检查**结尾：如果看到上面写的内容，这一步就完成了，可以继续。如果不一致，
请查看[问题与解决办法](#问题与解决办法)。

---

## 需要什么

| 必需 | 版本 | 用途 |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 22 或更高 | 机器人、网页面板、数据库 |
| [Ollama](https://ollama.com) | 当前版本 | 本地文本 AI |
| [Git](https://git-scm.com) | 任意 | 下载和更新 |
| 可用空间 | 约 6 GB | 两个 Ollama 模型 |

| 可选 | 版本 | 用途 |
| --- | --- | --- |
| Python | 3.11 或 3.12 | 语音转文字、生成图片 |
| ffmpeg | 当前版本 | 不用 Python 时的语音 |
| NVIDIA 显卡 | 4 GB 显存 | AI 更快；用 CPU 也能跑 |

支持 Linux、macOS 和 Windows，需要约 8 GB 内存。4 GB 显存的显卡跑 `qwen3:4b` 和
`qwen2.5:3b` 很轻松；内存更大可以用更大的模型。

---

## 快速流程（约 10 分钟）

### 1. 安装 Node.js

**Linux 和 macOS**（nvm，推荐）：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 关闭并重新打开终端，然后：
nvm install 22
nvm alias default 22
```

**macOS** 用 Homebrew：`brew install node`

**Windows**，在 PowerShell 中：

```powershell
winget install OpenJS.NodeJS.LTS
```

关闭并重新打开终端，让 `PATH` 生效。

**检查：** `node --version` 显示 `v22.` 或更高。

### 2. 安装 Ollama 和模型

```bash
# Linux 和 macOS
curl -fsSL https://ollama.com/install.sh | sh

# macOS 用 Homebrew
brew install ollama && brew services start ollama

# Windows（PowerShell）
winget install Ollama.Ollama
```

然后下载两个模型（约 5 GB，只需一次）：

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

**检查：** `ollama list` 列出两个模型，下面这条命令返回 JSON：

```bash
curl http://127.0.0.1:11434/api/tags
```

在 Windows 上如果不通，从开始菜单打开 Ollama 应用。

### 3. 下载项目

```bash
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

**检查：** `ls`（Windows 用 `dir`）能看到 `package.json`。

> 只有在不打算更新时才下载 ZIP：会失去历史记录和 `git pull`。

### 4. 安装依赖

```bash
npm install
```

Windows 上如果 PowerShell 报 `npm.ps1` 的错误，改用 `npm.cmd install`。

也可以双击 **`arrancar.bat`**（Windows）：它会补装缺少的依赖，必要时创建 `.env`，然后
启动机器人。

**检查：** 结束时没有报错。

### 5. 配置 `.env`

```bash
cp .env.example .env          # Linux 和 macOS
Copy-Item .env.example .env   # Windows（PowerShell）
```

模板直接可用：它指向本机的 Ollama 和你刚下载的两个模型。只有在 Ollama 在别处、使用别的
模型，或要填写学生登录验证码的邮箱时才需要修改。

有两点值得知道：

- **不要把 `.env` 上传到 Git。** 里面有你的手机号、邮箱和密码。它已经在 `.gitignore`
  里了。
- 如果使用 `PICKLEBRAIN_DATA_DIR`，`.env` 可以放在那个数据文件夹里。

**检查：** `.env` 和 `package.json` 在同一目录。

### 6. 第一次启动

```bash
npm start
```

第一次运行时浏览器会打开 `http://localhost:3000/setup` 选择语言（共 100 种）。选择会保存
在数据库里，没选之前机器人不会连接 WhatsApp。

然后终端会出现**二维码**。用
**WhatsApp → 设置 → 已关联的设备 → 关联设备**扫描它。

会话保存在 `data/auth/`（或 `PICKLEBRAIN_DATA_DIR/auth`）。不要分享这个文件夹：它等于
你账号的访问权。

**检查：** 终端显示已连接，手机上也出现已关联的设备。在群里发送 `!claw`，它会回复自己的
状态。

其他启动方式：

| 命令 | 启动什么 |
| --- | --- |
| `npm start` | 全部：WhatsApp、网页面板和提醒 |
| `npm run web` | 只有网页面板和 API，不连接 WhatsApp |
| `npm run sim` | 终端模拟器，不需要 WhatsApp 和二维码 |

---

## 关联群组

在群里发送：

```
!claw aqui
```

这样会保存群组的**标识符**（永远不保存名字，因为名字会重复，谁都能改）。也可以在 `.env`
里设置 `WHATSAPP_GROUP_JID`。

如果机器人一直不说话，大多数时候这是正常的：只有当有人问作业或考试，或者写到 `Claw`
再加一个问题时，它才开口。

---

## 可选：语音和图片（Python 服务）

没有这个服务机器人照样能用：语音走 Node 里的 ffmpeg 和 Whisper，图片用 `sd-cli`。装上之后
可以用 `faster-whisper`（更快）和 `diffusers`（图片更好）。**如果你只想要作业回答，可以直接
跳到[检查一切正常](#检查一切正常)。**

**1. 创建虚拟环境**（在项目根目录）：

```bash
python3.12 -m venv .venv      # Linux 和 macOS
py -3.12 -m venv .venv        # Windows
```

如果没有 Python 3.12：`sudo apt install python3.12 python3.12-venv`（Debian 和 Ubuntu）或
`brew install python@3.12`（macOS）。

**2. 安装依赖：**

```bash
.venv/bin/pip install -r python/requirements.txt                  # Linux 和 macOS
.venv\Scripts\pip.exe install -r python\requirements.txt          # Windows
```

**3. 在另一个终端里启动**，机器人运行时让它一直开着：

```bash
.venv/bin/python python/server.py                 # Linux 和 macOS
.venv\Scripts\python.exe python\server.py         # Windows
```

如果 `python` 在 `PATH` 里，可以用快捷命令：`npm run ia`（Windows 和 macOS）或
`npm run ia:linux`。

**检查：** 这条命令返回 `"ok": true` 以及 `voice` 和 `images` 的状态：

```bash
curl http://127.0.0.1:5050/health
```

机器人启动时会自己发现这个服务，并告诉你用的是哪个语音引擎。模型在第一次使用时下载：
Whisper 约 150 MB，图片约 4 GB，保存在 `data/models/`。

常用变量：

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

4 GB 显存时保留 `PYTHON_IMAGE_UNLOAD=true`，这样每张图之后 Ollama 能把显存收回去。

---

## 可选：生成图片

图片默认关闭，因为在小显存上很慢。要开启，在 `.env` 里加：

```dotenv
IMAGE_GEN_ENABLED=true
```

并在同一个环境里安装额外依赖：

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

没有 NVIDIA 显卡时，先安装 CPU 版 torch：

```bash
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
```

图片需要手动请求：`!claw imagen <你想要的内容>`。

---

## 检查一切正常

| 命令 | 检查什么 | 需要 Ollama？ |
| --- | --- | --- |
| `npm run doctor` | Ollama、模型、数据库、语音、磁盘 | 是 |
| `npm test` | 完整测试套件 | 是 |
| `npm run test:python` | Node 与 Python 服务之间的契约 | 否 |
| `npm run test:web` | 登录和 API | 否 |
| `npm run test:subjects` | 科目识别 | 否 |
| `npm run test:vetados` | 按号码和按 `@lid` 屏蔽 | 否 |
| `npm run test:i18n` | 100 种语言 | 否 |

`doctor` 全绿就完成了。想在不连 WhatsApp 的情况下试：

```bash
npm run sim
```

```
数学有什么作业？
Ana：第 30 到 32 页
数学有什么作业？
历史考试在 10 月 20 日
Claw，2+2 等于几？
```

---

## 用 Homebrew 安装（macOS 和 Linux）

有一个 tap，其中的 formula 会安装 `claw` 和 `claw-ia` 命令：

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 及更高
brew install claw
claw
```

第一次运行会把 Node 依赖下载到 `~/.local/share/claw`，数据保存在
`~/.local/share/claw/data`。如果想用自己的文件夹：

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

语音和图片服务：

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"  # 只有图片
claw-ia
```

> tap 放在 `Uyruw3/homebrew-claw`，因为项目组织不允许从那个账号创建仓库。如果迁到
> `ClawProject`，命令会变成 `brew tap ClawProject/claw`。

---

## 更新

```bash
git pull
npm install
```

如果 `python/requirements*.txt` 也变了：

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

重启 Node 和 Python 服务。用 Homebrew：`brew update && brew upgrade claw`。

---

## 问题与解决办法

| 你看到的 | 怎么办 |
| --- | --- |
| `npm start` 找不到 Ollama | 打开 Ollama 应用或运行 `ollama serve`，再检查 `curl http://127.0.0.1:11434/api/tags` |
| 不出现二维码 | 先到 `http://localhost:3000/setup` 选择语言 |
| 机器人在群里不说话 | 在群里发送 `!claw aqui`，再发 `!claw`；用 `LOG_LEVEL=debug` 能看到每条消息被丢弃的原因 |
| 语音消息不工作 | 启动 `python/server.py` 并运行 `npm run doctor`；不用 Python 就安装 ffmpeg 后重开终端 |
| `faster-whisper` 报 `metadata_errors` | `.venv/bin/pip install 'av<19'` |
| CUDA 加载失败（`libcublas.so.12`） | Whisper 会自动改用 CPU；想用显卡就安装 CUDA runtime 和带 CUDA 的 torch |
| 第一张图特别慢 | 正在下载 diffusers 模型（约 4 GB）；之后会很快 |
| 网站不发登录验证码 | 填好 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER` 和 `SMTP_PASSWORD`；用 `npm run smtp -- 你的邮箱@alu.edu.gva.es` 测试 |
| PowerShell 阻止 `npm.ps1` | 用 `npm.cmd`，或在新终端里执行 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `ollama pull` 空间不足 | 两个模型约占 5 GB；腾出空间或换更小的模型 |

还是卡住了？运行 `npm run doctor` 并贴出结果：

```bash
npm run doctor > doctor.txt
```

---

## 文件夹结构

```
TheClawRepo/
├─ src/                 机器人代码（Node）
├─ python/              语音和图片服务
├─ docs/                网站和文档
├─ sdserver/            可选的 stable-diffusion.cpp 引擎
├─ data/                会话、数据库、照片和模型（不在 Git 里）
├─ .env                 你的配置（不在 Git 里）
├─ package.json
└─ arrancar.bat         Windows 双击启动
```
