// Language test: 100 languages, normalisation, translations and persistence.
// Usage: npm run test:i18n  (it needs neither Ollama nor WhatsApp)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.js';
import * as memory from '../memory.js';
import * as i18n from '../i18n.js';

const stamp = Date.now();
const dbPath = path.join(os.tmpdir(), `claw-i18n-${stamp}.db`);
config.dataDir = path.join(os.tmpdir(), `claw-i18n-${stamp}`);
config.preventSleep = false;
delete process.env.CLAW_LANGUAGE;

await memory.init(dbPath);

try {
  // --- language catalog ---
  assert.equal(i18n.LANGUAGES.length, 100, 'debe haber exactamente 100 idiomas');
  assert.equal(new Set(i18n.codigos()).size, 100, 'los códigos no se repiten');
  for (const code of i18n.SOPORTADOS) {
    assert.ok(i18n.existeIdioma(code), `el idioma traducido "${code}" existe en la lista`);
  }

  // --- normalising what people type ---
  assert.equal(i18n.normalizarIdioma('en'), 'en');
  assert.equal(i18n.normalizarIdioma('en-US'), 'en');
  assert.equal(i18n.normalizarIdioma('English'), 'en');
  assert.equal(i18n.normalizarIdioma('español'), 'es');
  assert.equal(i18n.normalizarIdioma('Español'), 'es');
  assert.equal(i18n.normalizarIdioma('fr-FR'), 'fr');
  assert.equal(i18n.normalizarIdioma('xx'), null);
  assert.equal(i18n.normalizarIdioma(''), null);

  // --- browser Accept-Language ---
  assert.equal(i18n.idiomaDeCabecera('fr-CH, fr;q=0.9, en;q=0.8'), 'fr');
  assert.equal(i18n.idiomaDeCabecera('de-DE,de;q=0.9'), 'de');
  assert.equal(i18n.idiomaDeCabecera(''), 'es');

  // --- first start: a language must be chosen ---
  assert.equal(i18n.necesitaSetup(), true, 'sin idioma guardado hay que configurar');
  assert.equal(i18n.idioma(), 'es', 'el idioma de fábrica es español');

  // --- fixed translations ---
  i18n.setIdioma('es');
  assert.match(i18n.t('welcome'), /PickleBrain/);
  assert.match(i18n.t('footer'), /grupo/);
  i18n.setIdioma('en');
  assert.match(i18n.t('footer'), /group/);
  assert.match(i18n.t('languageChanged', { name: 'English' }), /Language changed/);
  i18n.setIdioma('de');
  assert.match(i18n.t('setupTitle'), /Wähle deine Sprache/);
  i18n.setIdioma('fr');
  assert.match(i18n.t('setupTitle'), /Choisissez votre langue/);
  i18n.setIdioma('ar');
  assert.match(i18n.t('setupTitle'), /اختر لغتك/);

  // --- languages without translated texts: English as fallback ---
  i18n.setIdioma('ja');
  assert.match(i18n.t('footer'), /Based on what has been said/);
  assert.match(i18n.t('setupTitle'), /Choose your language/);

  // --- instruction for the AI ---
  i18n.setIdioma('es');
  assert.match(i18n.instruccionIdioma(), /español/i);
  i18n.setIdioma('en');
  assert.match(i18n.instruccionIdioma(), /English/);
  i18n.setIdioma('de');
  assert.match(i18n.instruccionIdioma(), /Deutsch/);

  // --- saving and reloading (what the /setup web does) ---
  assert.equal(i18n.guardarIdioma('fr'), true);
  assert.equal(i18n.idioma(), 'fr');
  assert.equal(memory.getSetting('cfg:idioma'), JSON.stringify('fr'));
  assert.equal(i18n.necesitaSetup(), false, 'al guardar deja de hacer falta configurar');

  i18n.setIdioma('es'); // simulate a restart: memory in Spanish...
  assert.equal(i18n.idioma(), 'es');
  assert.equal(i18n.cargarIdioma(), 'fr'); // ...and the database wins
  assert.equal(i18n.idioma(), 'fr');

  // An invalid language breaks nothing.
  assert.equal(i18n.guardarIdioma('xx'), false);
  assert.equal(i18n.idioma(), 'fr');

  console.log('OK  i18n: 100 idiomas, normalización, traducciones, respaldo y persistencia.');
} finally {
  memory.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
}
