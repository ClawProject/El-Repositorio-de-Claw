# تثبيت Claw

[English](INSTALL.md) · [Español](INSTALL.es.md) · [Català](INSTALL.ca.md) · [Français](INSTALL.fr.md) · [Português](INSTALL.pt.md) · [Deutsch](INSTALL.de.md) · [Italiano](INSTALL.it.md) · [Русский](INSTALL.ru.md) · **العربية** · [中文](INSTALL.zh.md)

يتكوّن Claw من عمليتين:

1. **Node.js** (إلزامي): بوت واتساب، والواجهة الويب، وقاعدة البيانات، والمنطق.
2. **Python** (اختياري، مُستحسن): يفرّغ الرسائل الصوتية باستخدام faster-whisper و
   يولّد الصور باستخدام diffusers. وإذا لم يكن يعمل، يستخدم Node
   المحرّكات السابقة.

يشمل هذا الدليل Linux وmacOS وWindows. للمعلومات العامة عن البوت
راجع [README](README.ar.md)، ولخدمة Python راجع [`python/README.md`](python/README.md).

---

## 1. المتطلبات

| المكوّن | الإصدار | الغرض |
|---|---|---|
| Git | أي إصدار حديث | تنزيل المشروع وتحديثه |
| Node.js | 22 أو أحدث (يُستحسن 24 LTS) | البوت والواجهة الويب وقاعدة البيانات |
| Ollama | إصدار حديث | الذكاء الاصطناعي النصّي المحلي |
| Python | 3.11 أو 3.12 | خدمة الصوت والصور (اختياري) |
| ffmpeg | إصدار حديث | بديل للصوت بدون Python (اختياري) |

يحتاج الذكاء الاصطناعي النصّي إلى تنزيل نماذج Ollama. مع بطاقة GTX 1650 بسعة 4 غيغابايت
يعمل `qwen3:4b` و`qwen2.5:3b`؛ ومع ذاكرة أكبر يمكن استخدام نماذج أكبر.

---

## 2. تنزيل المشروع (`git clone`)

### Linux وmacOS

```bash
git clone https://github.com/ClawProject/El-Repositorio-de-Claw.git
cd El-Repositorio-de-Claw
```

### Windows (PowerShell)

```powershell
git clone https://github.com/ClawProject/El-Repositorio-de-Claw.git
cd El-Repositorio-de-Claw
```

> إذا كان المشروع موجودًا لديك بالفعل، حدّثه بالأمر `git pull` داخل المجلد.
> لا تنزّل ملف ZIP: بذلك تفقد السجل وإمكانية التحديث.

---

## 3. تثبيت Node.js

### Linux وmacOS باستخدام nvm (مُستحسن)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# أغلق الطرفية وأعد فتحها، أو نفّذ:
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

nvm install 22
nvm alias default 22
node --version       # يجب أن يظهر v22.x أو أحدث
npm --version
```

### macOS باستخدام Homebrew

```bash
brew install node
```

### Windows

نزّل مثبّت LTS من [nodejs.org](https://nodejs.org/) أو استخدم:

```powershell
winget install OpenJS.NodeJS.LTS
```

أغلق PowerShell وأعد فتحها لتحديث `PATH`.

---

## 4. تثبيت Ollama والنماذج

### Linux وmacOS

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

أو باستخدام Homebrew:

```bash
brew install ollama
brew services start ollama
```

### Windows

```powershell
winget install Ollama.Ollama
```

ثم في أي طرفية:

```bash
ollama pull qwen3:4b
ollama pull qwen2.5:3b
```

تحقّق من أنه يستجيب:

```bash
ollama list
curl http://127.0.0.1:11434/api/tags
```

---

## 5. تثبيت تبعيات Node

من جذر المشروع:

```bash
npm install
```

إذا اشتكى PowerShell في Windows من `npm.ps1`، استخدم `npm.cmd install`.

في Windows يمكنك أيضًا النقر المزدوج على **`arrancar.bat`**: يثبّت التبعيات
الناقصة، ويُنشئ `.env` عند الحاجة، ويشغّل البوت.

---

## 6. إعداد `.env`

انسخ النموذج وعدّله:

```bash
cp .env.example .env
```

في Windows:

```powershell
Copy-Item .env.example .env
notepad .env
```

إعداد أدنى للبدء:

```dotenv
OLLAMA_MODEL=qwen3:4b
OLLAMA_MODEL_BRAIN=qwen2.5:3b
# معرّف المجموعة (أو اكتب "!claw aqui" في المجموعة)
WHATSAPP_GROUP_JID=120363000000000000@g.us
```

- يمكنك ربط المجموعة لاحقًا بكتابة `!claw aqui` في واتساب؛ يُحفظ
  المعرّف فقط، ولا يُحفظ اسم المجموعة أبدًا.
- إذا ضبطت `PICKLEBRAIN_DATA_DIR`، يمكن أن يكون ملف `.env` في مجلد
  البيانات هذا.
- يمكن تغيير معظم الإعدادات والبوت يعمل عبر `!claw ajustes`؛
  أعد التشغيل بعد تعديل `.env` يدويًا.
- **لا ترفع `.env` إلى Git**: فهو يحتوي عناوين بريد وكلمات مرور ورقم هاتفك.
  وهو مُدرج أصلًا في `.gitignore`.

كل المتغيرات موثّقة في [`.env.example`](.env.example) وفي
[README](README.ar.md).

---

## 7. خدمة الصوت والصور بلغة Python (اختيارية، مُستحسنة)

بدون هذه الخدمة يعمل Claw أيضًا: يستخدم الصوت ffmpeg + Whisper في Node،
وتستخدم الصور `sd-cli` أو خادم HTTP. ومع Python تحصل على
`faster-whisper` (أسرع) و`diffusers`.

### 7.1 إنشاء بيئة افتراضية

من جذر المشروع:

```bash
python3.12 -m venv .venv
```

إذا لم يكن `python3.12` موجودًا في النظام:

```bash
# Debian/Ubuntu
sudo apt install python3.12 python3.12-venv

# macOS مع Homebrew
brew install python@3.12
```

في Windows:

```powershell
py -3.12 -m venv .venv
```

### 7.2 تثبيت التبعيات

```bash
# Linux/macOS
.venv/bin/pip install -r python/requirements.txt

# Windows
.venv\Scripts\pip.exe install -r python/requirements.txt
```

فقط إذا أردت توليد الصور عبر diffusers:

```bash
.venv/bin/pip install -r python/requirements-images.txt
```

> بدون بطاقة NVIDIA، ثبّت أولًا نسخة torch الخاصة بالمعالج:
>
> ```bash
> .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
> ```
>
> مع بطاقة NVIDIA يجب أن تكون torch نسخة CUDA. وإذا اكتشف Whisper CUDA
> لكن تفتقد `libcublas`/cuDNN، تنتقل الخدمة تلقائيًا إلى المعالج.

### 7.3 تشغيل الخدمة

في **طرفية أخرى**، من جذر المشروع:

```bash
# Linux/macOS
.venv/bin/python python/server.py

# Windows
.venv\Scripts\python.exe python\server.py
```

يمكنك أيضًا استخدام:

```bash
npm run ia          # Windows/macOS إذا كان "python" في PATH
npm run ia:linux    # Linux
```

تحقّق من أنها تستجيب:

```bash
curl http://127.0.0.1:5050/health
```

يجب أن يعيد `"ok": true` مع حالة `voice` و`images`. يكتشفها البوت
تلقائيًا عند بدء التشغيل ويعرض محرّك الصوت المستخدم.

### 7.4 النماذج

أول تفريغ ينزّل نموذج Whisper (نحو 150 ميغابايت مع `base`). وأول صورة
تنزّل نموذج diffusers (نحو 4 غيغابايت مع SD 1.5). تُحفظ في
`data/models/`، وهو مجلد يتجاهله Git.

متغيرات مفيدة:

```dotenv
PYTHON_AI_URL=http://127.0.0.1:5050
PYTHON_WHISPER_MODEL=base
PYTHON_WHISPER_DEVICE=auto
PYTHON_IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
PYTHON_IMAGE_UNLOAD=true
```

مع بطاقة بسعة 4 غيغابايت اترك `PYTHON_IMAGE_UNLOAD=true` كي يستعيد Ollama
ذاكرة VRAM بعد كل صورة.

---

## 8. تشغيل Claw

```bash
npm start       # البوت الكامل: واتساب + الويب + التذكيرات
npm run web     # الويب/API فقط، بدون واتساب
npm run sim     # محاكي في الطرفية، بدون واتساب
```

في المرة الأولى يفتح Claw المتصفح على `http://localhost:3000/setup` لاختيار
اللغة (100 لغة). يُحفظ الاختيار في قاعدة البيانات، ولا يتصل البوت
بواتساب قبل ذلك. يمكن تغييره لاحقًا من واتساب بالأمر `!claw language en`
(المالك/المشرفون) أو بالعودة إلى `/setup`.

بعد ذلك يعرض `npm start` **رمز QR**. امسحه في واتساب:

**الإعدادات → الأجهزة المرتبطة → ربط جهاز**

تُحفظ الجلسة في `data/auth/` (أو `PICKLEBRAIN_DATA_DIR/auth`). لا
تشارك ذلك المجلد: فهو يمنح الوصول إلى حسابك.

---

## 9. التحقق من التثبيت

```bash
npm run doctor      # Ollama والنماذج وقاعدة البيانات والصوت وغيرها
npm run test:python # عقد Node <-> خدمة Python (بدون نماذج)
npm run test:web    # المصادقة وAPI
npm run test:subjects
npm run test:vetados # الحظر بالرقم وبـ @lid (بدون Ollama)
```

يشغّل `npm test` كل المجموعة و**يحتاج إلى Ollama يعمل**.

اختبار سريع في المحاكي:

```bash
npm run sim
```

```
شباب، ما واجب الرياضيات؟
Ana: علينا عمل الصفحات من 30 إلى 32
ما واجب الرياضيات؟
امتحان التاريخ يوم 20 أكتوبر
Claw، كم يساوي 2+2؟
```

---

## 10. التثبيت عبر Homebrew (macOS وLinux)

يوجد tap فيه صيغة لتثبيت الأمرين `claw` و`claw-ia`:

```bash
brew tap Uyruw3/claw
brew trust Uyruw3/claw   # Homebrew 7 وما بعده
brew install claw
```

أول تشغيل ينزّل تبعيات Node في
`~/.local/share/claw` ويحفظ البيانات في `~/.local/share/claw/data`.

```bash
claw
```

إذا أردت إدارة المجلد بنفسك:

```bash
export CLAW_HOME="$HOME/Claw"
export PICKLEBRAIN_DATA_DIR="$CLAW_HOME/data"
claw
```

لخدمة الصوت والصور بلغة Python:

```bash
CLAW_HOME="$HOME/.local/share/claw"
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON" -m venv "$CLAW_HOME/.venv"
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements.txt"

# فقط لتوليد الصور:
"$CLAW_HOME/.venv/bin/pip" install -r "$(brew --prefix claw)/libexec/python/requirements-images.txt"

claw-ia
```

للتحديث:

```bash
brew update
brew upgrade claw
```

> الـ tap موجود في `Uyruw3/homebrew-claw` لأن منظمة المشروع
> لا تسمح بإنشاء مستودعات من هذا الحساب. يمكن نقله لاحقًا إلى
> `ClawProject`، وسيكون الأمر حينها `brew tap ClawProject/claw`.
>
> تثبّت الصيغة آخر إصدار مستقر منشور. وعند صدور إصدار جديد
> يُحدَّث الـ tap بالأمر `brew update && brew upgrade claw`.

---

## 11. تحديث المشروع

إذا ثبّتته بـ `git clone`:

```bash
git pull
npm install
```

وإذا تغيّرت ملفات `python/requirements*.txt`:

```bash
.venv/bin/pip install -r python/requirements.txt
.venv/bin/pip install -r python/requirements-images.txt
```

أعد تشغيل Node وخدمة Python بعد التحديث.

---

## 12. مشاكل شائعة

**`npm start` لا يجد Ollama.**
افتح تطبيق Ollama أو نفّذ `ollama serve`. تحقّق بالأمر
`curl http://127.0.0.1:11434/api/tags`.

**البوت لا يقول شيئًا في المجموعة.**
1. تحقّق من أنها مرتبطة: اكتب `!claw aqui` في المجموعة أو اضبط
   `WHATSAPP_GROUP_JID`.
2. اكتب `!claw` لمعرفة الحالة.
3. شغّله مع `LOG_LEVEL=debug` لترى لماذا تُستبعد الرسائل.

**الرسائل الصوتية لا تعمل.**
شغّل `python/server.py` وتحقّق بـ `npm run doctor`. وبدون Python ثبّت
ffmpeg وأعد فتح الطرفية.

**يفشل `faster-whisper` مع `metadata_errors`.**
لديك `av` 19. ثبّت إصدارًا محددًا:

```bash
.venv/bin/pip install 'av<19'
```

**CUDA لا يُحمَّل (`libcublas.so.12`).**
ينتقل Whisper تلقائيًا إلى المعالج. لاستخدام البطاقة ثبّت
وقت تشغيل CUDA ونسخة torch المتوافقة مع CUDA. وحتى ذلك الحين يعمل الصوت على المعالج.

**أول صورة تستغرق وقتًا طويلًا.**
يجري تنزيل نموذج diffusers (نحو 4 غيغابايت). وما بعدها يحتاج وقت
التوليد فقط.

**الموقع لا يرسل رموز الدخول.**
اضبط `SMTP_HOST` و`SMTP_PORT` و`SMTP_USER` و`SMTP_PASSWORD` في `.env`.
اختبر بالأمر `npm run smtp -- بريدك@alu.edu.gva.es`.

**PowerShell يمنع `npm.ps1`.**
استخدم `npm.cmd` أو نفّذ
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` وافتح طرفية أخرى.

---

## 13. البنية الدنيا بعد التثبيت

```
El-Repositorio-de-Claw/
├─ src/                 كود البوت (Node)
├─ python/              خدمة الصوت والصور
├─ docs/                الموقع الثابت والتوثيق
├─ sdserver/            محرّك stable-diffusion.cpp اختياري
├─ data/                الجلسة وقاعدة البيانات والصور والنماذج (خارج Git)
├─ .env                 إعداداتك (خارج Git)
├─ package.json
└─ arrancar.bat         سكربت التشغيل في Windows
```
