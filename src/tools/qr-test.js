// Comprueba que la conexion con WhatsApp funciona hasta el punto de generar
// el codigo QR, sin necesidad de escanear nada.
// Uso: node src/tools/qr-test.js
import path from 'node:path';
import os from 'node:os';
import { config } from '../config.js';
import * as memory from '../memory.js';
import { start, stop } from '../whatsapp.js';

const tmpAuth = path.join(os.tmpdir(), `picklebrain-auth-${Date.now()}`);
config.authDir = tmpAuth; // no tocamos la sesion real

async function main() {
  await memory.init();
  console.log('Arrancando el socket de WhatsApp (carpeta temporal)...\n');

  const sock = await start();

  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ kind: 'timeout' }), 45000);
    sock.ev.on('connection.update', (update) => {
      if (update.qr) {
        clearTimeout(timer);
        resolve({ kind: 'qr', length: update.qr.length });
      }
      if (update.connection === 'open') {
        clearTimeout(timer);
        resolve({ kind: 'open' });
      }
      if (update.connection === 'close') {
        clearTimeout(timer);
        resolve({ kind: 'close', code: update.lastDisconnect?.error?.output?.statusCode });
      }
    });
  });

  stop();
  memory.close();

  console.log('\n=== Resultado ===');
  if (result.kind === 'qr') {
    console.log(`OK: WhatsApp ha respondido con un QR (${result.length} caracteres).`);
    console.log('La conexion funciona: al arrancar con "npm start" podras escanearlo.\n');
    process.exitCode = 0;
  } else if (result.kind === 'open') {
    console.log('OK: la sesion ya estaba vinculada y se ha conectado.\n');
    process.exitCode = 0;
  } else if (result.kind === 'timeout') {
    console.log('AVISO: no ha llegado ni QR ni conexion en 45s.');
    console.log('Puede ser la red o un bloqueo del puerto. Prueba a arrancar con "npm start".\n');
    process.exitCode = 1;
  } else {
    console.log(`AVISO: la conexion se cerro antes de tiempo (codigo ${result.code}).\n`);
    process.exitCode = 1;
  }
  setTimeout(() => process.exit(process.exitCode || 0), 300);
}

main().catch((err) => {
  console.error('Fallo al arrancar el socket:', err.message);
  process.exitCode = 1;
  process.exit(1);
});
