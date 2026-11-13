# Instalar o Claw

[English](INSTALL.md) · [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · **Português** · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

O Claw é um bot de WhatsApp que corre no teu próprio computador. Precisa de duas coisas:
**Node.js** (o bot, o painel web e a base de dados) e **Ollama** (a IA local). As notas de
voz e a geração de imagens são **opcionais** e precisam de um pequeno serviço de Python.

Cada passo termina com uma **Verificação**: se vires o que diz, esse passo está feito e
podes seguir. Se algo não bater certo, salta para
[Problemas e soluções](#problemas-e-soluções).

---

## Do que precisas

| Obrigatório | Versão | Para quê |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 22 ou superior | Bot, painel web, base de dados |
| [Ollama](https://ollama.com) | versão atual | IA de texto local |
| [Git](https://git-scm.com) | qualquer | Descarregar e atualizar |
| Espaço livre | ~6 GB | Os dois modelos do Ollama |

| Opcional | Versão | Para quê |
| --- | --- | --- |
| Python | 3.11 ou 3.12 | Transcrever voz e gerar imagens |
| ffmpeg | versão atual | Voz sem Python |
| GPU NVIDIA | 4 GB de VRAM | IA mais rápida; com CPU também funciona |

Funciona em Linux, macOS e Windows, e precisa de cerca de 8 GB de RAM. Com uma GPU de
4 GB, o `qwen3:4b` e o `qwen2.5:3b` cabem à vontade; com mais memória podes usar modelos
maiores.

---

## Caminho rápido (cerca de 10 minutos)

### 1. Instalar o Node.js

**Linux e macOS** (nvm, recomendado):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# fecha e volta a abrir o terminal, e depois:
nvm install 22
nvm alias default 22
```

**macOS** com Homebrew: `brew install node`

**Windows**, no PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
```

Fecha e volta a abrir o terminal para atualizar o `PATH`.

**Verificação:** `node --version` mostra `v22.` ou superior.

### 2. Instalar o Ollama e os modelos

```bash
# Linux e macOS
curl -fsSL https://ollama.com/install.sh | sh

# macOS com Homebrew
brew install ollama && brew services start ollama

# Windows (PowerShell)
winget install Ollama.Ollama
```

Depois descarrega os dois modelos (cerca de 5 GB, só uma vez):

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

**Verificação:** `ollama list` mostra os dois modelos, e isto responde com JSON:

```bash
curl http://127.0.0.1:11434/api/tags
```

No Windows, se falhar, abre a aplicação do Ollama no menu Iniciar.

### 3. Descarregar o projeto

```bash
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

**Verificação:** `ls` (ou `dir` no Windows) mostra `package.json`.

> Descarrega o ZIP só se não quiseres atualizações: perdes o histórico e o `git pull`.

### 4. Instalar as dependências

```bash
npm install
```

No Windows, se o PowerShell se queixar do `npm.ps1`, usa `npm.cmd install`.

Também podes fazer duplo clique em **`arrancar.bat`** (Windows): instala o que faltar, cria
o `.env` se não existir e arranca o bot.

**Verificação:** termina sem erros.

### 5. Configurar o `.env`

```bash
cp .env.example .env          # Linux e macOS
Copy-Item .env.example .env   # Windows (PowerShell)
```

O modelo já serve: aponta para o Ollama neste computador e para os dois modelos que
acabaste de descarregar. Só precisas de o editar se o Ollama estiver noutro sítio, se usares
outro modelo, ou para pôr o email dos códigos de acesso.

Duas coisas a saber:

- **Não coloques o `.env` no Git.** Tem o teu número, o teu email e palavras-passe. Já está
  no `.gitignore`.
- Se usares `PICKLEBRAIN_DATA_DIR`, o `.env` pode ficar dentro dessa pasta de dados.

**Verificação:** o `.env` está ao lado do `package.json`.

### 6. Arrancar pela primeira vez

```bash
npm start
```

Da primeira vez, o navegador abre `http://localhost:3000/setup` para escolher o idioma (há
100). A escolha fica guardada na base de dados e o bot não se liga ao WhatsApp até
escolheres um.

Depois aparece um **código QR** no terminal. Lê-o com
**WhatsApp → Definições → Dispositivos ligados → Ligar dispositivo**.

A sessão fica em `data/auth/` (ou em `PICKLEBRAIN_DATA_DIR/auth`). Não partilhes essa
pasta: é o acesso à tua conta.

**Verificação:** o terminal diz que está ligado e o telemóvel mostra o dispositivo ligado.
Escreve `!claw` no grupo e responde com o estado.

Outras formas de o arrancar:

| Comando | O que arranca |
| --- | --- |
| `npm start` | Tudo: WhatsApp, painel web e lembretes |
| `npm run web` | Só o painel web e a API, sem WhatsApp |
| `npm run sim` | Simulador no terminal, sem WhatsApp nem QR |

---

## Ligar o teu grupo

Dentro do grupo, escreve:

```
!claw aqui
```

Isso guarda o **identificador** do grupo (nunca o nome, porque se repete e qualquer pessoa
o muda). Também podes pôr `WHATSAPP_GROUP_JID` no `.env`.

Se o bot ficar calado, quase sempre é o normal: só fala quando alguém pergunta pelos
trabalhos ou exames, ou quando se escreve `Claw` e uma pergunta.

---

## Opcional: voz e imagens (serviço de Python)

Sem este serviço o bot continua a funcionar: a voz usa ffmpeg e Whisper dentro do Node, e
as imagens usam o `sd-cli`. Com ele tens `faster-whisper` (mais rápido) e `diffusers`
(melhores imagens). **Se só queres que responda aos trabalhos, salta para
[Verificar que está tudo bem](#verificar-que-está-tudo-bem).**

**1. Criar o ambiente virtual** (na raiz do projeto):

```bash
python3.12 -m venv .venv      # Linux e macOS
py -3.12 -m venv .venv        # Windows
```

Se não tiveres Python 3.12: `sudo apt install python3.12 python3.12-venv` (Debian e Ubuntu)
ou `brew install python@3.12` (macOS).

**2. Instalar as dependências:**

```bash
.venv/bin/pip install -r python/requirements.txt                  # Linux e macOS
.venv\Scripts\pip.exe install -r python\requirements.txt          # Windows
```

**3. Arrancá-lo noutro terminal** e deixá-lo aberto enquanto o bot funciona:

```bash
.venv/bin/python python/server.py                 # Linux e macOS
.venv\Scripts\python.exe python\server.py         # Windows
```

Atalhos, se o `python` estiver no `PATH`: `npm run ia` (Windows e macOS) ou `npm run ia:linux`.

**Verificação:** isto devolve `"ok": true` com o estado de `voice` e `images`:

```bash
curl http://127.0.0.1:5050/health
```

O bot deteta o serviço sozinho ao arrancar e diz-te que motor de voz está a usar. Os
modelos descarregam-se no primeiro uso: cerca de 150 MB o do Whisper e cerca de 4 GB o das
imagens, guardados em `data/models/`.

Variáveis úteis:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

Com uma GPU de 4 GB, deixa `PYTHON_IMAGE_UNLOAD=true` para o Ollama recuperar a VRAM
depois de cada imagem.

---

## Opcional: gerar imagens

As imagens vêm desligadas porque em GPUs pequenas são lentas. Para as ligar, põe no `.env`:

```dotenv
IMAGE_GEN_ENABLED=true
```

e instala as dependências extra no mesmo ambiente:

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

Sem GPU NVIDIA, instala primeiro a versão de CPU do torch:

```bash
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
```

As imagens pedem-se à mão com `!claw imagen <o que quiseres>`.

---

## Verificar que está tudo bem

| Comando | O que verifica | Precisa do Ollama? |
| --- | --- | --- |
| `npm run doctor` | Ollama, modelos, base de dados, voz, disco | Sim |
| `npm test` | Toda a bateria de testes | Sim |
| `npm run test:python` | O contrato Node ↔ serviço de Python | Não |
| `npm run test:web` | Acessos e API | Não |
| `npm run test:subjects` | Deteção de disciplinas | Não |
| `npm run test:vetados` | Bloquear por número e por `@lid` | Não |
| `npm run test:i18n` | Os 100 idiomas | Não |

Se o `doctor` sair a verde, está feito. Para o experimentar sem WhatsApp:

```bash
npm run sim
```

```
que trabalhos há de matemática?
Ana: páginas 30 a 32
que trabalhos há de matemática?
o exame de história é a 20 de outubro
Claw, quanto é 2+2?
```

---

## Instalar com Homebrew (macOS e Linux)

Há um tap com uma fórmula que instala os comandos `claw` e `claw-ia`:

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 e seguintes
brew install claw
claw
```

O primeiro arranque descarrega as dependências de Node para `~/.local/share/claw` e guarda
os dados em `~/.local/share/claw/data`. Se preferires a tua pasta:

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

Para o serviço de voz e imagens:

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"  # só imagens
claw-ia
```

> O tap está em `Uyruw3/homebrew-claw` porque a organização do projeto não permite criar
> repositórios a partir dessa conta. Se passar para `ClawProject`, o comando será
> `brew tap ClawProject/claw`.

---

## Atualizar

```bash
git pull
npm install
```

Se os `python/requirements*.txt` também mudaram:

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

Reinicia o Node e o serviço de Python. Com Homebrew: `brew update && brew upgrade claw`.

---

## Problemas e soluções

| O que vês | O que fazer |
| --- | --- |
| O `npm start` não encontra o Ollama | Abre a aplicação do Ollama ou corre `ollama serve`, e verifica `curl http://127.0.0.1:11434/api/tags` |
| Não aparece o código QR | Escolhe primeiro o idioma em `http://localhost:3000/setup` |
| O bot não diz nada no grupo | `!claw aqui` dentro do grupo e depois `!claw`; com `LOG_LEVEL=debug` vês porque é que cada mensagem é descartada |
| As notas de voz não funcionam | Arranca `python/server.py` e corre `npm run doctor`; sem Python, instala ffmpeg e reabre o terminal |
| `faster-whisper` falha com `metadata_errors` | `.venv/bin/pip install 'av<19'` |
| O CUDA não carrega (`libcublas.so.12`) | O Whisper passa para CPU sozinho; para usar a GPU, instala o runtime de CUDA e um torch com CUDA |
| A primeira imagem demora imenso | Está a descarregar o modelo de diffusers (~4 GB); as seguintes são rápidas |
| O site não envia códigos de acesso | Preenche `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASSWORD`; testa com `npm run smtp -- o-teu-email@alu.edu.gva.es` |
| O PowerShell bloqueia o `npm.ps1` | Usa `npm.cmd`, ou `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` num terminal novo |
| O `ollama pull` fica sem espaço | Os modelos ocupam ~5 GB; liberta espaço ou usa um modelo mais pequeno |

Se continuas encravado, corre `npm run doctor` e cola o que sair:

```bash
npm run doctor > doctor.txt
```

---

## Como fica a pasta

```
TheClawRepo/
├─ src/                 código do bot (Node)
├─ python/              serviço de voz e imagens
├─ docs/                site e documentação
├─ sdserver/            motor opcional stable-diffusion.cpp
├─ data/                sessão, base de dados, fotos e modelos (fora do Git)
├─ .env                 a tua configuração (fora do Git)
├─ package.json
└─ arrancar.bat         arranque com duplo clique no Windows
```
