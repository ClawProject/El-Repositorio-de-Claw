import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const port = 45000 + Math.floor(Math.random() * 10000);
const allowedOrigin = 'https://picklebrain-test.github.io';
const dbPath = path.join(os.tmpdir(), `picklebrain-web-test-${process.pid}.db`);
const sentCodes = [];
process.env.PORT = String(port);
process.env.WEB_ALLOWED_ORIGINS = allowedOrigin;
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASSWORD = '';
process.env.NGROK_ENABLED = 'false';

const memory = await import('../memory.js');
const { config } = await import('../config.js');
const { createWebAuth } = await import('../web-auth.js');
const { startServer } = await import('../server.js');

// The tests do not want to trigger the Windows power lock.
config.preventSleep = false;

test('la API exige sesión institucional y limita CORS al origen configurado', async (t) => {
  await memory.init(dbPath);
  // The web is already configured: without this, "/" would redirect to /setup.
  memory.setSetting('cfg:idioma', JSON.stringify('es'));
  const auth = createWebAuth({
    randomInt: () => 123456,
    sendCode: async (email, code) => sentCodes.push({ email, code }),
    debugCode: '0912'
  });
  const server = startServer({ auth });
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const headers = { Origin: allowedOrigin, 'Content-Type': 'application/json' };

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    memory.close();
    for (const suffix of ['', '-shm', '-wal']) {
      fs.rmSync(dbPath + suffix, { force: true });
    }
  });

  const homepage = await fetch(`${baseUrl}/`, { headers: { Origin: allowedOrigin } });
  assert.equal(homepage.status, 200);
  const homepageHtml = await homepage.text();
  assert.match(homepageHtml, /La nueva forma de/);
  assert.match(homepageHtml, /href="entrar\/"/);
  const loginPage = await fetch(`${baseUrl}/entrar/`, { headers: { Origin: allowedOrigin } });
  assert.equal(loginPage.status, 200);
  const loginHtml = await loginPage.text();
  assert.match(loginHtml, /@alu\.edu\.gva\.es/);
  assert.match(loginHtml, /Servidor PickleBrain \(ngrok\)/);

  // The initial language setup is available and brings all 100 languages.
  const setup = await fetch(`${baseUrl}/setup`, { headers: { Origin: allowedOrigin } });
  assert.equal(setup.status, 200);
  const setupHtml = await setup.text();
  assert.match(setupHtml, /data-code="es"/);
  assert.equal((setupHtml.match(/class="lang/g) || []).length >= 100, true);
  const setupStatus = await fetch(`${baseUrl}/api/setup/status`, { headers });
  assert.equal(setupStatus.status, 200);
  const setupData = await setupStatus.json();
  assert.equal(setupData.needed, false);
  assert.equal(setupData.language, 'es');
  assert.equal(setupData.languages.length, 100);

  // The page JS must compile (a syntax error would leave the web mute).
  const vm = await import('node:vm');
  for (const [nombre, html] of [
    ['portada', homepageHtml],
    ['acceso', loginHtml],
    ['configuración', setupHtml]
  ]) {
    const inline = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(inline, `la ${nombre} debe incluir su JavaScript inline`);
    assert.doesNotThrow(() => new vm.Script(inline[1]), `el JavaScript de la ${nombre} debe compilar`);
  }
  // The access code is six boxes that write into the hidden field.
  assert.equal((loginHtml.match(/class="otp-digit"/g) || []).length, 6);
  assert.match(loginHtml, /id="auth-code"/);

  const forbidden = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://otra-web.example' }
  });
  assert.equal(forbidden.status, 403);

  // The web served from the ngrok tunnel must be able to use the API too
  // (401 for a missing session, never 403 for an unauthorized origin).
  const fromNgrok = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://picklebrain-prueba.ngrok-free.app' }
  });
  assert.equal(fromNgrok.status, 401);

  // The tunnel's fixed domain is also always a valid origin.
  const fixedNgrok = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://dawn-greeter-grazing.ngrok-free.dev' }
  });
  assert.equal(fixedNgrok.status, 401);

  for (const request of [
    fetch(`${baseUrl}/api/health`, { headers }),
    fetch(`${baseUrl}/api/context`, { headers }),
    fetch(`${baseUrl}/api/download-apk`, { headers, redirect: 'manual' }),
    fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ question: 'hola' })
    }),
    fetch(`${baseUrl}/api/health`)
  ]) {
    assert.equal((await request).status, 401);
  }

  const rejectedEmail = await fetch(`${baseUrl}/api/auth/request-code`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'alguien@example.com' })
  });
  assert.equal(rejectedEmail.status, 400);

  const requestCode = await fetch(`${baseUrl}/api/auth/request-code`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: 'estudiante@alu.edu.gva.es',
      profile: { name: 'Ada', surname: 'Lovelace', course: '2º BACH', group: 'B' }
    })
  });
  assert.equal(requestCode.status, 200);
  const requestData = await requestCode.json();
  assert.equal(requestData.registered, true);
  assert.equal(sentCodes[0].email, 'estudiante@alu.edu.gva.es');

  // Incomplete registration is rejected before sending the code.
  const incomplete = await fetch(`${baseUrl}/api/auth/request-code`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'otra@alu.edu.gva.es', profile: { name: 'A' } })
  });
  assert.equal(incomplete.status, 400);

  const verified = await fetch(`${baseUrl}/api/auth/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: sentCodes[0].email, code: sentCodes[0].code })
  });
  assert.equal(verified.status, 200);
  const login = await verified.json();
  const sessionHeaders = { ...headers, Authorization: `Bearer ${login.token}` };

  // A normal session knows the registered profile, but it is not an admin one.
  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: sessionHeaders });
  assert.equal(me.status, 200);
  const meData = await me.json();
  assert.equal(meData.debug, false);
  assert.equal(meData.student.name, 'Ada');
  assert.equal(meData.student.course, '2º BACH');

  for (const adminPath of ['/api/admin/overview', '/api/admin/students']) {
    const forbiddenAdmin = await fetch(`${baseUrl}${adminPath}`, { headers: sessionHeaders });
    assert.equal(forbiddenAdmin.status, 403, `${adminPath} debe estar cerrado a estudiantes`);
  }
  const forbiddenSetting = await fetch(`${baseUrl}/api/admin/settings`, {
    method: 'POST',
    headers: sessionHeaders,
    body: JSON.stringify({ clave: 'hora_aviso', valor: '21' })
  });
  assert.equal(forbiddenSetting.status, 403);

  // The debug code opens a session with full admin access.
  const badDebug = await fetch(`${baseUrl}/api/auth/debug`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: '0000' })
  });
  assert.equal(badDebug.status, 401);
  const debugLogin = await fetch(`${baseUrl}/api/auth/debug`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: '0912' })
  });
  assert.equal(debugLogin.status, 200);
  const debugData = await debugLogin.json();
  assert.equal(debugData.debug, true);
  const debugHeaders = { ...headers, Authorization: `Bearer ${debugData.token}` };

  const debugMe = await fetch(`${baseUrl}/api/auth/me`, { headers: debugHeaders });
  assert.equal((await debugMe.json()).debug, true);

  const overview = await fetch(`${baseUrl}/api/admin/overview`, { headers: debugHeaders });
  assert.equal(overview.status, 200);
  const overviewData = await overview.json();
  assert.ok(overviewData.settings.length > 5);
  assert.ok(overviewData.students.some((student) => student.email === 'estudiante@alu.edu.gva.es'));
  assert.equal(overviewData.ngrok, 'dawn-greeter-grazing.ngrok-free.dev');

  const settingChange = await fetch(`${baseUrl}/api/admin/settings`, {
    method: 'POST',
    headers: debugHeaders,
    body: JSON.stringify({ clave: 'hora_aviso', valor: '21' })
  });
  assert.equal(settingChange.status, 200);
  const afterChange = await (await fetch(`${baseUrl}/api/admin/overview`, { headers: debugHeaders })).json();
  const changedSetting = afterChange.settings.find((item) => item.clave === 'hora_aviso');
  assert.equal(changedSetting.valor, 21);
  const settingReset = await fetch(`${baseUrl}/api/admin/settings`, {
    method: 'POST',
    headers: debugHeaders,
    body: JSON.stringify({ reset: 'hora_aviso' })
  });
  assert.equal(settingReset.status, 200);

  const debugStudents = await fetch(`${baseUrl}/api/admin/students`, { headers: debugHeaders });
  assert.equal(debugStudents.status, 200);
  assert.equal((await debugStudents.json()).students[0].email, 'estudiante@alu.edu.gva.es');

  const debugDelete = await fetch(`${baseUrl}/api/admin/students`, {
    method: 'DELETE',
    headers: debugHeaders,
    body: JSON.stringify({ email: 'estudiante@alu.edu.gva.es' })
  });
  assert.equal(debugDelete.status, 200);
  const afterStudentDelete = await fetch(`${baseUrl}/api/admin/students`, { headers: debugHeaders });
  assert.equal((await afterStudentDelete.json()).students.length, 0);

  const health = await fetch(`${baseUrl}/api/health`, { headers: sessionHeaders });
  assert.equal(health.status, 200);
  assert.equal(
    (await health.json()).apkUrl,
    'https://github.com/ClawBott/ClawRepository/releases/latest/download/ClawCompanion.apk'
  );

  const apkRedirect = await fetch(`${baseUrl}/api/download-apk`, {
    headers: sessionHeaders,
    redirect: 'manual'
  });
  assert.equal(apkRedirect.status, 302);
  assert.equal(
    apkRedirect.headers.get('location'),
    'https://github.com/ClawBott/ClawRepository/releases/latest/download/ClawCompanion.apk'
  );

  const settingsUpdate = await fetch(`${baseUrl}/api/settings`, {
    method: 'POST',
    headers: sessionHeaders,
    body: JSON.stringify({ maintenance: true })
  });
  assert.equal(settingsUpdate.status, 403);
  const developerSettings = await fetch(`${baseUrl}/api/dev/settings`, {
    method: 'POST',
    headers: sessionHeaders,
    body: JSON.stringify({ pin: '9018', configUpdates: { maintenance: true } })
  });
  assert.equal(developerSettings.status, 403);

  const fechaFutura = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const created = await fetch(`${baseUrl}/api/context`, {
    method: 'POST',
    headers: sessionHeaders,
    body: JSON.stringify({
      kind: 'deberes',
      subject: 'Historia',
      description: 'Leer el tema 3',
      dateISO: fechaFutura
    })
  });
  assert.equal(created.status, 200);
  const createdData = await created.json();
  assert.equal(createdData.entry.content, 'Leer el tema 3');
  assert.equal(createdData.entry.fecha, fechaFutura);

  const listed = await fetch(`${baseUrl}/api/context`, { headers: sessionHeaders });
  assert.equal((await listed.json()).deberes.length, 1);
  const deleted = await fetch(`${baseUrl}/api/context?id=${createdData.entry.id}`, {
    method: 'DELETE',
    headers: sessionHeaders
  });
  assert.equal(deleted.status, 200);
  const afterDelete = await fetch(`${baseUrl}/api/context`, { headers: sessionHeaders });
  assert.equal((await afterDelete.json()).deberes.length, 0);

  const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: sessionHeaders });
  assert.equal(logout.status, 200);
  const expiredSession = await fetch(`${baseUrl}/api/health`, { headers: sessionHeaders });
  assert.equal(expiredSession.status, 401);
});
