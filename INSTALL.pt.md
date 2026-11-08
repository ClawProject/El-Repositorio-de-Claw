# Instalar o Claw

[English](INSTALL.md) · [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · **Português** · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

O Claw é composto por dois processos:

1. **Node.js** (obrigatório): o bot de WhatsApp, a interface web, a base de dados e a lógica.
2. **Python** (opcional, recomendado): transcreve notas de voz com faster-whisper e
   gera imagens com diffusers. Se não estiver a correr, o Node usa os seus
   motores antigos.

Este guia cobre Linux, macOS e Windows. Para informação geral sobre o bot,
consulta o [README](README.pt.md); para o serviço de Python, [`python/README.md`](python/README.md).

---

## 1. Requisitos

| Componente | Versão | Para quê |
|---|---|---|
| Git | Qualquer versão recente | Descarregar e atualizar o projeto |
| Node.js | 22 ou superior (recomenda-se 24 LTS) | Bot, interface web e base de dados |
| Ollama | Versão recente | IA de texto local |
| Python | 3.11 ou 3.12 | Serviço de voz e imagens (opcional) |
| ffmpeg | Versão recente | Alternativa de voz sem Python (opcional) |

A IA de texto precisa de descarregar modelos do Ollama. Com uma GTX 1650 de 4 GB,
`qwen3:4b` e `qwen2.5:3b` funcionam; com mais memória podes usar modelos maiores.

---

## 2. Descarregar o projeto (`git clone`)

### Linux e macOS

```bash
git clone https://github.com/ClawProject/El-Repositorio-de-Claw.git
cd El-Repositorio-de-Claw
```

### Windows (PowerShell)

```powershell
git clone https://github.com/ClawProject/El-Repositorio-de-Claw.git
cd El-Repositorio-de-Claw
```

> Se já o descarregaste, atualiza-o com `git pull` dentro da pasta. Não descarregues
> um ZIP: perdes o histórico e a possibilidade de atualizar.

---

## 3. Instalar o Node.js

### Linux e macOS com nvm (recomendado)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# fecha e volta a abrir o terminal, ou executa:
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

nvm install 22
nvm alias default 22
node --version       # deve mostrar v22.x ou superior
npm --version
```

### macOS com Homebrew

```bash
brew install node
```

### Windows

Descarrega o instalador LTS de [nodejs.org](https://nodejs.org/) ou usa:

```powershell
winget install OpenJS.NodeJS.LTS
```

Fecha e volta a abrir o PowerShell para atualizar o `PATH`.

---

## 4. Instalar o Ollama e os modelos

### Linux e macOS

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Ou com Homebrew:

```bash
brew install ollama
brew services start ollama
```

### Windows

```powershell
winget install Ollama.Ollama
```

Depois, em qualquer terminal:

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

Verifica se responde:

```bash
ollama list
curl http://127.0.0.1:11434/api/tags
```

---

## 5. Instalar as dependências do Node

A partir da raiz do projeto:

```bash
npm install
```

No Windows, se o PowerShell se queixar de `npm.ps1`, usa `npm.cmd install`.

Também podes fazer duplo clique em **`arrancar.bat`** (Windows): instala as
dependências que faltam, cria o `.env` se não existir e arranca o bot.

---

## 6. Configurar o `.env`

Copia o modelo e edita-o:

```bash
cp .env.example .env
```

No Windows:

```powershell
Copy-Item .env.example .env
notepad .env
```

Configuração mínima para começar:

```dotenv
OLLAMA_MODEL=qwen3:4b
OLLAMA_MODEL_BRAIN=qwen2.5:3b
# Identificador do grupo (ou escreve "!claw aqui" dentro do grupo)
WHATSAPP_GROUP_JID=120363000000000000@g.us
```

- Podes ligar o grupo mais tarde escrevendo `!claw aqui` no WhatsApp; só é
  guardado o identificador, nunca o nome do grupo.
- Se usares `PICKLEBRAIN_DATA_DIR`, o ficheiro `.env` pode ficar dentro dessa
  pasta de dados.
- Quase tudo pode ser alterado com o bot a correr a partir de `!claw ajustes`;
  reinicia depois de editar o `.env` à mão.
- **Não envies o `.env` para o Git**: contém endereços de email, palavras-passe e o teu número de telefone.
  Já está incluído no `.gitignore`.

Todas as variáveis estão documentadas em [`.env.example`](.env.example) e no
[README](README.pt.md).

---

## 7. Serviço de voz e imagens com Python (opcional, recomendado)

Sem este serviço o Claw continua a funcionar: a voz usa ffmpeg + Whisper em Node e
as imagens usam `sd-cli` ou um servidor HTTP. Com Python obténs
`faster-whisper` (mais rápido) e `diffusers`.

### 7.1 Criar o ambiente virtual

A partir da raiz do projeto:

```bash
python3.12 -m venv .venv
```

Se o teu sistema não tiver `python3.12`, instala-o:

```bash
# Debian/Ubuntu
sudo apt install python3.12 python3.12-venv

# macOS com Homebrew
brew install python@3.12
```

No Windows:

```powershell
py -3.12 -m venv .venv
```

### 7.2 Instalar dependências

```bash
# Linux/macOS
.venv/bin/pip install -r python/requirements.txt

# Windows
.venv\Scripts\pip.exe install -r python/requirements.txt
```

Só se quiseres gerar imagens com diffusers:

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

> Sem GPU NVIDIA, instala primeiro a versão CPU do torch:
>
> ```bash
> .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
> ```
>
> Com GPU NVIDIA, o torch tem de ser a versão CUDA. Se o Whisper detetar CUDA mas
> faltarem `libcublas`/cuDNN, o serviço passa automaticamente para CPU.

### 7.3 Arrancar o serviço

Noutro **terminal**, a partir da raiz do projeto:

```bash
# Linux/macOS
.venv/bin/python python/server.py

# Windows
.venv\Scripts\python.exe python\server.py
```

Também podes usar:

```bash
npm run ia          # Windows/macOS se "python" estiver no PATH
npm run ia:linux    # Linux
```

Verifica se responde:

```bash
curl http://127.0.0.1:5050/health
```

Deve devolver `"ok": true` e o estado de `voice` e `images`. O bot deteta-o
automaticamente ao arrancar e mostra que motor de voz está a usar.

### 7.4 Modelos

A primeira transcrição descarrega o modelo Whisper (~150 MB com `base`). A
primeira imagem descarrega o modelo diffusers (cerca de 4 GB com SD 1.5). Ficam
em `data/models/`, que o Git ignora.

Variáveis úteis:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

Com uma GPU de 4 GB, deixa `PYTHON_IMAGE_UNLOAD=true` para que o Ollama recupere
a VRAM depois de cada imagem.

---

## 8. Arrancar o Claw

```bash
npm start       # bot completo: WhatsApp + web + lembretes
npm run web     # só web/API, sem ligar ao WhatsApp
npm run sim     # simulador de consola, sem WhatsApp
```

Na primeira vez, o Claw abre o navegador em `http://localhost:3000/setup` para
escolher o idioma (há 100). A escolha fica na base de dados e o bot não se liga ao
WhatsApp até escolheres um. Podes mudá-lo depois pelo WhatsApp com
`!claw language en` (dono/administradores) ou voltando a `/setup`.

Depois, `npm start` mostra um **código QR**. Lê-o no WhatsApp:

**Definições → Dispositivos associados → Associar um dispositivo**

A sessão fica guardada em `data/auth/` (ou em `PICKLEBRAIN_DATA_DIR/auth`). Não
partilhes essa pasta: dá acesso à tua conta.

---

## 9. Verificar a instalação

```bash
npm run doctor      # Ollama, modelos, base de dados, voz, etc.
npm run test:python # contrato entre Node e o serviço de Python (sem modelos)
npm run test:web    # autenticação e API
npm run test:subjects
npm run test:i18n   # idiomas e traduções (sem Ollama)
npm run test:vetados # bloquear por número e por @lid (sem Ollama)
```

O `npm test` executa a bateria completa e **precisa do Ollama a correr**.

Teste rápido no simulador:

```bash
npm run sim
```

```
pessoal, que trabalhos de matemática há?
Ana: temos de fazer as páginas 30 a 32
que trabalhos de matemática há?
o teste de história é a 20 de outubro
Claw, quanto é 2+2?
```

---

## 10. Instalação com Homebrew (macOS e Linux)

Existe um tap com uma fórmula para instalar os comandos `claw` e `claw-ia`:

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 e seguintes
brew install claw
```

A primeira execução descarrega as dependências do Node para
`~/.local/share/claw` e guarda os dados em `~/.local/share/claw/data`.

```bash
claw
```

Se preferires gerir tu a pasta:

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

Para o serviço de voz e imagens com Python:

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"

# Só se quiseres gerar imagens:
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"

claw-ia
```

Para atualizar:

```bash
brew update
brew upgrade claw
```

> O tap está em `Uyruw3/homebrew-claw` porque a organização do projeto
> não permite criar repositórios a partir desta conta. Pode ser transferido para
> `ClawProject` mais tarde; o comando seria então `brew tap ClawProject/claw`.
>
> A fórmula instala a última versão estável publicada. Quando sair uma nova,
> o tap é atualizado com `brew update && brew upgrade claw`.

---

## 11. Atualizar o projeto

Se o instalaste com `git clone`:

```bash
git pull
npm install
```

Se os `python/requirements*.txt` também mudaram:

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

Reinicia o Node e o serviço de Python depois de atualizar.

---

## 12. Problemas frequentes

**O `npm start` não encontra o Ollama.**
Abre a aplicação Ollama ou executa `ollama serve`. Verifica com
`curl http://127.0.0.1:11434/api/tags`.

**O bot não diz nada no grupo.**
1. Verifica se está ligado: escreve `!claw aqui` dentro do grupo ou define
   `WHATSAPP_GROUP_JID`.
2. Escreve `!claw` para ver o estado.
3. Arranca com `LOG_LEVEL=debug` para ver porque é descartada cada mensagem.

**As notas de voz não funcionam.**
Arranca `python/server.py` e verifica `npm run doctor`. Se não usares Python, instala
o ffmpeg e volta a abrir o terminal.

**O `faster-whisper` falha com `metadata_errors`.**
Tens `av` 19. Fixa a versão:

```bash
.venv/bin/pip install 'av<19'
```

**O CUDA não carrega (`libcublas.so.12`).**
O Whisper passa automaticamente para CPU. Se quiseres usar a GPU, instala o runtime
CUDA e uma versão de torch com CUDA. Entretanto, a voz funciona em CPU.

**A primeira imagem demora muito.**
Está a descarregar o modelo diffusers (~4 GB). As seguintes demoram apenas o
tempo da geração.

**A web não envia códigos de acesso.**
Configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASSWORD` no `.env`.
Testa com `npm run smtp -- o-teu-email@alu.edu.gva.es`.

**O PowerShell bloqueia o `npm.ps1`.**
Usa `npm.cmd` ou executa
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` e abre outro terminal.

---

## 13. Estrutura mínima instalada

```
El-Repositorio-de-Claw/
├─ src/                 código do bot (Node)
├─ python/              serviço de voz e imagens
├─ docs/                site estático e documentação
├─ sdserver/            motor opcional stable-diffusion.cpp
├─ data/                sessão, base de dados, fotos e modelos (não rastreado pelo Git)
├─ .env                 a tua configuração (não rastreada pelo Git)
├─ package.json
└─ arrancar.bat         script de arranque para Windows
```
