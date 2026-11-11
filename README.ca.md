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

<p align="center"><strong>Un bot de WhatsApp autoallotjat amb IA local.</strong></p>

<p align="center">[English](README.md) · [Español](README.es.md) · **Català** · [Français](README.fr.md) · [Português](README.pt.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [中文](README.zh.md)</p>

Claw és un assistent de WhatsApp amb IA local pensat per portar el control dels deures, els exàmens, els avisos de l'institut i la informació important que es comparteix als grups.

Funciona en silenci en segon pla, entén missatges de text, notes de veu i imatges rellevants, i respon les preguntes quan algú necessita informació.

> **Instal·lació:** consulta [INSTALL.ca.md](INSTALL.ca.md) per a les instruccions detallades a Linux, macOS i Windows.
>
> **Documentació tècnica:** [Arquitectura, API i seguretat](docs/arquitectura.md).

---

## ✨ Funcions

- **Seguiment automàtic de deures:** detecta i anota els deures i els propers exàmens a partir de les converses del grup.
- **Funcionament silenciós:** Claw només parla quan algú pregunta o l'activa explícitament.
- **Assistent d'IA de propòsit general:** menciona `Claw` seguit d'una pregunta per fer servir les seves capacitats generals d'IA.
- **Reconeixement de veu:** transcriu les notes de veu en local amb Whisper.
- **Emmagatzematge d'imatges:** guarda les imatges relacionades amb deures i exàmens i elimina automàticament els fitxers caducats.
- **Processament d'IA local:** fa servir Ollama per executar els models de llenguatge al teu ordinador.
- **Configuració d'idioma al primer arrencament:** al primer inici, Claw obre una pàgina web per triar entre 100 idiomes. L'elecció es guarda a la base de dades, s'aplica a la interfície i a les respostes de la IA, i es pot canviar després amb `!claw language en`.
- **Interfície web:** dona als estudiants accés autenticat a la informació escolar compartida.
- **Integració amb el calendari:** exporta els propers exàmens com a fitxers `.ics`.
- **Escacs:** juga als escacs contra Claw o analitza posicions.
- **Generació d'imatges opcional:** genera imatges en local amb Stable Diffusion.
- **Manteniment automàtic:** gestiona els fitxers multimèdia guardats i pot evitar que l'ordinador amfitrió se suspengui.

### 🔒 Privacitat

Claw està dissenyat al voltant del processament local.

La inferència d'IA, la classificació i la base de dades s'executen al teu ordinador.

Tot i això, algunes connexions externes continuen sent necessàries:

- WhatsApp: lliurament i recepció de missatges.
- Ollama i Whisper: descàrrega de models.
- DuckDuckGo: cerques web opcionals.

Les cerques web es poden desactivar amb `WEB_SEARCH=false` o amb `!claw ajustes buscar no`.

Consulta la [documentació de privacitat](docs/arquitectura.md#datos-y-privacidad) per a més informació.

---

## 🧠 Com funciona

Claw analitza els missatges que arriben al grup i decideix què fer.

```text
Missatge entrant del grup
        |
        +-- Conté "Claw"?
        |       |
        |       +-- Assistent d'IA general
        |
        +-- És una pregunta de deures o exàmens?
        |       |
        |       +-- Respon directament des de la base de dades
        |
        +-- Podria contenir informació escolar?
                |
                +-- Classificació amb IA local
                        |
                        +-- Pregunta detectada
                        |       |
                        |       +-- Obre una pregunta pendent de 15 minuts
                        |
                        +-- Informació detectada
                                |
                                +-- Guarda en silenci a la base de dades
```

### Preguntes pendents

Una de les funcions principals de Claw és el seu sistema de preguntes pendents.

Per exemple:

1. Un estudiant pregunta: «Quins són els deures d'anglès?»
2. Claw obre una pregunta pendent de 15 minuts.
3. Un altre estudiant respon: «Fer la pàgina 12.»
4. Claw guarda la informació automàticament.
5. Qualsevol pot preguntar després a Claw pels deures d'anglès.

Les correccions substitueixen les entrades anteriors, així que la informació desactualitzada no es queda a la base de dades.

Claw també entén el context de la conversa a partir dels missatges recents del mateix xat, sense barrejar converses.

### 🎙️ Notes de veu

Claw entén les notes de veu amb Whisper.

- L'àudio es transcriu en local.
- El servei de Python fa servir faster-whisper.
- Hi ha un mode alternatiu a Node.js.
- Reconeix altres pronunciacions del nom, com «Clau» i «Clao».
- L'àudio no ha de sortir mai del teu ordinador per transcriure's.

### 🖼️ Imatges

Claw pot guardar imatges relacionades amb deures i exàmens.

- S'emmagatzemen les imatges escolars rellevants.
- Els mems i les imatges sense relació s'ignoren.
- Els fitxers caducats s'eliminen automàticament.
- Les imatges es poden reenviar quan algú pregunta per un examen.

---

## 🚀 Instal·lació

Per a les instruccions completes, consulta **[INSTALL.ca.md](INSTALL.ca.md)**.

### Requisits

| Dependència        | Versió / model                        |
| ------------------ | ------------------------------------- |
| Node.js            | 24 LTS                                |
| Git                | Última versió                         |
| Ollama             | Última versió                         |
| Model principal    | `qwen3:4b`                            |
| Model alternatiu   | `qwen2.5:3b`                          |
| Python             | 3.11 / 3.12 (recomanat)               |
| FFmpeg             | Opcional, per a la veu en mode antic  |

Descarrega els models:

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

### Clonar el repositori

```bash
git clone <REPOSITORY_URL>
cd Claw
```

Instal·la les dependències:

```bash
npm install
```

Com a alternativa, a Windows pots executar:

```powershell
.\arrancar.bat
```

Aquest script instal·la les dependències que falten, crea la configuració d'entorn i arrenca el bot.

### Servei de Python opcional

El servei de Python aporta millor processament de veu i generació d'imatges en local.

Crea un entorn virtual:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

Instal·la les dependències:

```bash
pip install -r python/requirements.txt
pip install -r python/requirements-images.txt
```

Arrenca el servei:

```bash
python python/server.py
```

Comprova'n l'estat:

```bash
curl http://127.0.0.1:5050/health
```

Consulta [python/README.md](python/README.md) per a més informació.

---

## 🧪 Proves

Claw inclou diverses eines per verificar que la instal·lació funciona.

```bash
npm run doctor
npm run sim
npm test
```

| Comanda                 | Descripció                                              |
| ----------------------- | ------------------------------------------------------- |
| `npm run doctor`        | Comprova Ollama, els models, la base i el classificador. |
| `npm run sim`           | Arrenca un simulador de missatges sense WhatsApp.       |
| `npm test`              | Executa les proves d'integració.                        |
| `npm run test:ai`       | Prova les funcions d'IA.                                |
| `npm run test:subjects` | Prova el reconeixement d'assignatures sense Ollama.     |
| `npm run test:python`   | Prova la interfície Node.js ↔ Python.                   |
| `npm run test:voice`    | Prova la transcripció amb àudio local.                  |

### Exemple de simulació

```text
Estudiant: Quins són els deures de matemàtiques?
Claw: Esperant una resposta...

Ana: Fer les pàgines 30 a 32.

Estudiant: Quins són els deures de matemàtiques?
Claw: Fer les pàgines 30 a 32.

Estudiant: L'examen d'història és el 20 d'octubre.

Estudiant: Claw, quant és 2 + 2?
Claw: 4.
```

---

## 📱 Connectar WhatsApp

Arrenca Claw:

```bash
npm start
```

Escaneja el codi QR des de:

**WhatsApp → Configuració → Dispositius vinculats → Vincular un dispositiu**

La sessió d'autenticació es guarda a:

```text
data/auth/
```

**No comparteixis mai aquesta carpeta ni el seu contingut.**

### Activar Claw en un grup

Hi ha dues maneres de connectar un grup:

**Activació manual:**

```text
!claw aqui
```

**Activació automàtica:**

Indica l'identificador intern del grup a `.env`:

```env
WHATSAPP_GROUP_JID=your-group-id@g.us
```

Claw identifica els grups pel seu identificador intern, no pel nom.

---

## 💬 Comandes

Totes les comandes comencen per `!claw`. També s'admet l'àlies antic `!pickle`.

### Comandes generals

| Comanda                      | Descripció                                     |
| ---------------------------- | ---------------------------------------------- |
| `!claw`                      | Mostra l'estat del bot.                        |
| `!claw ayuda`                | Mostra les comandes disponibles.               |
| `!claw deberes [asignatura]` | Mostra els deures pendents.                    |
| `!claw examenes`             | Mostra els propers exàmens.                    |
| `!claw apuntes`              | Mostra la informació guardada.                 |
| `!claw proximo`              | Mostra el proper examen o treball.             |
| `!claw apunta ...`           | Afegeix o corregeix un treball.                |
| `!claw hecho ...`            | Marca un treball com a fet.                    |
| `!claw resumen [hoy/semana]` | Resumeix la informació recent.                 |
| `!claw calendario`           | Exporta els exàmens com a fitxer ICS.          |
| `!claw busca ...`            | Cerca a la web.                                |
| `!claw imagen ...`           | Genera una imatge (experimental).              |
| `!claw ajedrez [jugada]`     | Juga als escacs contra Claw.                   |
| `!claw analiza [FEN]`        | Analitza una posició d'escacs.                 |
| `!claw novedades`            | Mostra els canvis recents.                     |

### Comandes del propietari i dels administradors

| Comanda                      | Descripció                                 |
| ---------------------------- | ------------------------------------------ |
| `!claw aqui` / `!claw fuera` | Connecta o desconnecta un grup.            |
| `!claw ajustes`              | Consulta i canvia els ajustos.             |
| `!claw ia`                   | Consulta o canvia el model d'IA.           |
| `!claw prohibir [número]`    | Bloqueja un usuari.                        |
| `!claw permitir [número]`    | Desbloqueja un usuari.                     |
| `!claw vetados`              | Llista els usuaris bloquejats.             |
| `!claw mantenimiento si/no`  | Activa o desactiva el mode manteniment.    |
| `!claw olvida ...`           | Esborra informació guardada.               |
| `!claw admins`               | Gestiona els administradors (només amo).   |

El propietari del bot és el compte de WhatsApp que executa Claw o `WHATSAPP_OWNER_JID`.

Només el propietari i els administradors autoritzats poden canviar ajustos administratius.

---

## 🌐 Interfície web

Claw inclou una interfície web i una API integrades.

Arrenca només el servidor web:

```bash
npm run web
```

Arrenca-ho tot:

```bash
npm start
```

La interfície web la serveix el mateix servidor de Claw:

- `/` — Pàgina principal.
- `/entrar/` — Accés per a estudiants.

### Autenticació d'estudiants

L'accés requereix un codi de verificació d'un sol ús enviat per correu.

Regles actuals d'autenticació:

- Només s'accepten adreces `@alu.edu.gva.es`.
- Els estudiants registren nom, cognoms, curs i grup.
- Els codis caduquen als 10 minuts.
- Es permeten com a màxim cinc intents de verificació.
- Les sessions caduquen a les vuit hores o quan es reinicia el servidor.
- Els estudiants autenticats comparteixen els mateixos registres de deures i exàmens.

### Accés des de la xarxa

La web la serveix el mateix Claw a `http://127.0.0.1:3000`, així que no cal cap túnel. Si la publiques en un altre domini (un proxy invers amb HTTPS, per exemple), afegeix-lo a `WEB_ALLOWED_ORIGINS` separat per comes.

Calen credencials SMTP per a la verificació per correu.

**Avís de seguretat:** la funció d'accés de depuració s'ha de configurar amb cura. No deixis mai un codi de depuració per defecte actiu en un servidor accessible des d'internet.

Consulta la [documentació d'arquitectura i seguretat](docs/arquitectura.md).

---

## ⚙️ Configuració

Copia la configuració d'exemple:

```bash
cp .env.example .env
```

El fitxer `.env` conté les opcions principals.

### Configuració d'IA

| Variable                | Valor per defecte |
| ----------------------- | ----------------- |
| `OLLAMA_MODEL`          | `qwen3:4b`        |
| `OLLAMA_MODEL_FALLBACK` | `qwen2.5:3b`      |
| `OLLAMA_MODEL_BRAIN`    | `qwen2.5:3b`      |
| `WEB_SEARCH`            | `true`            |
| `CLAW_TRIGGER`          | `claw`            |
| `CLAW_SIGNATURE`        | `true`            |

### Configuració de WhatsApp

| Variable                | Valor per defecte |
| ----------------------- | ----------------- |
| `WHATSAPP_GROUP_JID`    | Buit              |
| `WHATSAPP_OWNER_JID`    | Compte del bot    |
| `PRIVATE_MODE`          | `dueno`           |
| `APUNTA_LIBRE`          | `true`            |
| `ANSWER_WINDOW_MINUTES` | `15`              |
| `ACK_SAVES`             | `false`           |

### Configuració de fitxers multimèdia

| Variable               | Valor per defecte |
| ---------------------- | ----------------- |
| `MEDIA_ENABLED`        | `true`            |
| `MEDIA_MODE`           | `contexto`        |
| `MEDIA_MAX_MB`         | `12`              |
| `MEDIA_MAX_TOTAL_MB`   | `2048`            |
| `MEDIA_RETENTION_DAYS` | `14`              |

### Configuració de veu

| Variable                 | Valor per defecte     |
| ------------------------ | --------------------- |
| `TRANSCRIBE_ENABLED`     | `true`                |
| `TRANSCRIBE_MODE`        | `todo`                |
| `TRANSCRIBE_MAX_SECONDS` | `180`                 |
| `WHISPER_MODEL`          | `Xenova/whisper-base` |

### Configuració de la IA a Python

| Variable                | Valor per defecte                             |
| ----------------------- | --------------------------------------------- |
| `PYTHON_AI_ENABLED`     | `true`                                        |
| `PYTHON_AI_URL`         | `http://127.0.0.1:5050`                       |
| `PYTHON_WHISPER_MODEL`  | `base`                                        |
| `PYTHON_WHISPER_DEVICE` | `auto`                                        |
| `PYTHON_IMAGE_MODEL`    | `stable-diffusion-v1-5/stable-diffusion-v1-5` |

Gairebé tots els ajustos d'execució també es poden canviar amb `!claw ajustes`.

Per a la referència completa de configuració, consulta `.env.example` i [INSTALL.ca.md](INSTALL.ca.md).

---

## 🎨 Generació d'imatges en local (experimental)

Claw admet opcionalment la generació d'imatges en local.

Motors disponibles:

- **Python + Diffusers:** admet molts models a través de Hugging Face.
- **stable-diffusion.cpp:** generació lleugera per línia de comandes.
- **Backend HTTP:** servidors de generació d'imatges compatibles.

La generació d'imatges està desactivada per defecte.

Activa-la amb:

```text
!claw ajustes imagenes si
```

Genera una imatge:

```text
!claw imagen a futuristic city at night
```

Claw no genera mai imatges automàticament.

En equips amb poca memòria de GPU, la generació d'imatges pot descarregar temporalment el model d'Ollama per alliberar VRAM.

---

## 📁 Estructura del projecte

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

## ❓ Preguntes freqüents

**Claw necessita connexió a internet?**

WhatsApp i els serveis externs opcionals necessiten connexió. La inferència d'IA local i la base de dades funcionen al teu ordinador.

**Puc fer servir Claw amb el mòbil apagat?**

Sí, sempre que l'ordinador que l'allotja continuï encès i la sessió de dispositiu vinculat de WhatsApp segueixi sent vàlida.

**Què passa si s'apaga l'ordinador?**

Claw deixa de funcionar, però la informació guardada continua a `data/picklebrain.db`.

**Pot WhatsApp bloquejar el meu número?**

Hi ha risc real. Claw fa servir Baileys, una biblioteca no oficial de WhatsApp Web. Els termes de WhatsApp limiten l'automatització no autoritzada. Es recomana fer servir un número a part.

**Claw consumeix molts recursos?**

Depèn dels models i del maquinari. Les preguntes habituals es responen directament des de la base de dades, sense executar cap model.

**Guarda totes les imatges?**

No. Per defecte només guarda les imatges rellevants per a l'institut, i els fitxers antics s'eliminen automàticament.

**Per què no respon Claw?**

1. Comprova que el grup està vinculat.
2. Escriu `!claw` per veure'n l'estat.
3. Executa `npm run doctor`.
4. Activa `LOG_LEVEL=debug` per veure com processa els missatges.

**Per què no funciona el reconeixement de veu?**

Comprova que el servei de Python està en marxa o instal·la FFmpeg per al motor de transcripció antic de Node.js.

---

## ⚠️ Limitacions i millores futures

- L'APK complementari d'Android no és en aquest repositori. L'API espera que l'adjunt de l'última release es digui `ClawCompanion.apk`.
- Els models de llenguatge més grans milloren la conversa quan hi ha maquinari suficient.
- Els models de Whisper més grans milloren el reconeixement de noms i de gravacions amb soroll.
- La generació d'imatges és experimental i depèn del maquinari i de la compatibilitat dels models.

---

## 📚 Documentació

- [Guia d'instal·lació](INSTALL.ca.md)
- [Arquitectura tècnica](docs/arquitectura.md)
- [Documentació del servei de Python](python/README.md)
- [Configuració d'entorn](.env.example)
- [Comunitat de Discord](https://discord.gg/DwbMbEqQ6E)

---

**Claw — El teu assistent d'IA local per a la vida escolar.** 🪝
