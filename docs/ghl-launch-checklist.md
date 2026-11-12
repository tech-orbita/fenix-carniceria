# Checklist de lanzamiento en GoHighLevel

Fuente funcional: capacitación de Fénix J.A. del 29 de octubre de 2026. Ventana acordada de activación: miércoles 4 de noviembre de 2026 a las 5:00 a. m., hora de Bogotá. Confirmar la hora con Fénix antes de activar los agentes.

## Resultado de pruebas del 10 de noviembre de 2026

- Confirmado: abrir conversación desde el panel funciona.
- Confirmado: una respuesta humana pausa el agente.
- Confirmado: el pedido escrito llega al panel.
- Confirmado en el historial de n8n: la nota de voz se transcribió y se anexó al pedido activo. Se corrigió el filtro del panel para mostrar los pedidos según el día operativo minorista (corte a las 2:00 p. m.).
- Corregido en código, pendiente de desplegar y repetir: cuenta de cobro y aviso de despacho por el proveedor personalizado/QR del número minorista `573112889954`.
- Corregido en código, pendiente de desplegar y repetir: creación o actualización de la oportunidad cuando HighLevel no permite oportunidades duplicadas.
- Pendiente de configurar en la acción del agente: disparar el workflow al recibir imagen, documento, comprobante, soporte o recibo de pago. En la prueba el agente respondió, pero el workflow no se ejecutó y por eso no apareció `Requiere ayuda`.
- Corregido en código, pendiente de desplegar y repetir: aplicar la etiqueta exacta `cliente minorista`.
- Pendiente de decisión de catálogo: definir si `Huesos carnudo` corresponde a un producto existente o debe crearse. Hasta resolverlo, el panel lo muestra como `Precio pendiente`, sin bloquear las acciones operativas.

## 1. WhatsApp y agentes

- [ ] Confirmar que los dos números funcionan en modo coexistencia: uno para mayoristas y otro para minoristas.
- [ ] Asignar el agente correcto a cada número y mantener ambos agentes inactivos hasta la ventana acordada.
- [x] Verificar que una respuesta humana pause el agente y que el botón de IA permita reactivarlo.
- [ ] Activar ambos agentes en la ventana confirmada y monitorear las primeras conversaciones.

## 2. Segmentación de contactos y conversaciones

- [ ] Aplicar automáticamente la etiqueta `cliente mayorista` al número mayorista.
- [ ] Aplicar automáticamente la etiqueta `cliente minorista` al número minorista.
- [ ] Confirmar que los administradores vean ambos segmentos y que los operadores con acceso limitado vean solo el suyo.
- [ ] Verificar que nombre, teléfono, negocio, dirección y zona se actualicen después del primer formulario.

## 3. Formularios mayoristas

- [ ] Mantener dos formularios: `Nuevo Mayorista` para el registro inicial y `Mayorista Cliente` para pedidos posteriores.
- [ ] En `Nuevo Mayorista`, exigir negocio, NIT, teléfono, nombre, dirección y texto del pedido; dejar observaciones y comprobante como opcionales.
- [ ] En `Cliente Mayorista`, enviar únicamente establecimiento, teléfono, texto del pedido, observaciones y comprobante.
- [ ] En pedidos posteriores, identificar la ficha por establecimiento y reutilizar sus datos registrados sin sobrescribirlos.
- [ ] Mostrar el formulario dentro de WhatsApp cuando la integración lo permita.
- [ ] Permitir texto libre como `costilla lo que salga`; el webhook lo registrará como `0` para que Fénix complete la cantidad en el panel.
- [ ] Crear un workflow `Form Submitted` separado para cada formulario.
- [ ] Enviar `POST` a los endpoints documentados en `docs/highlevel-webhooks.md`, con `Content-Type: application/json` y `Authorization: Bearer <ORDERS_INGEST_SECRET>`.
- [ ] Mapear `Nuevo Mayorista`: `customer_name`, `business_name`, `phone`, `tax_id`, `address`, `order_text`, `observations` y `payment_proof`.
- [ ] Mapear `Cliente Mayorista`: `business_name`, `phone`, `order_text`, `observations` y `payment_proof`.
- [ ] Eliminar de ambos workflows `fulfillment_type`, `maps_url`, `zone`, `billing` y `receiver_phone`.
- [ ] Usar un `submission_id` distinto por envío; no reutilizar el ID del contacto.

## 4. Pipelines y campos personalizados

- [ ] Confirmar el pipeline `Mayoristas` con las etapas exactas: `Realizo Pedido`, `En Preparacion`, `Despachados`, `Requiere ayuda`, `Pendiente por Pago` y `Pago Realizado`.
- [ ] Confirmar el pipeline `Minoristas` con las etapas exactas: `Realizo Pedido`, `En Preparacion`, `Despachados`, `Requiere ayuda`, `Pendiente por Pago` y `Pago`.
- [ ] Crear o validar los campos de contacto `Orden` y `Valor del pedido`.
- [ ] Copiar los IDs de los pipelines, etapas y campos a las variables `GHL_*` de Vercel para evitar depender de nombres.
- [ ] Verificar que el token privado tenga `opportunities.readonly`, `opportunities.write` y `conversations/message.write`.

## 5. Solicitudes de ayuda y mensajes

- [ ] Conectar la escalación mayorista sin formulario al workflow n8n `/webhook/fenix-mayoristas-ayuda` con encabezado `x-fenix-secret`.
- [ ] Confirmar que el workflow reenvíe la solicitud a `/api/webhooks/ghl/wholesale-help-requests` y conserve `contactId`, `locationId`, `conversationId` y `sourceEventId`.
- [x] Probar el botón de conversación del panel con una URL válida de la conversación de HighLevel.
- [ ] Probar el mensaje de cobro desde Cartera y el aviso automático al marcar un pedido como despachado.
- [ ] Mantener `SEND_CONFIRMATION=false` en n8n para evitar confirmaciones duplicadas.

## 6. Prueba de aceptación antes de activar

- [ ] Enviar un registro real de `Nuevo Mayorista` y comprobar contacto, etiqueta, oportunidad y pedido en el panel.
- [ ] Enviar un pedido de `Mayorista Cliente` con cantidades normales y otro con un producto sin cantidad.
- [ ] Verificar que el pedido sin cantidad muestre `0`, que pueda editarse y que la unidad de pata de res sea `und`.
- [ ] Confirmar que los pedidos recibidos hasta las 5:00 a. m. queden en el despacho del mismo día y los posteriores pasen al siguiente día operativo.
- [ ] Probar un pedido minorista completo, pago, impresión térmica y cambio a despachado.
- [ ] Confirmar con Fénix la fecha de inicio del ciclo de facturación y documentarla en el grupo de soporte.
