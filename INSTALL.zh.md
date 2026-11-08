# 安装 Claw

[English](INSTALL.md) · [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · **中文**

Claw 由两个进程组成：

1. **Node.js**（必需）：WhatsApp 机器人、网页界面、数据库和逻辑。
2. **Python**（可选，推荐）：使用 faster-whisper 转写语音消息，并使用 diffusers
   生成图片。若未运行，Node 会使用
   原有的引擎。

本指南适用于 Linux、macOS 和 Windows。关于机器人的总体说明见
[README](README.zh.md)；关于 Python 服务见 [`python/README.md`](python/README.md)。

---

## 1. 依赖要求

| 组件 | 版本 | 用途 |
|---|---|---|
| Git | 任意较新版本 | 下载和更新项目 |
| Node.js | 22 或更高（推荐 24 LTS） | 机器人、网页界面和数据库 |
| Ollama | 较新版本 | 本地文本 AI |
| Python | 3.11 或 3.12 | 语音和图片服务（可选） |
| ffmpeg | 较新版本 | 不使用 Python 时的语音方案（可选） |

文本 AI 需要下载 Ollama 模型。在 4 GB 的 GTX 1650 上，
`qwen3:4b` 和 `qwen2.5:3b` 可以运行；内存更大时可用更大的模型。

---

## 2. 下载项目（`git clone`）

### Linux 和 macOS

```bash
git clone https://github.com/ClawProject/El-Repositorio-de-Claw.git
cd El-Repositorio-de-Claw
```

### Windows（PowerShell）

```powershell
git clone https://github.com/ClawProject/El-Repositorio-de-Claw.git
cd El-Repositorio-de-Claw
```

> 如果已经下载过，请在文件夹中运行 `git pull` 更新。
> 不要下载 ZIP：那样会失去提交历史和更新能力。

---

## 3. 安装 Node.js

### Linux 和 macOS 使用 nvm（推荐）

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 关闭并重新打开终端，或者执行：
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

nvm install 22
nvm alias default 22
node --version       # 应显示 v22.x 或更高
npm --version
```

### macOS 使用 Homebrew

```bash
brew install node
```

### Windows

从 [nodejs.org](https://nodejs.org/) 下载 LTS 安装包，或者使用：

```powershell
winget install OpenJS.NodeJS.LTS
```

关闭并重新打开 PowerShell 以更新 `PATH`。

---

## 4. 安装 Ollama 和模型

### Linux 和 macOS

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

或使用 Homebrew：

```bash
brew install ollama
brew services start ollama
```

### Windows

```powershell
winget install Ollama.Ollama
```

然后在任意终端中：

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

确认它能响应：

```bash
ollama list
curl http://127.0.0.1:11434/api/tags
```

---

## 5. 安装 Node 依赖

在项目根目录：

```bash
npm install
```

在 Windows 上，如果 PowerShell 报 `npm.ps1` 错误，请使用 `npm.cmd install`。

在 Windows 上也可以双击 **`arrancar.bat`**：它会安装缺少的
依赖、必要时创建 `.env` 并启动机器人。

---

## 6. 配置 `.env`

复制模板并编辑：

```bash
cp .env.example .env
```

在 Windows 上：

```powershell
Copy-Item .env.example .env
notepad .env
```

最小可用配置：

```dotenv
OLLAMA_MODEL=qwen3:4b
OLLAMA_MODEL_BRAIN=qwen2.5:3b
# 群组标识（或在群里发送 "!claw aqui"）
WHATSAPP_GROUP_JID=120363000000000000@g.us
```

- 之后可以在 WhatsApp 中发送 `!claw aqui` 来连接群组；只保存
  标识，从不保存群名。
- 如果设置了 `PICKLEBRAIN_DATA_DIR`，`.env` 可以放在该数据
  目录中。
- 几乎所有设置都能在机器人运行时用 `!claw ajustes` 修改；
  手动修改 `.env` 后需要重启。
- **不要把 `.env` 上传到 Git**：它包含邮箱、密码和你的手机号。
  它已在 `.gitignore` 中。

所有变量都在 [`.env.example`](.env.example) 和
[README](README.zh.md) 中有说明。

---

## 7. Python 语音与图片服务（可选，推荐）

没有这个服务 Claw 仍能运行：语音使用 Node 中的 ffmpeg + Whisper，
图片使用 `sd-cli` 或 HTTP 服务器。使用 Python 可以获得
`faster-whisper`（更快）和 `diffusers`。

### 7.1 创建虚拟环境

在项目根目录：

```bash
python3.12 -m venv .venv
```

如果系统没有 `python3.12`：

```bash
# Debian/Ubuntu
sudo apt install python3.12 python3.12-venv

# macOS 使用 Homebrew
brew install python@3.12
```

在 Windows 上：

```powershell
py -3.12 -m venv .venv
```

### 7.2 安装依赖

```bash
# Linux/macOS
.venv/bin/pip install -r python/requirements.txt

# Windows
.venv\Scripts\pip.exe install -r python/requirements.txt
```

仅在需要 diffusers 生成图片时：

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

> 没有 NVIDIA 显卡时，先安装 CPU 版 torch：
>
> ```bash
> .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
> ```
>
> 有 NVIDIA 显卡时，torch 必须是 CUDA 版本。如果 Whisper 检测到 CUDA
> 但缺少 `libcublas`/cuDNN，服务会自动改用 CPU。

### 7.3 启动服务

在**另一个终端**中，从项目根目录：

```bash
# Linux/macOS
.venv/bin/python python/server.py

# Windows
.venv\Scripts\python.exe python\server.py
```

也可以使用：

```bash
npm run ia          # Windows/macOS，前提是 "python" 在 PATH 中
npm run ia:linux    # Linux
```

确认它能响应：

```bash
curl http://127.0.0.1:5050/health
```

应返回 `"ok": true` 以及 `voice` 和 `images` 的状态。机器人会在启动时
自动检测它，并显示正在使用的语音引擎。

### 7.4 模型

首次转写会下载 Whisper 模型（使用 `base` 时约 150 MB）。首张图片会
下载 diffusers 模型（使用 SD 1.5 时约 4 GB）。它们保存在
`data/models/` 中，该目录被 Git 忽略。

常用变量：

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

在 4 GB 显存的显卡上，保留 `PYTHON_IMAGE_UNLOAD=true`，以便 Ollama
在每张图片后收回显存。

---

## 8. 启动 Claw

```bash
npm start       # 完整机器人：WhatsApp + 网页 + 提醒
npm run web     # 仅网页/API，不使用 WhatsApp
npm run sim     # 控制台模拟器，不使用 WhatsApp
```

首次启动时 Claw 会打开浏览器到 `http://localhost:3000/setup` 选择
语言（100 种）。选择会保存在数据库中，机器人只有在选定后
才会连接 WhatsApp。之后可通过 WhatsApp 的 `!claw language en`（所有者/管理员）
或再次访问 `/setup` 修改。

随后 `npm start` 会显示**二维码**。在 WhatsApp 中扫描：

**设置 → 已关联的设备 → 关联设备**

会话保存在 `data/auth/`（或 `PICKLEBRAIN_DATA_DIR/auth`）。不要
分享该文件夹：它会让你账号被人访问。

---

## 9. 验证安装

```bash
npm run doctor      # Ollama、模型、数据库、语音等
npm run test:python # Node 与 Python 服务之间的约定（不需要模型）
npm run test:web    # 身份验证和 API
npm run test:subjects
npm run test:i18n   # 语言和翻译（不需要 Ollama）
npm run test:vetados # 按号码和 @lid 屏蔽（不需要 Ollama）
```

`npm test` 会运行全部测试，且**需要 Ollama 正在运行**。

在模拟器中快速测试：

```bash
npm run sim
```

```
大家，数学作业是什么？
Ana: 要做第 30 到 32 页
数学作业是什么？
历史考试在 10 月 20 日
Claw，2+2 等于多少？
```

---

## 10. 使用 Homebrew 安装（macOS 和 Linux）

有一个 tap 提供 `claw` 和 `claw-ia` 命令的 formula：

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 及更高版本
brew install claw
```

首次运行会把 Node 依赖下载到
`~/.local/share/claw`，并把数据保存到 `~/.local/share/claw/data`。

```bash
claw
```

如果想自己管理文件夹：

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

配置 Python 语音与图片服务：

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"

# 仅在需要生成图片时：
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"

claw-ia
```

更新：

```bash
brew update
brew upgrade claw
```

> tap 位于 `Uyruw3/homebrew-claw`，因为项目组织不允许
> 从该账号创建仓库。之后可以迁移到
> `ClawProject`，那时的命令将是 `brew tap ClawProject/claw`。
>
> formula 安装最新的已发布稳定版本。发布新版本时，
> 用 `brew update && brew upgrade claw` 更新 tap。

---

## 11. 更新项目

如果是通过 `git clone` 安装的：

```bash
git pull
npm install
```

如果 `python/requirements*.txt` 也有变化：

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

更新后重启 Node 和 Python 服务。

---

## 12. 常见问题

**`npm start` 找不到 Ollama。**
打开 Ollama 应用或运行 `ollama serve`。用
`curl http://127.0.0.1:11434/api/tags` 检查。

**机器人在群里不说话。**
1. 检查群组是否已连接：在群里发送 `!claw aqui` 或设置
   `WHATSAPP_GROUP_JID`。
2. 输入 `!claw` 查看状态。
3. 用 `LOG_LEVEL=debug` 启动，查看消息为何被丢弃。

**语音消息不工作。**
启动 `python/server.py` 并检查 `npm run doctor`。不使用 Python 时，请安装
ffmpeg 并重新打开终端。

**`faster-whisper` 报 `metadata_errors` 失败。**
安装了 `av` 19。请固定版本：

```bash
.venv/bin/pip install 'av<19'
```

**CUDA 无法加载（`libcublas.so.12`）。**
Whisper 会自动改用 CPU。要使用显卡，请安装
CUDA 运行时和支持 CUDA 的 torch 版本。在此之前语音由 CPU 处理。

**第一张图片耗时很长。**
正在下载 diffusers 模型（约 4 GB）。之后只需
生成时间。

**网站没有发送登录验证码。**
在 `.env` 中配置 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER` 和 `SMTP_PASSWORD`。
用 `npm run smtp -- 你的邮箱@alu.edu.gva.es` 测试。

**PowerShell 阻止 `npm.ps1`。**
使用 `npm.cmd`，或运行
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 后打开另一个终端。

---

## 13. 最小安装结构

```
El-Repositorio-de-Claw/
├─ src/                 机器人代码（Node）
├─ python/              语音与图片服务
├─ docs/                静态站点和文档
├─ sdserver/            可选的 stable-diffusion.cpp 引擎
├─ data/                会话、数据库、照片和模型（不在 Git 中）
├─ .env                 你的配置（不在 Git 中）
├─ package.json
└─ arrancar.bat         Windows 启动脚本
```
