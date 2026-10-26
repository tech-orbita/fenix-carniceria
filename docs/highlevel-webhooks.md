# Webhooks de HighLevel

Implementación en la rama Pamela. Requiere desplegar esta rama antes de usar las rutas públicas.

- Formulario Mayorista Cliente: POST https://fenix-carniceria.vercel.app/api/webhooks/highlevel/mayorista-cliente
- Formulario Nuevo Mayorista: POST https://fenix-carniceria.vercel.app/api/webhooks/highlevel/nuevo-mayorista

En ambas acciones configurar Content-Type: application/json y Authorization: Bearer <ORDERS_INGEST_SECRET>. La clave debe coincidir con la variable del servidor. No poner secretos en la URL.

Configurar un flujo por formulario con disparador Form Submitted y filtro del formulario correspondiente. Mapear los valores usando el selector de campos de HighLevel: las capturas no contienen las claves internas de los campos personalizados. No escribir variables de plantilla adivinadas.

El cuerpo puede incluir los campos con sus etiquetas originales o los siguientes nombres explícitos en Custom Data:

| Clave JSON | Campo del formulario |
| --- | --- |
| customer_name | Nombre Completo (cliente) |
| business_name | Nombre del Negocio (nuevo) |
| phone | Teléfono |
| tax_id | Nit o Cédula |
| fulfillment_type | Domicilio o Tienda |
| address | Dirección |
| maps_url | Ubicación de Maps |
| zone | Zona |
| billing | Facturación |
| receiver_phone | Número de Quien Recibe |
| order_text | Coloca tu Pedido |
| observations | Observaciones Adicionales |
| payment_proof | URL del comprobante de Pago |
| submission_id | Identificador único de ESTE envío (si está disponible) |
| contactId | ID del contacto de HighLevel |
| locationId | ID de la subcuenta de HighLevel |
| conversationId | ID de la conversación, si está disponible |
| conversationUrl | URL directa de la conversación, si está disponible |

Nombre o negocio, teléfono, modalidad y texto del pedido son obligatorios. El formulario nuevo requiere negocio. Los campos no presentes en el formulario cliente se omiten; se conservan los datos registrados de ese teléfono. Usar el mismo formato internacional de teléfono en ambos formularios.

No usar el ID de contacto como submission_id: el mismo contacto puede hacer varios pedidos. Con un identificador de envío se rechazan duplicados con 409; sin él, cada petición crea un pedido nuevo.

El texto libre queda íntegro en el detalle y la comanda, sin inventar productos, pesos o precios. La zona se asigna a una ruta existente; si no coincide queda Sin clasificar. Facturación se conserva como respuesta textual. El comprobante se muestra como enlace y no acredita el pago. La app no descarga archivos externos. Original del webhook conservado en orders.source_payload.form_data.original_payload.

Verificación local: node --test --test-isolation=none tests/highlevel.test.mjs; npm run lint; npm run build.

Pendiente para activar: despliegue de Pamela, variables del servidor y prueba con un envío real de cada formulario. Los IDs opacos de customFields requieren mapearse mediante Custom Data con las claves de esta tabla.

## Pipeline Mayoristas

El token privado debe incluir `opportunities.readonly`, `opportunities.write` y, si se usará **Enviar resumen**, `conversations/message.write`. La app busca el pipeline `Mayoristas` y estas etapas por nombre: `Realizo Pedido`, `En Preparacion`, `Despachados`, `Requiere ayuda`, `Pendiente por Pago` y `Pago Realizado`. También se pueden fijar sus IDs con las variables `GHL_WHOLESALE_PIPELINE_ID` y `GHL_STAGE_*_ID` de `.env.example`.

- Un formulario aceptado crea o mueve la oportunidad a **Realizo Pedido**.
- Los cambios operativos del panel sincronizan **En Preparacion**, **Despachados** o **Requiere ayuda**.
- La pestaña **Cartera** sincroniza **Pendiente por Pago** y **Pago Realizado**.
- Los fallos de HighLevel no revierten el pedido: quedan registrados en los logs para reintento/configuración.

## Pipeline Minoristas

La app busca el pipeline `Minoristas` y estas etapas por nombre: `Realizo Pedido`, `En Preparacion`, `Despachados`, `Requiere ayuda`, `Pendiente por Pago` y `Pago`. Los IDs se pueden fijar con `GHL_RETAIL_PIPELINE_ID` y las variables `GHL_RETAIL_STAGE_*_ID` de `.env.example`.

- Cuando el agente registra un pedido nuevo, la oportunidad se crea o mueve a **Realizo Pedido**.
- Los botones **En preparación**, **Despachados** y **Requiere ayuda** mueven la oportunidad a la etapa equivalente.
- **Marcar como pagado** mueve a **Pago** y **Marcar pendiente** mueve a **Pendiente por Pago**.
- Las solicitudes de atención del agente llegan a `/api/webhooks/ghl/help-requests`, aparecen en **Requiere ayuda** y mueven allí la oportunidad.
- Si la actualización local se guarda pero HighLevel falla, el panel muestra la advertencia sin perder el cambio del pedido.

La personalidad, el registro único del cliente y el workflow que marca `Registro Minorista Completo` están documentados en [agente-minorista.md](agente-minorista.md). Mantener `SEND_CONFIRMATION=false` en n8n evita que el agente y el flujo envíen dos confirmaciones por el mismo cambio.

