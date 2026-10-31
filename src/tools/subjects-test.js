import assert from 'node:assert/strict';
import test from 'node:test';
import { normalize } from '../brain.js';
import { canonicalSubject, detectSubject } from '../subjects.js';
import { fastRoute } from '../signals.js';

test('Física y Química se detecta como asignatura conjunta', () => {
  for (const text of ['deberes de física y química', 'deberes de fisica y quimica', 'deberes de fyq']) {
    assert.equal(detectSubject(text)?.label, 'física y química', text);
  }
});

test('los mensajes de deberes enrutan Física y Química con la clave conjunta', () => {
  for (const text of ['¿Qué deberes hay de Física y Química?', '¿Qué deberes hay de fisica y quimica?', '¿Qué deberes hay de FYQ?']) {
    assert.deepEqual(fastRoute(text), {
      kind: 'deberes',
      subjectKey: 'fisica y quimica',
      subjectLabel: 'física y química'
    });
  }
});

test('la clasificación conserva la asignatura conjunta aunque la IA devuelva solo Física', () => {
  const result = normalize(
    {
      tipo: 'dato_deberes',
      asignatura: 'física',
      contenido: 'hacer ejercicios',
      fecha: '',
      fecha_texto: '',
      confianza: 0.9,
      correccion: false
    },
    { text: 'hacer ejercicios de fisica y quimica', pending: null }
  );

  assert.equal(result.subject, 'física y química');
  assert.equal(result.subjectKey, 'fisica y quimica');
});

test('Física y Química no cambia las detecciones de Física y Química por separado', () => {
  assert.equal(detectSubject('tarea de física')?.label, 'física');
  assert.equal(detectSubject('tarea de quimica')?.label, 'química');
  assert.equal(canonicalSubject('FYQ'), 'física y química');

  for (const [subject, text] of [
    ['física', 'tarea de física'],
    ['química', 'tarea de quimica']
  ]) {
    const result = normalize(
      { tipo: 'dato_deberes', asignatura: subject, contenido: '', confianza: 0.9 },
      { text, pending: null }
    );
    assert.equal(result.subject, subject);
  }
});
