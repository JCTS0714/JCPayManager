# 📊 PayManager - Sistema de Administración de Pagos

Un sistema profesional y escalable para administrar pagos de clientes, diseñado específicamente para empresas con múltiples clientes y flujos de pago complejos.

## 🎯 Características

✅ **Gestión de Clientes**
- Importar datos desde Excel/CSV
- Información completa del cliente (contacto, celular, ciudad, RUC, rubro)
- Búsqueda y filtrado en tiempo real

✅ **Administración de Pagos**
- Estados de pago dinámicos (Factura Enviada → Pago Registrado)
- Registro mensual de pagos
- Cálculo automático de deuda

✅ **Comprobantes Digitales**
- Subida de imágenes/capturas de pago
- Almacenamiento local con visión a Google Drive
- Galería de comprobantes por cliente

✅ **Reportes y Estadísticas**
- Resumen de pagos pendientes y recaudados
- Análisis de clientes morosos
- Exportación a Excel

✅ **Interfaz Profesional**
- Diseño moderno y responsivo
- Paleta de colores profesional
- Navegación intuitiva

---

## 🛠️ Instalación

### Requisitos Previos
- Node.js 14+ instalado
- npm o yarn
- Git (opcional)

### Paso 1: Descargar archivos
Descarga todos los archivos en una carpeta llamada `paymanager`

### Paso 2: Instalar dependencias

```bash
cd paymanager
npm install
```

### Paso 3: Estructura de carpetas
Crea esta estructura en tu proyecto:

```
paymanager/
├── server.js                 # Backend API
├── App.jsx                   # Componente principal React
├── App.css                   # Estilos globales
├── package.json             # Dependencias
├── components/              # Carpeta de componentes
│   ├── ClientesList.jsx
│   ├── ClienteDetalle.jsx
│   ├── ImportarDatos.jsx
│   └── Reportes.jsx
├── uploads/                 # Carpeta para comprobantes (crear manualmente)
└── env.template             # Plantilla de variables de entorno
```

### Paso 4: Ejecutar el sistema

**Terminal 1 - Backend:**
```bash
npm start
# El servidor inicia en http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
npm run client
# La app React inicia en http://localhost:3000
```

---

## 📖 Cómo Usar

### 1. **Importar Clientes**
1. Ve a la sección "Importar"
2. Descarga la plantilla Excel
3. Llena con tus datos de clientes
4. Sube el archivo

**Columnas requeridas:**
- COMERCIO (nombre del negocio)
- CONTACTO (nombre del contacto)
- CELULAR (número de teléfono)
- CIUDAD
- PRECIO (monto mensual a pagar)
- RUC
- RUBRO (tipo de negocio)
- AÑO
- USUARIO
- CONTRASEÑA

### 2. **Gestionar Pagos**
1. En la sección "Clientes", haz clic en un cliente
2. Verás su historial de pagos
3. Para registrar un pago:
   - Selecciona el mes/año con estado "Factura Enviada"
   - Sube el comprobante (imagen)
   - El estado cambia automáticamente a "Pago Registrado"

### 3. **Ver Reportes**
- Ve a la sección "Reportes"
- Visualiza estadísticas generales
- Identifica clientes morosos
- Descarga reportes en Excel

---

## 🗄️ Estructura de Base de Datos

### Tabla: clientes
```sql
- id (INT, PK)
- comercio (TEXT)
- contacto (TEXT)
- celular (TEXT)
- ciudad (TEXT)
- precio (REAL)
- ruc (TEXT)
- rubro (TEXT)
- año (INT)
- usuario (TEXT)
- contraseña (TEXT)
- createdAt (DATETIME)
```

### Tabla: pagos_mensuales
```sql
- id (INT, PK)
- clienteId (FK → clientes)
- mes (TEXT)
- año (INT)
- estado (TEXT): 'factura_enviada' o 'pago_registrado'
- fechaEmision (DATE)
- fechaPago (DATE)
- comprobante (TEXT)
- notas (TEXT)
```

### Tabla: comprobantes
```sql
- id (INT, PK)
- pagoId (FK → pagos_mensuales)
- archivoUrl (TEXT)
- tipoArchivo (TEXT)
- fechaSubida (DATETIME)
```

---

## 🔌 API Endpoints

### Clientes
```
GET    /api/clientes              # Obtener todos
GET    /api/clientes/:id          # Obtener uno con pagos
POST   /api/clientes              # Crear nuevo
```

### Pagos
```
PUT    /api/pagos/:id             # Actualizar estado
```

### Importación
```
POST   /api/importar              # Importar Excel/CSV
```

### Comprobantes
```
POST   /api/comprobantes          # Subir comprobante
```

### Reportes
```
GET    /api/reportes/resumen      # Resumen de pagos
```

---

## 🚀 Deployment

### Opción 1: Servidor local (desarrollo)
Ya está configurado. Usa `npm start` y `npm run client`

### Opción 2: Producción con Heroku

```bash
# 1. Instalar Heroku CLI
# 2. Login
heroku login

# 3. Crear app
heroku create tu-app-name

# 4. Configurar variables de entorno
heroku config:set NODE_ENV=production

# 5. Deploy
git push heroku main
```

### Opción 3: Con Google Drive (para comprobantes)
Se necesitará configurar OAuth 2.0 con Google Drive API.

---

## 📱 Características Avanzadas (Próximas)

- 📧 Envío automático de recordatorios por email
- 📱 App móvil (React Native)
- 🔐 Autenticación de usuarios con roles
- 📊 Gráficos más avanzados
- 🌐 Integración con Google Drive
- 💳 Pasarela de pagos integrada
- 📱 WhatsApp notificaciones

---

## 🐛 Solución de Problemas

### Error: "Port 3001 already in use"
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3001
kill -9 <PID>
```

### Error: "Cannot find module"
```bash
npm install
# Si persiste:
rm -rf node_modules package-lock.json
npm install
```

### Base de datos no conecta
- Verifica credenciales MySQL en `.env` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
- Confirma que la base de datos exista en tu proveedor antes de iniciar el backend.

---

## 📞 Soporte

Para reportar bugs o sugerir features, revisa la documentación o contacta al equipo de desarrollo.

### Documentacion operativa de integraciones

- Brevo (Email/SMS): [docs/BREVO_PRUEBAS.md](docs/BREVO_PRUEBAS.md)
- Kapso (WhatsApp BSP): [docs/KAPSO_PRUEBAS.md](docs/KAPSO_PRUEBAS.md)
- Kapso (WhatsApp BSP): script de prueba `npm run test:kapso:wa-pdf -- 519XXXXXXXX`

---

## 📄 Licencia

Este proyecto es propietario. Todos los derechos reservados.

---

## 🎨 Diseño

Interfaz profesional creada con:
- React 18+
- CSS3 con variables y animaciones
- Responsive Design
- Paleta de colores moderna (Teal & Orange)

---

**Versión:** 1.0.0  
**Última actualización:** 2024
