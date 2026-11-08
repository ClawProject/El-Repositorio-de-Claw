# 🪝 Claw

[English](README.md) · [Español](README.es.md) · [Català](README.ca.md) · [Français](README.fr.md) · [Português](README.pt.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · **中文**

**一个自托管的 WhatsApp 机器人，使用本地 AI。**

Claw 是一个本地 AI 的 WhatsApp 助手，负责跟进作业、考试、学校通知以及群聊中分享的重要信息。

它在后台安静运行，能理解文字消息、语音消息和相关图片，并在有人需要信息时回答问题。

> **安装：** 详见 [INSTALL.zh.md](INSTALL.zh.md)，包含 Linux、macOS 和 Windows 的完整步骤。
>
> **技术文档：** [架构、API 与安全](docs/arquitectura.md)。

---

## ✨ 功能

- **自动记录作业：** 从群聊中识别并记录作业和即将到来的考试。
- **安静运行：** 只有在被询问或明确唤起时，Claw 才会说话。
- **通用 AI 助手：** 输入 `Claw` 加问题，即可使用通用 AI 能力。
- **语音识别：** 使用 Whisper 在本地转写语音消息。
- **图片存储：** 保存与作业和考试相关的图片，并自动清理过期文件。
- **本地 AI 处理：** 使用 Ollama 在本机运行语言模型。
- **首次启动选择语言：** 首次启动时，Claw 会打开一个网页，可从 100 种语言中选择。选择会保存在数据库中，应用于界面和 AI 回答，之后可用 `!claw language en` 修改。
- **网页界面：** 让学生通过身份验证访问共享的学校信息。
- **日历集成：** 将即将到来的考试导出为 `.ics` 文件。
- **国际象棋：** 与 Claw 对弈或分析局面。
- **可选图片生成：** 使用 Stable Diffusion 在本地生成图片。
- **自动维护：** 管理已保存的媒体，并可防止主机进入休眠。

### 🔒 隐私

Claw 以本地处理为核心设计。

AI 推理、分类和数据库都在你的电脑上运行。

但仍然需要一些外部连接：

- WhatsApp：收发消息。
- ngrok：远程访问网页界面和 API。
- Ollama 与 Whisper：下载模型。
- DuckDuckGo：可选的联网搜索。

联网搜索可通过 `WEB_SEARCH=false` 或 `!claw ajustes buscar no` 关闭。

更多信息见[隐私文档](docs/arquitectura.md#datos-y-privacidad)。

---

## 🧠 工作原理

Claw 分析群里的新消息，并决定如何处理。

```text
收到群消息
        |
        +-- 包含 "Claw"？
        |       |
        |       +-- 通用 AI 助手
        |
        +-- 是关于作业或考试的问题？
        |       |
        |       +-- 直接从数据库回答
        |
        +-- 可能包含学校信息？
                |
                +-- 使用本地 AI 分类
                        |
                        +-- 识别为问题
                        |       |
                        |       +-- 开启 15 分钟的待答问题
                        |
                        +-- 识别为信息
                                |
                                +-- 静默保存到数据库
```

### 待答问题

Claw 最重要的功能之一是待答问题系统。

例如：

1. 一名学生问：“英语作业是什么？”
2. Claw 开启一个 15 分钟的待答问题。
3. 另一名同学回答：“做第 12 页。”
4. Claw 自动保存这条信息。
5. 之后任何人都可以问 Claw 英语作业。

更正会替换之前的记录，因此过期信息不会留在数据库中。

Claw 还会依据同一聊天中的近期消息理解对话上下文，不会混淆不同会话。

### 🎙️ 语音消息

Claw 使用 Whisper 理解语音消息。

- 音频在本地转写。
- Python 服务使用 faster-whisper。
- 另有 Node.js 备用方案。
- 能识别 “Clau” 和 “Clao” 等不同叫法。
- 音频无需离开你的电脑即可完成转写。

### 🖼️ 图片

Claw 可以保存与作业和考试相关的图片。

- 保留相关的学校图片。
- 忽略表情包和无关图片。
- 过期媒体会自动删除。
- 有人询问考试时，可以重新发送图片。

---

## 🚀 安装

完整步骤见 **[INSTALL.zh.md](INSTALL.zh.md)**。

### 依赖要求

| 依赖       | 版本 / 模型                      |
| ---------- | -------------------------------- |
| Node.js    | 24 LTS                           |
| Git        | 最新版本                         |
| Ollama     | 最新版本                         |
| 主模型     | `qwen3:4b`                       |
| 备用模型   | `qwen2.5:3b`                     |
| Python     | 3.11 / 3.12（推荐）              |
| FFmpeg     | 可选，用于旧版语音处理           |

下载模型：

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

### 克隆仓库

```bash
git clone <REPOSITORY_URL>
cd Claw
```

安装依赖：

```bash
npm install
```

在 Windows 上也可以运行：

```powershell
.\arrancar.bat
```

该脚本会安装缺少的依赖、创建环境配置并启动机器人。

### 可选的 Python 服务

Python 服务可以提升语音处理效果，并支持本地图片生成。

创建虚拟环境：

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

安装依赖：

```bash
pip install -r python/requirements.txt
pip install -r python/requirements-images.txt
```

启动服务：

```bash
python python/server.py
```

检查状态：

```bash
curl http://127.0.0.1:5050/health
```

详见 [python/README.md](python/README.md)。

---

## 🧪 测试

Claw 提供多种工具检查安装是否正常。

```bash
npm run doctor
npm run sim
npm test
```

| 命令                    | 说明                                     |
| ----------------------- | ---------------------------------------- |
| `npm run doctor`        | 检查 Ollama、模型、数据库和分类器。      |
| `npm run sim`           | 启动不使用 WhatsApp 的消息模拟器。       |
| `npm test`              | 运行集成测试。                           |
| `npm run test:ai`       | 测试 AI 功能。                           |
| `npm run test:subjects` | 测试科目识别，无需 Ollama。              |
| `npm run test:python`   | 测试 Node.js ↔ Python 接口。             |
| `npm run test:voice`    | 使用本地音频测试转写。                   |

### 模拟示例

```text
学生：数学作业是什么？
Claw：等待回答……

Ana：做第 30 到 32 页。

学生：数学作业是什么？
Claw：做第 30 到 32 页。

学生：历史考试在 10 月 20 日。

学生：Claw，2 + 2 等于多少？
Claw：4。
```

---

## 📱 连接 WhatsApp

启动 Claw：

```bash
npm start
```

扫码位置：

**WhatsApp → 设置 → 已关联的设备 → 关联设备**

登录会话保存在：

```text
data/auth/
```

**切勿分享此文件夹及其内容。**

### 在群组中启用 Claw

有两种方式：

**手动：**

```text
!claw aqui
```

**自动：**

在 `.env` 中填写群组内部标识：

```env
WHATSAPP_GROUP_JID=your-group-id@g.us
```

Claw 通过内部标识识别群组，而不是群名。

---

## 💬 命令

所有命令都以 `!claw` 开头。旧别名 `!pickle` 仍然有效。

### 通用命令

| 命令                         | 说明                               |
| ---------------------------- | ---------------------------------- |
| `!claw`                      | 显示机器人状态。                   |
| `!claw ayuda`                | 显示可用命令。                     |
| `!claw deberes [科目]`       | 显示待完成的作业。                 |
| `!claw examenes`             | 显示即将到来的考试。               |
| `!claw apuntes`              | 显示已保存的信息。                 |
| `!claw proximo`              | 显示最近的考试或作业。             |
| `!claw apunta ...`           | 添加或更正作业。                   |
| `!claw hecho ...`            | 将作业标记为完成。                 |
| `!claw resumen [hoy/semana]` | 汇总最新信息。                     |
| `!claw calendario`           | 将考试导出为 ICS 文件。            |
| `!claw busca ...`            | 联网搜索。                         |
| `!claw imagen ...`           | 生成图片（实验性）。               |
| `!claw ajedrez [走法]`       | 与 Claw 下国际象棋。               |
| `!claw analiza [FEN]`        | 分析棋局局面。                     |
| `!claw novedades`            | 显示最近的变更。                   |

### 所有者和管理员命令

| 命令                         | 说明                                 |
| ---------------------------- | ------------------------------------ |
| `!claw aqui` / `!claw fuera` | 连接或断开群组。                     |
| `!claw ajustes`              | 查看和修改设置。                     |
| `!claw ia`                   | 查看或更换 AI 模型。                 |
| `!claw prohibir [号码]`      | 封禁用户。                           |
| `!claw permitir [号码]`      | 解除封禁。                           |
| `!claw vetados`              | 列出被封禁的用户。                   |
| `!claw mantenimiento si/no`  | 开启或关闭维护模式。                 |
| `!claw olvida ...`           | 删除已保存的信息。                   |
| `!claw admins`               | 管理管理员（仅限所有者）。           |

所有者是运行 Claw 的 WhatsApp 账号，或 `WHATSAPP_OWNER_JID`。

只有所有者和被授权的管理员可以修改管理设置。

---

## 🌐 网页界面

Claw 内置网页界面和 API。

只启动 Web 服务器：

```bash
npm run web
```

启动全部：

```bash
npm start
```

网页界面由 Claw 服务器提供：

- `/` — 首页。
- `/entrar/` — 学生登录。

### 学生身份验证

登录需要发送到邮箱的一次性验证码。

当前规则：

- 仅接受 `@alu.edu.gva.es` 地址。
- 学生需填写名字、姓氏、年级和班级。
- 验证码 10 分钟后过期。
- 最多五次验证尝试。
- 会话在八小时后或服务器重启时过期。
- 已登录的学生共享相同的作业和考试记录。

### 外部访问

Claw 可以使用 ngrok 在局域网之外提供网页界面。

配置：

```env
NGROK_ENABLED=true
NGROK_DOMAIN=your-ngrok-domain
```

邮箱验证需要 SMTP 凭据。

**安全提示：** 调试登录功能必须谨慎配置。切勿在公网可访问的服务器上保留默认调试码。

见[架构与安全文档](docs/arquitectura.md)。

---

## ⚙️ 配置

复制示例配置：

```bash
cp .env.example .env
```

`.env` 文件包含主要选项。

### AI 配置

| 变量                    | 默认值       |
| ----------------------- | ------------ |
| `OLLAMA_MODEL`          | `qwen3:4b`   |
| `OLLAMA_MODEL_FALLBACK` | `qwen2.5:3b` |
| `OLLAMA_MODEL_BRAIN`    | `qwen2.5:3b` |
| `WEB_SEARCH`            | `true`       |
| `CLAW_TRIGGER`          | `claw`       |
| `CLAW_SIGNATURE`        | `true`       |

### WhatsApp 配置

| 变量                    | 默认值     |
| ----------------------- | ---------- |
| `WHATSAPP_GROUP_JID`    | 空         |
| `WHATSAPP_OWNER_JID`    | 机器人账号 |
| `PRIVATE_MODE`          | `dueno`    |
| `APUNTA_LIBRE`          | `true`     |
| `ANSWER_WINDOW_MINUTES` | `15`       |
| `ACK_SAVES`             | `false`    |

### 媒体配置

| 变量                   | 默认值     |
| ---------------------- | ---------- |
| `MEDIA_ENABLED`        | `true`     |
| `MEDIA_MODE`           | `contexto` |
| `MEDIA_MAX_MB`         | `12`       |
| `MEDIA_MAX_TOTAL_MB`   | `2048`     |
| `MEDIA_RETENTION_DAYS` | `14`       |

### 语音配置

| 变量                     | 默认值               |
| ------------------------ | -------------------- |
| `TRANSCRIBE_ENABLED`     | `true`               |
| `TRANSCRIBE_MODE`        | `todo`               |
| `TRANSCRIBE_MAX_SECONDS` | `180`                |
| `WHISPER_MODEL`          | `Xenova/whisper-base` |

### Python AI 配置

| 变量                    | 默认值                                        |
| ----------------------- | --------------------------------------------- |
| `PYTHON_AI_ENABLED`     | `true`                                        |
| `PYTHON_AI_URL`         | `http://127.0.0.1:5050`                       |
| `PYTHON_WHISPER_MODEL`  | `base`                                        |
| `PYTHON_WHISPER_DEVICE` | `auto`                                        |
| `PYTHON_IMAGE_MODEL`    | `stable-diffusion-v1-5/stable-diffusion-v1-5` |

几乎所有运行时设置都可以通过 `!claw ajustes` 修改。

完整参考见 `.env.example` 和 [INSTALL.zh.md](INSTALL.zh.md)。

---

## 🎨 本地图片生成（实验性）

Claw 可选支持本地图片生成。

可用后端：

- **Python + Diffusers：** 通过 Hugging Face 支持众多模型。
- **stable-diffusion.cpp：** 轻量的命令行生成。
- **HTTP 后端：** 兼容的图片生成服务器。

图片生成默认关闭。

启用：

```text
!claw ajustes imagenes si
```

生成图片：

```text
!claw imagen a futuristic city at night
```

Claw 绝不会自动生成图片。

在显存较小的系统上，图片生成可能会临时卸载 Ollama 模型以释放显存。

---

## 📁 项目结构

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

## ❓ 常见问题

**Claw 需要联网吗？**

WhatsApp 和可选的外部服务需要联网。本地 AI 推理和数据库在你的电脑上运行。

**手机没电时还能用 Claw 吗？**

可以，只要主机电脑保持开机，并且 WhatsApp 的关联设备会话仍然有效。

**电脑关机后会怎样？**

Claw 会停止，但已保存的信息仍留在 `data/picklebrain.db` 中。

**WhatsApp 会封禁我的号码吗？**

风险确实存在。Claw 使用 Baileys，一个非官方的 WhatsApp Web 库。WhatsApp 条款限制未授权的自动化操作。建议使用单独的号码。

**Claw 占用资源多吗？**

取决于模型和硬件。常见问题会直接从数据库回答，无需运行模型。

**所有图片都会被保存吗？**

不会。默认只保存相关的学校图片，旧文件会自动删除。

**为什么 Claw 不回答？**

1. 检查群组是否已连接。
2. 输入 `!claw` 查看状态。
3. 运行 `npm run doctor`。
4. 启用 `LOG_LEVEL=debug`，查看消息处理过程。

**为什么语音识别不工作？**

检查 Python 服务是否运行，或为旧的 Node.js 转写引擎安装 FFmpeg。

---

## ⚠️ 限制与后续计划

- Android 配套 APK 不在本仓库中。API 期望最新版本的附件名为 `ClawCompanion.apk`。
- 硬件允许时，更大的语言模型能改善对话质量。
- 更大的 Whisper 模型能更好地识别姓名和嘈杂录音。
- 图片生成仍属实验性，取决于硬件和模型兼容性。

---

## 📚 文档

- [安装指南](INSTALL.zh.md)
- [技术架构](docs/arquitectura.md)
- [Python 服务](python/README.md)
- [环境配置](.env.example)

---

**Claw — 你在学校生活中的本地 AI 助手。** 🪝
