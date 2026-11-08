# Installer Claw

[English](INSTALL.md) · [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · **Français** · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · [العربية](INSTALL.ar.md) · [中文](INSTALL.zh.md)

Claw se compose de deux processus :

1. **Node.js** (obligatoire) : le bot WhatsApp, l'interface web, la base de données et la logique.
2. **Python** (optionnel, recommandé) : transcrit les notes vocales avec faster-whisper et
   génère des images avec diffusers. S'il ne tourne pas, Node utilise ses
   anciens moteurs.

Ce guide couvre Linux, macOS et Windows. Pour les informations générales sur le bot,
voir le [README](README.fr.md) ; pour le service Python, voir [`python/README.md`](python/README.md).

---

## 1. Prérequis

| Composant | Version | Utilité |
|---|---|---|
| Git | Toute version récente | Télécharger et mettre à jour le projet |
| Node.js | 22 ou plus (24 LTS recommandé) | Bot, interface web et base de données |
| Ollama | Version récente | IA de texte locale |
| Python | 3.11 ou 3.12 | Service voix et images (optionnel) |
| ffmpeg | Version récente | Solution de secours pour la voix sans Python (optionnel) |

L'IA de texte doit télécharger des modèles Ollama. Avec une GTX 1650 de 4 Go,
`qwen3:4b` et `qwen2.5:3b` fonctionnent ; avec plus de mémoire, vous pouvez utiliser des modèles plus grands.

---

## 2. Télécharger le projet (`git clone`)

### Linux et macOS

```bash
git clone https://github.com/ClawProject/El-Repositorio-de-Claw.git
cd El-Repositorio-de-Claw
```

### Windows (PowerShell)

```powershell
git clone https://github.com/ClawProject/El-Repositorio-de-Claw.git
cd El-Repositorio-de-Claw
```

> Si vous avez déjà téléchargé le projet, mettez-le à jour avec `git pull` dans le
> dossier. Ne téléchargez pas de ZIP : vous perdriez l'historique et la possibilité de mettre à jour.

---

## 3. Installer Node.js

### Linux et macOS avec nvm (recommandé)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# fermez et rouvrez le terminal, ou exécutez :
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

nvm install 22
nvm alias default 22
node --version       # doit afficher v22.x ou plus
npm --version
```

### macOS avec Homebrew

```bash
brew install node
```

### Windows

Téléchargez l'installateur LTS depuis [nodejs.org](https://nodejs.org/) ou utilisez :

```powershell
winget install OpenJS.NodeJS.LTS
```

Fermez et rouvrez PowerShell pour que le `PATH` soit mis à jour.

---

## 4. Installer Ollama et les modèles

### Linux et macOS

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Ou avec Homebrew :

```bash
brew install ollama
brew services start ollama
```

### Windows

```powershell
winget install Ollama.Ollama
```

Ensuite, dans n'importe quel terminal :

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

Vérifiez qu'il répond :

```bash
ollama list
curl http://127.0.0.1:11434/api/tags
```

---

## 5. Installer les dépendances Node

Depuis la racine du projet :

```bash
npm install
```

Sous Windows, si PowerShell se plaint de `npm.ps1`, utilisez `npm.cmd install`.

Vous pouvez aussi double-cliquer sur **`arrancar.bat`** (Windows) : il installe les
dépendances manquantes, crée `.env` s'il n'existe pas et démarre le bot.

---

## 6. Configurer `.env`

Copiez le modèle et modifiez-le :

```bash
cp .env.example .env
```

Sous Windows :

```powershell
Copy-Item .env.example .env
notepad .env
```

Configuration minimale pour démarrer :

```dotenv
OLLAMA_MODEL=qwen3:4b
OLLAMA_MODEL_BRAIN=qwen2.5:3b
# Identifiant du groupe (ou tapez "!claw aqui" dans le groupe)
WHATSAPP_GROUP_JID=120363000000000000@g.us
```

- Vous pouvez connecter le groupe plus tard en tapant `!claw aqui` dans WhatsApp ; seul
  l'identifiant est stocké, jamais le nom du groupe.
- Si vous utilisez `PICKLEBRAIN_DATA_DIR`, le fichier `.env` peut se trouver dans ce
  dossier de données.
- Presque tout peut être modifié bot en marche avec `!claw ajustes` ;
  redémarrez après avoir modifié `.env` à la main.
- **Ne publiez pas `.env` sur Git** : il contient des adresses e-mail, des mots de passe et votre numéro de téléphone.
  Il est déjà dans `.gitignore`.

Toutes les variables sont documentées dans [`.env.example`](.env.example) et dans le
[README](README.fr.md).

---

## 7. Service voix et images Python (optionnel, recommandé)

Sans ce service, Claw fonctionne quand même : la voix utilise ffmpeg + Whisper dans Node et
les images utilisent `sd-cli` ou un serveur HTTP. Avec Python, vous obtenez
`faster-whisper` (plus rapide) et `diffusers`.

### 7.1 Créer l'environnement virtuel

Depuis la racine du projet :

```bash
python3.12 -m venv .venv
```

Si votre système n'a pas `python3.12`, installez-le :

```bash
# Debian/Ubuntu
sudo apt install python3.12 python3.12-venv

# macOS avec Homebrew
brew install python@3.12
```

Sous Windows :

```powershell
py -3.12 -m venv .venv
```

### 7.2 Installer les dépendances

```bash
# Linux/macOS
.venv/bin/pip install -r python/requirements.txt

# Windows
.venv\Scripts\pip.exe install -r python/requirements.txt
```

Seulement si vous voulez générer des images avec diffusers :

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

> Sans GPU NVIDIA, installez d'abord la version CPU de torch :
>
> ```bash
> .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
> ```
>
> Avec un GPU NVIDIA, torch doit être la version CUDA. Si Whisper détecte CUDA mais
> que `libcublas`/cuDNN manquent, le service passe automatiquement en CPU.

### 7.3 Démarrer le service

Dans **un autre terminal**, depuis la racine du projet :

```bash
# Linux/macOS
.venv/bin/python python/server.py

# Windows
.venv\Scripts\python.exe python\server.py
```

Vous pouvez aussi utiliser :

```bash
npm run ia          # Windows/macOS si "python" est dans le PATH
npm run ia:linux    # Linux
```

Vérifiez qu'il répond :

```bash
curl http://127.0.0.1:5050/health
```

Il doit renvoyer `"ok": true` et l'état de `voice` et `images`. Le bot le détecte
automatiquement au démarrage et indique quel moteur vocal il utilise.

### 7.4 Modèles

La première transcription télécharge le modèle Whisper (~150 Mo avec `base`). La
première image télécharge le modèle diffusers (environ 4 Go avec SD 1.5). Ils sont stockés
dans `data/models/`, ignoré par Git.

Variables utiles :

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

Avec un GPU de 4 Go, laissez `PYTHON_IMAGE_UNLOAD=true` pour qu'Ollama récupère
la VRAM après chaque image.

---

## 8. Démarrer Claw

```bash
npm start       # bot complet : WhatsApp + web + rappels
npm run web     # web/API seulement, sans WhatsApp
npm run sim     # simulateur console, sans WhatsApp
```

La première fois, Claw ouvre le navigateur sur `http://localhost:3000/setup` pour
choisir la langue (100 disponibles). Le choix est enregistré dans la base et le
bot ne se connecte pas à WhatsApp tant que vous n'en avez pas choisi une. Vous pouvez le changer plus tard depuis
WhatsApp avec `!claw language en` (propriétaire/admins) ou en revenant sur `/setup`.

Ensuite, `npm start` affiche un **code QR**. Scannez-le dans WhatsApp :

**Paramètres → Appareils connectés → Connecter un appareil**

La session est enregistrée dans `data/auth/` (ou `PICKLEBRAIN_DATA_DIR/auth`). Ne
partagez pas ce dossier : il donne accès à votre compte.

---

## 9. Vérifier l'installation

```bash
npm run doctor      # Ollama, modèles, base de données, voix, etc.
npm run test:python # contrat Node <-> service Python (sans modèles)
npm run test:web    # authentification et API
npm run test:subjects
npm run test:i18n   # langues et traductions (sans Ollama)
npm run test:vetados # blocage par numéro et par @lid (sans Ollama)
```

`npm test` lance toute la suite et **nécessite Ollama en marche**.

Test rapide dans le simulateur :

```bash
npm run sim
```

```
les gars, quels devoirs de maths on a ?
Ana : il faut faire les pages 30 à 32
quels devoirs de maths on a ?
le contrôle d'histoire est le 20 octobre
Claw, combien font 2+2 ?
```

---

## 10. Installation avec Homebrew (macOS et Linux)

Il existe un tap avec une formule pour installer les commandes `claw` et `claw-ia` :

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 et suivants
brew install claw
```

Le premier lancement télécharge les dépendances Node dans
`~/.local/share/claw` et stocke les données dans `~/.local/share/claw/data`.

```bash
claw
```

Si vous préférez gérer le dossier vous-même :

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

Pour le service voix et images Python :

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"

# Seulement si vous voulez générer des images :
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"

claw-ia
```

Pour mettre à jour :

```bash
brew update
brew upgrade claw
```

> Le tap est hébergé sur `Uyruw3/homebrew-claw` parce que l'organisation du projet
> ne permet pas de créer des dépôts depuis ce compte. Il pourra être transféré vers
> `ClawProject` plus tard ; la commande serait alors `brew tap ClawProject/claw`.
>
> La formule installe la dernière version stable publiée. Quand une nouvelle version
> sort, le tap est mis à jour avec `brew update && brew upgrade claw`.

---

## 11. Mettre à jour le projet

Si vous l'avez installé avec `git clone` :

```bash
git pull
npm install
```

Si `python/requirements*.txt` a aussi changé :

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

Redémarrez Node et le service Python après la mise à jour.

---

## 12. Problèmes courants

**`npm start` ne trouve pas Ollama.**
Ouvrez l'application Ollama ou lancez `ollama serve`. Vérifiez avec
`curl http://127.0.0.1:11434/api/tags`.

**Le bot ne dit rien dans le groupe.**
1. Vérifiez qu'il est connecté : tapez `!claw aqui` dans le groupe ou définissez
   `WHATSAPP_GROUP_JID`.
2. Tapez `!claw` pour voir l'état.
3. Démarrez avec `LOG_LEVEL=debug` pour voir pourquoi chaque message est ignoré.

**Les notes vocales ne fonctionnent pas.**
Lancez `python/server.py` et vérifiez `npm run doctor`. Si vous n'utilisez pas Python, installez
ffmpeg et rouvrez le terminal.

**`faster-whisper` échoue avec `metadata_errors`.**
Vous avez `av` 19. Fixez la version :

```bash
.venv/bin/pip install 'av<19'
```

**CUDA ne se charge pas (`libcublas.so.12`).**
Whisper passe automatiquement en CPU. Si vous voulez utiliser le GPU, installez le runtime
CUDA et une version de torch compatible CUDA. En attendant, la voix fonctionne sur le CPU.

**La première image prend beaucoup de temps.**
Le modèle diffusers est en cours de téléchargement (~4 Go). Les suivantes ne prennent que le
temps de la génération.

**Le site n'envoie pas de codes d'accès.**
Configurez `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` et `SMTP_PASSWORD` dans `.env`.
Testez avec `npm run smtp -- votre-email@alu.edu.gva.es`.

**PowerShell bloque `npm.ps1`.**
Utilisez `npm.cmd` ou exécutez
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` et ouvrez un autre terminal.

---

## 13. Structure minimale installée

```
El-Repositorio-de-Claw/
├─ src/                 code du bot (Node)
├─ python/              service voix et images
├─ docs/                site statique et documentation
├─ sdserver/            moteur stable-diffusion.cpp optionnel
├─ data/                session, base de données, photos et modèles (non suivi par Git)
├─ .env                 votre configuration (non suivie par Git)
├─ package.json
└─ arrancar.bat         script de démarrage pour Windows
```
