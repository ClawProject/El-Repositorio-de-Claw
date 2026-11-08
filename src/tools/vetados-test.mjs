// Prueba de vetados: comprueba que un veto por número también se aplica
// cuando WhatsApp identifica a la persona solo con su @lid (y al revés).
// Uso: npm run test:vetados  (no necesita Ollama ni WhatsApp)
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.js';
import * as memory from '../memory.js';
import * as admins from '../admins.js';
import { recordarAlias } from '../identities.js';
import { handleMessage, resetTransientState } from '../router.js';

const stamp = Date.now();
config.dataDir = path.join(os.tmpdir(), `claw-repro-${stamp}`);
config.preventSleep = false;
await memory.init(path.join(os.tmpdir(), `claw-repro-${stamp}.db`));
resetTransientState();
config.ownerJid = '34600000000@s.whatsapp.net';
config.adminJids = [];
memory.setSetting('group_jid', 'test@g.us');

const DUENO = '34600000000@s.whatsapp.net';
const CACO_LID = '998877665544@lid';
const CACO_PN = '34600555444@s.whatsapp.net';

async function dice(text, senderJid, senderJidAlt, who = 'X') {
  return handleMessage({
    chatJid: 'test@g.us',
    chatName: 'Grupo',
    isGroup: true,
    text,
    senderName: who,
    senderJid,
    senderJidAlt,
    msgId: `m-${Math.random()}`,
    mentionedBot: false,
    fromMe: false,
    esPrivado: false,
    esChatPropio: false
  });
}

function caso(label, r, esperado) {
  const ok = r.action === esperado;
  console.log(`${ok ? 'OK  ' : 'FALLO'} ${label.padEnd(46)} action=${r.action} (esperado ${esperado})`);
  return ok;
}

let todoOk = true;

// El dueño veta el número de Caco.
let r = await dice('!claw prohibir +34600555444', DUENO, DUENO, 'Dueno');
todoOk = caso('vetar por número', r, 'comando-prohibir') && todoOk;

// Aprendemos la equivalencia número <-> @lid (lo hace whatsapp.js al ver un mensaje).
recordarAlias(CACO_LID, CACO_PN);

todoOk = caso('vetado llega con número', await dice('!claw apuntes', CACO_PN, null, 'Caco'), 'vetado') && todoOk;
todoOk = caso('vetado llega con @lid + número', await dice('!claw apuntes', CACO_LID, CACO_PN, 'Caco'), 'vetado') && todoOk;
todoOk = caso('vetado llega SOLO con @lid', await dice('!claw apuntes', CACO_LID, null, 'Caco'), 'vetado') && todoOk;

// El dueño también puede ser reconocido por su @lid.
recordarAlias('555000111@lid', DUENO);
todoOk = caso('el dueño es admin también con @lid', await dice('!claw vetados', '555000111@lid', null, 'Dueno'), 'comando-vetados') && todoOk;

// Perdonar usando el número debe quitar el veto aunque el mensaje llegue por @lid.
r = await dice('!claw permitir +34600555444', DUENO, DUENO, 'Dueno');
todoOk = caso('perdonar por número', r, 'comando-permitir') && todoOk;
todoOk = caso('tras perdonar, el @lid ya no está vetado', await dice('!claw apuntes', CACO_LID, null, 'Caco'), 'comando-apuntes') && todoOk;

// Y al revés: vetar por @lid bloquea también los mensajes con el número.
r = await dice(`!claw prohibir ${CACO_LID}`, DUENO, DUENO, 'Dueno');
todoOk = caso('vetar por @lid', r, 'comando-prohibir') && todoOk;
todoOk = caso('vetado por @lid llega con número', await dice('!claw apuntes', CACO_PN, null, 'Caco'), 'vetado') && todoOk;
todoOk = caso('vetado por @lid llega con @lid', await dice('!claw apuntes', CACO_LID, null, 'Caco'), 'vetado') && todoOk;

// El número se puede escribir con o sin el prefijo del país.
r = await dice('!claw prohibir 600777888', DUENO, DUENO, 'Dueno');
todoOk = caso('vetar sin prefijo del país', r, 'comando-prohibir') && todoOk;
todoOk = caso('ese veto bloquea el número con prefijo', await dice('!claw apuntes', '34600777888@s.whatsapp.net', null, 'Otro'), 'vetado') && todoOk;
r = await dice('!claw permitir +34600777888', DUENO, DUENO, 'Dueno');
todoOk = caso('perdonar con prefijo quita el veto sin prefijo', r, 'comando-permitir') && todoOk;

// El dueño no se puede vetar ni a través de un alias.
r = await dice('!claw prohibir 555000111@lid', DUENO, DUENO, 'Dueno');
const protegido =
  /No puedo vetar/i.test(r.replies.join(' ')) && !admins.esVetado(DUENO, '555000111@lid');
console.log(`${protegido ? 'OK  ' : 'FALLO'} ${'no se puede vetar al dueño por su @lid'.padEnd(46)} ${r.replies.join(' ').split('\n')[0]}`);
todoOk = protegido && todoOk;

console.log(todoOk ? '\nTODO OK' : '\nHAY FALLOS');
process.exit(todoOk ? 0 : 1);
