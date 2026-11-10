// Manda UN mensaje al grupo del instituto desde tu propia cuenta de WhatsApp.
//
//   npm run enviar "texto del mensaje"
//   npm run enviar -- --listar        (ver los grupos y su identificador)
//
// OJO: cierra antes el bot (arrancar.bat) si lo tienes abierto. Dos conexiones
// a la vez con la misma sesión se pelean y WhatsApp cierra una de las dos.
import { config } from '../config.js';
import * as memory from '../memory.js';
import { welcomeText } from '../replies.js';

const args = process.argv.slice(2);
const listar = args.includes('--listar') || args.includes('-l');
const esBienvenida = args.includes('--bienvenida') || args.includes('-b');
const texto = esBienvenida
  ? welcomeText(config.welcomeMessage)
  : args.filter((a) => !a.startsWith('-')).join(' ').trim();

const silence = {
  level: 'silent',
  fatal: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
  trace: () => {},
  child: () => silence
};

function bail(msg) {
  console.log(`\n  ✗ ${msg}\n`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`  ${msg}`);
}

/**
 * ¿A qué grupo lo mando? Solo por identificador: el del .env o el que guardó
 * el bot al vincularse con "!claw aqui". El nombre no se usa para elegir grupo.
 */
async function resolverGrupo() {
  try {
    await memory.init(config.dbPath);
  } catch {
    /* si no hay base de datos, tiramos del .env */
  }

  const jidFijo = config.groupJid || (memory.getSetting('group_jid') || null);
  if (!jidFijo) return null;
  return { jid: jidFijo, nombre: '', como: 'identificador guardado' };
}

async function main() {
  if (!listar && !texto) {
    bail('Dime qué mensaje mando:\n\n      npm run enviar "Esto es una prueba (Ignorarme)"');
    return;
  }

  const mod = await import('@whiskeysockets/baileys');
  const makeWASocket = mod.default ?? mod.makeWASocket;
  const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } =
    mod;

  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
  if (!state.creds?.registered && !state.creds?.me?.id) {
    bail('No hay sesión de WhatsApp guardada todavía. Arranca el bot y escanea el QR.');
    return;
  } else if (!state.creds?.registered && state.creds?.me?.id) {
    // Para evitar un bucle: si solo tenemos me.id pero registered es false
    // (esto pasa a veces con sesiones antiguas), forzamos registered = true
    state.creds.registered = true;
  }

  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    version = undefined;
  }

  const sock = makeWASocket({
    version,
    logger: silence,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, silence) },
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    getMessage: async () => undefined
  });

  sock.ev.on('creds.update', saveCreds);

  console.log('\n  Conectando con WhatsApp...');
  await new Promise((resolve, reject) => {
    const reloj = setTimeout(() => reject(new Error('WhatsApp no responde (¿tienes internet?)')), 60000);
    sock.ev.on('connection.update', (u) => {
      if (u.connection === 'open') {
        clearTimeout(reloj);
        resolve();
      }
      if (u.connection === 'close') {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason?.loggedOut) {
          clearTimeout(reloj);
          reject(new Error('La sesión se cerró. Hay que volver a escanear el QR (npm run qr).'));
        } else if (code === 440) {
          clearTimeout(reloj);
          reject(
            new Error(
              'Otra conexión está usando esta misma sesión (seguramente el bot abierto). Ciérralo y vuelve a probar.'
            )
          );
        }
      }
    });
  }).catch((err) => {
    bail(err.message);
    throw err;
  });

  ok(`Conectado como ${sock.user?.id || 'desconocido'}`);

  const destino = await resolverGrupo();

  if (listar) {
    const todos = await sock.groupFetchAllParticipating();
    const grupos = Object.values(todos || {}).sort((a, b) => String(a.subject).localeCompare(String(b.subject)));
    console.log(`\n  Grupos en los que estás (${grupos.length}):\n`);
    for (const g of grupos) {
      const marca = destino && g.id === destino.jid ? ' ← este es el asignado' : '';
      console.log(`    ${g.subject}\n      ${g.id}${marca}`);
    }
    console.log('');
    sock.end();
    return;
  }

  if (!destino) {
    bail(
      'No sé a qué grupo mandarlo: no hay ninguno asignado.\n' +
        '      Escribe "!claw aqui" dentro del grupo, o fija WHATSAPP_GROUP_JID.\n' +
        '      Para ver los identificadores:  npm run enviar -- --listar'
    );
    sock.end();
    return;
  }

  ok(`Grupo: ${destino.jid}`);
  ok(`Encontrado por: ${destino.como}`);

  const payload = { text: texto };
  if (esBienvenida) {
    try {
      const meta = await sock.groupMetadata(destino.jid);
      const mentions = (meta.participants || []).map((p) => p.id).filter(Boolean);
      if (mentions.length) payload.mentions = mentions;
    } catch {
      /* si no puedo ver los participantes, mandamos solo el texto */
    }
  }
  const enviado = await sock.sendMessage(destino.jid, payload);
  if (esBienvenida) {
    try {
      memory.setSetting('welcome_sent', new Date().toISOString());
    } catch {
      /* nada */
    }
  }
  console.log(`\n  ✅ Enviado:\n\n    ${texto}\n`);
  ok(`id del mensaje: ${enviado?.key?.id || '?'}`);

  // Un respiro para que WhatsApp confirme antes de cortar.
  await new Promise((r) => setTimeout(r, 1500));
  sock.end();
}

main()
  .catch((err) => {
    if (err?.message?.startsWith('Otra conexión') || err?.message?.startsWith('La sesión')) return;
    console.error(`\n  ✗ ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      memory.close();
    } catch {
      /* nada */
    }
    setTimeout(() => process.exit(process.exitCode || 0), 400);
  });
