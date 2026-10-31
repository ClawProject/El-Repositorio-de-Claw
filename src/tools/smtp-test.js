// Comprueba el SMTP de AsterMail sin arrancar el bot.
// Uso:  npm run smtp            (solo conecta y saluda)
//       npm run smtp -- tu@alu.edu.gva.es   (ademas envia un codigo de prueba)
import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { log } from '../logger.js';

const destino = process.argv[2];

function falta() {
  const vacios = [
    ['SMTP_HOST', config.smtpHost],
    ['SMTP_USER', config.smtpUser],
    ['SMTP_PASSWORD', config.smtpPassword]
  ].filter(([, valor]) => !String(valor || '').trim()).map(([nombre]) => nombre);
  return vacios;
}

async function main() {
  console.log('\n=== PickleBrain: prueba de SMTP ===\n');
  const vacios = falta();
  if (vacios.length) {
    console.log(`Faltan datos en .env: ${vacios.join(', ')}.`);
    console.log('Rellena esas variables con los datos de AsterMail y vuelve a intentarlo.');
    process.exit(1);
  }

  console.log(`Servidor : ${config.smtpHost}:${config.smtpPort} (${config.smtpSecure ? 'TLS' : 'sin TLS implicito'})`);
  console.log(`Usuario  : ${config.smtpUser}`);
  console.log(`Remitente: ${config.smtpFrom}`);

  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: { user: config.smtpUser, pass: config.smtpPassword },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000
  });

  try {
    await transport.verify();
    console.log('\n[OK] El servidor acepta las credenciales.');
  } catch (error) {
    console.log(`\n[FALLA] No se pudo conectar: ${error.message}`);
    process.exit(1);
  }

  if (!destino) {
    console.log('\nNo se ha enviado nada. Para probar un correo de verdad:');
    console.log('  npm run smtp -- tu-correo@alu.edu.gva.es');
    return;
  }

  const codigo = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  try {
    await transport.sendMail({
      from: config.smtpFrom,
      to: destino,
      subject: 'Prueba de Claw: tu código de acceso',
      text: `Este es un correo de prueba. Tu código sería ${codigo}. Caduca en 10 minutos.`,
      html: `<p>Este es un correo de prueba de Claw.</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${codigo}</p><p>Si lo recibes, el inicio de sesión de la web ya puede enviar códigos.</p>`
    });
    console.log(`\n[OK] Correo de prueba enviado a ${destino}. Revisa la bandeja de entrada y el spam.`);
  } catch (error) {
    log.error('No se pudo enviar el correo de prueba:', error.message);
    process.exit(1);
  }
}

main();
