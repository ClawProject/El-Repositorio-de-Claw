<p align="center">
  <img src="assets/logo.png" width="128" height="128" alt="Claw logo">
</p>

<h1 align="center">Claw</h1>

<p align="center">
  <a href="https://github.com/ClawProject/TheClawRepo/releases"><img src="https://img.shields.io/github/v/tag/ClawProject/TheClawRepo?label=release&color=f59e0b" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white" alt="Node.js 22 or newer">
  <img src="https://img.shields.io/badge/platforms-Windows%20%7C%20Linux%20%7C%20macOS-4B5563" alt="Windows, Linux and macOS">
  <img src="https://img.shields.io/badge/AI-local%20with%20Ollama-111827" alt="Local AI with Ollama">
  <img src="https://img.shields.io/badge/voice-Whisper-7c3aed" alt="Voice with Whisper">
  <a href="https://discord.gg/DwbMbEqQ6E"><img src="https://img.shields.io/badge/Discord-join%20the%20server-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://github.com/ClawProject/TheClawRepo/stargazers"><img src="https://img.shields.io/github/stars/ClawProject/TheClawRepo" alt="GitHub stars"></a>
  <a href="https://hub.xerj.org/contributors/ClawProject"><img src="https://hub.xerj.org/contributors/ClawProject/badge.svg" alt="XERJ Corpus Hub contributor"></a>
</p>

<p align="center"><strong>Um bot de WhatsApp autoalojado com IA local.</strong></p>

<p align="center">[English](README.md) · [Español](README.es.md) · [Català](README.ca.md) · [Français](README.fr.md) · **Português** · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [中文](README.zh.md)</p>

O Claw é um assistente de WhatsApp com IA local pensado para acompanhar os trabalhos de casa, os testes, os avisos da escola e a informação importante partilhada nos grupos.

Funciona em silêncio em segundo plano, entende mensagens de texto, notas de voz e imagens relevantes, e responde às perguntas quando alguém precisa de informação.

> **Instalação:** consulta [INSTALL.pt.md](INSTALL.pt.md) para instruções detalhadas em Linux, macOS e Windows.
>
> **Documentação técnica:** [Arquitetura, API e segurança](docs/arquitectura.md).

---

## ✨ Funcionalidades

- **Registo automático dos trabalhos:** deteta e anota os trabalhos e os próximos testes a partir das conversas do grupo.
- **Funcionamento silencioso:** o Claw só fala quando alguém pergunta ou o ativa explicitamente.
- **Assistente de IA de uso geral:** menciona `Claw` seguido de uma pergunta para usar as suas capacidades gerais de IA.
- **Reconhecimento de voz:** transcreve as notas de voz localmente com Whisper.
- **Armazenamento de imagens:** guarda as imagens relacionadas com trabalhos e testes e elimina automaticamente os ficheiros expirados.
- **Processamento de IA local:** usa Ollama para executar os modelos de linguagem no teu computador.
- **Escolha de idioma no primeiro arranque:** no primeiro início, o Claw abre uma página web para escolher entre 100 idiomas. A escolha fica guardada na base de dados, é aplicada à interface e às respostas da IA, e pode ser alterada depois com `!claw language en`.
- **Interface web:** dá aos alunos acesso autenticado à informação escolar partilhada.
- **Integração com o calendário:** exporta os próximos testes como ficheiros `.ics`.
- **Xadrez:** joga xadrez contra o Claw ou analisa posições.
- **Geração de imagens opcional:** gera imagens localmente com Stable Diffusion.
- **Manutenção automática:** gere os ficheiros multimédia guardados e pode impedir que o computador anfitrião entre em suspensão.

### 🔒 Privacidade

O Claw foi desenhado em torno do processamento local.

A inferência de IA, a classificação e a base de dados correm no teu computador.

Ainda assim, algumas ligações externas continuam a ser necessárias:

- WhatsApp: entrega e receção de mensagens.
- Ollama e Whisper: descarregamento de modelos.
- DuckDuckGo: pesquisas web opcionais.

As pesquisas web podem ser desativadas com `WEB_SEARCH=false` ou com `!claw ajustes buscar no`.

Consulta a [documentação de privacidade](docs/arquitectura.md#datos-y-privacidad) para mais informação.

---

## 🧠 Como funciona

O Claw analisa as mensagens que chegam ao grupo e decide o que fazer.

```text
Mensagem recebida do grupo
        |
        +-- Contém "Claw"?
        |       |
        |       +-- Assistente de IA geral
        |
        +-- É uma pergunta sobre trabalhos ou testes?
        |       |
        |       +-- Responde diretamente a partir da base de dados
        |
        +-- Pode conter informação escolar?
                |
                +-- Classificação com IA local
                        |
                        +-- Pergunta detetada
                        |       |
                        |       +-- Abre uma pergunta pendente de 15 minutos
                        |
                        +-- Informação detetada
                                |
                                +-- Guarda em silêncio na base de dados
```

### Perguntas pendentes

Uma das principais funcionalidades do Claw é o sistema de perguntas pendentes.

Por exemplo:

1. Um aluno pergunta: «Quais são os trabalhos de inglês?»
2. O Claw abre uma pergunta pendente de 15 minutos.
3. Outro aluno responde: «Fazer a página 12.»
4. O Claw guarda a informação automaticamente.
5. Qualquer pessoa pode depois perguntar ao Claw pelos trabalhos de inglês.

As correções substituem as entradas anteriores, por isso a informação desatualizada não fica na base de dados.

O Claw também entende o contexto da conversa a partir das mensagens recentes do mesmo chat, sem misturar conversas.

### 🎙️ Notas de voz

O Claw entende as notas de voz com Whisper.

- O áudio é transcrito localmente.
- O serviço de Python usa faster-whisper.
- Existe um modo alternativo em Node.js.
- Reconhece outras pronúncias do nome, como «Clau» e «Clao».
- O áudio nunca precisa de sair do teu computador para ser transcrito.

### 🖼️ Imagens

O Claw pode guardar imagens relacionadas com trabalhos e testes.

- As imagens escolares relevantes são guardadas.
- Memes e imagens sem relação são ignorados.
- Os ficheiros expirados são eliminados automaticamente.
- As imagens podem ser reenviadas quando alguém pergunta por um teste.

---

## 🚀 Instalação

Para as instruções completas, consulta **[INSTALL.pt.md](INSTALL.pt.md)**.

### Requisitos

| Dependência       | Versão / modelo                        |
| ----------------- | -------------------------------------- |
| Node.js           | 24 LTS                                 |
| Git               | Última versão                          |
| Ollama            | Última versão                          |
| Modelo principal  | `qwen3:4b`                             |
| Modelo de reserva | `qwen2.5:3b`                           |
| Python            | 3.11 / 3.12 (recomendado)              |
| FFmpeg            | Opcional, para a voz em modo antigo    |

Descarrega os modelos:

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

### Clonar o repositório

```bash
git clone <REPOSITORY_URL>
cd Claw
```

Instala as dependências:

```bash
npm install
```

Em alternativa, no Windows podes executar:

```powershell
.\arrancar.bat
```

Esse script instala as dependências que faltam, cria a configuração de ambiente e arranca o bot.

### Serviço de Python opcional

O serviço de Python melhora o processamento de voz e permite gerar imagens localmente.

Cria um ambiente virtual:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

Instala as dependências:

```bash
pip install -r python/requirements.txt
pip install -r python/requirements-images.txt
```

Arranca o serviço:

```bash
python python/server.py
```

Verifica o estado:

```bash
curl http://127.0.0.1:5050/health
```

Consulta [python/README.md](python/README.md) para mais informação.

---

## 🧪 Testes

O Claw inclui várias ferramentas para verificar se a instalação está a funcionar.

```bash
npm run doctor
npm run sim
npm test
```

| Comando                 | Descrição                                               |
| ----------------------- | ------------------------------------------------------- |
| `npm run doctor`        | Verifica Ollama, os modelos, a base e o classificador.   |
| `npm run sim`           | Arranca um simulador de mensagens sem WhatsApp.         |
| `npm test`              | Executa os testes de integração.                        |
| `npm run test:ai`       | Testa as funcionalidades de IA.                         |
| `npm run test:subjects` | Testa o reconhecimento de disciplinas sem Ollama.       |
| `npm run test:python`   | Testa a interface Node.js ↔ Python.                     |
| `npm run test:voice`    | Testa a transcrição com áudio local.                    |

### Exemplo de simulação

```text
Aluno: Quais são os trabalhos de matemática?
Claw: À espera de uma resposta...

Ana: Fazer as páginas 30 a 32.

Aluno: Quais são os trabalhos de matemática?
Claw: Fazer as páginas 30 a 32.

Aluno: O teste de história é a 20 de outubro.

Aluno: Claw, quanto é 2 + 2?
Claw: 4.
```

---

## 📱 Ligar o WhatsApp

Arranca o Claw:

```bash
npm start
```

Lê o código QR a partir de:

**WhatsApp → Definições → Dispositivos associados → Associar um dispositivo**

A tua sessão de autenticação fica guardada em:

```text
data/auth/
```

**Nunca partilhes esta pasta nem o seu conteúdo.**

### Ativar o Claw num grupo

Há duas formas de ligar um grupo:

**Ativação manual:**

```text
!claw aqui
```

**Ativação automática:**

Indica o identificador interno do grupo no `.env`:

```env
WHATSAPP_GROUP_JID=your-group-id@g.us
```

O Claw identifica os grupos pelo identificador interno, não pelo nome.

---

## 💬 Comandos

Todos os comandos começam por `!claw`. Também é aceite o alias antigo `!pickle`.

### Comandos gerais

| Comando                      | Descrição                                     |
| ---------------------------- | --------------------------------------------- |
| `!claw`                      | Mostra o estado do bot.                       |
| `!claw ayuda`                | Mostra os comandos disponíveis.               |
| `!claw deberes [disciplina]` | Mostra os trabalhos pendentes.                |
| `!claw examenes`             | Mostra os próximos testes.                    |
| `!claw apuntes`              | Mostra a informação guardada.                 |
| `!claw proximo`              | Mostra o próximo teste ou trabalho.           |
| `!claw apunta ...`           | Adiciona ou corrige um trabalho.              |
| `!claw hecho ...`            | Marca um trabalho como feito.                 |
| `!claw resumen [hoy/semana]` | Resume a informação recente.                  |
| `!claw calendario`           | Exporta os testes como ficheiro ICS.          |
| `!claw busca ...`            | Pesquisa na web.                              |
| `!claw imagen ...`           | Gera uma imagem (experimental).               |
| `!claw ajedrez [jogada]`     | Joga xadrez contra o Claw.                    |
| `!claw personalidad`         | Ver ou mudar a personalidade do Claw.         |
| `!claw analiza [FEN]`        | Analisa uma posição de xadrez.                |
| `!claw novedades`            | Mostra as alterações recentes.                |

### Comandos do dono e dos administradores

| Comando                      | Descrição                                  |
| ---------------------------- | ------------------------------------------ |
| `!claw aqui` / `!claw fuera` | Liga ou desliga um grupo.                  |
| `!claw ajustes`              | Consulta e altera as definições.           |
| `!claw ia`                   | Consulta ou altera o modelo de IA.         |
| `!claw prohibir [número]`    | Bloqueia um utilizador.                    |
| `!claw permitir [número]`    | Desbloqueia um utilizador.                 |
| `!claw vetados`              | Lista os utilizadores bloqueados.          |
| `!claw mantenimiento si/no`  | Ativa ou desativa o modo manutenção.       |
| `!claw olvida ...`           | Apaga informação guardada.                 |
| `!claw admins`               | Gere os administradores (só o dono).       |

O dono do bot é a conta de WhatsApp que executa o Claw ou `WHATSAPP_OWNER_JID`.

Só o dono e os administradores autorizados podem alterar definições administrativas.

---

## 🌐 Interface web

O Claw inclui uma interface web e uma API integradas.

Arranca apenas o servidor web:

```bash
npm run web
```

Arranca tudo:

```bash
npm start
```

A interface web é servida pelo próprio servidor do Claw:

- `/` — Página principal.
- `/entrar/` — Acesso para alunos.

### Autenticação dos alunos

O acesso exige um código de verificação de uso único enviado por email.

Regras atuais de autenticação:

- Só são aceites endereços `@alu.edu.gva.es`.
- Os alunos registam nome, apelidos, curso e grupo.
- Os códigos expiram ao fim de 10 minutos.
- São permitidas no máximo cinco tentativas de verificação.
- As sessões expiram ao fim de oito horas ou quando o servidor reinicia.
- Os alunos autenticados partilham os mesmos registos de trabalhos e testes.

### Acesso a partir da rede

O Claw serve a própria página web em `http://127.0.0.1:3000`, por isso não é preciso nenhum túnel. Se a publicares noutro domínio (um proxy inverso com HTTPS, por exemplo), adiciona-o a `WEB_ALLOWED_ORIGINS` separado por vírgulas.

São necessárias credenciais SMTP para a verificação por email.

**Aviso de segurança:** a função de acesso de depuração deve ser configurada com cuidado. Nunca deixes um código de depuração predefinido ativo num servidor acessível pela internet.

Consulta a [documentação de arquitetura e segurança](docs/arquitectura.md).

---

## ⚙️ Configuração

Copia a configuração de exemplo:

```bash
cp .env.example .env
```

O ficheiro `.env` contém as principais opções.

### Configuração de IA

| Variável                | Valor predefinido |
| ----------------------- | ----------------- |
| `OLLAMA_MODEL`          | `qwen3:4b`        |
| `OLLAMA_MODEL_FALLBACK` | `qwen2.5:3b`      |
| `OLLAMA_MODEL_BRAIN`    | `qwen2.5:3b`      |
| `WEB_SEARCH`            | `true`            |
| `CLAW_TRIGGER`          | `claw`            |
| `CLAW_SIGNATURE`        | `true`            |

### Configuração do WhatsApp

| Variável                | Valor predefinido |
| ----------------------- | ----------------- |
| `WHATSAPP_GROUP_JID`    | Vazio             |
| `WHATSAPP_OWNER_JID`    | Conta do bot      |
| `PRIVATE_MODE`          | `dueno`           |
| `APUNTA_LIBRE`          | `true`            |
| `ANSWER_WINDOW_MINUTES` | `15`              |
| `ACK_SAVES`             | `false`           |

### Configuração de multimédia

| Variável               | Valor predefinido |
| ---------------------- | ----------------- |
| `MEDIA_ENABLED`        | `true`            |
| `MEDIA_MODE`           | `contexto`        |
| `MEDIA_MAX_MB`         | `12`              |
| `MEDIA_MAX_TOTAL_MB`   | `2048`            |
| `MEDIA_RETENTION_DAYS` | `14`              |

### Configuração de voz

| Variável                 | Valor predefinido     |
| ------------------------ | --------------------- |
| `TRANSCRIBE_ENABLED`     | `true`                |
| `TRANSCRIBE_MODE`        | `todo`                |
| `TRANSCRIBE_MAX_SECONDS` | `180`                 |
| `WHISPER_MODEL`          | `Xenova/whisper-base` |

### Configuração da IA em Python

| Variável                | Valor predefinido                             |
| ----------------------- | --------------------------------------------- |
| `PYTHON_AI_ENABLED`     | `true`                                        |
| `PYTHON_AI_URL`         | `http://127.0.0.1:5050`                       |
| `PYTHON_WHISPER_MODEL`  | `base`                                        |
| `PYTHON_WHISPER_DEVICE` | `auto`                                        |
| `PYTHON_IMAGE_MODEL`    | `stable-diffusion-v1-5/stable-diffusion-v1-5` |

Quase todas as definições de execução também podem ser alteradas com `!claw ajustes`.

Para a referência completa, consulta `.env.example` e [INSTALL.pt.md](INSTALL.pt.md).

---

## 🎨 Geração de imagens local (experimental)

O Claw suporta opcionalmente a geração de imagens local.

Motores disponíveis:

- **Python + Diffusers:** suporta muitos modelos através do Hugging Face.
- **stable-diffusion.cpp:** geração leve por linha de comandos.
- **Backend HTTP:** servidores de geração de imagens compatíveis.

A geração de imagens está desativada por predefinição.

Ativa-a com:

```text
!claw ajustes imagenes si
```

Gera uma imagem:

```text
!claw imagen a futuristic city at night
```

O Claw nunca gera imagens automaticamente.

Em equipamentos com pouca memória de GPU, a geração de imagens pode descarregar temporariamente o modelo do Ollama para libertar VRAM.

---

## 📁 Estrutura do projeto

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

## ❓ Perguntas frequentes

**O Claw precisa de ligação à internet?**

O WhatsApp e os serviços externos opcionais precisam de ligação. A inferência de IA local e a base de dados funcionam no teu computador.

**Posso usar o Claw com o telemóvel desligado?**

Sim, desde que o computador que o aloja continue ligado e a sessão de dispositivo associado do WhatsApp continue válida.

**O que acontece se o computador se desligar?**

O Claw deixa de funcionar, mas a informação guardada mantém-se em `data/picklebrain.db`.

**O WhatsApp pode bloquear o meu número?**

Há risco real. O Claw usa Baileys, uma biblioteca não oficial do WhatsApp Web. Os termos do WhatsApp limitam a automatização não autorizada. Recomenda-se usar um número à parte.

**O Claw consome muitos recursos?**

Depende dos modelos e do hardware. As perguntas habituais são respondidas diretamente a partir da base de dados, sem executar um modelo.

**Guarda todas as imagens?**

Não. Por predefinição só guarda as imagens relevantes para a escola, e os ficheiros antigos são eliminados automaticamente.

**Porque é que o Claw não responde?**

1. Verifica se o grupo está ligado.
2. Escreve `!claw` para ver o estado.
3. Executa `npm run doctor`.
4. Ativa `LOG_LEVEL=debug` para ver como processa as mensagens.

**Porque é que o reconhecimento de voz não funciona?**

Verifica se o serviço de Python está a correr ou instala o FFmpeg para o motor de transcrição antigo do Node.js.

---

## ⚠️ Limitações e melhorias futuras

- O APK complementar para Android não está neste repositório. A API espera que o anexo da última release se chame `ClawCompanion.apk`.
- Modelos de linguagem maiores melhoram a conversa quando há hardware suficiente.
- Modelos de Whisper maiores melhoram o reconhecimento de nomes e de gravações com ruído.
- A geração de imagens é experimental e depende do hardware e da compatibilidade dos modelos.

---

## 📚 Documentação

- [Guia de instalação](INSTALL.pt.md)
- [Arquitetura técnica](docs/arquitectura.md)
- [Documentação do serviço de Python](python/README.md)
- [Configuração de ambiente](.env.example)
- [Comunidade do Discord](https://discord.gg/DwbMbEqQ6E)

---

**Claw — O teu assistente de IA local para a vida escolar.** 🪝
