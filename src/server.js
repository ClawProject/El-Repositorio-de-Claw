// Servidor HTTP API y Aplicación Web para PickleBrain y Claw Companion (Metro UI 3 Pro).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import nodemailer from 'nodemailer';
import { config, normalizarJid } from './config.js';
import { log } from './logger.js';
import { clawAnswer } from './claw.js';
import * as memory from './memory.js';
import { transcribeFile } from './transcribe.js';
import { generarImagen, esPedidoDeImagen } from './imagegen.js';
import { isValidISO } from './dates.js';
import { AuthError, createWebAuth } from './web-auth.js';
import * as settings from './settings.js';

const PORT = Number(process.env.PORT || 3000);
const ANDROID_RELEASE_APK_URL =
  'https://github.com/ClawBott/ClawRepository/releases/latest/download/ClawCompanion.apk';
let mailTransport;
const webAuth = createWebAuth({
  debugCode: config.debugCode,
  onSendError(error) {
    log.error('No se pudo enviar el código institucional por SMTP:', error.message);
  },
  async sendCode(email, code) {
    if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
      throw new Error('SMTP no está configurado.');
    }
    if (!mailTransport) {
      mailTransport = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: { user: config.smtpUser, pass: config.smtpPassword },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000
      });
    }
    await mailTransport.sendMail({
      from: config.smtpFrom,
      to: email,
      subject: 'Tu código de acceso a Claw',
      text: `Tu código de acceso es ${code}. Caduca en 10 minutos. Si no has solicitado este código, puedes ignorar este mensaje.`,
      html: `<p>Tu código para iniciar sesión en Claw es:</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${code}</p><p>Caduca en 10 minutos. Si no has solicitado este código, puedes ignorar este mensaje.</p>`
    });
  }
});
const TEMP_IMAGE_DIR = path.join(os.tmpdir(), 'claw_generated_images');
if (!fs.existsSync(TEMP_IMAGE_DIR)) {
  fs.mkdirSync(TEMP_IMAGE_DIR, { recursive: true });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(JSON.stringify(data));
}

function sendHtml(res, html) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8'
  });
  res.end(html);
}

function sendOptions(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end();
}

const LOCAL_WEB_ORIGINS = new Set([
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`
]);

// ngrok sirve la propia web, asi que el navegador envia su dominio como Origin.
// Sin esto, cualquier peticion desde el tunel acabaria en un 403.
const NGROK_ORIGIN = /^https:\/\/[a-z0-9-]+\.ngrok(?:-free)?\.(?:app|dev|io)$/i;

function isAllowedOrigin(origin) {
  if (LOCAL_WEB_ORIGINS.has(origin)) return true;
  if (config.webAllowedOrigins.includes(origin)) return true;
  if (config.ngrokDomain && origin === `https://${config.ngrokDomain}`) return true;
  return NGROK_ORIGIN.test(origin);
}

function startNgrok(server) {
  if (!config.ngrokEnabled) return;
  if (!config.ngrokDomain) {
    log.warn('NGROK_ENABLED está activo, pero NGROK_DOMAIN está vacío.');
    return;
  }

  let tunnel = null;
  let restartTimer = null;
  let stopping = false;

  const launch = () => {
    if (stopping) return;
    tunnel = spawn(
      'ngrok',
      ['http', String(PORT), '--url', `https://${config.ngrokDomain}`],
      { windowsHide: true, stdio: 'ignore' }
    );
    tunnel.once('spawn', () => log.info(`Túnel ngrok activo en https://${config.ngrokDomain} → puerto ${PORT}.`));
    tunnel.once('error', (err) => {
      if (err.code === 'ENOENT') {
        // Sin el binario no tiene sentido reintentar cada 5 s: avisa una vez.
        stopping = true;
        log.warn('No se encontró ngrok; el túnel público queda desactivado. Instálalo o pon NGROK_ENABLED=false.');
        return;
      }
      log.error(`No se pudo iniciar ngrok: ${err.message}`);
    });
    tunnel.once('close', (code) => {
      if (stopping) return;
      log.warn(`ngrok terminó${code === null ? '' : ` con código ${code}`}; reintento en 5 segundos.`);
      restartTimer = setTimeout(launch, 5000);
      restartTimer.unref?.();
    });
  };

  const stop = () => {
    stopping = true;
    if (restartTimer) clearTimeout(restartTimer);
    if (tunnel && !tunnel.killed) tunnel.kill();
  };

  launch();
  server.once('close', stop);
  process.once('exit', stop);
}

async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf8');
      if (body.length > 20 * 1024 * 1024) { // 20MB max
        reject(new Error('Payload demasiado grande'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

/** IP real del cliente (ngrok añade X-Forwarded-For). */
function clientAddressOf(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',').pop().trim();
  return forwardedFor || req.socket.remoteAddress || 'unknown';
}

function textoCorto(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Datos de registro que llegan con la petición del código.
 * Devuelve null si no se ha enviado ninguno (clientes antiguos).
 */
function perfilDeRegistro(body) {
  const fuente = body?.profile && typeof body.profile === 'object' ? body.profile : body || {};
  const nombre = textoCorto(fuente.name, 80);
  const apellidos = textoCorto(fuente.surname, 120);
  const curso = textoCorto(fuente.course, 40);
  const grupo = textoCorto(fuente.group, 40);
  const hayDatos = Boolean(nombre || apellidos || curso || grupo);
  if (!hayDatos) return null;
  if (nombre.length < 2) {
    throw new AuthError(400, 'Escribe tu nombre para completar el registro.');
  }
  if (!curso) {
    throw new AuthError(400, 'Dinos en qué curso estás.');
  }
  return { name: nombre, surname: apellidos, course: curso, group: grupo };
}

export function startServer({ auth = webAuth } = {}) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const origin = req.headers.origin;

    if (origin && !isAllowedOrigin(origin)) {
      return sendJson(res, 403, { error: 'Origen web no autorizado' });
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      return sendOptions(res);
    }

    try {
      if (pathname === '/api/auth/request-code' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        // El registro es obligatorio antes de pedir el código.
        const profile = perfilDeRegistro(body);
        const result = await auth.requestCode(body.email, clientAddressOf(req));
        if (profile) {
          memory.saveStudent({
            email: result.email,
            name: profile.name,
            surname: profile.surname,
            course: profile.course,
            group: profile.group
          });
        }
        return sendJson(res, 200, {
          success: true,
          email: result.email,
          expiresAt: result.expiresAt,
          registered: Boolean(profile || memory.getStudent(result.email)),
          message: 'Si el correo es válido, recibirás un código en tu bandeja de entrada.'
        });
      }

      if (pathname === '/api/auth/verify' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const login = auth.verifyCode(body.email, body.code);
        const student = memory.touchStudentLogin(login.email);
        return sendJson(res, 200, { ...login, student });
      }

      // Modo debug: un código corto abre sesión de administrador sin correo.
      // Solo funciona desde un origen web permitido y con límite de intentos.
      if (pathname === '/api/auth/debug' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const code = String(body.code ?? body.email ?? '').trim();
        return sendJson(res, 200, auth.loginDebug(code, clientAddressOf(req)));
      }

      const session = pathname.startsWith('/api/')
        ? auth.authenticate(req.headers.authorization)
        : null;
      if (pathname.startsWith('/api/') && !session) {
        return sendJson(res, 401, { error: 'Inicia sesión con tu correo institucional para continuar.' });
      }

      if (pathname === '/api/settings' || pathname.startsWith('/api/dev/')) {
        return sendJson(res, 403, { error: 'Los ajustes y herramientas de administración no están disponibles para cuentas de estudiantes.' });
      }

      if (pathname === '/api/auth/me' && req.method === 'GET') {
        const student = session.debug ? null : memory.getStudent(session.email);
        return sendJson(res, 200, {
          email: session.email,
          expiresAt: session.expiresAt,
          debug: Boolean(session.debug),
          student
        });
      }

      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        auth.logout(session);
        return sendJson(res, 200, { success: true });
      }

      // ------------------------------------------------------ administración
      // Solo las sesiones de depuración (dueño del bot) pueden entrar aquí.
      if (pathname === '/api/admin/overview' && req.method === 'GET') {
        if (!session.debug) return sendJson(res, 403, { error: 'Solo el modo debug puede ver la administración.' });
        return sendJson(res, 200, {
          settings: settings.list(),
          students: memory.listStudents(),
          stats: {
            entries: memory.listEntries(1000).length,
            students: memory.listStudents().length,
            uptime: Math.round(process.uptime()),
            node: process.version,
            platform: process.platform
          },
          ngrok: config.ngrokDomain,
          model: config.ollamaModel
        });
      }

      if (pathname === '/api/admin/settings' && req.method === 'POST') {
        if (!session.debug) return sendJson(res, 403, { error: 'Solo el modo debug puede cambiar los ajustes.' });
        const body = await parseJsonBody(req);
        if (body.reset) {
          const result = settings.reset(String(body.reset));
          return sendJson(res, result.ok ? 200 : 400, result);
        }
        const clave = String(body.clave || '').trim();
        const texto = String(body.valor ?? '').trim();
        const result = settings.setDesdeTexto(clave, texto);
        return sendJson(res, result.ok ? 200 : 400, result);
      }

      if (pathname === '/api/admin/students' && req.method === 'GET') {
        if (!session.debug) return sendJson(res, 403, { error: 'Solo el modo debug puede ver el alumnado.' });
        return sendJson(res, 200, { students: memory.listStudents() });
      }

      if (pathname === '/api/admin/students' && req.method === 'DELETE') {
        if (!session.debug) return sendJson(res, 403, { error: 'Solo el modo debug puede borrar alumnado.' });
        const body = await parseJsonBody(req);
        const email = String(body.email || url.searchParams.get('email') || '').trim();
        if (!email) return sendJson(res, 400, { error: 'Falta el correo del estudiante.' });
        const deleted = memory.deleteStudent(email);
        return sendJson(res, deleted ? 200 : 404, {
          success: deleted,
          error: deleted ? undefined : 'Ese estudiante no existe.'
        });
      }

      // Servir la Web App en la raíz (GET /)
      if (pathname === '/' && req.method === 'GET') {
        const page = await fs.promises.readFile(path.join(config.rootDir, 'docs', 'index.html'), 'utf8');
        return sendHtml(res, page);
      }

      if ((pathname === '/entrar' || pathname === '/entrar/') && req.method === 'GET') {
        const page = await fs.promises.readFile(path.join(config.rootDir, 'docs', 'entrar', 'index.html'), 'utf8');
        return sendHtml(res, page);
      }

      // Health check endpoint
      if (pathname === '/api/health' && req.method === 'GET') {
        return sendJson(res, 200, {
          status: 'ok',
          app: 'PickleBrain AI',
          version: process.env.APP_VERSION || '1.6.0',
          apkUrl: ANDROID_RELEASE_APK_URL,
          model: config.ollamaModel,
          webSearch: config.webSearchEnabled,
          imageGenEnabled: config.imageGenEnabled,
          privateMode: config.privateMode,
          maintenance: Boolean(config.maintenance)
        });
      }

      // Mantener compatibilidad con clientes anteriores y enviarlos a GitHub Releases.
      if (pathname === '/api/download-apk' && req.method === 'GET') {
        res.writeHead(302, { Location: ANDROID_RELEASE_APK_URL });
        return res.end();
      }

      // Si el servidor está en mantenimiento, bloquea las operaciones normales del API
      if (config.maintenance) {
        return sendJson(res, 503, {
          maintenance: true,
          error: "Estamos ahora mismo en modo mantenimiento ¡Disculpe las molestias!"
        });
      }

      // Conversación con Claw e imágenes integradas.
      if (pathname === '/api/chat' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const question = (body.question || body.prompt || '').trim();
        if (!question) {
          return sendJson(res, 400, { error: 'Falta el parámetro question o prompt' });
        }

        // Detectar si el usuario pide una imagen (ej: "!claw imagen...", "dibuja un perro", etc.)
        const partes = question.split(/\s+/);
        const primerPalabra = partes[0].toLowerCase().replace(/^!/, '');
        const esImagen = esPedidoDeImagen(primerPalabra) || esPedidoDeImagen(partes[1]);

        if (esImagen || body.generateImage) {
          const promptLimpio = question
            .replace(/^!(claw|pickle)\s+/i, '')
            .replace(/^(imagen|imagenes|dibuja|dibujar|dibujo|pinta|pintar|disena|disenar|ilustra|ilustrar)\s+/i, '');

          log.info(`Petición de imagen recibida: "${promptLimpio}"`);
          const imgResult = await generarImagen(promptLimpio || question, { forzar: true });

          if (imgResult.ok && imgResult.buffer) {
            const base64 = imgResult.buffer.toString('base64');
            return sendJson(res, 200, {
              response: `🎨 He generado la imagen para: "${promptLimpio || question}"`,
              imageBase64: base64,
              mime: imgResult.mime || 'image/png'
            });
          } else {
            return sendJson(res, 200, {
              response: `🪝 No pude generar la imagen: ${imgResult.error || 'Error en el motor SD'}`,
              error: imgResult.error
            });
          }
        }

        // Respuesta normal de conversación
        const answer = await clawAnswer({
          question: question,
          history: body.history || [],
          persona: body.persona || 'normal',
          chatJid: body.userJid || body.chatJid || null,
          forzarBusca: Boolean(body.forzarBusca)
        });

        return sendJson(res, 200, {
          response: answer,
          question: question
        });
      }

      // Endpoint dedicado para la generación de imágenes
      if (pathname === '/api/imagegen' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const prompt = (body.prompt || '').trim();
        if (!prompt) {
          return sendJson(res, 400, { error: 'Falta el parámetro prompt' });
        }

        log.info(`Generando imagen desde API: "${prompt}"`);
        const result = await generarImagen(prompt, { forzar: true });

        if (result.ok && result.buffer) {
          return sendJson(res, 200, {
            success: true,
            prompt: prompt,
            imageBase64: result.buffer.toString('base64'),
            mime: result.mime || 'image/png'
          });
        } else {
          return sendJson(res, 500, {
            success: false,
            error: result.error || 'Error al generar imagen'
          });
        }
      }

      // Obtener, agregar o borrar contexto escolar (deberes/exámenes)
      if (pathname === '/api/context') {
        if (req.method === 'DELETE' || (req.method === 'POST' && url.searchParams.get('action') === 'delete')) {
          const body = req.method === 'POST' ? await parseJsonBody(req) : {};
          const id = body.id || url.searchParams.get('id');
          const entryId = Number(id);
          if (!Number.isSafeInteger(entryId) || entryId < 1) {
            return sendJson(res, 400, { error: 'El ID del apunte no es válido' });
          }
          memory.deleteEntry(entryId);
          return sendJson(res, 200, { success: true, deletedId: entryId });
        }

        if (req.method === 'GET') {
          const chatJid = url.searchParams.get('chatJid') || null;
          const deberes = memory.findPending({ kind: 'deberes', chatJid }) || [];
          const examenes = memory.findPending({ kind: 'examen', chatJid }) || [];
          const briefingText = memory.briefing(chatJid);

          return sendJson(res, 200, {
            briefing: briefingText,
            deberes,
            examenes
          });
        }

        if (req.method === 'POST') {
          const body = await parseJsonBody(req);
          if (typeof body.description !== 'string' || !body.description.trim()) {
            return sendJson(res, 400, { error: 'Falta la descripción del contexto' });
          }

          const date = body.dateISO || null;
          if (date && !isValidISO(date)) {
            return sendJson(res, 400, { error: 'La fecha debe tener formato YYYY-MM-DD' });
          }
          const kind = body.kind === 'examen' ? 'examen' : body.kind === 'deberes' ? 'deberes' : null;
          if (!kind) {
            return sendJson(res, 400, { error: 'El tipo debe ser deberes o examen' });
          }
          const saved = memory.saveEntry({
            kind,
            subject: String(body.subject || 'General').trim().slice(0, 100),
            content: String(body.description).trim().slice(0, 2000),
            fecha: date,
            chatJid: body.chatJid || null
          });

          if (!saved.entry) {
            return sendJson(res, 400, { error: 'No se pudo guardar el apunte' });
          }
          return sendJson(res, 200, { success: true, entry: saved.entry, status: saved.status });
        }
      }

      // Transcripción de audio / notas de voz
      if (pathname === '/api/transcribe' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.audioBase64) {
          return sendJson(res, 400, { error: 'Falta el audio en formato audioBase64' });
        }

        const buffer = Buffer.from(body.audioBase64, 'base64');
        const tempPath = path.join(os.tmpdir(), `claw_voice_${Date.now()}.ogg`);
        await fs.promises.writeFile(tempPath, buffer);

        try {
          const transcription = await transcribeFile(tempPath);
          await fs.promises.unlink(tempPath).catch(() => {});

          let clawReply = null;
          if (transcription.text && body.askClaw !== false) {
            clawReply = await clawAnswer({
              question: transcription.text,
              chatJid: body.chatJid || null
            });
          }

          return sendJson(res, 200, {
            transcription: transcription.text,
            response: clawReply,
            seconds: transcription.seconds
          });
        } catch (err) {
          await fs.promises.unlink(tempPath).catch(() => {});
          throw err;
        }
      }

      // Ruta no encontrada
      return sendJson(res, 404, { error: 'Ruta no encontrada' });
    } catch (err) {
      if (err instanceof AuthError) {
        return sendJson(res, err.status, { error: err.message });
      }
      log.error('Error en servidor HTTP de PickleBrain:', err.message);
      return sendJson(res, 500, { error: err.message || 'Error interno del servidor' });
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    log.info(`Servidor API HTTP y Web App de PickleBrain activo en http://127.0.0.1:${PORT}`);
    startNgrok(server);
  });

  return server;
}
