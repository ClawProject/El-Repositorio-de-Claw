// Optional local Whisper test with the bundled voice note and a variant with noise.
// Uso: npm run test:voice
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { clawMatch } from '../signals.js';
import { ffmpegAvailable, transcribeFile } from '../transcribe.js';

const execFileAsync = promisify(execFile);
const fixture = process.env.WHISPER_TEST_AUDIO ||
  path.join(config.rootDir, 'src', 'tools', 'fixtures', 'nota-de-voz.ogg');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'picklebrain-voice-test-'));
let passed = 0;

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

try {
  if (!fs.existsSync(fixture)) {
    console.log('La muestra de voz no está incluida; se omite. Puedes probar con una muestra local autorizada.');
  } else {
    const transformers = await import('@huggingface/transformers');
    const cache = transformers.env.cacheDir
      ? path.join(transformers.env.cacheDir, config.whisperModel)
      : '';
    if (!cache || !fs.existsSync(cache)) {
      console.log(`Whisper "${config.whisperModel}" no está en la caché local; se omite (no se descarga nada).`);
    } else {
      assert.equal(await ffmpegAvailable(), true, `No se encuentra ffmpeg: ${config.ffmpegPath}`);

      const noisyFixture = path.join(tempDir, 'nota-con-ruido.ogg');
      await execFileAsync(config.ffmpegPath, [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-i',
        fixture,
        '-filter_complex',
        "anoisesrc=color=pink:amplitude=0.02:sample_rate=48000[noise];[0:a][noise]amix=inputs=2:duration=first:dropout_transition=0:weights='1 0.15',alimiter=limit=0.95",
        '-c:a',
        'libopus',
        '-b:a',
        '32k',
        noisyFixture
      ]);

      for (const [name, audioPath] of [
        ['Audio español de ejemplo', fixture],
        ['El mismo audio con ruido de fondo', noisyFixture]
      ]) {
        await check(name, async () => {
          const result = await transcribeFile(audioPath, { localFilesOnly: true });
          const text = normalize(result.text);
          console.log(`    ${result.seconds.toFixed(1)} s, ${result.ms} ms`);
          assert.match(text, /\bexamen de historia\b/);
          assert.match(text, /\btema 4\b/);
          assert.match(text, /\btema 5\b/);
          assert.equal(clawMatch(result.text), null, 'El audio de deberes no debe activar a Claw');
        });
      }
    }
  }
  console.log(`\n${passed} comprobaciones locales de Whisper correctas.`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
