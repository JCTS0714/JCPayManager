require('dotenv').config();

const fs = require('fs');
const path = require('path');
const https = require('https');

const BREVO_API_BASE_URL = 'https://api.brevo.com/v3';
const PDF_PRUEBA_PATH = path.join(__dirname, '..', 'test-assets', 'prueba-email.pdf');

function limpiarNumero(valor = '') {
  return String(valor).replace(/\D/g, '');
}

function validarEmail(valor = '') {
  const email = String(valor || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function postJson({ url, apiKey, body }) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = JSON.stringify(body || {});

    const req = https.request(
      {
        method: 'POST',
        hostname: parsed.hostname,
        path: `${parsed.pathname}${parsed.search}`,
        port: parsed.port || 443,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'api-key': apiKey,
          Accept: 'application/json'
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch (error) {
            data = { raw };
          }

          if ((res.statusCode || 500) >= 200 && (res.statusCode || 500) < 300) {
            resolve({ statusCode: res.statusCode, data });
            return;
          }

          const err = new Error(data?.message || `HTTP ${res.statusCode}`);
          err.statusCode = res.statusCode;
          err.response = data;
          reject(err);
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function printUso() {
  console.log('Uso:');
  console.log('  node scripts/test-brevo-email-sms.js --email correo@dominio.com --sms 519XXXXXXXX');
  console.log('  node scripts/test-brevo-email-sms.js --email correo@dominio.com');
  console.log('  node scripts/test-brevo-email-sms.js --sms 519XXXXXXXX');
}

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return '';
  }
  return process.argv[index + 1] || '';
}

async function enviarEmailPrueba({ apiKey, emailDestino }) {
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || '').trim();
  const senderName = (process.env.BREVO_SENDER_NAME || 'JCPAYMANAGER').trim();

  if (!senderEmail) {
    throw new Error('Falta BREVO_SENDER_EMAIL en .env');
  }
  if (!validarEmail(senderEmail)) {
    throw new Error('BREVO_SENDER_EMAIL invalido en .env. Debe tener formato correo, por ejemplo: facturacion@tu-dominio.com');
  }

  const attachments = [];
  if (fs.existsSync(PDF_PRUEBA_PATH)) {
    attachments.push({
      name: 'prueba-email.pdf',
      content: fs.readFileSync(PDF_PRUEBA_PATH).toString('base64')
    });
  }

  const body = {
    sender: {
      email: senderEmail,
      name: senderName
    },
    to: [{ email: emailDestino }],
    subject: 'Prueba Brevo Email - JCPAYMANAGER',
    htmlContent: '<p>Prueba de email transaccional desde JCPAYMANAGER.</p><p>Se adjunta un PDF de prueba.</p>',
    textContent: 'Prueba de email transaccional desde JCPAYMANAGER. Se adjunta un PDF de prueba.',
    ...(attachments.length ? { attachment: attachments } : {})
  };

  return postJson({
    url: `${BREVO_API_BASE_URL}/smtp/email`,
    apiKey,
    body
  });
}

async function enviarSmsPrueba({ apiKey, numeroDestino }) {
  const sender = (process.env.BREVO_SMS_SENDER || '').trim();
  if (!sender) {
    throw new Error('Falta BREVO_SMS_SENDER en .env (ej: ATLANTIS o un numero permitido por tu cuenta).');
  }

  const body = {
    sender,
    recipient: numeroDestino,
    content: 'Prueba SMS desde JCPAYMANAGER via Brevo.',
    type: 'transactional'
  };

  return postJson({
    url: `${BREVO_API_BASE_URL}/transactionalSMS/send`,
    apiKey,
    body
  });
}

async function main() {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  if (!apiKey) {
    console.error('Falta BREVO_API_KEY en .env');
    process.exit(1);
  }

  const emailArg = String(getArgValue('--email')).trim();
  const smsArg = limpiarNumero(getArgValue('--sms'));

  if (!emailArg && !smsArg) {
    printUso();
    process.exit(1);
  }

  if (emailArg && !validarEmail(emailArg)) {
    console.error('Email invalido para --email.');
    process.exit(1);
  }

  try {
    if (emailArg) {
      const responseEmail = await enviarEmailPrueba({ apiKey, emailDestino: emailArg });
      console.log('Email enviado OK.');
      console.log('email messageId:', responseEmail?.data?.messageId || '(sin messageId)');
    }

    if (smsArg) {
      const responseSms = await enviarSmsPrueba({ apiKey, numeroDestino: smsArg });
      console.log('SMS enviado OK.');
      console.log('sms reference:', responseSms?.data?.reference || '(sin reference)');
      console.log('sms messageId:', responseSms?.data?.messageId || '(sin messageId)');
    }
  } catch (error) {
    console.error('Fallo test Brevo email/sms.');
    console.error('status:', error.statusCode || 'n/a');
    console.error('error:', error.message);
    if (error.response) {
      console.error('details:', JSON.stringify(error.response, null, 2));
    }
    process.exit(1);
  }
}

main();
