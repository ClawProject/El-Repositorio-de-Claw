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
</p>

<p align="center"><strong>Ein selbst gehosteter WhatsApp-Bot mit lokaler KI.</strong></p>

<p align="center">[English](README.md) · [Español](README.es.md) · [Català](README.ca.md) · [Français](README.fr.md) · [Português](README.pt.md) · **Deutsch** · [Italiano](README.it.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [中文](README.zh.md)</p>

Claw ist ein WhatsApp-Assistent mit lokaler KI, der Hausaufgaben, Prüfungen, Schulankündigungen und wichtige Informationen aus Gruppenchats im Blick behält.

Er arbeitet leise im Hintergrund, versteht Textnachrichten, Sprachnachrichten und relevante Bilder und antwortet auf Fragen, wenn jemand Informationen braucht.

> **Installation:** Siehe [INSTALL.de.md](INSTALL.de.md) für ausführliche Anleitungen für Linux, macOS und Windows.
>
> **Technische Dokumentation:** [Architektur, API und Sicherheit](docs/arquitectura.md).

---

## ✨ Funktionen

- **Automatische Hausaufgabenverfolgung:** erkennt Hausaufgaben und anstehende Prüfungen aus den Gruppenchats und schreibt sie mit.
- **Lautloser Betrieb:** Claw spricht nur, wenn jemand fragt oder ihn ausdrücklich aktiviert.
- **Allgemeiner KI-Assistent:** `Claw` gefolgt von einer Frage nutzt die allgemeinen KI-Fähigkeiten.
- **Spracherkennung:** transkribiert Sprachnachrichten lokal mit Whisper.
- **Bildspeicher:** speichert Bilder zu Hausaufgaben und Prüfungen und löscht abgelaufene Dateien automatisch.
- **Lokale KI-Verarbeitung:** nutzt Ollama, um Sprachmodelle auf dem eigenen Rechner auszuführen.
- **Sprachauswahl beim ersten Start:** beim ersten Start öffnet Claw eine Webseite zur Auswahl aus 100 Sprachen. Die Wahl wird in der Datenbank gespeichert, auf Oberfläche und KI-Antworten angewendet und kann später mit `!claw language en` geändert werden.
- **Weboberfläche:** gibt Schülerinnen und Schülern authentifizierten Zugriff auf geteilte Schulinformationen.
- **Kalenderintegration:** exportiert anstehende Prüfungen als `.ics`-Dateien.
- **Schach:** spielt Schach gegen Claw oder analysiert Stellungen.
- **Optionale Bildgenerierung:** erzeugt Bilder lokal mit Stable Diffusion.
- **Automatische Wartung:** verwaltet gespeicherte Medien und kann verhindern, dass der Host-Rechner in den Ruhezustand geht.

### 🔒 Datenschutz

Claw ist auf lokale Verarbeitung ausgelegt.

KI-Inferenz, Klassifizierung und Datenbank laufen auf dem eigenen Rechner.

Einige externe Verbindungen sind dennoch nötig:

- WhatsApp: Senden und Empfangen von Nachrichten.
- Ollama und Whisper: Download der Modelle.
- DuckDuckGo: optionale Websuchen.

Websuchen lassen sich mit `WEB_SEARCH=false` oder `!claw ajustes buscar no` abschalten.

Mehr dazu in der [Datenschutzdokumentation](docs/arquitectura.md#datos-y-privacidad).

---

## 🧠 So funktioniert es

Claw analysiert eingehende Gruppennachrichten und entscheidet, was zu tun ist.

```text
Eingehende Gruppennachricht
        |
        +-- Enthält "Claw"?
        |       |
        |       +-- Allgemeiner KI-Assistent
        |
        +-- Ist es eine Frage zu Hausaufgaben oder Prüfungen?
        |       |
        |       +-- Antwortet direkt aus der Datenbank
        |
        +-- Könnte es Schulinformationen enthalten?
                |
                +-- Klassifizierung durch lokale KI
                        |
                        +-- Frage erkannt
                        |       |
                        |       +-- Öffnet eine offene Frage für 15 Minuten
                        |
                        +-- Information erkannt
                                |
                                +-- Speichert sie still in der Datenbank
```

### Offene Fragen

Eine der wichtigsten Funktionen von Claw ist das System offener Fragen.

Zum Beispiel:

1. Eine Schülerin fragt: „Was sind die Englisch-Hausaufgaben?“
2. Claw öffnet eine offene Frage für 15 Minuten.
3. Ein Mitschüler antwortet: „Seite 12 machen.“
4. Claw speichert die Information automatisch.
5. Jeder kann später Claw nach den Englisch-Hausaufgaben fragen.

Korrekturen ersetzen frühere Einträge, damit veraltete Informationen nicht in der Datenbank bleiben.

Claw versteht außerdem den Gesprächskontext anhand der letzten Nachrichten desselben Chats, ohne Gespräche zu vermischen.

### 🎙️ Sprachnachrichten

Claw versteht Sprachnachrichten mit Whisper.

- Audio wird lokal transkribiert.
- Der Python-Dienst nutzt faster-whisper.
- Ein Node.js-Fallback ist vorhanden.
- Er erkennt alternative Aussprachen wie „Clau“ und „Clao“.
- Das Audio muss den Rechner zur Transkription nie verlassen.

### 🖼️ Bilder

Claw kann Bilder zu Hausaufgaben und Prüfungen speichern.

- Relevante Schulbilder werden gespeichert.
- Memes und unpassende Bilder werden ignoriert.
- Abgelaufene Medien werden automatisch gelöscht.
- Bilder können erneut gesendet werden, wenn jemand nach einer Prüfung fragt.

---

## 🚀 Installation

Die vollständige Anleitung steht in **[INSTALL.de.md](INSTALL.de.md)**.

### Voraussetzungen

| Abhängigkeit     | Version / Modell                       |
| ---------------- | -------------------------------------- |
| Node.js          | 24 LTS                                 |
| Git              | Neueste Version                        |
| Ollama           | Neueste Version                        |
| Primäres Modell  | `qwen3:4b`                             |
| Fallback-Modell  | `qwen2.5:3b`                           |
| Python           | 3.11 / 3.12 (empfohlen)                |
| FFmpeg           | Optional, für die alte Sprachverarbeitung |

Modelle herunterladen:

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

### Repository klonen

```bash
git clone <REPOSITORY_URL>
cd Claw
```

Abhängigkeiten installieren:

```bash
npm install
```

Unter Windows geht auch:

```powershell
.\arrancar.bat
```

Das Skript installiert fehlende Abhängigkeiten, erstellt die Umgebungskonfiguration und startet den Bot.

### Optionaler Python-Dienst

Der Python-Dienst verbessert die Sprachverarbeitung und ermöglicht lokale Bildgenerierung.

Virtuelle Umgebung anlegen:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

Abhängigkeiten installieren:

```bash
pip install -r python/requirements.txt
pip install -r python/requirements-images.txt
```

Dienst starten:

```bash
python python/server.py
```

Status prüfen:

```bash
curl http://127.0.0.1:5050/health
```

Mehr dazu in [python/README.md](python/README.md).

---

## 🧪 Tests

Claw enthält mehrere Werkzeuge, um die Installation zu prüfen.

```bash
npm run doctor
npm run sim
npm test
```

| Befehl                  | Beschreibung                                         |
| ----------------------- | ---------------------------------------------------- |
| `npm run doctor`        | Prüft Ollama, Modelle, Datenbank und Klassifizierer. |
| `npm run sim`           | Startet einen Nachrichtensimulator ohne WhatsApp.    |
| `npm test`              | Führt die Integrationstests aus.                     |
| `npm run test:ai`       | Testet die KI-Funktionen.                            |
| `npm run test:subjects` | Testet die Facherkennung ohne Ollama.                |
| `npm run test:python`   | Testet die Schnittstelle Node.js ↔ Python.           |
| `npm run test:voice`    | Testet die Transkription mit lokalem Audio.          |

### Simulationsbeispiel

```text
Schülerin: Was sind die Mathe-Hausaufgaben?
Claw: Warte auf eine Antwort...

Ana: Seiten 30 bis 32 machen.

Schülerin: Was sind die Mathe-Hausaufgaben?
Claw: Seiten 30 bis 32 machen.

Schüler: Die Geschichtsprüfung ist am 20. Oktober.

Schüler: Claw, wie viel ist 2 + 2?
Claw: 4.
```

---

## 📱 WhatsApp verbinden

Claw starten:

```bash
npm start
```

QR-Code scannen über:

**WhatsApp → Einstellungen → Verknüpfte Geräte → Gerät verknüpfen**

Die Anmeldesitzung wird gespeichert in:

```text
data/auth/
```

**Diesen Ordner niemals weitergeben.**

### Claw in einer Gruppe aktivieren

Es gibt zwei Wege:

**Manuell:**

```text
!claw aqui
```

**Automatisch:**

Interne Kennung der Gruppe in `.env` eintragen:

```env
WHATSAPP_GROUP_JID=your-group-id@g.us
```

Claw erkennt Gruppen an ihrer internen Kennung, nicht am Namen.

---

## 💬 Befehle

Alle Befehle beginnen mit `!claw`. Der alte Alias `!pickle` funktioniert weiterhin.

### Allgemeine Befehle

| Befehl                       | Beschreibung                              |
| ---------------------------- | ----------------------------------------- |
| `!claw`                      | Zeigt den Bot-Status.                     |
| `!claw ayuda`                | Zeigt die verfügbaren Befehle.            |
| `!claw deberes [Fach]`       | Zeigt offene Hausaufgaben.                |
| `!claw examenes`             | Zeigt anstehende Prüfungen.               |
| `!claw apuntes`              | Zeigt gespeicherte Informationen.         |
| `!claw proximo`              | Zeigt die nächste Prüfung oder Aufgabe.   |
| `!claw apunta ...`           | Fügt eine Aufgabe hinzu oder korrigiert sie. |
| `!claw hecho ...`            | Markiert eine Aufgabe als erledigt.       |
| `!claw resumen [hoy/semana]` | Fasst neue Informationen zusammen.        |
| `!claw calendario`           | Exportiert Prüfungen als ICS-Datei.       |
| `!claw busca ...`            | Sucht im Web.                             |
| `!claw imagen ...`           | Erzeugt ein Bild (experimentell).         |
| `!claw ajedrez [Zug]`        | Spielt Schach gegen Claw.                 |
| `!claw analiza [FEN]`        | Analysiert eine Schachstellung.           |
| `!claw novedades`            | Zeigt die letzten Änderungen.             |

### Befehle für Besitzer und Administratoren

| Befehl                       | Beschreibung                               |
| ---------------------------- | ------------------------------------------ |
| `!claw aqui` / `!claw fuera` | Verbindet oder trennt eine Gruppe.         |
| `!claw ajustes`              | Zeigt und ändert Einstellungen.            |
| `!claw ia`                   | Zeigt oder ändert das KI-Modell.           |
| `!claw prohibir [Nummer]`    | Sperrt einen Nutzer.                       |
| `!claw permitir [Nummer]`    | Entsperrt einen Nutzer.                    |
| `!claw vetados`              | Listet gesperrte Nutzer.                   |
| `!claw mantenimiento si/no`  | Aktiviert oder deaktiviert den Wartungsmodus. |
| `!claw olvida ...`           | Löscht gespeicherte Informationen.         |
| `!claw admins`               | Verwaltet Administratoren (nur Besitzer).  |

Besitzer ist das WhatsApp-Konto, das Claw ausführt, oder `WHATSAPP_OWNER_JID`.

Nur Besitzer und autorisierte Administratoren können Verwaltungseinstellungen ändern.

---

## 🌐 Weboberfläche

Claw enthält eine integrierte Weboberfläche und API.

Nur den Webserver starten:

```bash
npm run web
```

Alles starten:

```bash
npm start
```

Die Weboberfläche wird vom Claw-Server ausgeliefert:

- `/` — Startseite.
- `/entrar/` — Anmeldung für Schüler.

### Anmeldung für Schüler

Der Zugang erfordert einen einmaligen Bestätigungscode per E-Mail.

Aktuelle Regeln:

- Nur Adressen `@alu.edu.gva.es` werden akzeptiert.
- Schüler registrieren Name, Nachname, Kurs und Gruppe.
- Codes laufen nach 10 Minuten ab.
- Höchstens fünf Bestätigungsversuche.
- Sitzungen laufen nach acht Stunden oder bei Serverneustart ab.
- Angemeldete Schüler teilen dieselben Hausaufgaben- und Prüfungseinträge.

### Zugriff aus dem Netz

Claw liefert die Weboberfläche selbst unter `http://127.0.0.1:3000` aus, ein Tunnel ist also nicht nötig. Wenn du sie unter einer anderen Domain veröffentlichst (etwa hinter einem HTTPS-Reverse-Proxy), trage sie in `WEB_ALLOWED_ORIGINS` ein, durch Kommas getrennt.

Für die E-Mail-Bestätigung werden SMTP-Zugangsdaten benötigt.

**Sicherheitshinweis:** Der Debug-Zugang muss sorgfältig konfiguriert werden. Niemals einen Standard-Debug-Code auf einem aus dem Internet erreichbaren Server aktiv lassen.

Siehe [Architektur- und Sicherheitsdokumentation](docs/arquitectura.md).

---

## ⚙️ Konfiguration

Beispielkonfiguration kopieren:

```bash
cp .env.example .env
```

Die Datei `.env` enthält die wichtigsten Optionen.

### KI-Konfiguration

| Variable                | Standardwert |
| ----------------------- | ------------ |
| `OLLAMA_MODEL`          | `qwen3:4b`   |
| `OLLAMA_MODEL_FALLBACK` | `qwen2.5:3b` |
| `OLLAMA_MODEL_BRAIN`    | `qwen2.5:3b` |
| `WEB_SEARCH`            | `true`       |
| `CLAW_TRIGGER`          | `claw`       |
| `CLAW_SIGNATURE`        | `true`       |

### WhatsApp-Konfiguration

| Variable                | Standardwert |
| ----------------------- | ------------ |
| `WHATSAPP_GROUP_JID`    | Leer         |
| `WHATSAPP_OWNER_JID`    | Bot-Konto    |
| `PRIVATE_MODE`          | `dueno`      |
| `APUNTA_LIBRE`          | `true`       |
| `ANSWER_WINDOW_MINUTES` | `15`         |
| `ACK_SAVES`             | `false`      |

### Medien-Konfiguration

| Variable               | Standardwert |
| ---------------------- | ------------ |
| `MEDIA_ENABLED`        | `true`       |
| `MEDIA_MODE`           | `contexto`   |
| `MEDIA_MAX_MB`         | `12`         |
| `MEDIA_MAX_TOTAL_MB`   | `2048`       |
| `MEDIA_RETENTION_DAYS` | `14`         |

### Sprach-Konfiguration

| Variable                 | Standardwert         |
| ------------------------ | -------------------- |
| `TRANSCRIBE_ENABLED`     | `true`               |
| `TRANSCRIBE_MODE`        | `todo`               |
| `TRANSCRIBE_MAX_SECONDS` | `180`                |
| `WHISPER_MODEL`          | `Xenova/whisper-base` |

### Python-KI-Konfiguration

| Variable                | Standardwert                                  |
| ----------------------- | --------------------------------------------- |
| `PYTHON_AI_ENABLED`     | `true`                                        |
| `PYTHON_AI_URL`         | `http://127.0.0.1:5050`                       |
| `PYTHON_WHISPER_MODEL`  | `base`                                        |
| `PYTHON_WHISPER_DEVICE` | `auto`                                        |
| `PYTHON_IMAGE_MODEL`    | `stable-diffusion-v1-5/stable-diffusion-v1-5` |

Fast alle Laufzeiteinstellungen lassen sich auch mit `!claw ajustes` ändern.

Die vollständige Referenz steht in `.env.example` und [INSTALL.de.md](INSTALL.de.md).

---

## 🎨 Lokale Bildgenerierung (experimentell)

Claw unterstützt optional lokale Bildgenerierung.

Verfügbare Backends:

- **Python + Diffusers:** viele Modelle über Hugging Face.
- **stable-diffusion.cpp:** leichte Generierung per Kommandozeile.
- **HTTP-Backend:** kompatible Bildgenerierungsserver.

Die Bildgenerierung ist standardmäßig deaktiviert.

Aktivieren mit:

```text
!claw ajustes imagenes si
```

Bild erzeugen:

```text
!claw imagen a futuristic city at night
```

Claw erzeugt nie automatisch Bilder.

Auf Systemen mit wenig GPU-Speicher kann die Bildgenerierung das Ollama-Modell vorübergehend entladen, um VRAM freizugeben.

---

## 📁 Projektstruktur

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

## ❓ FAQ

**Braucht Claw eine Internetverbindung?**

WhatsApp und optionale externe Dienste brauchen eine Verbindung. Lokale KI-Inferenz und Datenbank laufen auf dem eigenen Rechner.

**Kann ich Claw nutzen, wenn das Handy aus ist?**

Ja, solange der Host-Rechner eingeschaltet bleibt und die WhatsApp-Gerätesitzung gültig ist.

**Was passiert, wenn der Rechner herunterfährt?**

Claw stoppt, aber die gespeicherten Informationen bleiben in `data/picklebrain.db`.

**Kann WhatsApp meine Nummer sperren?**

Das Risiko ist real. Claw nutzt Baileys, eine inoffizielle WhatsApp-Web-Bibliothek. Die WhatsApp-Bedingungen beschränken nicht autorisierte Automatisierung. Eine separate Nummer wird empfohlen.

**Verbraucht Claw viele Ressourcen?**

Das hängt von Modellen und Hardware ab. Übliche Fragen werden direkt aus der Datenbank beantwortet, ohne ein Modell auszuführen.

**Werden alle Bilder gespeichert?**

Nein. Standardmäßig nur relevante Schulbilder, und alte Dateien werden automatisch gelöscht.

**Warum antwortet Claw nicht?**

1. Prüfen, ob die Gruppe verbunden ist.
2. `!claw` für den Status eingeben.
3. `npm run doctor` ausführen.
4. `LOG_LEVEL=debug` aktivieren, um die Verarbeitung zu sehen.

**Warum funktioniert die Spracherkennung nicht?**

Prüfen, ob der Python-Dienst läuft, oder FFmpeg für die alte Node.js-Transkription installieren.

---

## ⚠️ Grenzen und geplante Verbesserungen

- Das Android-Begleit-APK ist nicht in diesem Repository. Die API erwartet das Release-Anhängsel `ClawCompanion.apk`.
- Größere Sprachmodelle verbessern Gespräche bei ausreichender Hardware.
- Größere Whisper-Modelle verbessern Namen und verrauschte Aufnahmen.
- Bildgenerierung ist experimentell und hängt von Hardware und Modellkompatibilität ab.

---

## 📚 Dokumentation

- [Installationsanleitung](INSTALL.de.md)
- [Technische Architektur](docs/arquitectura.md)
- [Python-Dienst](python/README.md)
- [Umgebungskonfiguration](.env.example)
- [Discord-Community](https://discord.gg/DwbMbEqQ6E)

---

**Claw — Dein lokaler KI-Assistent für den Schulalltag.** 🪝
