import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthError, createWebAuth } from '../web-auth.js';

const student = 'alumna@alu.edu.gva.es';

test('el código solo permite el dominio del instituto, es de un uso y crea sesión temporal', async () => {
  let timestamp = 1_000_000;
  const sent = [];
  const auth = createWebAuth({
    now: () => timestamp,
    randomInt: () => 42,
    sendCode: async (email, code) => sent.push({ email, code })
  });

  await assert.rejects(
    auth.requestCode('alguien@example.com', 'client-1'),
    (error) => error instanceof AuthError && error.status === 400
  );
  const challenge = await auth.requestCode(student, 'client-1');
  assert.equal(challenge.email, student);
  assert.equal(sent[0].code, '000042');
  await assert.rejects(
    auth.requestCode(student, 'client-1'),
    (error) => error instanceof AuthError && error.status === 429
  );

  const login = auth.verifyCode(student, '000042');
  assert.equal(login.email, student);
  assert.equal(auth.authenticate(`Bearer ${login.token}`).email, student);
  assert.throws(() => auth.verifyCode(student, '000042'), AuthError);
  auth.logout(auth.authenticate(`Bearer ${login.token}`));
  assert.equal(auth.authenticate(`Bearer ${login.token}`), null);

  timestamp += 61_000;
  await auth.requestCode(student, 'client-1');
  timestamp += 10 * 60 * 1000;
  assert.throws(
    () => auth.verifyCode(student, '000042'),
    (error) => error instanceof AuthError && error.status === 401
  );

  const secondLogin = await auth.requestCode(student, 'client-1');
  const session = auth.verifyCode(student, '000042');
  assert.equal(auth.authenticate(`Bearer ${session.token}`).email, student);
  timestamp = secondLogin.expiresAt + 8 * 60 * 60 * 1000;
  assert.equal(auth.authenticate(`Bearer ${session.token}`), null);
});

test('limita intentos del código y solicitudes por correo', async () => {
  let timestamp = 10_000;
  let sentCount = 0;
  const auth = createWebAuth({
    now: () => timestamp,
    randomInt: () => 654321,
    sendCode: async () => { sentCount += 1; }
  });

  await auth.requestCode(student, 'client-2');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.throws(
      () => auth.verifyCode(student, '111111'),
      (error) => error instanceof AuthError && error.status === 401
    );
  }
  assert.throws(() => auth.verifyCode(student, '654321'), AuthError);

  for (let request = 1; request < 5; request += 1) {
    timestamp += 61_000;
    await auth.requestCode(student, `client-${request + 2}`);
  }
  timestamp += 61_000;
  await assert.rejects(
    auth.requestCode(student, 'another-client'),
    (error) => error instanceof AuthError && error.status === 429
  );
  assert.equal(sentCount, 5);
});

test('el modo debug abre una sesión de administrador y limita los intentos', () => {
  let timestamp = 50_000;
  const auth = createWebAuth({
    now: () => timestamp,
    sendCode: async () => {},
    debugCode: '0912'
  });

  assert.throws(
    () => auth.loginDebug('0000', 'client-debug'),
    (error) => error instanceof AuthError && error.status === 401
  );

  const login = auth.loginDebug('0912', 'client-debug');
  assert.equal(login.debug, true);
  assert.equal(login.email, 'debug@picklebrain.local');
  const session = auth.authenticate(`Bearer ${login.token}`);
  assert.equal(session.debug, true);
  assert.equal(session.email, 'debug@picklebrain.local');

  auth.logout(session);
  assert.equal(auth.authenticate(`Bearer ${login.token}`), null);

  // Tras demasiados fallos, se bloquea por IP durante la ventana.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.throws(
      () => auth.loginDebug('1111', 'client-limit'),
      (error) => error instanceof AuthError && error.status === 401
    );
  }
  assert.throws(
    () => auth.loginDebug('0912', 'client-limit'),
    (error) => error instanceof AuthError && error.status === 429
  );

  timestamp += 16 * 60 * 1000;
  const afterWait = auth.loginDebug('0912', 'client-limit');
  assert.equal(afterWait.debug, true);
});

test('el modo debug se desactiva si no hay código configurado', () => {
  const auth = createWebAuth({ sendCode: async () => {}, debugCode: '' });
  assert.throws(
    () => auth.loginDebug('0912', 'client'),
    (error) => error instanceof AuthError && error.status === 403
  );
});
