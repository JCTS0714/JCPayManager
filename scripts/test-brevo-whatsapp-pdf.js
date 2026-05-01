require('dotenv').config();

const fs = require('fs');
const path = require('path');
const https = require('https');

function limpiarNumero(valor = '') {
  return String(valor).replace(/\D/g, '');
}

function crearPdfPrueba({ outputPath, titulo, mensaje }) {
  const safeTitulo = String(titulo || 'Prueba Brevo');
  const safeMensaje = String(mensaje || 'Documento de prueba');
  const contenido = `%PDF-1.1\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 184 >>\nstream\nBT\n/F1 18 Tf\n72 740 Td\n(${safeTitulo.replace(/[()]/g, '')}) Tj\n/F1 12 Tf\n0 -30 Td\n(${safeMensaje.replace(/[()]/g, '')}) Tj\n0 -20 Td\n(Generado: ${new Date().toISOString()}) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000243 00000 n \n0000000480 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n566\n%%EOF`;

  fs.writeFileSync(outputPath, contenido, 'utf8');
}

function postJson({ url, headers = {}, body }) {
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
          ...headers
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

          const err = new Error(data?.message || `Brevo error ${res.statusCode}`);
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

async function main() {
  const numeroDestinoArg = process.argv[2] || '';
  const numeroDestino = limpiarNumero(numeroDestinoArg);

  if (!numeroDestino) {
    console.error('Uso: node scripts/test-brevo-whatsapp-pdf.js <NUMERO_DESTINO_E164_SIN_+>');
    console.error('Ejemplo: node scripts/test-brevo-whatsapp-pdf.js 51987654321');
    process.exit(1);
  }

  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const senderNumber = limpiarNumero(process.env.BREVO_WHATSAPP_SENDER_NUMBER || '');
  const baseUrl = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');

  if (!apiKey) {
    console.error('Falta BREVO_API_KEY en .env');
    process.exit(1);
  }

  if (!senderNumber) {
    console.error('Falta BREVO_WHATSAPP_SENDER_NUMBER en .env');
    process.exit(1);
  }

  if (!baseUrl) {
    console.error('Falta PUBLIC_BASE_URL en .env para construir el link del PDF.');
    process.exit(1);
  }

  const facturasDir = path.join(__dirname, '..', 'uploads', 'facturas');
  if (!fs.existsSync(facturasDir)) {
    fs.mkdirSync(facturasDir, { recursive: true });
  }

  const stamp = Date.now();
  const fileName = `test-random-${stamp}.pdf`;
  const outputPath = path.join(facturasDir, fileName);

  crearPdfPrueba({
    outputPath,
    titulo: 'Factura de prueba',
    mensaje: `PDF random para numero ${numeroDestino}`
  });

  const pdfUrl = `${baseUrl}/uploads/facturas/${fileName}`;
  const mensaje = `Prueba automatica de JCPAYMANAGER. Aqui tienes tu PDF de prueba: ${pdfUrl}`;

  const payload = {
    senderNumber,
    contactNumbers: [numeroDestino],
    text: mensaje
  };

  try {
    const response = await postJson({
      url: 'https://api.brevo.com/v3/whatsapp/sendMessage',
      headers: {
        'api-key': apiKey,
        Accept: 'application/json'
      },
      body: payload
    });

    console.log('Mensaje enviado correctamente.');
    console.log('messageId:', response?.data?.messageId || '(sin messageId)');
    console.log('pdfUrl:', pdfUrl);
  } catch (error) {
    console.error('No se pudo enviar el test por WhatsApp.');
    console.error('status:', error.statusCode || 'n/a');
    console.error('error:', error.message);
    if (error.response) {
      console.error('details:', JSON.stringify(error.response, null, 2));
    }
    console.error('pdfUrl generado:', pdfUrl);

    const code = String(error?.response?.code || '').toLowerCase();
    const message = String(error?.response?.message || '').toLowerCase();

    if ((error.statusCode === 403 && code === 'permission_denied') || message.includes('not registered')) {
      console.error('\nDiagnostico rapido:');
      console.error('- Tu cuenta Brevo aun no tiene WhatsApp API registrado/activado para envio transaccional.');
      console.error('- En muchas cuentas, WhatsApp API requiere plan habilitado y WABA enlazado con Meta.');
      console.error('\nChecklist de solucion:');
      console.error('1) En Brevo activa WhatsApp (Apps & Integrations).');
      console.error('2) Vincula tu cuenta de Meta WhatsApp Business (WABA).');
      console.error('3) Verifica que BREVO_WHATSAPP_SENDER_NUMBER sea el numero remitente aprobado en Brevo.');
      console.error('4) Si es el primer envio API, usa plantilla aprobada (templateId) en lugar de texto libre.');
      console.error('5) Confirma que tu plan de Brevo incluya WhatsApp API para envios.');
      console.error('6) Si el bloqueo persiste, abre ticket con soporte Brevo indicando: code=permission_denied, message=Your account is not registered.');
    }

    if (pdfUrl.includes('http://localhost')) {
      console.error('\nNota: el PDF apunta a localhost; solo es accesible desde tu maquina.');
      console.error('Para pruebas reales, usa PUBLIC_BASE_URL publico (dominio o tunel).');
    }

    process.exit(1);
  }
}

main();
