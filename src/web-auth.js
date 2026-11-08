import crypto from 'node:crypto';

const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@alu\.edu\.gva\.es$/i;
const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const CODE_COOLDOWN_MS = 60 * 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_CODES_PER_EMAIL = 5;
const MAX_CODES_PER_CLIENT = 60;
const MAX_CODE_ATTEMPTS = 5;
const DEBUG_RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_DEBUG_ATTEMPTS = 10;

export class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function digest(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest();
}

function sameDigest(left, right) {
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function createWebAuth({
  sendCode,
  onSendError,
  now = Date.now,
  randomInt = crypto.randomInt,
  debugCode = ''
}) {
  const pepper = crypto.randomBytes(32);
  const challenges = new Map();
  const sessions = new Map();
  const cooldowns = new Map();
  const requestsByEmail = new Map();
  const requestsByClient = new Map();
  const debugAttempts = new Map();

  function pruneExpired(timestamp) {
    for (const [email, challenge] of challenges) {
      if (challenge.expiresAt <= timestamp) challenges.delete(email);
    }
    for (const [tokenHash, session] of sessions) {
      if (session.expiresAt <= timestamp) sessions.delete(tokenHash);
    }
    for (const [email, lastSent] of cooldowns) {
      if (timestamp - lastSent >= RATE_WINDOW_MS) cooldowns.delete(email);
    }
    for (const [client, attempts] of debugAttempts) {
      const recientes = attempts.filter((item) => timestamp - item < DEBUG_RATE_WINDOW_MS);
      if (recientes.length) debugAttempts.set(client, recientes);
      else debugAttempts.delete(client);
    }
  }

  function recordRequest(map, key, timestamp, limit) {
    const recent = (map.get(key) || []).filter((item) => timestamp - item < RATE_WINDOW_MS);
    if (recent.length >= limit) {
      throw new AuthError(429, 'Has solicitado demasiados códigos. Inténtalo más tarde.');
    }
    return recent;
  }

  async function requestCode(emailValue, clientKey) {
    const email = String(emailValue || '').trim().toLowerCase();
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      throw new AuthError(400, 'Usa tu correo institucional terminado en @alu.edu.gva.es.');
    }

    const timestamp = now();
    pruneExpired(timestamp);
    if (cooldowns.has(email) && timestamp - cooldowns.get(email) < CODE_COOLDOWN_MS) {
      throw new AuthError(429, 'Espera un minuto antes de pedir otro código.');
    }
    const emailRequests = recordRequest(requestsByEmail, email, timestamp, MAX_CODES_PER_EMAIL);
    const clientRequests = recordRequest(requestsByClient, clientKey, timestamp, MAX_CODES_PER_CLIENT);
    emailRequests.push(timestamp);
    clientRequests.push(timestamp);
    requestsByEmail.set(email, emailRequests);
    requestsByClient.set(clientKey, clientRequests);
    cooldowns.set(email, timestamp);

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    try {
      await sendCode(email, code);
    } catch (error) {
      onSendError?.(error);
      // If email is not configured, say so plainly: it is not a temporary failure.
      const sinSmtp = /SMTP no est[áa] configurado/i.test(String(error?.message || ''));
      throw new AuthError(
        503,
        sinSmtp
          ? 'El envío de códigos aún no está configurado en el servidor. Avisa a quien lo administra.'
          : 'No se pudo enviar el correo. Inténtalo más tarde.'
      );
    }

    challenges.set(email, {
      codeHash: digest(code, pepper),
      expiresAt: timestamp + CODE_TTL_MS,
      attempts: 0
    });
    return { email, expiresAt: timestamp + CODE_TTL_MS };
  }

  function verifyCode(emailValue, codeValue) {
    const email = String(emailValue || '').trim().toLowerCase();
    const code = String(codeValue || '').trim();
    if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(code)) {
      throw new AuthError(400, 'El correo o el código no son válidos.');
    }

    const challenge = challenges.get(email);
    const timestamp = now();
    if (!challenge || challenge.expiresAt <= timestamp) {
      challenges.delete(email);
      throw new AuthError(401, 'El código ha caducado o no existe. Solicita uno nuevo.');
    }
    challenge.attempts += 1;
    const candidate = digest(code, pepper);
    if (!sameDigest(candidate, challenge.codeHash)) {
      if (challenge.attempts >= MAX_CODE_ATTEMPTS) challenges.delete(email);
      throw new AuthError(401, 'Código incorrecto.');
    }

    challenges.delete(email);
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = digest(token, pepper).toString('hex');
    const expiresAt = timestamp + SESSION_TTL_MS;
    sessions.set(tokenHash, { email, expiresAt, debug: false });
    return { token, email, expiresAt, debug: false };
  }

  /**
   * Debug access: a short code that opens a session with administrator
   * permissions, without going through email. Meant for the bot owner.
   * It is rate limited per IP so it cannot be brute-forced.
   */
  function loginDebug(codeValue, clientKey = 'unknown') {
    const configured = String(debugCode || '').trim();
    if (!configured) {
      throw new AuthError(403, 'El acceso de depuración está desactivado.');
    }

    const timestamp = now();
    pruneExpired(timestamp);
    const client = String(clientKey || 'unknown');
    const attempts = (debugAttempts.get(client) || []).filter(
      (item) => timestamp - item < DEBUG_RATE_WINDOW_MS
    );
    if (attempts.length >= MAX_DEBUG_ATTEMPTS) {
      throw new AuthError(429, 'Demasiados intentos de depuración. Espera unos minutos.');
    }
    attempts.push(timestamp);
    debugAttempts.set(client, attempts);

    const provided = Buffer.from(String(codeValue || '').trim());
    const expected = Buffer.from(configured);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      throw new AuthError(401, 'Código de depuración incorrecto.');
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = digest(token, pepper).toString('hex');
    const expiresAt = timestamp + SESSION_TTL_MS;
    sessions.set(tokenHash, {
      email: 'debug@picklebrain.local',
      name: 'Modo debug',
      debug: true,
      expiresAt
    });
    return {
      token,
      email: 'debug@picklebrain.local',
      name: 'Modo debug',
      debug: true,
      expiresAt
    };
  }

  function authenticate(authorization) {
    const match = /^Bearer\s+([A-Za-z0-9_-]{40,})$/i.exec(String(authorization || ''));
    if (!match) return null;
    const tokenHash = digest(match[1], pepper).toString('hex');
    const session = sessions.get(tokenHash);
    if (!session) return null;
    if (session.expiresAt <= now()) {
      sessions.delete(tokenHash);
      return null;
    }
    return { ...session, tokenHash };
  }

  function logout(session) {
    if (session?.tokenHash) sessions.delete(session.tokenHash);
  }

  return { requestCode, verifyCode, loginDebug, authenticate, logout };
}
