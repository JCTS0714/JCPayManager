const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const csv = require('csv-parse/sync');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const https = require('https');
const cors = require('cors');

require('dotenv').config();

const app = express();
const PORT = 3001;

const MESES_ORDEN = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE'
];

const ALIAS_MESES = {
  SETIEMBRE: 'SEPTIEMBRE'
};

const MENSAJE_FACTURA_BASE = `Buenos dias, le envio la factura de {NEGOCIO} del mes de {MES}.\n\nNuestra cuenta BCP ES:\nCta Ahorros GRUPO ATLANTIS: 48005793464046\n\nCta ahorros Arturo Bernal: 48092533082021\nCCI: 00248019253308202125\n\nNuestro  Yape es: 971177872\n\nPor favor mandar pantallazo del deposito, Gracias.\n\nAtte \nAsist: Juan Carlos Tello S.\nGRUPO ATLANTIS`;

const BREVO_API_BASE_URL = 'https://api.brevo.com/v3';
const KAPSO_WHATSAPP_API_BASE_URL = 'https://api.kapso.ai/meta/whatsapp/v24.0';

const normalizarTexto = (valor = '') => {
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
};

const normalizarFila = (row = {}) => {
  const normalizada = {};
  Object.entries(row).forEach(([key, value]) => {
    normalizada[normalizarTexto(key)] = value;
  });
  return normalizada;
};

const limpiarCadena = (valor = '') => String(valor).trim();

const obtenerMesCobroActual = () => {
  const ahora = new Date();
  const indiceMesAnterior = (ahora.getMonth() + 11) % 12;
  return indiceMesAnterior;
};

const parsearNumero = (valor) => {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return 0;
  }

  const numero = Number(String(valor).replace(',', '.').trim());
  return Number.isFinite(numero) ? numero : 0;
};

const normalizarNombreComparacion = (valor = '') => {
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const limpiarCelular = (valor = '') => String(valor).replace(/\D/g, '');

const validarEmail = (valor = '') => {
  const email = String(valor || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const getBrevoConfig = () => {
  return {
    apiKey: (process.env.BREVO_API_KEY || '').trim(),
    senderEmail: (process.env.BREVO_SENDER_EMAIL || '').trim(),
    senderName: (process.env.BREVO_SENDER_NAME || 'JCPAYMANAGER').trim(),
    enabled: (process.env.BREVO_ENABLED || 'true').toLowerCase() === 'true'
  };
};

const getKapsoConfig = () => {
  return {
    apiKey: (process.env.KAPSO_API_KEY || '').trim(),
    phoneNumberId: (process.env.KAPSO_PHONE_NUMBER_ID || '').trim(),
    enabled: (process.env.KAPSO_ENABLED || 'true').toLowerCase() === 'true'
  };
};

const isBrevoConfigured = () => {
  const config = getBrevoConfig();
  return Boolean(config.enabled && config.apiKey && config.senderEmail);
};

const isKapsoConfigured = () => {
  const config = getKapsoConfig();
  return Boolean(config.enabled && config.apiKey && config.phoneNumberId);
};

const httpPostJson = ({ url, headers = {}, body }) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const payload = JSON.stringify(body || {});

    const req = https.request(
      {
        method: 'POST',
        hostname: parsedUrl.hostname,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        port: parsedUrl.port || 443,
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
          const statusCode = res.statusCode || 500;
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch (parseError) {
            parsed = { raw };
          }

          if (statusCode >= 200 && statusCode < 300) {
            resolve({ statusCode, data: parsed });
            return;
          }

          const error = new Error(parsed?.message || parsed?.code || `Error HTTP ${statusCode}`);
          error.statusCode = statusCode;
          error.response = parsed;
          reject(error);
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
};

const enviarCorreoBrevo = async ({ toEmail, toName, subject, htmlContent, textContent }) => {
  const config = getBrevoConfig();
  if (!isBrevoConfigured()) {
    throw new Error('Brevo no esta configurado. Define BREVO_API_KEY y BREVO_SENDER_EMAIL.');
  }

  const body = {
    sender: {
      email: config.senderEmail,
      name: config.senderName
    },
    to: [{
      email: toEmail,
      ...(toName ? { name: toName } : {})
    }],
    subject,
    htmlContent,
    textContent
  };

  return httpPostJson({
    url: `${BREVO_API_BASE_URL}/smtp/email`,
    headers: {
      'api-key': config.apiKey,
      Accept: 'application/json'
    },
    body
  });
};

const enviarDocumentoWhatsAppKapso = async ({ to, documentLink, caption, filename, callbackData }) => {
  const config = getKapsoConfig();
  if (!isKapsoConfigured()) {
    throw new Error('Kapso no esta configurado. Define KAPSO_API_KEY y KAPSO_PHONE_NUMBER_ID.');
  }

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'document',
    document: {
      link: documentLink,
      caption,
      filename
    },
    ...(callbackData ? { biz_opaque_callback_data: callbackData } : {})
  };

  return httpPostJson({
    url: `${KAPSO_WHATSAPP_API_BASE_URL}/${config.phoneNumberId}/messages`,
    headers: {
      'X-API-Key': config.apiKey,
      Accept: 'application/json'
    },
    body
  });
};

const generarMensajeFactura = ({ cliente, pago }) => {
  return MENSAJE_FACTURA_BASE
    .replaceAll('{NEGOCIO}', cliente.comercio || '')
    .replaceAll('{MES}', `${pago.mes || ''} ${pago.anio || ''}`.trim())
    .replaceAll('{MONTO}', Number(cliente.precio || 0).toFixed(2));
};

const limpiarDirectorioArchivos = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const archivos = fs.readdirSync(dirPath);
  archivos.forEach((nombre) => {
    const fullPath = path.join(dirPath, nombre);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      limpiarDirectorioArchivos(fullPath);
      fs.rmdirSync(fullPath);
      return;
    }
    fs.unlinkSync(fullPath);
  });
};

const renderizarPlantillaMensaje = ({ plantilla, cliente, pago }) => {
  if (!plantilla || !String(plantilla).trim()) {
    return generarMensajeFactura({ cliente, pago });
  }

  return String(plantilla)
    .replaceAll('{NEGOCIO}', cliente.comercio || '')
    .replaceAll('{MES}', `${pago.mes || ''} ${pago.anio || ''}`.trim())
    .replaceAll('{MONTO}', Number(cliente.precio || 0).toFixed(2));
};

const obtenerPeriodoCobroActual = () => {
  const ahora = new Date();
  const fechaPeriodo = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  return {
    mes: MESES_ORDEN[fechaPeriodo.getMonth()],
    anio: fechaPeriodo.getFullYear()
  };
};

const sincronizarMesAutomatico = () => {
  return new Promise((resolve, reject) => {
    const periodo = obtenerPeriodoCobroActual();
    db.run(
      `INSERT IGNORE INTO pagos_mensuales (clienteId, mes, anio, estado, fechaEmision)
       SELECT c.id, ?, ?, 'factura_pendiente', CURRENT_DATE
       FROM clientes c`,
      [periodo.mes, periodo.anio],
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(periodo);
      }
    );
  });
};

const detectarEstadoMes = (valorMes) => {
  const valor = limpiarCadena(valorMes || '');
  if (!valor) {
    return 'factura_pendiente';
  }

  if (normalizarTexto(valor) === 'ENVIADO') {
    return 'factura_enviada';
  }

  return 'pago_registrado';
};

// Middleware
app.use(cors());
app.use(express.json());

const publicDir = path.join(__dirname, 'public');
const buildDir = path.join(__dirname, 'build');
const buildIndexPath = path.join(buildDir, 'index.html');
const hasBuild = fs.existsSync(buildIndexPath);

if (hasBuild) {
  app.use(express.static(buildDir));
} else {
  app.use(express.static(publicDir));
}

// Configurar almacenamiento de archivos
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const facturasDir = path.join(uploadDir, 'facturas');
if (!fs.existsSync(facturasDir)) {
  fs.mkdirSync(facturasDir, { recursive: true });
}

app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Inicializar base de datos (MySQL)
const DB_HOST = (process.env.DB_HOST || 'localhost').trim();
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = (process.env.DB_USER || 'root').trim();
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = (process.env.DB_NAME || 'jcpaymanager').trim();

const dbConnection = mysql.createConnection({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  charset: 'utf8mb4',
  multipleStatements: false
});

const db = {
  run(sql, params = [], callback) {
    const finalParams = typeof params === 'function' ? [] : params;
    const finalCallback = typeof params === 'function' ? params : callback;

    dbConnection.query(sql, finalParams, (err, result) => {
      if (typeof finalCallback === 'function') {
        finalCallback.call(
          {
            lastID: result?.insertId || 0,
            changes: result?.affectedRows || 0
          },
          err
        );
      }
    });
  },
  get(sql, params = [], callback) {
    const finalParams = typeof params === 'function' ? [] : params;
    const finalCallback = typeof params === 'function' ? params : callback;

    dbConnection.query(sql, finalParams, (err, rows) => {
      if (typeof finalCallback === 'function') {
        finalCallback(err, rows?.[0] || null);
      }
    });
  },
  all(sql, params = [], callback) {
    const finalParams = typeof params === 'function' ? [] : params;
    const finalCallback = typeof params === 'function' ? params : callback;

    dbConnection.query(sql, finalParams, (err, rows) => {
      if (typeof finalCallback === 'function') {
        finalCallback(err, rows || []);
      }
    });
  },
  serialize(fn) {
    if (typeof fn === 'function') {
      fn();
    }
  }
};

const runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
};

const getAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
};

const getBaseUrl = (req) => {
  if (process.env.PUBLIC_BASE_URL && String(process.env.PUBLIC_BASE_URL).trim()) {
    return String(process.env.PUBLIC_BASE_URL).trim().replace(/\/$/, '');
  }

  return `${req.protocol}://${req.get('host')}`;
};

const esBaseUrlPublica = (baseUrl = '') => {
  try {
    const parsed = new URL(baseUrl);
    const host = String(parsed.hostname || '').toLowerCase();
    if (!host) {
      return false;
    }

    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return false;
    }

    if (host.endsWith('.local')) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

const construirUrlWhatsAppManual = ({ celularConPais, mensaje }) => {
  if (!celularConPais) {
    return '';
  }
  return `https://wa.me/${celularConPais}?text=${encodeURIComponent(mensaje || '')}`;
};

const obtenerDiagnosticoWhatsapp = ({ celularConPais, baseUrl }) => {
  const diagnostico = [];
  if (!celularConPais) {
    diagnostico.push({ code: 'celular_invalido', message: 'El cliente no tiene celular valido en formato nacional.' });
  }
  if (!isKapsoConfigured()) {
    diagnostico.push({ code: 'kapso_no_configurado', message: 'Falta configurar KAPSO_API_KEY o KAPSO_PHONE_NUMBER_ID.' });
  }
  if (!esBaseUrlPublica(baseUrl)) {
    diagnostico.push({ code: 'public_base_url_no_publica', message: 'PUBLIC_BASE_URL debe ser publica (no localhost) para que WhatsApp descargue el archivo.' });
  }
  return diagnostico;
};

const ensureColumnIfMissing = async (tableName, columnName, columnDefinition) => {
  const rows = await new Promise((resolve, reject) => {
    dbConnection.query(
      'SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [tableName],
      (err, cols) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(cols || []);
      }
    );
  });

  const existing = new Set(rows.map((col) => col.name));
  if (existing.has(columnName)) {
    return;
  }

  await runAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
};

const ensureIndexIfMissing = async (tableName, indexName, definitionSql) => {
  const rows = await new Promise((resolve, reject) => {
    dbConnection.query(
      'SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
      [tableName, indexName],
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result || []);
      }
    );
  });

  if (rows.length > 0) {
    return;
  }

  await runAsync(definitionSql);
};

const initializeDatabase = async () => {
  await runAsync(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      comercio VARCHAR(255) NOT NULL,
      contacto VARCHAR(255),
      celular VARCHAR(50),
      ciudad VARCHAR(120),
      precio DECIMAL(10,2),
      ruc VARCHAR(32),
      rubro VARCHAR(120),
      anio INT,
      comercioKey VARCHAR(255),
      mesInicio VARCHAR(30),
      fechaEmision VARCHAR(50),
      link TEXT,
      usuario VARCHAR(120),
      contrasena VARCHAR(255),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await ensureColumnIfMissing('clientes', 'comercioKey', 'VARCHAR(255)');
  await ensureColumnIfMissing('clientes', 'mesInicio', 'VARCHAR(30)');
  await ensureColumnIfMissing('clientes', 'fechaEmision', 'VARCHAR(50)');
  await ensureColumnIfMissing('clientes', 'link', 'TEXT');
  await ensureColumnIfMissing('clientes', 'contrasena', 'VARCHAR(255)');

  await ensureIndexIfMissing('clientes', 'idx_clientes_comercio_key', 'CREATE INDEX idx_clientes_comercio_key ON clientes(comercioKey)');
  await ensureIndexIfMissing('clientes', 'idx_clientes_ruc', 'CREATE INDEX idx_clientes_ruc ON clientes(ruc)');

  const rows = await new Promise((resolve, reject) => {
    db.all('SELECT id, comercio FROM clientes WHERE comercioKey IS NULL OR comercioKey = ""', (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result || []);
    });
  });

  for (const row of rows) {
    const comercioKey = normalizarNombreComparacion(row.comercio || '');
    await runAsync('UPDATE clientes SET comercioKey = ? WHERE id = ?', [comercioKey, row.id]);
  }

  await runAsync(`
    CREATE TABLE IF NOT EXISTS pagos_mensuales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      clienteId INT NOT NULL,
      mes VARCHAR(20) NOT NULL,
      anio INT NOT NULL,
      estado VARCHAR(40) DEFAULT 'factura_enviada',
      fechaEmision DATE,
      fechaPago DATE,
      comprobante TEXT,
      notas TEXT,
      CONSTRAINT uq_pago_cliente_mes UNIQUE (clienteId, mes, anio),
      CONSTRAINT fk_pagos_cliente FOREIGN KEY (clienteId) REFERENCES clientes(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS comprobantes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pagoId INT NOT NULL,
      archivoUrl TEXT NOT NULL,
      tipoArchivo VARCHAR(120),
      fechaSubida DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_comprobante_pago FOREIGN KEY (pagoId) REFERENCES pagos_mensuales(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id INT AUTO_INCREMENT PRIMARY KEY,
      accion VARCHAR(120),
      clienteId INT,
      detalles LONGTEXT,
      usuario VARCHAR(120),
      fechaAccion DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS envios_factura (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pagoId INT NOT NULL UNIQUE,
      archivoUrl TEXT NOT NULL,
      mensaje LONGTEXT,
      estado VARCHAR(40) DEFAULT 'preparado',
      fechaPreparado DATETIME DEFAULT CURRENT_TIMESTAMP,
      fechaEnviado DATETIME,
      CONSTRAINT fk_envio_pago FOREIGN KEY (pagoId) REFERENCES pagos_mensuales(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

// ==================== RUTAS DE CLIENTES ====================

// Obtener todos los clientes
app.get('/api/clientes', (req, res) => {
  sincronizarMesAutomatico()
    .catch((err) => {
      console.error('No se pudo sincronizar el periodo mensual:', err.message);
    })
    .finally(() => {
      db.all('SELECT * FROM clientes ORDER BY comercio ASC', (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(rows);
      });
    });
});

// Obtener cliente por ID con todos sus pagos
app.get('/api/clientes/:id', (req, res) => {
  const { id } = req.params;

  sincronizarMesAutomatico()
    .catch((err) => {
      console.error('No se pudo sincronizar el periodo mensual:', err.message);
    })
    .finally(() => {
      db.get('SELECT * FROM clientes WHERE id = ?', [id], (err, cliente) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        if (!cliente) {
          res.status(404).json({ error: 'Cliente no encontrado' });
          return;
        }

        // Obtener pagos del cliente
        db.all(
          `WITH pagos_unicos AS (
            SELECT pm.*
            FROM pagos_mensuales pm
            INNER JOIN (
              SELECT clienteId, mes, MAX(anio) AS anioMax
              FROM pagos_mensuales
              WHERE clienteId = ?
              GROUP BY clienteId, mes
            ) ult
              ON ult.clienteId = pm.clienteId
             AND ult.mes = pm.mes
             AND ult.anioMax = pm.anio
            WHERE pm.clienteId = ?
          )
          SELECT
            pu.*,
            ef.archivoUrl AS facturaArchivoUrl,
            ef.mensaje AS facturaMensaje,
            ef.estado AS facturaEnvioEstado,
            ef.fechaPreparado AS facturaFechaPreparado,
            ef.fechaEnviado AS facturaFechaEnviado
          FROM pagos_unicos pu
          LEFT JOIN envios_factura ef ON ef.pagoId = pu.id
          ORDER BY pu.anio DESC,
            CASE pu.mes
              WHEN 'ENERO' THEN 1
              WHEN 'FEBRERO' THEN 2
              WHEN 'MARZO' THEN 3
              WHEN 'ABRIL' THEN 4
              WHEN 'MAYO' THEN 5
              WHEN 'JUNIO' THEN 6
              WHEN 'JULIO' THEN 7
              WHEN 'AGOSTO' THEN 8
              WHEN 'SEPTIEMBRE' THEN 9
              WHEN 'OCTUBRE' THEN 10
              WHEN 'NOVIEMBRE' THEN 11
              WHEN 'DICIEMBRE' THEN 12
              ELSE 99
            END DESC`,
          [id, id],
          (errorPagos, pagos) => {
            if (errorPagos) {
              res.status(500).json({ error: errorPagos.message });
              return;
            }
            res.json({ cliente, pagos });
          }
        );
      });
    });
});

// Crear cliente
app.post('/api/clientes', (req, res) => {
  const {
    comercio, contacto, celular, ciudad, precio, ruc, rubro, usuario
  } = req.body;
  const anio = req.body?.anio ?? req.body?.año ?? null;
  const contrasena = req.body?.contrasena ?? req.body?.contraseña ?? '';

  const comercioKey = normalizarNombreComparacion(comercio || '');
  const rucLimpio = limpiarCadena(ruc || '');

  const sqlExiste = rucLimpio
    ? 'SELECT id FROM clientes WHERE ruc = ? OR comercioKey = ? LIMIT 1'
    : 'SELECT id FROM clientes WHERE comercioKey = ? LIMIT 1';

  const paramsExiste = rucLimpio ? [rucLimpio, comercioKey] : [comercioKey];

  db.get(sqlExiste, paramsExiste, (errExiste, existente) => {
    if (errExiste) {
      res.status(500).json({ error: errExiste.message });
      return;
    }

    if (existente) {
      res.status(409).json({ error: 'El cliente ya existe (RUC o nombre de negocio).' });
      return;
    }

    db.run(
      `INSERT INTO clientes (comercio, contacto, celular, ciudad, precio, ruc, rubro, anio, comercioKey, usuario, contrasena)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [comercio, contacto, celular, ciudad, precio, rucLimpio, rubro, anio, comercioKey, usuario, contrasena],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ id: this.lastID, message: 'Cliente creado' });
      }
    );
  });
});

// Actualizar cliente
app.put('/api/clientes/:id', (req, res) => {
  const { id } = req.params;
  const {
    comercio, contacto, celular, ciudad, precio, ruc, rubro
  } = req.body;

  if (!limpiarCadena(comercio || '')) {
    res.status(400).json({ error: 'El comercio es obligatorio.' });
    return;
  }

  const comercioKey = normalizarNombreComparacion(comercio || '');
  const rucLimpio = limpiarCadena(ruc || '');

  const sqlExiste = rucLimpio
    ? 'SELECT id FROM clientes WHERE id <> ? AND (ruc = ? OR comercioKey = ?) LIMIT 1'
    : 'SELECT id FROM clientes WHERE id <> ? AND comercioKey = ? LIMIT 1';

  const paramsExiste = rucLimpio ? [id, rucLimpio, comercioKey] : [id, comercioKey];

  db.get(sqlExiste, paramsExiste, (errExiste, existente) => {
    if (errExiste) {
      res.status(500).json({ error: errExiste.message });
      return;
    }

    if (existente) {
      res.status(409).json({ error: 'Ya existe otro cliente con ese RUC o nombre de negocio.' });
      return;
    }

    db.run(
      `UPDATE clientes
       SET comercio = ?, contacto = ?, celular = ?, ciudad = ?, precio = ?, ruc = ?, rubro = ?, comercioKey = ?
       WHERE id = ?`,
      [comercio, contacto, celular, ciudad, precio, rucLimpio, rubro, comercioKey, id],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        if (this.changes === 0) {
          res.status(404).json({ error: 'Cliente no encontrado.' });
          return;
        }

        res.json({ message: 'Cliente actualizado' });
      }
    );
  });
});

// ==================== RUTAS DE PAGOS ====================

// Actualizar estado de pago
app.put('/api/pagos/:id', (req, res) => {
  const { id } = req.params;
  const { estado, notas } = req.body;

  if (!['factura_pendiente', 'factura_enviada', 'pago_registrado'].includes(estado)) {
    res.status(400).json({ error: 'Estado de pago no valido.' });
    return;
  }

  const sql = estado === 'pago_registrado'
    ? 'UPDATE pagos_mensuales SET estado = ?, notas = ?, fechaPago = COALESCE(fechaPago, CURRENT_DATE) WHERE id = ?'
    : 'UPDATE pagos_mensuales SET estado = ?, notas = ?, fechaPago = NULL WHERE id = ?';

  db.run(
    sql,
    [estado, notas, id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Pago actualizado' });
    }
  );
});

app.get('/api/integraciones/brevo/status', (req, res) => {
  const config = getBrevoConfig();
  const faltantes = [];

  if (!config.apiKey) {
    faltantes.push('BREVO_API_KEY');
  }
  if (!config.senderEmail) {
    faltantes.push('BREVO_SENDER_EMAIL');
  }

  res.json({
    enabled: config.enabled,
    configured: isBrevoConfigured(),
    senderEmail: config.senderEmail || null,
    senderName: config.senderName,
    missing: faltantes
  });
});

app.post('/api/integraciones/brevo/test', async (req, res) => {
  const { emailDestino, nombreDestino } = req.body || {};
  if (!validarEmail(emailDestino)) {
    res.status(400).json({ error: 'Correo de destino invalido.' });
    return;
  }

  try {
    const ahora = new Date();
    const htmlContent = `
      <h2>Prueba de integracion Brevo</h2>
      <p>Hola ${nombreDestino || 'equipo'}, este correo confirma que la API de Brevo quedo conectada.</p>
      <p><strong>Fecha:</strong> ${ahora.toLocaleString('es-PE')}</p>
      <p>Enviado desde JCPAYMANAGER.</p>
    `;

    const textContent = `Prueba de integracion Brevo\nHola ${nombreDestino || 'equipo'}, este correo confirma que la API de Brevo quedo conectada.\nFecha: ${ahora.toLocaleString('es-PE')}\nEnviado desde JCPAYMANAGER.`;

    const response = await enviarCorreoBrevo({
      toEmail: String(emailDestino).trim(),
      toName: nombreDestino,
      subject: 'Prueba de integracion Brevo - JCPAYMANAGER',
      htmlContent,
      textContent
    });

    res.json({
      message: 'Correo de prueba enviado.',
      messageId: response?.data?.messageId || null
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || 'No se pudo enviar correo de prueba con Brevo.',
      details: error.response || null
    });
  }
});

app.get('/api/integraciones/kapso/status', (req, res) => {
  const config = getKapsoConfig();
  const faltantes = [];

  if (!config.apiKey) {
    faltantes.push('KAPSO_API_KEY');
  }
  if (!config.phoneNumberId) {
    faltantes.push('KAPSO_PHONE_NUMBER_ID');
  }

  res.json({
    enabled: config.enabled,
    configured: isKapsoConfigured(),
    phoneNumberId: config.phoneNumberId || null,
    missing: faltantes
  });
});

app.post('/api/integraciones/kapso/test', async (req, res) => {
  if (!isKapsoConfigured()) {
    res.status(400).json({
      error: 'Kapso no esta configurado. Define KAPSO_API_KEY y KAPSO_PHONE_NUMBER_ID.'
    });
    return;
  }

  const kapsoConfig = getKapsoConfig();
  const celularDestino = limpiarCelular((req.body || {}).celularDestino || '');
  if (!celularDestino) {
    res.status(400).json({ error: 'celularDestino es obligatorio.' });
    return;
  }

  const numeroDestino = celularDestino.startsWith('51') ? celularDestino : `51${celularDestino}`;

  try {
    const response = await httpPostJson({
      url: `${KAPSO_WHATSAPP_API_BASE_URL}/${kapsoConfig.phoneNumberId}/messages`,
      headers: {
        'X-API-Key': kapsoConfig.apiKey,
        Accept: 'application/json'
      },
      body: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: numeroDestino,
        type: 'text',
        text: {
          body: 'Prueba de integracion Kapso WhatsApp - JCPAYMANAGER.'
        }
      }
    });

    res.json({
      message: 'Mensaje de prueba enviado por Kapso.',
      messageId: response?.data?.messages?.[0]?.id || null
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || 'No se pudo enviar mensaje de prueba con Kapso.',
      details: error.response || null
    });
  }
});

app.post('/api/facturas/preparar', upload.single('archivo'), (req, res) => {
  if (!req.file || !req.body.pagoId) {
    res.status(400).json({ error: 'Falta archivo o pagoId.' });
    return;
  }

  const pagoId = Number(req.body.pagoId);
  db.get(
    `SELECT pm.id, pm.mes, pm.anio, pm.estado, c.comercio, c.contacto, c.celular, c.precio
     FROM pagos_mensuales pm
     INNER JOIN clientes c ON c.id = pm.clienteId
     WHERE pm.id = ?`,
    [pagoId],
    (err, data) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (!data) {
        fs.unlinkSync(req.file.path);
        res.status(404).json({ error: 'Pago no encontrado.' });
        return;
      }

      if (!['factura_pendiente', 'factura_enviada'].includes(data.estado)) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'Solo se pueden preparar facturas en estado pendiente o enviada.' });
        return;
      }

      const nombreArchivoSinExt = path.parse(req.file.originalname).name;
      const esperado = normalizarNombreComparacion(data.comercio);
      const recibido = normalizarNombreComparacion(nombreArchivoSinExt);

      if (esperado !== recibido) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({
          error: `Nombre invalido. El archivo debe llamarse exactamente como el negocio: ${data.comercio}`
        });
        return;
      }

      const nuevoNombre = `${esperado}-${data.anio}-${data.mes}${path.extname(req.file.originalname).toLowerCase()}`;
      const destino = path.join(facturasDir, nuevoNombre);
      try {
        fs.copyFileSync(req.file.path, destino);
        fs.unlinkSync(req.file.path);
      } catch (fileError) {
        res.status(500).json({ error: 'No se pudo guardar la factura preparada.' });
        return;
      }

      const archivoUrl = `/uploads/facturas/${nuevoNombre}`;
      const mensaje = renderizarPlantillaMensaje({
        plantilla: req.body.mensajeTemplate,
        cliente: data,
        pago: data
      });

      db.run(
        `INSERT INTO envios_factura (pagoId, archivoUrl, mensaje, estado, fechaPreparado)
         VALUES (?, ?, ?, 'preparado', CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE
           archivoUrl = VALUES(archivoUrl),
           mensaje = VALUES(mensaje),
           estado = 'preparado',
           fechaPreparado = CURRENT_TIMESTAMP,
           fechaEnviado = NULL`,
        [pagoId, archivoUrl, mensaje],
        (insertErr) => {
          if (insertErr) {
            res.status(500).json({ error: insertErr.message });
            return;
          }

          const celular = limpiarCelular(data.celular || '');
          const celularConPais = celular ? (celular.startsWith('51') ? celular : `51${celular}`) : '';
          const whatsappUrl = construirUrlWhatsAppManual({ celularConPais, mensaje });
          const baseUrl = getBaseUrl(req);
          const facturaUrl = `${baseUrl}${archivoUrl}`;

          const whatsappDiagnostics = obtenerDiagnosticoWhatsapp({
            celularConPais,
            baseUrl
          });

          res.json({
            message: 'Factura preparada. Lista para envio por Kapso o manual.',
            pagoId,
            archivoUrl,
            facturaUrl,
            mensaje,
            whatsappUrl,
            celular: celularConPais,
            whatsappApiReady: whatsappDiagnostics.length === 0,
            whatsappDiagnostics,
            whatsappDelivery: {
              sent: false,
              provider: 'kapso',
              reason: 'prepared_only'
            }
          });
        }
      );
    }
  );
});

app.get('/api/facturas/pendientes', (req, res) => {
  const periodo = obtenerPeriodoCobroActual();
  const mes = (req.query.mes || periodo.mes).toString().toUpperCase();
  const anio = Number(req.query.anio || periodo.anio);

  sincronizarMesAutomatico()
    .catch((errorSync) => {
      console.error('No se pudo sincronizar el periodo mensual:', errorSync.message);
    })
    .finally(() => db.all(
      `SELECT
      pm.id AS pagoId,
      pm.mes,
      pm.anio AS anio,
      pm.estado,
      c.id AS clienteId,
      c.comercio,
      c.contacto,
      c.celular,
      c.precio,
      ef.archivoUrl AS facturaArchivoUrl,
      ef.mensaje AS facturaMensaje,
      ef.estado AS facturaEnvioEstado,
      ef.fechaPreparado AS facturaFechaPreparado,
      ef.fechaEnviado AS facturaFechaEnviado
    FROM pagos_mensuales pm
    INNER JOIN clientes c ON c.id = pm.clienteId
    LEFT JOIN envios_factura ef ON ef.pagoId = pm.id
    WHERE pm.estado = 'factura_pendiente'
      AND pm.mes = ?
      AND pm.anio = ?
    ORDER BY c.comercio ASC`,
      [mes, anio],
      (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        res.json({
          periodo: { mes, anio },
          total: rows.length,
          templateSugerido: MENSAJE_FACTURA_BASE,
          rows
        });
      }
    ));
});

app.post('/api/facturas/:pagoId/marcar-enviada', (req, res) => {
  const pagoId = Number(req.params.pagoId);

  db.run(
    `UPDATE envios_factura
     SET estado = 'enviado', fechaEnviado = CURRENT_TIMESTAMP
     WHERE pagoId = ?`,
    [pagoId],
    function onUpdateEnvio(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (this.changes === 0) {
        res.status(404).json({ error: 'No existe una factura preparada para este pago.' });
        return;
      }

      db.run(
        `UPDATE pagos_mensuales
         SET estado = CASE WHEN estado = 'factura_pendiente' THEN 'factura_enviada' ELSE estado END
         WHERE id = ?`,
        [pagoId],
        (errPago) => {
          if (errPago) {
            res.status(500).json({ error: errPago.message });
            return;
          }

          res.json({ message: 'Factura marcada como enviada.' });
        }
      );
    }
  );
});

app.post('/api/facturas/:pagoId/enviar-whatsapp', async (req, res) => {
  const pagoId = Number(req.params.pagoId);

  if (!Number.isFinite(pagoId) || pagoId <= 0) {
    res.status(400).json({ error: 'pagoId invalido.' });
    return;
  }

  try {
    const data = await getAsync(
      `SELECT
        pm.id AS pagoId,
        pm.mes,
        pm.anio AS anio,
        pm.estado,
        c.id AS clienteId,
        c.comercio,
        c.contacto,
        c.celular,
        c.precio,
        ef.archivoUrl AS facturaArchivoUrl,
        ef.mensaje AS facturaMensaje
      FROM pagos_mensuales pm
      INNER JOIN clientes c ON c.id = pm.clienteId
      LEFT JOIN envios_factura ef ON ef.pagoId = pm.id
      WHERE pm.id = ?`,
      [pagoId]
    );

    if (!data) {
      res.status(404).json({ error: 'Pago no encontrado.' });
      return;
    }

    if (!data.facturaArchivoUrl) {
      res.status(400).json({ error: 'Primero prepara la factura para poder enviarla por WhatsApp.' });
      return;
    }

    const celular = limpiarCelular(data.celular || '');
    const celularConPais = celular ? (celular.startsWith('51') ? celular : `51${celular}`) : '';
    const baseUrl = getBaseUrl(req);
    const facturaUrl = data.facturaArchivoUrl.startsWith('http')
      ? data.facturaArchivoUrl
      : `${baseUrl}${data.facturaArchivoUrl}`;

    const diagnostico = obtenerDiagnosticoWhatsapp({ celularConPais, baseUrl });
    if (diagnostico.length > 0) {
      res.status(400).json({
        error: 'El envio por WhatsApp no esta listo. Revisa diagnostico.',
        diagnostics: diagnostico,
        facturaUrl,
        whatsappUrl: construirUrlWhatsAppManual({
          celularConPais,
          mensaje: data.facturaMensaje || ''
        })
      });
      return;
    }

    const caption = `Factura ${data.mes} ${data.anio} - ${data.comercio}`;
    const filename = path.basename(data.facturaArchivoUrl);
    const responseKapso = await enviarDocumentoWhatsAppKapso({
      to: celularConPais,
      documentLink: facturaUrl,
      caption,
      filename,
      callbackData: `pago_${pagoId}`
    });

    const messageId = responseKapso?.data?.messages?.[0]?.id || null;

    await runAsync(
      `UPDATE envios_factura
       SET estado = 'enviado', fechaEnviado = CURRENT_TIMESTAMP
       WHERE pagoId = ?`,
      [pagoId]
    );

    await runAsync(
      `UPDATE pagos_mensuales
       SET estado = CASE WHEN estado = 'factura_pendiente' THEN 'factura_enviada' ELSE estado END
       WHERE id = ?`,
      [pagoId]
    );

    await runAsync(
      'INSERT INTO auditoria (accion, clienteId, detalles, usuario) VALUES (?, ?, ?, ?)',
      [
        'ENVIO_WHATSAPP_KAPSO',
        data.clienteId,
        JSON.stringify({
          pagoId,
          celularDestino: celularConPais,
          messageId,
          proveedor: 'kapso',
          facturaUrl
        }),
        'sistema'
      ]
    );

    res.json({
      message: 'Factura enviada por WhatsApp (Kapso).',
      messageId,
      facturaUrl,
      celular: celularConPais
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || 'No se pudo enviar la factura por WhatsApp (Kapso).',
      details: error.response || null
    });
  }
});

app.post('/api/facturas/:pagoId/enviar-email', async (req, res) => {
  const pagoId = Number(req.params.pagoId);
  const { emailDestino, nombreDestino, asunto } = req.body || {};

  if (!Number.isFinite(pagoId) || pagoId <= 0) {
    res.status(400).json({ error: 'pagoId invalido.' });
    return;
  }

  if (!validarEmail(emailDestino)) {
    res.status(400).json({ error: 'Correo de destino invalido.' });
    return;
  }

  try {
    const data = await getAsync(
      `SELECT
        pm.id AS pagoId,
        pm.mes,
        pm.anio AS anio,
        pm.estado,
        c.id AS clienteId,
        c.comercio,
        c.contacto,
        c.precio,
        ef.archivoUrl AS facturaArchivoUrl,
        ef.mensaje AS facturaMensaje
      FROM pagos_mensuales pm
      INNER JOIN clientes c ON c.id = pm.clienteId
      LEFT JOIN envios_factura ef ON ef.pagoId = pm.id
      WHERE pm.id = ?`,
      [pagoId]
    );

    if (!data) {
      res.status(404).json({ error: 'Pago no encontrado.' });
      return;
    }

    if (!data.facturaArchivoUrl) {
      res.status(400).json({ error: 'Primero prepara la factura para enviar por email.' });
      return;
    }

    const baseUrl = getBaseUrl(req);
    const facturaUrl = data.facturaArchivoUrl.startsWith('http')
      ? data.facturaArchivoUrl
      : `${baseUrl}${data.facturaArchivoUrl}`;

    const mensaje = renderizarPlantillaMensaje({
      plantilla: req.body.mensajeTemplate || data.facturaMensaje || MENSAJE_FACTURA_BASE,
      cliente: data,
      pago: data
    });

    const subject = String(asunto || `Factura ${data.comercio} - ${data.mes} ${data.anio}`).trim();
    const htmlContent = `
      <h2>Factura ${data.mes} ${data.anio}</h2>
      <p>Hola ${nombreDestino || data.contacto || 'cliente'},</p>
      <p>${mensaje.replace(/\n/g, '<br />')}</p>
      <p><strong>Monto:</strong> S/. ${Number(data.precio || 0).toFixed(2)}</p>
      <p>Puedes descargar tu factura aqui: <a href="${facturaUrl}" target="_blank" rel="noopener noreferrer">Descargar factura</a></p>
      <p>Gracias.</p>
    `;

    const textContent = `${mensaje}\n\nMonto: S/. ${Number(data.precio || 0).toFixed(2)}\nFactura: ${facturaUrl}`;

    const response = await enviarCorreoBrevo({
      toEmail: String(emailDestino).trim(),
      toName: nombreDestino || data.contacto,
      subject,
      htmlContent,
      textContent
    });

    await runAsync(
      `UPDATE envios_factura
       SET estado = 'enviado', fechaEnviado = CURRENT_TIMESTAMP
       WHERE pagoId = ?`,
      [pagoId]
    );

    await runAsync(
      `UPDATE pagos_mensuales
       SET estado = CASE WHEN estado = 'factura_pendiente' THEN 'factura_enviada' ELSE estado END
       WHERE id = ?`,
      [pagoId]
    );

    await runAsync(
      'INSERT INTO auditoria (accion, clienteId, detalles, usuario) VALUES (?, ?, ?, ?)',
      [
        'ENVIO_EMAIL_BREVO',
        data.clienteId,
        JSON.stringify({
          pagoId,
          emailDestino: String(emailDestino).trim(),
          messageId: response?.data?.messageId || null,
          proveedor: 'brevo'
        }),
        'sistema'
      ]
    );

    res.json({
      message: `Correo enviado a ${emailDestino}.`,
      messageId: response?.data?.messageId || null,
      facturaUrl
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || 'No se pudo enviar la factura por Brevo.',
      details: error.response || null
    });
  }
});

// ==================== IMPORTAR DATOS ====================

app.post('/api/importar', upload.single('archivo'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No se envió archivo' });
    return;
  }

  try {
    let datos = [];
    const extension = path.extname(req.file.filename).toLowerCase();

    if (extension === '.xlsx' || extension === '.xls') {
      const workbook = xlsx.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      datos = xlsx.utils.sheet_to_json(sheet);
    } else if (extension === '.csv') {
      const contenido = fs.readFileSync(req.file.path, 'utf8');
      datos = csv.parse(contenido, { columns: true });
    } else {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Formato de archivo no soportado' });
      return;
    }

    const filasNormalizadas = datos.map((row) => normalizarFila(row));
    const mesCobroActual = obtenerMesCobroActual();
    const mesesEnArchivo = MESES_ORDEN.filter((mes) => (
      filasNormalizadas.some((fila) => Object.prototype.hasOwnProperty.call(fila, mes))
    ));

    const anioGestion = new Date().getFullYear();
    let procesados = 0;
    let insertados = 0;
    let actualizados = 0;

    await runAsync('BEGIN TRANSACTION');

    for (const fila of filasNormalizadas) {
      const comercio = limpiarCadena(fila.COMERCIO || '');
      if (!comercio) {
        continue;
      }

      const anio = parseInt(fila.ANO || anioGestion, 10);
      const anioSeguro = Number.isFinite(anio) ? anio : anioGestion;

      const mesInicioRaw = limpiarCadena(fila.MES || '');
      const mesInicio = ALIAS_MESES[mesInicioRaw.toUpperCase()] || mesInicioRaw.toUpperCase();
      const fechaEmision = limpiarCadena(fila.FECHADEEMICION || fila.FECHAEMISION || '');

      const comercioKey = normalizarNombreComparacion(comercio);
      const ruc = limpiarCadena(fila.RUC || '');
      const existente = ruc
        ? await getAsync('SELECT id FROM clientes WHERE ruc = ? OR comercioKey = ? LIMIT 1', [ruc, comercioKey])
        : await getAsync('SELECT id FROM clientes WHERE comercioKey = ? LIMIT 1', [comercioKey]);

      let clienteId;
      if (existente?.id) {
        clienteId = existente.id;
        await runAsync(
          `UPDATE clientes
           SET comercio = ?, contacto = ?, celular = ?, ciudad = ?, precio = ?, ruc = ?, rubro = ?, anio = ?, comercioKey = ?, mesInicio = ?, fechaEmision = ?, link = ?, usuario = ?, contrasena = ?
           WHERE id = ?`,
          [
            comercio,
            limpiarCadena(fila.CONTACTO || ''),
            limpiarCadena(fila.CELULAR || ''),
            limpiarCadena(fila.CIUDAD || ''),
            parsearNumero(fila.PRECIO),
            ruc,
            limpiarCadena(fila.RUBRO || ''),
            anioSeguro,
            comercioKey,
            mesInicio,
            fechaEmision,
            limpiarCadena(fila.LINK || ''),
            limpiarCadena(fila.USUARIO || ''),
            limpiarCadena(fila.CONTRASENA || ''),
            clienteId
          ]
        );
        actualizados += 1;
      } else {
        const resultInsert = await runAsync(
          `INSERT INTO clientes (comercio, contacto, celular, ciudad, precio, ruc, rubro, anio, comercioKey, mesInicio, fechaEmision, link, usuario, contrasena)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            comercio,
            limpiarCadena(fila.CONTACTO || ''),
            limpiarCadena(fila.CELULAR || ''),
            limpiarCadena(fila.CIUDAD || ''),
            parsearNumero(fila.PRECIO),
            ruc,
            limpiarCadena(fila.RUBRO || ''),
            anioSeguro,
            comercioKey,
            mesInicio,
            fechaEmision,
            limpiarCadena(fila.LINK || ''),
            limpiarCadena(fila.USUARIO || ''),
            limpiarCadena(fila.CONTRASENA || '')
          ]
        );
        clienteId = resultInsert.lastID;
        insertados += 1;
      }

      for (const mes of mesesEnArchivo) {
        const indiceRealMes = MESES_ORDEN.indexOf(mes);
        if (indiceRealMes === -1 || indiceRealMes > mesCobroActual) {
          continue;
        }

        const valorMes = fila[mes];
        const estadoMes = detectarEstadoMes(valorMes);

        await runAsync(
          `INSERT INTO pagos_mensuales (clienteId, mes, anio, estado, fechaEmision, fechaPago)
           VALUES (?, ?, ?, ?, ?, NULL)
           ON DUPLICATE KEY UPDATE
             estado = VALUES(estado),
             fechaEmision = VALUES(fechaEmision),
             fechaPago = NULL`,
          [clienteId, mes, anioGestion, estadoMes, fechaEmision || null]
        );
      }

      procesados += 1;
    }

    await runAsync('COMMIT');
    fs.unlinkSync(req.file.path);

    res.json({
      message: `${procesados} clientes importados`,
      contador: procesados,
      insertados,
      actualizados,
      mesesDetectados: mesesEnArchivo,
      mesCobroActual: MESES_ORDEN[mesCobroActual]
    });
  } catch (error) {
    try {
      await runAsync('ROLLBACK');
    } catch (_) {
      // No-op
    }

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ error: error.message });
  }
});

// Reiniciar datos por error de importacion
app.delete('/api/admin/reset', (req, res) => {
  db.serialize(() => {
    try {
      limpiarDirectorioArchivos(facturasDir);
    } catch (cleanupError) {
      console.error('Error limpiando archivos de facturas:', cleanupError.message);
    }

    db.run('BEGIN TRANSACTION');

    db.run('DELETE FROM envios_factura');
    db.run('DELETE FROM comprobantes');
    db.run('DELETE FROM pagos_mensuales');
    db.run('DELETE FROM clientes');
    db.run('DELETE FROM auditoria');
    db.run('COMMIT', (err) => {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: 'No se pudo limpiar la base de datos.' });
        return;
      }

      res.json({ message: 'Base de datos reiniciada correctamente.' });
    });
  });
});

// ==================== COMPROBANTES ====================

app.post('/api/comprobantes', upload.single('archivo'), (req, res) => {
  if (!req.file || !req.body.pagoId) {
    res.status(400).json({ error: 'Falta archivo o ID de pago' });
    return;
  }

  const { pagoId } = req.body;
  const archivoUrl = `/uploads/${req.file.filename}`;

  db.run(
    'INSERT INTO comprobantes (pagoId, archivoUrl, tipoArchivo) VALUES (?, ?, ?)',
    [pagoId, archivoUrl, req.file.mimetype],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Actualizar estado del pago
      db.run(
        'UPDATE pagos_mensuales SET estado = ?, fechaPago = CURRENT_DATE WHERE id = ?',
        ['pago_registrado', pagoId],
        (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ id: this.lastID, archivoUrl, message: 'Comprobante subido' });
        }
      );
    }
  );
});

// ==================== REPORTES ====================

app.get('/api/reportes/resumen', (req, res) => {
  sincronizarMesAutomatico()
    .catch((err) => {
      console.error('No se pudo sincronizar el periodo mensual:', err.message);
    })
    .finally(() => {
      db.all(`
        WITH pagos_unicos AS (
          SELECT pm.*
          FROM pagos_mensuales pm
          INNER JOIN (
            SELECT clienteId, mes, MAX(anio) AS anioMax
            FROM pagos_mensuales
            GROUP BY clienteId, mes
          ) ult
            ON ult.clienteId = pm.clienteId
           AND ult.mes = pm.mes
           AND ult.anioMax = pm.anio
        )
        SELECT
          c.comercio,
          COUNT(CASE WHEN pu.estado IN ('factura_enviada', 'factura_pendiente') THEN 1 END) as pendientes,
          COUNT(CASE WHEN pu.estado = 'pago_registrado' THEN 1 END) as pagados,
          SUM(CASE WHEN pu.estado = 'pago_registrado' THEN c.precio ELSE 0 END) as montoRecaudado
        FROM clientes c
        LEFT JOIN pagos_unicos pu ON c.id = pu.clienteId
        GROUP BY c.id
      `, (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(rows);
      });
    });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
    next();
    return;
  }

  if (hasBuild) {
    res.sendFile(buildIndexPath);
    return;
  }

  res.sendFile(path.join(publicDir, 'index.html'));
});

// ==================== SERVIDOR ====================
const startServer = async () => {
  try {
    await new Promise((resolve, reject) => {
      dbConnection.connect((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

    console.log(`Conectado a MySQL (${DB_HOST}:${DB_PORT}/${DB_NAME})`);
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
