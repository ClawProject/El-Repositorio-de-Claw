# 🪝 Claw

[English](README.md) · [Español](README.es.md) · [Català](README.ca.md) · **Français** · [Português](README.pt.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [中文](README.zh.md)

**Un bot WhatsApp auto-hébergé propulsé par une IA locale.**

Claw est un assistant WhatsApp doté d'une IA locale, conçu pour suivre les devoirs, les contrôles, les annonces du lycée et les informations importantes partagées dans les groupes.

Il travaille discrètement en arrière-plan, comprend les messages texte, les notes vocales et les images pertinentes, et répond aux questions quand quelqu'un a besoin d'une information.

> **Installation :** voir [INSTALL.fr.md](INSTALL.fr.md) pour les instructions détaillées sous Linux, macOS et Windows.
>
> **Documentation technique :** [Architecture, API et sécurité](docs/arquitectura.md).

---

## ✨ Fonctionnalités

- **Suivi automatique des devoirs :** détecte et note les devoirs et les contrôles à venir à partir des conversations du groupe.
- **Fonctionnement silencieux :** Claw ne parle que lorsqu'on lui pose une question ou qu'on l'active explicitement.
- **Assistant IA généraliste :** mentionnez `Claw` suivi d'une question pour utiliser ses capacités générales.
- **Reconnaissance vocale :** transcrit les notes vocales en local avec Whisper.
- **Stockage des images :** conserve les images liées aux devoirs et aux contrôles et supprime automatiquement les fichiers expirés.
- **Traitement IA local :** utilise Ollama pour exécuter les modèles de langage sur votre ordinateur.
- **Choix de la langue au premier démarrage :** au premier lancement, Claw ouvre une page web pour choisir parmi 100 langues. Le choix est enregistré dans la base de données, appliqué à l'interface et aux réponses de l'IA, et peut être modifié plus tard avec `!claw language en`.
- **Interface web :** donne aux élèves un accès authentifié aux informations scolaires partagées.
- **Intégration au calendrier :** exporte les contrôles à venir au format `.ics`.
- **Échecs :** jouez aux échecs contre Claw ou analysez des positions.
- **Génération d'images optionnelle :** générez des images en local avec Stable Diffusion.
- **Maintenance automatique :** gère les médias enregistrés et peut empêcher l'ordinateur hôte de se mettre en veille.

### 🔒 Confidentialité

Claw est conçu autour du traitement local.

L'inférence IA, la classification et la base de données s'exécutent sur votre ordinateur.

Certaines connexions externes restent toutefois nécessaires :

- WhatsApp : envoi et réception des messages.
- ngrok : accès distant à l'interface web et à l'API.
- Ollama et Whisper : téléchargement des modèles.
- DuckDuckGo : recherches web optionnelles.

Les recherches web peuvent être désactivées avec `WEB_SEARCH=false` ou `!claw ajustes buscar no`.

Consultez la [documentation sur la confidentialité](docs/arquitectura.md#datos-y-privacidad) pour en savoir plus.

---

## 🧠 Comment ça marche

Claw analyse les messages reçus dans le groupe et décide quoi faire.

```text
Message entrant du groupe
        |
        +-- Contient "Claw" ?
        |       |
        |       +-- Assistant IA général
        |
        +-- Est-ce une question de devoirs ou de contrôles ?
        |       |
        |       +-- Répond directement depuis la base de données
        |
        +-- Pourrait-il contenir une information scolaire ?
                |
                +-- Classification par IA locale
                        |
                        +-- Question détectée
                        |       |
                        |       +-- Ouvre une question en attente de 15 minutes
                        |
                        +-- Information détectée
                                |
                                +-- Enregistrement silencieux dans la base
```

### Questions en attente

L'une des fonctions principales de Claw est son système de questions en attente.

Par exemple :

1. Un élève demande : « Quels sont les devoirs d'anglais ? »
2. Claw ouvre une question en attente de 15 minutes.
3. Un autre élève répond : « Faire la page 12. »
4. Claw enregistre l'information automatiquement.
5. N'importe qui peut ensuite interroger Claw sur les devoirs d'anglais.

Les corrections remplacent les entrées précédentes, donc les informations obsolètes ne restent pas dans la base.

Claw comprend aussi le contexte de la conversation grâce aux messages récents de la même discussion, sans mélanger les conversations.

### 🎙️ Notes vocales

Claw comprend les notes vocales avec Whisper.

- L'audio est transcrit en local.
- Le service Python utilise faster-whisper.
- Un mode de secours Node.js est disponible.
- Il reconnaît d'autres prononciations du nom, comme « Clau » et « Clao ».
- L'audio n'a jamais besoin de quitter votre ordinateur pour être transcrit.

### 🖼️ Images

Claw peut enregistrer les images liées aux devoirs et aux contrôles.

- Les images scolaires pertinentes sont conservées.
- Les mèmes et les images sans rapport sont ignorés.
- Les médias expirés sont supprimés automatiquement.
- Les images peuvent être renvoyées quand quelqu'un pose une question sur un contrôle.

---

## 🚀 Installation

Pour les instructions complètes, voir **[INSTALL.fr.md](INSTALL.fr.md)**.

### Prérequis

| Dépendance        | Version / modèle                      |
| ----------------- | ------------------------------------- |
| Node.js           | 24 LTS                                |
| Git               | Dernière version                      |
| Ollama            | Dernière version                      |
| Modèle principal  | `qwen3:4b`                            |
| Modèle de secours | `qwen2.5:3b`                          |
| Python            | 3.11 / 3.12 (recommandé)              |
| FFmpeg            | Optionnel, pour la voix en mode ancien |

Téléchargez les modèles :

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

### Cloner le dépôt

```bash
git clone <REPOSITORY_URL>
cd Claw
```

Installez les dépendances :

```bash
npm install
```

Autre possibilité sous Windows :

```powershell
.\arrancar.bat
```

Ce script installe les dépendances manquantes, crée la configuration d'environnement et démarre le bot.

### Service Python optionnel

Le service Python améliore le traitement de la voix et permet la génération d'images en local.

Créez un environnement virtuel :

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

Installez les dépendances :

```bash
pip install -r python/requirements.txt
pip install -r python/requirements-images.txt
```

Démarrez le service :

```bash
python python/server.py
```

Vérifiez son état :

```bash
curl http://127.0.0.1:5050/health
```

Voir [python/README.md](python/README.md) pour plus d'informations.

---

## 🧪 Tests

Claw inclut plusieurs outils pour vérifier que l'installation fonctionne.

```bash
npm run doctor
npm run sim
npm test
```

| Commande                | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `npm run doctor`        | Vérifie Ollama, les modèles, la base et le classifieur. |
| `npm run sim`           | Lance un simulateur de messages sans WhatsApp.       |
| `npm test`              | Exécute les tests d'intégration.                     |
| `npm run test:ai`       | Teste les fonctions d'IA.                            |
| `npm run test:subjects` | Teste la reconnaissance des matières sans Ollama.    |
| `npm run test:python`   | Teste l'interface Node.js ↔ Python.                  |
| `npm run test:voice`    | Teste la transcription avec un audio local.          |

### Exemple de simulation

```text
Élève : Quels sont les devoirs de maths ?
Claw : En attente d'une réponse...

Ana : Faire les pages 30 à 32.

Élève : Quels sont les devoirs de maths ?
Claw : Faire les pages 30 à 32.

Élève : Le contrôle d'histoire est le 20 octobre.

Élève : Claw, combien font 2 + 2 ?
Claw : 4.
```

---

## 📱 Connecter WhatsApp

Démarrez Claw :

```bash
npm start
```

Scannez le code QR depuis :

**WhatsApp → Paramètres → Appareils connectés → Connecter un appareil**

Votre session d'authentification est enregistrée dans :

```text
data/auth/
```

**Ne partagez jamais ce dossier ni son contenu.**

### Activer Claw dans un groupe

Deux méthodes sont possibles :

**Activation manuelle :**

```text
!claw aqui
```

**Activation automatique :**

Indiquez l'identifiant interne du groupe dans `.env` :

```env
WHATSAPP_GROUP_JID=your-group-id@g.us
```

Claw identifie les groupes par leur identifiant interne, pas par leur nom.

---

## 💬 Commandes

Toutes les commandes commencent par `!claw`. L'ancien alias `!pickle` est aussi accepté.

### Commandes générales

| Commande                     | Description                              |
| ---------------------------- | ---------------------------------------- |
| `!claw`                      | Affiche l'état du bot.                   |
| `!claw ayuda`                | Affiche les commandes disponibles.       |
| `!claw deberes [matière]`    | Affiche les devoirs en attente.          |
| `!claw examenes`             | Affiche les contrôles à venir.           |
| `!claw apuntes`              | Affiche les informations enregistrées.   |
| `!claw proximo`              | Affiche le prochain contrôle ou devoir.  |
| `!claw apunta ...`           | Ajoute ou corrige un devoir.             |
| `!claw hecho ...`            | Marque un devoir comme fait.             |
| `!claw resumen [hoy/semana]` | Résume les informations récentes.        |
| `!claw calendario`           | Exporte les contrôles en fichier ICS.    |
| `!claw busca ...`            | Cherche sur le web.                      |
| `!claw imagen ...`           | Génère une image (expérimental).         |
| `!claw ajedrez [coup]`       | Joue aux échecs contre Claw.             |
| `!claw analiza [FEN]`        | Analyse une position d'échecs.           |
| `!claw novedades`            | Affiche les changements récents.         |

### Commandes du propriétaire et des administrateurs

| Commande                     | Description                                |
| ---------------------------- | ------------------------------------------ |
| `!claw aqui` / `!claw fuera` | Connecte ou déconnecte un groupe.          |
| `!claw ajustes`              | Consulte et modifie les réglages.          |
| `!claw ia`                   | Consulte ou change le modèle d'IA.         |
| `!claw prohibir [numéro]`    | Bloque un utilisateur.                     |
| `!claw permitir [numéro]`    | Débloque un utilisateur.                   |
| `!claw vetados`              | Liste les utilisateurs bloqués.            |
| `!claw mantenimiento si/no`  | Active ou désactive le mode maintenance.   |
| `!claw olvida ...`           | Supprime des informations enregistrées.    |
| `!claw admins`               | Gère les administrateurs (propriétaire).   |

Le propriétaire du bot est le compte WhatsApp qui exécute Claw ou `WHATSAPP_OWNER_JID`.

Seuls le propriétaire et les administrateurs autorisés peuvent modifier les réglages administratifs.

---

## 🌐 Interface web

Claw inclut une interface web et une API intégrées.

Démarrez uniquement le serveur web :

```bash
npm run web
```

Démarrez tout :

```bash
npm start
```

L'interface web est servie par le serveur de Claw :

- `/` — Page principale.
- `/entrar/` — Connexion des élèves.

### Authentification des élèves

L'accès nécessite un code de vérification à usage unique envoyé par e-mail.

Règles actuelles :

- Seules les adresses `@alu.edu.gva.es` sont acceptées.
- Les élèves enregistrent leur prénom, nom, classe et groupe.
- Les codes expirent au bout de 10 minutes.
- Cinq tentatives de vérification au maximum sont autorisées.
- Les sessions expirent après huit heures ou au redémarrage du serveur.
- Les élèves authentifiés partagent les mêmes fiches de devoirs et de contrôles.

### Accès externe

Claw peut utiliser ngrok pour exposer son interface web hors du réseau local.

La configuration se fait avec :

```env
NGROK_ENABLED=true
NGROK_DOMAIN=your-ngrok-domain
```

Des identifiants SMTP sont nécessaires pour la vérification par e-mail.

**Avertissement de sécurité :** la fonction d'accès de débogage doit être configurée avec soin. Ne laissez jamais un code de débogage par défaut actif sur un serveur accessible depuis internet.

Voir la [documentation sur l'architecture et la sécurité](docs/arquitectura.md).

---

## ⚙️ Configuration

Copiez la configuration d'exemple :

```bash
cp .env.example .env
```

Le fichier `.env` contient les principales options.

### Configuration de l'IA

| Variable                | Valeur par défaut |
| ----------------------- | ----------------- |
| `OLLAMA_MODEL`          | `qwen3:4b`        |
| `OLLAMA_MODEL_FALLBACK` | `qwen2.5:3b`      |
| `OLLAMA_MODEL_BRAIN`    | `qwen2.5:3b`      |
| `WEB_SEARCH`            | `true`            |
| `CLAW_TRIGGER`          | `claw`            |
| `CLAW_SIGNATURE`        | `true`            |

### Configuration de WhatsApp

| Variable                | Valeur par défaut |
| ----------------------- | ----------------- |
| `WHATSAPP_GROUP_JID`    | Vide              |
| `WHATSAPP_OWNER_JID`    | Compte du bot     |
| `PRIVATE_MODE`          | `dueno`           |
| `APUNTA_LIBRE`          | `true`            |
| `ANSWER_WINDOW_MINUTES` | `15`              |
| `ACK_SAVES`             | `false`           |

### Configuration des médias

| Variable               | Valeur par défaut |
| ---------------------- | ----------------- |
| `MEDIA_ENABLED`        | `true`            |
| `MEDIA_MODE`           | `contexto`        |
| `MEDIA_MAX_MB`         | `12`              |
| `MEDIA_MAX_TOTAL_MB`   | `2048`            |
| `MEDIA_RETENTION_DAYS` | `14`              |

### Configuration de la voix

| Variable                 | Valeur par défaut     |
| ------------------------ | --------------------- |
| `TRANSCRIBE_ENABLED`     | `true`                |
| `TRANSCRIBE_MODE`        | `todo`                |
| `TRANSCRIBE_MAX_SECONDS` | `180`                 |
| `WHISPER_MODEL`          | `Xenova/whisper-base` |

### Configuration de l'IA Python

| Variable                | Valeur par défaut                             |
| ----------------------- | --------------------------------------------- |
| `PYTHON_AI_ENABLED`     | `true`                                        |
| `PYTHON_AI_URL`         | `http://127.0.0.1:5050`                       |
| `PYTHON_WHISPER_MODEL`  | `base`                                        |
| `PYTHON_WHISPER_DEVICE` | `auto`                                        |
| `PYTHON_IMAGE_MODEL`    | `stable-diffusion-v1-5/stable-diffusion-v1-5` |

La plupart des réglages d'exécution peuvent aussi être modifiés avec `!claw ajustes`.

Pour la référence complète, consultez `.env.example` et [INSTALL.fr.md](INSTALL.fr.md).

---

## 🎨 Génération d'images en local (expérimental)

Claw prend en charge, en option, la génération d'images en local.

Moteurs disponibles :

- **Python + Diffusers :** prise en charge de nombreux modèles via Hugging Face.
- **stable-diffusion.cpp :** génération légère en ligne de commande.
- **Backend HTTP :** serveurs de génération d'images compatibles.

La génération d'images est désactivée par défaut.

Activez-la avec :

```text
!claw ajustes imagenes si
```

Générez une image :

```text
!claw imagen a futuristic city at night
```

Claw ne génère jamais d'images automatiquement.

Sur les machines avec peu de mémoire GPU, la génération peut décharger temporairement le modèle Ollama pour libérer de la VRAM.

---

## 📁 Structure du projet

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

**Claw a-t-il besoin d'une connexion internet ?**

WhatsApp et les services externes optionnels nécessitent une connexion. L'inférence IA locale et la base de données fonctionnent sur votre ordinateur.

**Puis-je utiliser Claw avec mon téléphone éteint ?**

Oui, tant que l'ordinateur hôte reste allumé et que la session d'appareil connecté WhatsApp reste valide.

**Que se passe-t-il si l'ordinateur s'éteint ?**

Claw s'arrête, mais les informations restent dans `data/picklebrain.db`.

**WhatsApp peut-il bloquer mon numéro ?**

Le risque est réel. Claw utilise Baileys, une bibliothèque WhatsApp Web non officielle. Les conditions de WhatsApp limitent l'automatisation non autorisée. Il est recommandé d'utiliser un numéro séparé.

**Claw consomme-t-il beaucoup de ressources ?**

Cela dépend des modèles et du matériel. Les questions courantes sont traitées directement depuis la base de données, sans exécuter de modèle.

**Enregistre-t-il toutes les images ?**

Non. Par défaut, seules les images scolaires pertinentes sont conservées, et les anciens fichiers sont supprimés automatiquement.

**Pourquoi Claw ne répond-il pas ?**

1. Vérifiez que le groupe est bien connecté.
2. Tapez `!claw` pour voir son état.
3. Lancez `npm run doctor`.
4. Activez `LOG_LEVEL=debug` pour voir comment les messages sont traités.

**Pourquoi la reconnaissance vocale ne fonctionne-t-elle pas ?**

Vérifiez que le service Python tourne, ou installez FFmpeg pour l'ancien moteur de transcription Node.js.

---

## ⚠️ Limites et améliorations futures

- L'APK compagnon Android n'est pas inclus dans ce dépôt. L'API attend que la pièce jointe de la dernière release s'appelle `ClawCompanion.apk`.
- Des modèles plus grands améliorent la conversation si le matériel le permet.
- Des modèles Whisper plus grands améliorent la reconnaissance des noms et des enregistrements bruyants.
- La génération d'images est expérimentale et dépend du matériel et de la compatibilité des modèles.

---

## 📚 Documentation

- [Guide d'installation](INSTALL.fr.md)
- [Architecture technique](docs/arquitectura.md)
- [Documentation du service Python](python/README.md)
- [Configuration de l'environnement](.env.example)

---

**Claw — Votre assistant IA local pour la vie scolaire.** 🪝
