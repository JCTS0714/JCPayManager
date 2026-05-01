# ⚡ Guía Rápida - PayManager en 5 Minutos

## Paso 1️⃣: Preparar la carpeta

Crea una carpeta llamada `paymanager` y coloca dentro:

```
paymanager/
├── server.js
├── App.jsx
├── App.css
├── index.js
├── index.html
├── package.json
├── README.md
├── env.template
├── components/
│   ├── ClientesList.jsx
│   ├── ClienteDetalle.jsx
│   ├── ImportarDatos.jsx
│   └── Reportes.jsx
└── public/
    └── index.html
```

## Paso 2️⃣: Instalar dependencias (2 min)

```bash
cd paymanager
npm install
```

Espera a que terminen las descargas (~30-60 segundos)

## Paso 3️⃣: Crear carpeta de uploads

```bash
mkdir uploads
```

Esta carpeta guardará las imágenes de comprobantes.

## Paso 4️⃣: Ejecutar Backend (Terminal 1)

```bash
npm start
```

Deberías ver:
```
Servidor ejecutándose en http://localhost:3001
Conectado a MySQL (host:puerto/base)
```

✅ Backend listo

## Paso 5️⃣: Ejecutar Frontend (Terminal 2 - misma carpeta)

```bash
npm run client
```

Se abrirá automáticamente: `http://localhost:3000`

✅ **¡Sistema corriendo!**

---

## 🎯 Primer uso

### 1. Importar clientes
- Haz clic en "Importar"
- Descarga la plantilla
- Llena tus datos
- Sube el archivo

### 2. Ver clientes
- Ves a "Clientes"
- Haz clic en uno
- Verás su historial de pagos

### 3. Registrar pago
- En detalles del cliente
- Sección "Cargar Comprobante"
- Selecciona mes y sube imagen
- ¡Listo!

---

## 🐛 Si algo no funciona

### Error de puerto
```bash
# Cambiar puerto en server.js (línea con const PORT = 3001)
const PORT = 3002  # Cambiar a otro número
```

### Dependencias no instalan
```bash
npm install --legacy-peer-deps
```

### Configuracion de base de datos
```bash
# 1) Copia env.template a .env
# 2) Configura DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
# 3) Crea la base de datos MySQL y ejecuta npm start
```

---

## 📁 Estructura Final

Después de ejecutar, verás:
```
paymanager/
├── node_modules/          (creada automáticamente)
├── uploads/               (comprobantes guardados aquí)
├── .env                  (configuracion local, NO subir a git)
├── env.template          (plantilla de variables)
└── [archivos del código]
```

---

## ✨ Características principales

| Función | Ubicación |
|---------|-----------|
| Ver clientes | Panel principal |
| Importar datos | Botón "Importar" |
| Registrar pagos | Detalles del cliente |
| Ver reportes | Botón "Reportes" |
| Buscar cliente | Barra de búsqueda |

---

## 🚀 Próximos pasos

1. **Personalizar colores**: Edita `App.css` (variables CSS al inicio)
2. **Agregar usuarios**: Modifica `server.js` para autenticación
3. **Integrar Google Drive**: Descarga la documentación de Google Drive API
4. **Deploy a producción**: Usa Heroku o Vercel

---

## 📞 Comando útiles

```bash
# Reiniciar servidor
npm start

# Reiniciar frontend
npm run client

# Ver logs detallados (Mac/Linux)
npm start 2>&1 | tee server.log

# Limpiar todo y reinstalar
rm -rf node_modules package-lock.json
npm install
```

---

**¡Listo! Tu sistema de administración de pagos está funcionando! 🎉**

Necesitas ayuda? Revisa el README.md completo o contacta al equipo de desarrollo.
