# تثبيت Claw

[English](INSTALL.md) · [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · **العربية** · [中文](INSTALL.zh.md)

Claw روبوت واتساب يعمل على حاسوبك أنت. يحتاج إلى شيئين: **Node.js** (الروبوت ولوحة الويب
وقاعدة البيانات) و**Ollama** (الذكاء الاصطناعي المحلي). الرسائل الصوتية وتوليد الصور
**اختيارية** وتحتاج خدمة صغيرة بلغة Python.

كل خطوة تنتهي بـ **تحقّق**: إن رأيت ما هو مكتوب، فالخطوة تمّت ويمكنك المتابعة. وإن لم
يتطابق شيء، فانتقل إلى [المشاكل والحلول](#المشاكل-والحلول).

---

## ما تحتاج إليه

| إجباري | الإصدار | لماذا |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 22 أو أحدث | الروبوت ولوحة الويب وقاعدة البيانات |
| [Ollama](https://ollama.com) | الإصدار الحالي | الذكاء الاصطناعي النصي المحلي |
| [Git](https://git-scm.com) | أي إصدار | التنزيل والتحديث |
| مساحة حرة | نحو 6 غيغابايت | نموذجا Ollama |

| اختياري | الإصدار | لماذا |
| --- | --- | --- |
| Python | 3.11 أو 3.12 | تحويل الصوت إلى نص وتوليد الصور |
| ffmpeg | الإصدار الحالي | الصوت دون Python |
| كرت NVIDIA | 4 غيغابايت من الذاكرة | ذكاء أسرع؛ ويعمل أيضًا على المعالج |

يعمل على Linux وmacOS وWindows، ويحتاج نحو 8 غيغابايت من الذاكرة. مع كرت بـ 4 غيغابايت
يدخل `qwen3:4b` و`qwen2.5:3b` بارتياح؛ ومع ذاكرة أكبر يمكنك استخدام نماذج أكبر.

---

## الطريق السريع (نحو 10 دقائق)

### 1. تثبيت Node.js

**Linux وmacOS** (باستخدام nvm، وهو المُفضّل):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# أغلق الطرفية وافتحها من جديد، ثم:
nvm install 22
nvm alias default 22
```

**macOS** مع Homebrew: `brew install node`

**Windows**، في PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
```

أغلق الطرفية وافتحها من جديد حتى يتحدّث `PATH`.

**تحقّق:** الأمر `node --version` يطبع `v22.` أو أعلى.

### 2. تثبيت Ollama والنماذج

```bash
# Linux وmacOS
curl -fsSL https://ollama.com/install.sh | sh

# macOS مع Homebrew
brew install ollama && brew services start ollama

# Windows (PowerShell)
winget install Ollama.Ollama
```

ثم نزّل النموذجين (نحو 5 غيغابايت، مرة واحدة فقط):

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

**تحقّق:** الأمر `ollama list` يُظهر النموذجين، وهذا يرد بصيغة JSON:

```bash
curl http://127.0.0.1:11434/api/tags
```

في Windows، إن لم يعمل، افتح تطبيق Ollama من قائمة ابدأ.

### 3. تنزيل المشروع

```bash
git clone https://github.com/ClawProject/TheClawRepo.git
cd TheClawRepo
```

**تحقّق:** الأمر `ls` (أو `dir` في Windows) يُظهر `package.json`.

> نزّل ملف ZIP فقط إن لم تكن تريد التحديثات: ستفقد السجل والأمر `git pull`.

### 4. تثبيت الاعتماديات

```bash
npm install
```

في Windows، إن اعترض PowerShell على `npm.ps1`، استخدم `npm.cmd install`.

يمكنك أيضًا النقر مرتين على **`arrancar.bat`** (Windows): يثبّت ما ينقص، وينشئ `.env` إن
لم يكن موجودًا، ويشغّل الروبوت.

**تحقّق:** ينتهي دون أخطاء.

### 5. إعداد `.env`

```bash
cp .env.example .env          # Linux وmacOS
Copy-Item .env.example .env   # Windows (PowerShell)
```

القالب يصلح كما هو: يشير إلى Ollama على هذا الحاسوب وإلى النموذجين الذين نزّلتهما للتوّ.
لا تحتاج إلى تعديله إلا إذا كان Ollama في مكان آخر، أو كنت تستخدم نموذجًا آخر، أو
لإضافة بريد أكواد الدخول.

أمران يجدر معرفتهما:

- **لا ترفع `.env` إلى Git.** فيه رقمك وبريدك وكلمات المرور. وهو مضاف أصلًا إلى
  `.gitignore`.
- إن استخدمت `PICKLEBRAIN_DATA_DIR`، يمكن أن يكون `.env` داخل مجلد البيانات ذاك.

**تحقّق:** ملف `.env` موجود بجانب `package.json`.

### 6. التشغيل لأول مرة

```bash
npm start
```

في المرة الأولى يفتح المتصفح `http://localhost:3000/setup` لاختيار اللغة (هناك 100 لغة).
يُحفظ الاختيار في قاعدة البيانات، ولا يتصل الروبوت بواتساب حتى تختار واحدة.

بعد ذلك يظهر **رمز QR** في الطرفية. امسحه من
**واتساب ← الإعدادات ← الأجهزة المرتبطة ← ربط جهاز**.

تُحفظ الجلسة في `data/auth/` (أو في `PICKLEBRAIN_DATA_DIR/auth`). لا تشارك هذا المجلد:
فهو الوصول إلى حسابك.

**تحقّق:** الطرفية تقول إنه متصل، والهاتف يُظهر الجهاز المرتبط. اكتب `!claw` في
المجموعة، فيجيب بحالته.

طرق أخرى للتشغيل:

| الأمر | ما يشغّله |
| --- | --- |
| `npm start` | كل شيء: واتساب ولوحة الويب والتذكيرات |
| `npm run web` | لوحة الويب وواجهة API فقط، دون واتساب |
| `npm run sim` | محاكي في الطرفية، دون واتساب أو QR |

---

## ربط مجموعتك

داخل المجموعة، اكتب:

```
!claw aqui
```

بهذا يُحفظ **مُعرّف** المجموعة (وليس الاسم أبدًا، لأنه يتكرر ويمكن لأي شخص تغييره).
ويمكنك أيضًا ضبط `WHATSAPP_GROUP_JID` في `.env`.

إن بقي الروبوت صامتًا، فغالبًا هذا هو الصحيح: لا يتكلم إلا عندما يسأل أحد عن الواجبات أو
الامتحانات، أو عندما يُكتب `Claw` مع سؤال.

---

## اختياري: الصوت والصور (خدمة Python)

بدون هذه الخدمة يبقى الروبوت يعمل: الصوت يستخدم ffmpeg وWhisper داخل Node، والصور تستخدم
`sd-cli`. ومعها تحصل على `faster-whisper` (أسرع) و`diffusers` (صور أفضل). **إن كنت تريد
فقط إجابات الواجبات، فانتقل إلى
[التأكد من أن كل شيء يعمل](#التأكد-من-أن-كل-شيء-يعمل).**

**1. إنشاء البيئة الافتراضية** (من جذر المشروع):

```bash
python3.12 -m venv .venv      # Linux وmacOS
py -3.12 -m venv .venv        # Windows
```

إن لم يكن لديك Python 3.12: `sudo apt install python3.12 python3.12-venv` (Debian وUbuntu)
أو `brew install python@3.12` (macOS).

**2. تثبيت الاعتماديات:**

```bash
.venv/bin/pip install -r python/requirements.txt                  # Linux وmacOS
.venv\Scripts\pip.exe install -r python\requirements.txt          # Windows
```

**3. تشغيلها في طرفية أخرى** وتَركها مفتوحة ما دام الروبوت يعمل:

```bash
.venv/bin/python python/server.py                 # Linux وmacOS
.venv\Scripts\python.exe python\server.py         # Windows
```

اختصارات، إن كان `python` في `PATH`: `npm run ia` (Windows وmacOS) أو `npm run ia:linux`.

**تحقّق:** هذا يُعيد `"ok": true` مع حالة `voice` و`images`:

```bash
curl http://127.0.0.1:5050/health
```

يكتشف الروبوت الخدمة تلقائيًا عند التشغيل ويخبرك بمحرّك الصوت الذي يستخدمه. تُنزَّل
النماذج عند أول استخدام: نحو 150 ميغابايت لنموذج Whisper ونحو 4 غيغابايت للصور، وتُحفظ في
`data/models/`.

متغيّرات مفيدة:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

مع كرت بـ 4 غيغابايت، اترك `PYTHON_IMAGE_UNLOAD=true` كي يستعيد Ollama الذاكرة بعد كل صورة.

---

## اختياري: توليد الصور

الصور مطفأة افتراضيًا لأنها بطيئة على الكروت الصغيرة. لتفعيلها، ضع في `.env`:

```dotenv
IMAGE_GEN_ENABLED=true
```

وثبّت الاعتماديات الإضافية في البيئة نفسها:

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

بدون كرت NVIDIA، ثبّت أولًا نسخة torch للمعالج:

```bash
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
```

تُطلب الصور يدويًا بالأمر `!claw imagen <ما تريد>`.

---

## التأكد من أن كل شيء يعمل

| الأمر | ما يتحقق منه | يحتاج Ollama؟ |
| --- | --- | --- |
| `npm run doctor` | Ollama والنماذج وقاعدة البيانات والصوت والقرص | نعم |
| `npm test` | كل مجموعة الاختبارات | نعم |
| `npm run test:python` | عقد الاتصال بين Node وخدمة Python | لا |
| `npm run test:web` | الدخول وواجهة API | لا |
| `npm run test:subjects` | تمييز المواد | لا |
| `npm run test:vetados` | الحجب بالرقم وبـ `@lid` | لا |
| `npm run test:i18n` | اللغات المئة | لا |

إن ظهر `doctor` بالأخضر، فقد انتهيت. لتجربته دون واتساب:

```bash
npm run sim
```

```
ما واجبات الرياضيات؟
Ana: الصفحات من 30 إلى 32
ما واجبات الرياضيات؟
امتحان التاريخ في 20 أكتوبر
Claw، كم يساوي 2+2؟
```

---

## التثبيت باستخدام Homebrew (macOS وLinux)

هناك tap فيه وصفة تثبّت الأمرين `claw` و`claw-ia`:

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 وما بعده
brew install claw
claw
```

عند أول تشغيل تُنزَّل اعتماديات Node إلى `~/.local/share/claw` وتُحفظ البيانات في
`~/.local/share/claw/data`. وإن أردت مجلدك الخاص:

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

لخدمة الصوت والصور:

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"  # الصور فقط
claw-ia
```

> الـ tap موجود في `Uyruw3/homebrew-claw` لأن منظمة المشروع لا تسمح بإنشاء مستودعات من
> ذلك الحساب. وإن انتقل إلى `ClawProject` سيصبح الأمر `brew tap ClawProject/claw`.

---

## التحديث

```bash
git pull
npm install
```

وإن تغيّرت أيضًا ملفات `python/requirements*.txt`:

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

أعد تشغيل Node وخدمة Python. مع Homebrew: `brew update && brew upgrade claw`.

---

## المشاكل والحلول

| ما تراه | ما تفعله |
| --- | --- |
| `npm start` لا يجد Ollama | افتح تطبيق Ollama أو نفّذ `ollama serve`، ثم تحقّق من `curl http://127.0.0.1:11434/api/tags` |
| لا يظهر رمز QR | اختر اللغة أولًا في `http://localhost:3000/setup` |
| الروبوت لا يقول شيئًا في المجموعة | `!claw aqui` داخل المجموعة ثم `!claw`؛ ومع `LOG_LEVEL=debug` ترى سبب تجاهل كل رسالة |
| الرسائل الصوتية لا تعمل | شغّل `python/server.py` ونفّذ `npm run doctor`؛ وبدون Python ثبّت ffmpeg وأعد فتح الطرفية |
| `faster-whisper` يفشل بـ `metadata_errors` | `.venv/bin/pip install 'av<19'` |
| CUDA لا يُحمّل (`libcublas.so.12`) | ينتقل Whisper إلى المعالج تلقائيًا؛ ولاستخدام الكرت ثبّت CUDA runtime ونسخة torch مع CUDA |
| أول صورة تستغرق وقتًا طويلًا | إنه ينزّل نموذج diffusers (نحو 4 غيغابايت)؛ وما بعده يكون سريعًا |
| الموقع لا يرسل أكواد الدخول | املأ `SMTP_HOST` و`SMTP_PORT` و`SMTP_USER` و`SMTP_PASSWORD`؛ واختبر بـ `npm run smtp -- بريدك@alu.edu.gva.es` |
| PowerShell يحجب `npm.ps1` | استخدم `npm.cmd`، أو `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` في طرفية جديدة |
| `ollama pull` ينفد منه المكان | النموذجان يحتاجان نحو 5 غيغابايت؛ فرّغ مساحة أو استخدم نموذجًا أصغر |

إن بقيت عالقًا، نفّذ `npm run doctor` وألصق الناتج:

```bash
npm run doctor > doctor.txt
```

---

## شكل المجلد

```
TheClawRepo/
├─ src/                 كود الروبوت (Node)
├─ python/              خدمة الصوت والصور
├─ docs/                الموقع والتوثيق
├─ sdserver/            محرك stable-diffusion.cpp الاختياري
├─ data/                الجلسة وقاعدة البيانات والصور والنماذج (خارج Git)
├─ .env                 إعداداتك (خارج Git)
├─ package.json
└─ arrancar.bat         التشغيل بنقرتين في Windows
```
