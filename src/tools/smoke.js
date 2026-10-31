// Comprobacion rapida de que todos los modulos se cargan sin error.
// Uso: node src/tools/smoke.js
import { config } from '../config.js';
console.log('config ok ->', config.ollamaModel, config.timezone);
const dates = await import('../dates.js');
console.log('dates ok ->', dates.describeToday());
console.log('  parseSpanishDate("el lunes") =', dates.parseSpanishDate('el lunes'));
console.log('  parseSpanishDate("20 de octubre") =', dates.parseSpanishDate('20 de octubre'));
console.log('  parseSpanishDate("mañana") =', dates.parseSpanishDate('mañana'));
console.log('  parseSpanishDate("20/10") =', dates.parseSpanishDate('20/10'));
const subjects = await import('../subjects.js');
console.log('subjects ok ->', subjects.detectSubject('que deberes hay de mates?'));
const signals = await import('../signals.js');
console.log('signals ok');
console.log('  fastRoute("que deberes hay de mates?") =', signals.fastRoute('que deberes hay de mates?'));
console.log('  fastRoute("cuando es el examen de historia?") =', signals.fastRoute('cuando es el examen de historia?'));
console.log('  fastRoute("jajaja") =', signals.fastRoute('jajaja'));
console.log('  looksRelevant("hay que hacer la pagina 30") =', signals.looksRelevant('hay que hacer la pagina 30'));
console.log('  clawQuestion("Claw, cuanto son 2+2") =', JSON.stringify(signals.clawQuestion('Claw, cuanto son 2+2')));
const memory = await import('../memory.js');
await memory.init();
console.log('memory ok ->', memory.stats());
const router = await import('../router.js');
console.log('router ok');
const baileys = await import('@whiskeysockets/baileys');
console.log('baileys ok -> default?', typeof baileys.default, '| makeWASocket:', typeof (baileys.default ?? baileys.makeWASocket));
memory.close();
console.log('\nTODO CARGA CORRECTAMENTE');
