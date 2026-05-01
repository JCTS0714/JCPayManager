# Brevo: Guia de pruebas rapidas (Email y SMS)

Esta guia documenta lo implementado en el proyecto para pruebas de Brevo y los pasos minimos para ejecutarlas.

## Estado actual

- Email transaccional: habilitado y probado.
- SMS transaccional: script listo (requiere habilitacion/creditos/ruta en Brevo).
- WhatsApp API: no habilitado en plan actual.

## Variables de entorno requeridas

Definir en [.env](.env):

```dotenv
BREVO_ENABLED=true
BREVO_API_KEY=tu_api_key_brevo
BREVO_SENDER_EMAIL=notificaciones@tu-dominio.com
BREVO_SENDER_NAME=JCPAYMANAGER
BREVO_SMS_SENDER=ATLANTIS
PUBLIC_BASE_URL=http://localhost:3001
```

Notas:
- `BREVO_SENDER_EMAIL` debe ser un remitente valido/verificado en Brevo.
- `BREVO_SMS_SENDER` depende de reglas del pais/cuenta (Sender ID o numero permitido).

## Scripts disponibles

- WhatsApp + PDF (actualmente bloqueado por plan):
  - `npm run test:brevo:wa-pdf -- 519XXXXXXXX`
- Email y/o SMS:
  - `npm run test:brevo:email-sms -- --email correo@dominio.com`
  - `npm run test:brevo:email-sms -- --sms 519XXXXXXXX`
  - `npm run test:brevo:email-sms -- --email correo@dominio.com --sms 519XXXXXXXX`

## PDF adjunto de prueba

La prueba de email adjunta automaticamente el archivo:

- [test-assets/prueba-email.pdf](test-assets/prueba-email.pdf)

Puedes reemplazar ese archivo por cualquier otro PDF conservando el mismo nombre.

## Flujo recomendado para validar Email

1. Verificar variables `.env`.
2. Ejecutar:

```powershell
npm run test:brevo:email-sms -- --email tu-correo@dominio.com
```

3. Confirmar salida en terminal:
- `Email enviado OK`
- `email messageId: ...`

4. Confirmar llegada en bandeja de entrada (y carpeta spam/promociones si aplica).

## Errores comunes y solucion

### Error: `valid sender email required`

Causa:
- `BREVO_SENDER_EMAIL` invalido o no verificado.

Solucion:
1. Corregir formato de correo (debe incluir `@dominio`).
2. Verificar remitente en Brevo.

### Error SMS: `permission_denied` o similar

Causa:
- Canal SMS no habilitado para cuenta/ruta/pais o sin creditos.

Solucion:
1. Revisar creditos SMS en Brevo.
2. Confirmar `BREVO_SMS_SENDER` permitido para tu pais.
3. Revisar numero destino en formato E.164 sin signos.

### Error WhatsApp: `Your account is not registered`

Causa:
- Cuenta no registrada/habilitada para WhatsApp API en Brevo.

Solucion:
1. Completar alta de WhatsApp Business en Brevo + Meta.
2. Confirmar plan con acceso a WhatsApp API.
3. Primer envio via API debe usar plantilla aprobada (`templateId`).

## Endpoints de backend agregados

- `GET /api/integraciones/brevo/status`
- `POST /api/integraciones/brevo/test`
- `POST /api/facturas/:pagoId/enviar-email`

## Seguridad

- Nunca compartir API keys en capturas o commits.
- Si una clave fue expuesta, rotarla inmediatamente en Brevo.
- Mantener `.env` fuera de control de versiones.
