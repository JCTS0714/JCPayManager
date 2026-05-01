# Kapso: Guia de pruebas rapidas (WhatsApp BSP)

Esta guia documenta los pasos minimos para validar envio de WhatsApp por Kapso en JCPAYMANAGER.

## 1) Variables de entorno requeridas

Configura en `.env`:

```env
KAPSO_ENABLED=true
KAPSO_API_KEY=tu_api_key_kapso
KAPSO_PHONE_NUMBER_ID=123456789012345
PUBLIC_BASE_URL=https://tu-dominio-publico
```

Notas:
- `KAPSO_PHONE_NUMBER_ID` es el `phone_number_id` del numero conectado en Kapso.
- `PUBLIC_BASE_URL` debe ser accesible desde internet para que WhatsApp pueda descargar el PDF.

## 2) Reiniciar backend

```bash
npm start
```

## 3) Verificar estado de integracion

Endpoint:

- `GET /api/integraciones/kapso/status`

Debe responder `configured: true`.

## 4) Probar envio de texto (sanity check)

Endpoint:

- `POST /api/integraciones/kapso/test`

Body JSON:

```json
{
  "celularDestino": "519XXXXXXXX"
}
```

## 5) Probar envio de PDF por script

```bash
npm run test:kapso:wa-pdf -- 519XXXXXXXX
```

Este script:
- genera un PDF temporal en `uploads/facturas/`
- construye su URL publica
- envia un mensaje tipo `document` por Kapso

## 6) Flujo desde la UI

En Envio Masivo, al usar "Preparar y enviar WA":
- se guarda la factura
- si Kapso esta configurado y hay celular valido, envia el PDF por API
- si falla, deja fallback para envio manual con `wa.me`

## Troubleshooting rapido

### Error 401/403 en Kapso

- API key invalida o sin permisos.
- Verifica `KAPSO_API_KEY` y proyecto correcto.

### Error de media/documento

- `PUBLIC_BASE_URL` no es publico o URL no accesible.
- Valida que el archivo responda por HTTPS y sin bloqueo.

### No llega el mensaje

- Revisa formato de destino (E.164 sin `+`, ej. `519XXXXXXXX`).
- Revisa logs del backend y API logs en Kapso.
