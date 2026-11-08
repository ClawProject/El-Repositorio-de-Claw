// Banned test: checks that a ban by number also applies when WhatsApp
// identifies the person only with their @lid (and the other way round).
// Usage: npm run test:vetados  (it needs neither Ollama nor WhatsApp)
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

// The owner bans Caco's number.
let r = await dice('!claw prohibir +34600555444', DUENO, DUENO, 'Dueno');
todoOk = caso('vetar por número', r, 'comando-prohibir') && todoOk;

// Learn the number <-> @lid equivalence (whatsapp.js does this when it sees a message).
recordarAlias(CACO_LID, CACO_PN);

todoOk = caso('vetado llega con número', await dice('!claw apuntes', CACO_PN, null, 'Caco'), 'vetado') && todoOk;
todoOk = caso('vetado llega con @lid + número', await dice('!claw apuntes', CACO_LID, CACO_PN, 'Caco'), 'vetado') && todoOk;
todoOk = caso('vetado llega SOLO con @lid', await dice('!claw apuntes', CACO_LID, null, 'Caco'), 'vetado') && todoOk;

// The owner can also be recognised by their @lid.
recordarAlias('555000111@lid', DUENO);
todoOk = caso('el dueño es admin también con @lid', await dice('!claw vetados', '555000111@lid', null, 'Dueno'), 'comando-vetados') && todoOk;

// Allowing by number must lift the ban even when the message arrives via the @lid.
r = await dice('!claw permitir +34600555444', DUENO, DUENO, 'Dueno');
todoOk = caso('perdonar por número', r, 'comando-permitir') && todoOk;
todoOk = caso('tras perdonar, el @lid ya no está vetado', await dice('!claw apuntes', CACO_LID, null, 'Caco'), 'comando-apuntes') && todoOk;

// And the other way round: banning by @lid also blocks the messages with the number.
r = await dice(`!claw prohibir ${CACO_LID}`, DUENO, DUENO, 'Dueno');
todoOk = caso('vetar por @lid', r, 'comando-prohibir') && todoOk;
todoOk = caso('vetado por @lid llega con número', await dice('!claw apuntes', CACO_PN, null, 'Caco'), 'vetado') && todoOk;
todoOk = caso('vetado por @lid llega con @lid', await dice('!claw apuntes', CACO_LID, null, 'Caco'), 'vetado') && todoOk;

// The number can be written with or without the country prefix.
r = await dice('!claw prohibir 600777888', DUENO, DUENO, 'Dueno');
todoOk = caso('vetar sin prefijo del país', r, 'comando-prohibir') && todoOk;
todoOk = caso('ese veto bloquea el número con prefijo', await dice('!claw apuntes', '34600777888@s.whatsapp.net', null, 'Otro'), 'vetado') && todoOk;
r = await dice('!claw permitir +34600777888', DUENO, DUENO, 'Dueno');
todoOk = caso('perdonar con prefijo quita el veto sin prefijo', r, 'comando-permitir') && todoOk;

// The owner cannot be banned, not even through an alias.
r = await dice('!claw prohibir 555000111@lid', DUENO, DUENO, 'Dueno');
const protegido =
  /No puedo vetar/i.test(r.replies.join(' ')) && !admins.esVetado(DUENO, '555000111@lid');
console.log(`${protegido ? 'OK  ' : 'FALLO'} ${'no se puede vetar al dueño por su @lid'.padEnd(46)} ${r.replies.join(' ').split('\n')[0]}`);
todoOk = protegido && todoOk;

console.log(todoOk ? '\nTODO OK' : '\nHAY FALLOS');
process.exit(todoOk ? 0 : 1);
