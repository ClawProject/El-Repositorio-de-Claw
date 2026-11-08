# 🪝 Claw

[English](README.md) · [Español](README.es.md) · [Català](README.ca.md) · [Français](README.fr.md) · [Português](README.pt.md) · [Deutsch](README.de.md) · **Italiano** · [Русский](README.ru.md) · [العربية](README.ar.md) · [中文](README.zh.md)

**Un bot WhatsApp autoospitato con IA locale.**

Claw è un assistente WhatsApp con IA locale pensato per tenere traccia dei compiti, delle verifiche, degli avvisi scolastici e delle informazioni importanti condivise nei gruppi.

Lavora in silenzio in background, capisce messaggi di testo, note vocali e immagini rilevanti, e risponde alle domande quando qualcuno ha bisogno di un'informazione.

> **Installazione:** vedi [INSTALL.it.md](INSTALL.it.md) per le istruzioni dettagliate su Linux, macOS e Windows.
>
> **Documentazione tecnica:** [Architettura, API e sicurezza](docs/arquitectura.md).

---

## ✨ Funzionalità

- **Tracciamento automatico dei compiti:** individua e annota compiti e verifiche in arrivo dalle conversazioni del gruppo.
- **Funzionamento silenzioso:** Claw parla solo quando qualcuno chiede o lo attiva esplicitamente.
- **Assistente IA generalista:** scrivi `Claw` seguito da una domanda per usare le sue capacità generali.
- **Riconoscimento vocale:** trascrive le note vocali in locale con Whisper.
- **Archiviazione immagini:** salva le immagini legate a compiti e verifiche ed elimina automaticamente i file scaduti.
- **Elaborazione IA locale:** usa Ollama per eseguire i modelli di linguaggio sul tuo computer.
- **Scelta della lingua al primo avvio:** al primo avvio Claw apre una pagina web per scegliere tra 100 lingue. La scelta viene salvata nel database, applicata all'interfaccia e alle risposte dell'IA, e può essere cambiata con `!claw language en`.
- **Interfaccia web:** dà agli studenti accesso autenticato alle informazioni scolastiche condivise.
- **Integrazione con il calendario:** esporta le verifiche in arrivo come file `.ics`.
- **Scacchi:** gioca a scacchi contro Claw o analizza posizioni.
- **Generazione di immagini opzionale:** genera immagini in locale con Stable Diffusion.
- **Manutenzione automatica:** gestisce i media salvati e può impedire la sospensione del computer host.

### 🔒 Privacy

Claw è progettato intorno all'elaborazione locale.

L'inferenza IA, la classificazione e il database girano sul tuo computer.

Alcune connessioni esterne restano comunque necessarie:

- WhatsApp: invio e ricezione dei messaggi.
- Ollama e Whisper: download dei modelli.
- DuckDuckGo: ricerche web opzionali.

Le ricerche web possono essere disattivate con `WEB_SEARCH=false` o `!claw ajustes buscar no`.

Consulta la [documentazione sulla privacy](docs/arquitectura.md#datos-y-privacidad) per maggiori informazioni.

---

## 🧠 Come funziona

Claw analizza i messaggi in arrivo nel gruppo e decide cosa fare.

```text
Messaggio in arrivo dal gruppo
        |
        +-- Contiene "Claw"?
        |       |
        |       +-- Assistente IA generale
        |
        +-- È una domanda su compiti o verifiche?
        |       |
        |       +-- Risponde direttamente dal database
        |
        +-- Potrebbe contenere informazioni scolastiche?
                |
                +-- Classificazione con IA locale
                        |
                        +-- Domanda rilevata
                        |       |
                        |       +-- Apre una domanda in sospeso di 15 minuti
                        |
                        +-- Informazione rilevata
                                |
                                +-- Salva in silenzio nel database
```

### Domande in sospeso

Una delle funzioni principali di Claw è il sistema di domande in sospeso.

Per esempio:

1. Uno studente chiede: «Quali sono i compiti di inglese?»
2. Claw apre una domanda in sospeso di 15 minuti.
3. Un altro studente risponde: «Fare pagina 12.»
4. Claw salva l'informazione automaticamente.
5. Chiunque può poi chiedere a Claw i compiti di inglese.

Le correzioni sostituiscono le voci precedenti, così le informazioni vecchie non restano nel database.

Claw capisce anche il contesto della conversazione grazie ai messaggi recenti della stessa chat, senza mescolare conversazioni diverse.

### 🎙️ Note vocali

Claw capisce le note vocali con Whisper.

- L'audio viene trascritto in locale.
- Il servizio Python usa faster-whisper.
- È disponibile un fallback Node.js.
- Riconosce altre pronunce del nome, come «Clau» e «Clao».
- L'audio non deve mai uscire dal tuo computer per essere trascritto.

### 🖼️ Immagini

Claw può salvare immagini legate a compiti e verifiche.

- Le immagini scolastiche rilevanti vengono conservate.
- I meme e le immagini non pertinenti vengono ignorati.
- I media scaduti vengono eliminati automaticamente.
- Le immagini possono essere reinviate quando qualcuno chiede di una verifica.

---

## 🚀 Installazione

Per le istruzioni complete vedi **[INSTALL.it.md](INSTALL.it.md)**.

### Requisiti

| Dipendenza        | Versione / modello                    |
| ----------------- | ------------------------------------- |
| Node.js           | 24 LTS                                |
| Git               | Ultima versione                       |
| Ollama            | Ultima versione                       |
| Modello principale| `qwen3:4b`                            |
| Modello di riserva| `qwen2.5:3b`                          |
| Python            | 3.11 / 3.12 (consigliato)             |
| FFmpeg            | Opzionale, per la voce in modalità vecchia |

Scarica i modelli:

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

### Clonare il repository

```bash
git clone <REPOSITORY_URL>
cd Claw
```

Installa le dipendenze:

```bash
npm install
```

In alternativa, su Windows puoi eseguire:

```powershell
.\arrancar.bat
```

Questo script installa le dipendenze mancanti, crea la configurazione d'ambiente e avvia il bot.

### Servizio Python opzionale

Il servizio Python migliora l'elaborazione vocale e permette la generazione di immagini in locale.

Crea un ambiente virtuale:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

Installa le dipendenze:

```bash
pip install -r python/requirements.txt
pip install -r python/requirements-images.txt
```

Avvia il servizio:

```bash
python python/server.py
```

Controlla lo stato:

```bash
curl http://127.0.0.1:5050/health
```

Vedi [python/README.md](python/README.md) per maggiori informazioni.

---

## 🧪 Test

Claw include diversi strumenti per verificare che l'installazione funzioni.

```bash
npm run doctor
npm run sim
npm test
```

| Comando                 | Descrizione                                          |
| ----------------------- | ---------------------------------------------------- |
| `npm run doctor`        | Controlla Ollama, i modelli, il database e il classificatore. |
| `npm run sim`           | Avvia un simulatore di messaggi senza WhatsApp.      |
| `npm test`              | Esegue i test di integrazione.                       |
| `npm run test:ai`       | Testa le funzioni IA.                                |
| `npm run test:subjects` | Testa il riconoscimento delle materie senza Ollama.  |
| `npm run test:python`   | Testa l'interfaccia Node.js ↔ Python.                |
| `npm run test:voice`    | Testa la trascrizione con audio locale.              |

### Esempio di simulazione

```text
Studente: Quali sono i compiti di matematica?
Claw: In attesa di una risposta...

Ana: Fare le pagine da 30 a 32.

Studente: Quali sono i compiti di matematica?
Claw: Fare le pagine da 30 a 32.

Studente: La verifica di storia è il 20 ottobre.

Studente: Claw, quanto fa 2 + 2?
Claw: 4.
```

---

## 📱 Collegare WhatsApp

Avvia Claw:

```bash
npm start
```

Scansiona il codice QR da:

**WhatsApp → Impostazioni → Dispositivi collegati → Collega un dispositivo**

La sessione di autenticazione viene salvata in:

```text
data/auth/
```

**Non condividere mai questa cartella né il suo contenuto.**

### Attivare Claw in un gruppo

Ci sono due modi per collegare un gruppo:

**Attivazione manuale:**

```text
!claw aqui
```

**Attivazione automatica:**

Indica l'identificatore interno del gruppo in `.env`:

```env
WHATSAPP_GROUP_JID=your-group-id@g.us
```

Claw identifica i gruppi dall'identificatore interno, non dal nome.

---

## 💬 Comandi

Tutti i comandi iniziano con `!claw`. È supportato anche il vecchio alias `!pickle`.

### Comandi generali

| Comando                      | Descrizione                                |
| ---------------------------- | ------------------------------------------ |
| `!claw`                      | Mostra lo stato del bot.                   |
| `!claw ayuda`                | Mostra i comandi disponibili.              |
| `!claw deberes [materia]`    | Mostra i compiti in sospeso.               |
| `!claw examenes`             | Mostra le verifiche in arrivo.             |
| `!claw apuntes`              | Mostra le informazioni salvate.            |
| `!claw proximo`              | Mostra la prossima verifica o compito.     |
| `!claw apunta ...`           | Aggiunge o corregge un compito.            |
| `!claw hecho ...`            | Segna un compito come fatto.               |
| `!claw resumen [hoy/semana]` | Riassume le informazioni recenti.          |
| `!claw calendario`           | Esporta le verifiche come file ICS.        |
| `!claw busca ...`            | Cerca sul web.                             |
| `!claw imagen ...`           | Genera un'immagine (sperimentale).         |
| `!claw ajedrez [mossa]`      | Gioca a scacchi contro Claw.               |
| `!claw analiza [FEN]`        | Analizza una posizione di scacchi.         |
| `!claw novedades`            | Mostra le modifiche recenti.               |

### Comandi del proprietario e degli amministratori

| Comando                      | Descrizione                                 |
| ---------------------------- | ------------------------------------------- |
| `!claw aqui` / `!claw fuera` | Collega o scollega un gruppo.               |
| `!claw ajustes`              | Consulta e modifica le impostazioni.        |
| `!claw ia`                   | Consulta o cambia il modello IA.            |
| `!claw prohibir [numero]`    | Blocca un utente.                           |
| `!claw permitir [numero]`    | Sblocca un utente.                          |
| `!claw vetados`              | Elenca gli utenti bloccati.                 |
| `!claw mantenimiento si/no`  | Attiva o disattiva la modalità manutenzione.|
| `!claw olvida ...`           | Elimina informazioni salvate.               |
| `!claw admins`               | Gestisce gli amministratori (solo proprietario). |

Il proprietario del bot è l'account WhatsApp che esegue Claw o `WHATSAPP_OWNER_JID`.

Solo il proprietario e gli amministratori autorizzati possono modificare le impostazioni amministrative.

---

## 🌐 Interfaccia web

Claw include un'interfaccia web e un'API integrate.

Avvia solo il server web:

```bash
npm run web
```

Avvia tutto:

```bash
npm start
```

L'interfaccia web è servita dal server di Claw:

- `/` — Pagina principale.
- `/entrar/` — Accesso per studenti.

### Autenticazione degli studenti

L'accesso richiede un codice di verifica monouso inviato via email.

Regole attuali:

- Sono accettati solo indirizzi `@alu.edu.gva.es`.
- Gli studenti registrano nome, cognome, corso e gruppo.
- I codici scadono dopo 10 minuti.
- Sono consentiti al massimo cinque tentativi di verifica.
- Le sessioni scadono dopo otto ore o al riavvio del server.
- Gli studenti autenticati condividono gli stessi record di compiti e verifiche.

### Accesso dalla rete

Claw serve da sé la pagina web su `http://127.0.0.1:3000`, quindi non serve alcun tunnel. Se la pubblichi su un altro dominio (un reverse proxy HTTPS, per esempio), aggiungilo a `WEB_ALLOWED_ORIGINS` separato da virgole.

Servono credenziali SMTP per la verifica via email.

**Avviso di sicurezza:** la funzione di accesso di debug va configurata con attenzione. Non lasciare mai un codice di debug predefinito attivo su un server raggiungibile da internet.

Vedi la [documentazione su architettura e sicurezza](docs/arquitectura.md).

---

## ⚙️ Configurazione

Copia la configurazione di esempio:

```bash
cp .env.example .env
```

Il file `.env` contiene le opzioni principali.

### Configurazione IA

| Variabile               | Valore predefinito |
| ----------------------- | ------------------ |
| `OLLAMA_MODEL`          | `qwen3:4b`         |
| `OLLAMA_MODEL_FALLBACK` | `qwen2.5:3b`       |
| `OLLAMA_MODEL_BRAIN`    | `qwen2.5:3b`       |
| `WEB_SEARCH`            | `true`             |
| `CLAW_TRIGGER`          | `claw`             |
| `CLAW_SIGNATURE`        | `true`             |

### Configurazione WhatsApp

| Variabile               | Valore predefinito |
| ----------------------- | ------------------ |
| `WHATSAPP_GROUP_JID`    | Vuoto              |
| `WHATSAPP_OWNER_JID`    | Account del bot    |
| `PRIVATE_MODE`          | `dueno`            |
| `APUNTA_LIBRE`          | `true`             |
| `ANSWER_WINDOW_MINUTES` | `15`               |
| `ACK_SAVES`             | `false`            |

### Configurazione media

| Variabile              | Valore predefinito |
| ---------------------- | ------------------ |
| `MEDIA_ENABLED`        | `true`             |
| `MEDIA_MODE`           | `contexto`         |
| `MEDIA_MAX_MB`         | `12`               |
| `MEDIA_MAX_TOTAL_MB`   | `2048`             |
| `MEDIA_RETENTION_DAYS` | `14`               |

### Configurazione voce

| Variabile                | Valore predefinito    |
| ------------------------ | --------------------- |
| `TRANSCRIBE_ENABLED`     | `true`                |
| `TRANSCRIBE_MODE`        | `todo`                |
| `TRANSCRIBE_MAX_SECONDS` | `180`                 |
| `WHISPER_MODEL`          | `Xenova/whisper-base` |

### Configurazione IA Python

| Variabile               | Valore predefinito                            |
| ----------------------- | --------------------------------------------- |
| `PYTHON_AI_ENABLED`     | `true`                                        |
| `PYTHON_AI_URL`         | `http://127.0.0.1:5050`                       |
| `PYTHON_WHISPER_MODEL`  | `base`                                        |
| `PYTHON_WHISPER_DEVICE` | `auto`                                        |
| `PYTHON_IMAGE_MODEL`    | `stable-diffusion-v1-5/stable-diffusion-v1-5` |

Quasi tutte le impostazioni di esecuzione si possono cambiare con `!claw ajustes`.

Per il riferimento completo vedi `.env.example` e [INSTALL.it.md](INSTALL.it.md).

---

## 🎨 Generazione di immagini in locale (sperimentale)

Claw supporta opzionalmente la generazione di immagini in locale.

Backend disponibili:

- **Python + Diffusers:** supporta molti modelli tramite Hugging Face.
- **stable-diffusion.cpp:** generazione leggera da riga di comando.
- **Backend HTTP:** server di generazione immagini compatibili.

La generazione è disattivata per impostazione predefinita.

Attivala con:

```text
!claw ajustes imagenes si
```

Genera un'immagine:

```text
!claw imagen a futuristic city at night
```

Claw non genera mai immagini automaticamente.

Su sistemi con poca memoria GPU, la generazione può scaricare temporaneamente il modello Ollama per liberare VRAM.

---

## 📁 Struttura del progetto

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

## ❓ Domande frequenti

**Claw richiede una connessione a internet?**

WhatsApp e i servizi esterni opzionali richiedono la connessione. L'inferenza IA locale e il database girano sul tuo computer.

**Posso usare Claw con il telefono spento?**

Sì, purché il computer che lo ospita resti acceso e la sessione del dispositivo collegato di WhatsApp sia valida.

**Cosa succede se il computer si spegne?**

Claw si ferma, ma le informazioni restano in `data/picklebrain.db`.

**WhatsApp può bloccare il mio numero?**

Il rischio è reale. Claw usa Baileys, una libreria WhatsApp Web non ufficiale. I termini di WhatsApp limitano l'automazione non autorizzata. Si consiglia un numero separato.

**Claw consuma molte risorse?**

Dipende dai modelli e dall'hardware. Le domande abituali vengono risposte direttamente dal database, senza eseguire un modello.

**Salva tutte le immagini?**

No. Per impostazione predefinita salva solo le immagini scolastiche rilevanti e i file vecchi vengono eliminati automaticamente.

**Perché Claw non risponde?**

1. Controlla che il gruppo sia collegato.
2. Scrivi `!claw` per vedere lo stato.
3. Esegui `npm run doctor`.
4. Attiva `LOG_LEVEL=debug` per vedere come vengono elaborati i messaggi.

**Perché il riconoscimento vocale non funziona?**

Controlla che il servizio Python sia attivo o installa FFmpeg per il vecchio motore di trascrizione Node.js.

---

## ⚠️ Limiti e miglioramenti futuri

- L'APK companion Android non è in questo repository. L'API si aspetta che l'allegato dell'ultima release si chiami `ClawCompanion.apk`.
- Modelli più grandi migliorano la conversazione quando l'hardware lo consente.
- Modelli Whisper più grandi migliorano il riconoscimento di nomi e registrazioni rumorose.
- La generazione di immagini è sperimentale e dipende dall'hardware e dalla compatibilità dei modelli.

---

## 📚 Documentazione

- [Guida all'installazione](INSTALL.it.md)
- [Architettura tecnica](docs/arquitectura.md)
- [Servizio Python](python/README.md)
- [Configurazione d'ambiente](.env.example)

---

**Claw — Il tuo assistente IA locale per la vita scolastica.** 🪝
