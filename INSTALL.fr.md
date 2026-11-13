# Installer Claw

[English](INSTALL.md) · [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · **Français** · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

Claw est un bot WhatsApp qui tourne sur ton propre ordinateur. Il lui faut deux choses :
**Node.js** (le bot, le panneau web et la base de données) et **Ollama** (l'IA locale).
Les notes vocales et la génération d'images sont **facultatives** et demandent un petit
service Python.

Chaque étape se termine par une **Vérification** : si tu vois ce qui est indiqué, l'étape
est faite et tu peux continuer. Si quelque chose ne colle pas, va à
[Problèmes et solutions](#problèmes-et-solutions).

---

## Ce qu'il te faut

| Obligatoire | Version | Pour quoi |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 22 ou plus | Bot, panneau web, base de données |
| [Ollama](https://ollama.com) | version actuelle | IA de texte locale |
| [Git](https://git-scm.com) | n'importe laquelle | Télécharger et mettre à jour |
| Espace libre | ~6 Go | Les deux modèles Ollama |

| Facultatif | Version | Pour quoi |
| --- | --- | --- |
| Python | 3.11 ou 3.12 | Transcrire la voix et générer des images |
| ffmpeg | version actuelle | Voix sans Python |
| GPU NVIDIA | 4 Go de VRAM | IA plus rapide ; le CPU fonctionne aussi |

Ça tourne sous Linux, macOS et Windows, et il faut environ 8 Go de RAM. Avec un GPU de
4 Go, `qwen3:4b` et `qwen2.5:3b` tiennent largement ; avec plus de mémoire, tu peux prendre
des modèles plus gros.

---

## Chemin rapide (environ 10 minutes)

### 1. Installer Node.js

**Linux et macOS** (nvm, recommandé) :

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# ferme et rouvre le terminal, puis :
nvm install 22
nvm alias default 22
```

**macOS** avec Homebrew : `brew install node`

**Windows**, dans PowerShell :

```powershell
winget install OpenJS.NodeJS.LTS
```

Ferme et rouvre le terminal pour que le `PATH` soit à jour.

**Vérification :** `node --version` affiche `v22.` ou plus.

### 2. Installer Ollama et les modèles

```bash
# Linux et macOS
curl -fsSL https://ollama.com/install.sh | sh

# macOS avec Homebrew
brew install ollama && brew services start ollama

# Windows (PowerShell)
winget install Ollama.Ollama
```

Ensuite, télécharge les deux modèles (environ 5 Go, une seule fois) :

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

**Vérification :** `ollama list` montre les deux modèles, et ceci répond en JSON :

```bash
curl http://127.0.0.1:11434/api/tags
```

Sous Windows, si ça échoue, ouvre l'application Ollama depuis le menu Démarrer.

### 3. Télécharger le projet

```bash
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

**Vérification :** `ls` (ou `dir` sous Windows) montre `package.json`.

> Ne prends le ZIP que si tu ne veux pas de mises à jour : tu perds l'historique et
> `git pull`.

### 4. Installer les dépendances

```bash
npm install
```

Sous Windows, si PowerShell râle à propos de `npm.ps1`, utilise `npm.cmd install`.

Tu peux aussi double-cliquer sur **`arrancar.bat`** (Windows) : il installe ce qui manque,
crée `.env` s'il n'existe pas et démarre le bot.

**Vérification :** ça se termine sans erreur.

### 5. Configurer `.env`

```bash
cp .env.example .env          # Linux et macOS
Copy-Item .env.example .env   # Windows (PowerShell)
```

Le modèle suffit tel quel : il pointe vers Ollama sur cet ordinateur et vers les deux
modèles que tu viens de télécharger. Il ne faut l'éditer que si Ollama est ailleurs, si tu
utilises un autre modèle, ou pour mettre l'e-mail des codes d'accès.

Deux choses à savoir :

- **Ne mets pas `.env` sur Git.** Il contient ton numéro, ton e-mail et des mots de passe.
  Il est déjà dans `.gitignore`.
- Si tu utilises `PICKLEBRAIN_DATA_DIR`, le `.env` peut vivre dans ce dossier de données.

**Vérification :** `.env` se trouve à côté de `package.json`.

### 6. Le démarrer pour la première fois

```bash
npm start
```

La première fois, le navigateur ouvre `http://localhost:3000/setup` pour choisir la langue
(il y en a 100). Le choix est enregistré dans la base de données et le bot ne se connecte
pas à WhatsApp avant que tu en choisisses une.

Ensuite, un **QR code** apparaît dans le terminal. Scanne-le avec
**WhatsApp → Réglages → Appareils connectés → Connecter un appareil**.

La session est enregistrée dans `data/auth/` (ou `PICKLEBRAIN_DATA_DIR/auth`). Ne partage
pas ce dossier : c'est l'accès à ton compte.

**Vérification :** le terminal dit qu'il est connecté et le téléphone affiche l'appareil
connecté. Écris `!claw` dans le groupe et il répond avec son état.

Autres façons de le lancer :

| Commande | Ce qu'elle démarre |
| --- | --- |
| `npm start` | Tout : WhatsApp, panneau web et rappels |
| `npm run web` | Seulement le panneau web et l'API, sans WhatsApp |
| `npm run sim` | Simulateur dans le terminal, sans WhatsApp ni QR |

---

## Relier ton groupe

Dans le groupe, écris :

```
!claw aqui
```

Ça enregistre l'**identifiant** du groupe (jamais le nom, parce qu'il se répète et que
n'importe qui peut le changer). Tu peux aussi mettre `WHATSAPP_GROUP_JID` dans `.env`.

Si le bot reste muet, c'est presque toujours normal : il ne parle que quand on lui demande
les devoirs ou les examens, ou quand on écrit `Claw` suivi d'une question.

---

## Facultatif : voix et images (service Python)

Sans ce service, le bot fonctionne quand même : la voix utilise ffmpeg et Whisper dans
Node, et les images utilisent `sd-cli`. Avec, tu as `faster-whisper` (plus rapide) et
`diffusers` (meilleures images). **Si tu veux seulement qu'il réponde aux devoirs, va à
[Vérifier que tout marche](#vérifier-que-tout-marche).**

**1. Créer l'environnement virtuel** (depuis la racine du projet) :

```bash
python3.12 -m venv .venv      # Linux et macOS
py -3.12 -m venv .venv        # Windows
```

S'il te manque Python 3.12 : `sudo apt install python3.12 python3.12-venv` (Debian et
Ubuntu) ou `brew install python@3.12` (macOS).

**2. Installer les dépendances :**

```bash
.venv/bin/pip install -r python/requirements.txt                  # Linux et macOS
.venv\Scripts\pip.exe install -r python\requirements.txt          # Windows
```

**3. Le lancer dans un autre terminal** et le laisser ouvert pendant que le bot tourne :

```bash
.venv/bin/python python/server.py                 # Linux et macOS
.venv\Scripts\python.exe python\server.py         # Windows
```

Raccourcis, si `python` est dans le `PATH` : `npm run ia` (Windows et macOS) ou
`npm run ia:linux`.

**Vérification :** ceci renvoie `"ok": true` avec l'état de `voice` et `images` :

```bash
curl http://127.0.0.1:5050/health
```

Le bot détecte le service tout seul au démarrage et te dit quel moteur vocal il utilise.
Les modèles se téléchargent au premier usage : environ 150 Mo pour Whisper et environ
4 Go pour les images, stockés dans `data/models/`.

Variables utiles :

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

Avec un GPU de 4 Go, garde `PYTHON_IMAGE_UNLOAD=true` pour qu'Ollama récupère la VRAM
après chaque image.

---

## Facultatif : générer des images

Les images sont désactivées d'usine parce qu'elles sont lentes sur les petits GPU. Pour les
activer, mets dans `.env` :

```dotenv
IMAGE_GEN_ENABLED=true
```

et installe les dépendances en plus dans le même environnement :

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

Sans GPU NVIDIA, installe d'abord la version CPU de torch :

```bash
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
```

Les images se demandent à la main avec `!claw imagen <ce que tu veux>`.

---

## Vérifier que tout marche

| Commande | Ce qu'elle vérifie | Ollama nécessaire ? |
| --- | --- | --- |
| `npm run doctor` | Ollama, modèles, base de données, voix, disque | Oui |
| `npm test` | Toute la batterie de tests | Oui |
| `npm run test:python` | Le contrat Node ↔ service Python | Non |
| `npm run test:web` | Connexions et API | Non |
| `npm run test:subjects` | Détection des matières | Non |
| `npm run test:vetados` | Blocage par numéro et par `@lid` | Non |
| `npm run test:i18n` | Les 100 langues | Non |

Si `doctor` est au vert, c'est bon. Pour l'essayer sans WhatsApp :

```bash
npm run sim
```

```
quels devoirs il y a en maths ?
Ana: pages 30 à 32
quels devoirs il y a en maths ?
l'examen d'histoire est le 20 octobre
Claw, combien font 2+2 ?
```

---

## Installer avec Homebrew (macOS et Linux)

Il y a un tap avec une formule qui installe les commandes `claw` et `claw-ia` :

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 et suivants
brew install claw
claw
```

Le premier lancement télécharge les dépendances Node dans `~/.local/share/claw` et stocke
les données dans `~/.local/share/claw/data`. Si tu préfères ton propre dossier :

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

Pour le service de voix et d'images :

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"  # images seulement
claw-ia
```

> Le tap est hébergé sur `Uyruw3/homebrew-claw` parce que l'organisation du projet ne
> permet pas de créer des dépôts depuis ce compte. S'il passe à `ClawProject`, la commande
> sera `brew tap ClawProject/claw`.

---

## Mettre à jour

```bash
git pull
npm install
```

Si les `python/requirements*.txt` ont changé aussi :

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

Redémarre Node et le service Python. Avec Homebrew : `brew update && brew upgrade claw`.

---

## Problèmes et solutions

| Ce que tu vois | Quoi faire |
| --- | --- |
| `npm start` ne trouve pas Ollama | Ouvre l'application Ollama ou lance `ollama serve`, puis vérifie `curl http://127.0.0.1:11434/api/tags` |
| Aucun QR code n'apparaît | Choisis d'abord la langue sur `http://localhost:3000/setup` |
| Le bot ne dit rien dans le groupe | `!claw aqui` dans le groupe puis `!claw` ; avec `LOG_LEVEL=debug` tu vois pourquoi chaque message est ignoré |
| Les notes vocales ne marchent pas | Lance `python/server.py` et `npm run doctor` ; sans Python, installe ffmpeg et rouvre le terminal |
| `faster-whisper` échoue avec `metadata_errors` | `.venv/bin/pip install 'av<19'` |
| CUDA ne charge pas (`libcublas.so.12`) | Whisper passe tout seul sur le CPU ; pour le GPU, installe le runtime CUDA et un torch avec CUDA |
| La première image prend un temps fou | Il télécharge le modèle diffusers (~4 Go) ; les suivantes sont rapides |
| Le site n'envoie pas de codes d'accès | Renseigne `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` et `SMTP_PASSWORD` ; teste avec `npm run smtp -- ton-email@alu.edu.gva.es` |
| PowerShell bloque `npm.ps1` | Utilise `npm.cmd`, ou `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` dans un nouveau terminal |
| `ollama pull` manque d'espace | Les modèles pèsent ~5 Go ; libère de la place ou prends un modèle plus petit |

Toujours bloqué ? Lance `npm run doctor` et colle la sortie :

```bash
npm run doctor > doctor.txt
```

---

## À quoi ressemble le dossier

```
TheClawRepo/
├─ src/                 code du bot (Node)
├─ python/              service de voix et d'images
├─ docs/                site web et documentation
├─ sdserver/            moteur stable-diffusion.cpp facultatif
├─ data/                session, base de données, photos et modèles (hors Git)
├─ .env                 ta configuration (hors Git)
├─ package.json
└─ arrancar.bat         démarrage en un double-clic sous Windows
```
