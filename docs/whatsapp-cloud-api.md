# Integración WhatsApp Cloud API (preparación, no desplegada)

Función: `supabase/functions/send-whatsapp-template/index.ts`.

**Estado:** código preparado, NO conectado al frontend, NO desplegado y NO envía mensajes todavía.

## Requisitos
- Identificar el proyecto Supabase real de PATRIAM antes de desplegar.
- Configurar secretos de Edge Functions: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION` (versión vigente de Graph API), `WHATSAPP_INTERNAL_SECRET` (valor aleatorio largo).
- Registrar un número real en WhatsApp Business Platform y aprobar plantillas para producción.
- Obtener consentimiento específico y documentado del destinatario para mensajes de WhatsApp.
- Implementar un disparador **servidor a servidor** desde un evento validado (pedido, solicitud, etc.) y comprobación de consentimiento. No llamar desde React.
- Evitar duplicados con identificadores de evento y registro de envío; incorporar límites de frecuencia, reintentos controlados y webhook de estado antes de producción.
- Proteger el endpoint: requiere `x-internal-secret` y además se recomienda verificación JWT de Supabase para llamadas internas. El secreto NO debe ir en código público.
- Nunca subir tokens a GitHub.

## Contrato de entrada (solo servidor)
`POST` con JSON:
`{"to":"+34600000000","template":"nombre_aprobado","language":"es","parameters":["Nombre"]}`

El remitente y token se obtienen de secretos; se utiliza la API oficial de Meta. Para el número de prueba solo funcionan destinatarios verificados. El servidor llamante debe garantizar consentimiento y autorización antes de invocar la función.
