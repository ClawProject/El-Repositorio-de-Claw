// Pruebas del cliente del servicio Python, con un servidor HTTP falso.
// No necesita Python ni modelos: comprueba el contrato Node <-> servicio.
// Uso: npm run test:python
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.js';
import * as pythonAi from '../python-ai.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claw-python-ai-'));

let ultimaPeticion = null;

const servidor = http.createServer((req, res) => {
  const trozos = [];
  req.on('data', (c) => trozos.push(c));
  req.on('end', () => {
    const cuerpo = Buffer.concat(trozos);
    ultimaPeticion = { url: req.url, headers: req.headers, cuerpo };

    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, voice: { available: true }, images: { available: true } }));
      return;
    }
    if (req.url === '/warmup?target=voice') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.url === '/transcribe') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ text: '  examen   de historia ', seconds: 2.5, ms: 120 }));
      return;
    }
    if (req.url === '/generate') {
      const peticion = JSON.parse(cuerpo.toString('utf8') || '{}');
      if (/falla/i.test(peticion.prompt)) {
        res.writeHead(507, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'sin memoria de GPU' }));
        return;
      }
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(PNG);
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'no encontrado' }));
  });
});

await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
const { port } = servidor.address();
const base = `http://127.0.0.1:${port}`;

// Guardamos la configuración real para restaurarla al terminar.
const guardado = {
  url: config.pythonAiUrl,
  enabled: config.pythonAiEnabled,
  timeout: config.pythonAiTimeoutMs,
  healthTimeout: config.pythonAiHealthTimeoutMs
};
config.pythonAiEnabled = true;
config.pythonAiUrl = base;
config.pythonAiTimeoutMs = 5000;
config.pythonAiHealthTimeoutMs = 1000;
pythonAi.olvidarEstado();

after(() => {
  servidor.close();
  config.pythonAiUrl = guardado.url;
  config.pythonAiEnabled = guardado.enabled;
  config.pythonAiTimeoutMs = guardado.timeout;
  config.pythonAiHealthTimeoutMs = guardado.healthTimeout;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('detecta voz e imágenes en /health', async () => {
  const estado = await pythonAi.salud({ force: true });
  assert.equal(estado?.ok, true);
  assert.equal(await pythonAi.vozDisponible(), true);
  assert.equal(await pythonAi.imagenDisponible(), true);
});

test('transcribe enviando el audio como multipart', async () => {
  const audio = path.join(tempDir, 'nota.ogg');
  fs.writeFileSync(audio, Buffer.from('OggS-falso'));
  const res = await pythonAi.transcribir(audio);
  assert.deepEqual(res, { text: 'examen de historia', seconds: 2.5, ms: 120 });
  assert.match(ultimaPeticion.headers['content-type'], /^multipart\/form-data; boundary=/);
  assert.match(ultimaPeticion.cuerpo.toString('latin1'), /OggS-falso/);
});

test('genera una imagen y devuelve el buffer', async () => {
  const res = await pythonAi.generarImagen('un pingüino');
  assert.equal(res.ok, true);
  assert.equal(res.mime, 'image/png');
  assert.deepEqual(res.buffer, PNG);
  const peticion = JSON.parse(ultimaPeticion.cuerpo.toString('utf8'));
  assert.equal(peticion.prompt, 'un pingüino');
  assert.equal(typeof peticion.negative_prompt, 'string');
});

test('devuelve el error del servicio si no puede dibujar', async () => {
  const res = await pythonAi.generarImagen('esto falla');
  assert.equal(res.ok, false);
  assert.match(res.error, /sin memoria/i);
});

test('con el servicio desactivado no intenta nada', async () => {
  config.pythonAiEnabled = false;
  pythonAi.olvidarEstado();
  assert.equal(await pythonAi.estaDisponible({ force: true }), false);
  assert.equal(await pythonAi.vozDisponible({ force: true }), false);
  assert.equal(await pythonAi.imagenDisponible({ force: true }), false);
  config.pythonAiEnabled = true;
  pythonAi.olvidarEstado();
});
