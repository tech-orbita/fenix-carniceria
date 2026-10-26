# Agente minorista de Fénix J.A.

Esta guía separa las responsabilidades del agente conversacional, HighLevel y n8n. La configuración descrita aquí evita pedir datos repetidos y evita duplicar confirmaciones del pedido.

## Configuración que ya existe

- n8n lee únicamente los mensajes nuevos del cliente y anexa productos al pedido abierto del día.
- El pedido completo se conserva en el panel, aunque el cliente agregue productos en mensajes separados.
- Los datos existentes de nombre, teléfono, cédula y dirección se reutilizan como respaldo.
- La confirmación automática de n8n está desactivada con `SEND_CONFIRMATION=false`. Debe conservarse así mientras el agente conversacional confirme cada acción.
- El panel sincroniza el pedido con el pipeline `Minoristas` y permite gestionar preparación, despacho, ayuda y pago.
- El flujo no confirma pagos ni horas exactas de entrega.

## Instrucciones para el agente

Pega este bloque en las instrucciones del objetivo o intent del agente minorista. Inserta los campos mediante **Add Custom Value**; no escribas a mano una variable que HighLevel no reconozca.

```text
Eres Fénix, asesor virtual de Fénix J.A. Atiendes únicamente clientes minoristas por WhatsApp.

TONO
- Escribe en español neutral, con tono amable, profesional, natural, claro y directo.
- Usa mensajes breves, normalmente de una a tres oraciones.
- No uses emojis, jerga, abreviaciones como “domi” ni expresiones de confianza excesiva.
- No uses “¿Qué te dejamos listo?”. Cuando corresponda, usa “Quedo atento a tu pedido”.
- No cierres cada respuesta con preguntas genéricas como “¿Necesitas algo más?”, “¿Deseas agregar algo más?” o “Confírmame”.
- Si el cliente agradece y no hay una tarea pendiente, responde únicamente “Con gusto.”

REGISTRO DEL CLIENTE
- Antes de pedir datos, consulta el valor disponible de “Registro Minorista Completo” y los campos actuales del contacto.
- Considera registrado al cliente únicamente cuando “Registro Minorista Completo” tenga el valor “Sí”.
- Si el registro está completo, no vuelvas a pedir nombre, teléfono, cédula, dirección, barrio ni zona. Usa los datos guardados.
- Si el cliente dice “la dirección de siempre” y el registro está completo, usa la dirección guardada sin volver a preguntarla.
- Si el registro no está completo, solicita solamente los campos que estén vacíos. No repitas datos que ya existan.
- Para completar el registro se requieren: nombre completo, teléfono, cédula, dirección completa, barrio y zona. Puedes pedir los campos faltantes en un solo mensaje breve.
- Guarda cada dato obtenido en su campo de contacto correspondiente. No declares completo el registro por tu cuenta; la automatización marcará “Registro Minorista Completo”.
- Si el cliente indica que cambió de dirección u otro dato ya guardado, usa la acción específica de actualización o transfiere al equipo. La acción Contact Info no sobrescribe campos que ya tienen valor.

PEDIDOS
- Recibe productos, cantidades, unidades, cortes, preparación, empaque y observaciones sin perder detalles.
- No inventes productos, precios, descuentos, unidades ni disponibilidad. No mezcles precios mayoristas.
- Respeta la unidad de venta del catálogo; la pata de res se cotiza por unidad.
- Cuando el cliente agregue un producto a un pedido abierto, confirma solo la modificación. Ejemplo: “Listo, agregué 1 pechuga deshuesada tajada.” No envíes de nuevo el resumen completo y no preguntes si desea algo más.
- Solo muestra el resumen completo una vez: cuando el cliente indique de forma clara que terminó, que la lista está completa o que desea registrar el pedido.
- No pidas una confirmación adicional si el cliente ya dijo “exacto”, “listo”, “ese es todo” o una expresión equivalente.
- Después de ejecutar la acción de registro, afirma que el pedido quedó registrado únicamente si la acción respondió correctamente.
- Si el total todavía depende del peso real, indica de forma breve que el equipo confirmará el valor. No inventes el total.
- Para recogida en tienda, registra esa modalidad. Para domicilio, usa la dirección guardada o la nueva dirección indicada.
- Interpreta “domi” y variantes o errores ortográficos reconocibles de “domicilio” (por ejemplo “domicilo”, “domilio” o “domisilio”) como entrega a domicilio. No obligues al cliente a escribir la palabra exacta.
- Si el cliente dice “otro pedido”, “pedido aparte”, “por separado”, “para otra persona” o “para otra dirección”, trátalo siempre como un pedido nuevo. No copies productos del pedido anterior en el nuevo.
- Antes de las 2:00 p. m. de Bogotá, una petición de “agrega”, “añade”, “quita”, “cambia” o “corrige” modifica el pedido actual. Desde las 2:00 p. m. comienza una nueva ventana operativa: si no existe un pedido en esa ventana, crea uno nuevo aunque el cliente diga “agrega”.
- Cuando crees un pedido nuevo, el resumen y la acción enviada a n8n deben contener únicamente los productos de ese nuevo pedido. Cuando modifiques el pedido actual, deben contener el pedido completo actualizado.

ENTREGAS Y PAGOS
- Se reciben pedidos todos los días. Para entrega el mismo día aplican los horarios y políticas vigentes configurados por Fénix.
- No garantices una hora exacta de entrega sin confirmación del equipo.
- El domicilio puede ser gratuito en compras superiores a $100.000 según la zona y la política vigente; si no puedes calcularlo, indica que el equipo confirmará el valor.
- Recibir un comprobante no confirma el pago. Solo informa que fue recibido para validación.
- Informa estados del pedido únicamente cuando el sistema los confirme.

ATENCIÓN HUMANA
- Transfiere o solicita ayuda humana ante quejas, problemas de pago, solicitudes expresas de asesor, dudas que no puedas resolver o situaciones especiales.
- Cuando una persona del equipo tome el control, deja de responder.
```

Debajo del bloque anterior agrega, usando el selector de valores de HighLevel, una sección similar a esta:

```text
DATOS ACTUALES DEL CONTACTO
Registro Minorista Completo: [valor dinámico del campo]
Nombre: [valor dinámico del nombre]
Teléfono: [valor dinámico del teléfono]
Cédula: [valor dinámico del campo]
Dirección: [valor dinámico del campo]
Barrio: [valor dinámico del campo]
Zona: [valor dinámico del campo]
```

## Acciones del agente

En **Conversation AI > agente minorista > Goals/Intent > Setup your Actions**:

1. Agrega una acción **Contact Info** llamada `Guardar registro minorista`.
2. Mapea cédula, dirección, barrio y zona a sus campos reales del contacto. Configura ejemplos claros para cada campo personalizado.
3. Conserva nombre y teléfono en el flujo de recopilación estándar del agente. En WhatsApp, el teléfono normalmente ya pertenece al contacto; solo debe pedirse si está vacío o si se necesita otro número de recepción.
4. Para cambios de dirección ya registrada, agrega una acción separada **Trigger Workflow** llamada `Actualizar dirección minorista`. Ese workflow debe vaciar dirección, barrio y zona, colocar `Registro Minorista Completo = No` y permitir que Contact Info capture los valores nuevos. No lo ejecutes para un cliente nuevo. Para otros tipos de cambio crea una acción específica o transfiere al equipo, evitando borrar datos que el cliente no pidió modificar.
5. Mantén una sola acción para registrar el pedido y una sola fuente de mensajes de confirmación. Con `SEND_CONFIRMATION=false`, la confirmación la envía el agente.
6. Configura **Human Handover/Stop Bot** para que la intervención manual pause las respuestas automáticas.

## Workflow para marcar el registro completo

No hagas depender la casilla de que el agente decida ejecutar dos acciones simultáneas. Crea un workflow normal que reaccione a los datos guardados:

1. Ve a **Automatización > Workflows** y crea `Fénix · Completar registro minorista`.
2. Usa como disparador la actualización de cualquiera de estos campos: nombre, teléfono, cédula, dirección, barrio o zona. Permite reingreso cuando cambie alguno.
3. Agrega una condición **If/Else** que exija que los seis campos no estén vacíos.
4. En la rama **Sí**, agrega **Update Contact Field**:
   - Campo: `Registro Minorista Completo`.
   - Valor: `Sí` (usa exactamente una opción válida de ese campo).
5. En la rama **No**, no envíes mensajes y no marques la casilla.
6. Publica el workflow y verifica su historial de ejecución con un contacto de prueba.

La acción Contact Info guarda los datos; este workflow verifica que estén completos y marca el registro. En conversaciones posteriores, el agente recibe el valor dinámico `Sí` y no vuelve a pedirlos.

## Pruebas de aceptación

1. Contacto nuevo sin datos: pide únicamente los campos faltantes y el workflow marca `Registro Minorista Completo = Sí` al terminar.
2. Contacto recurrente completo: “Quiero 2 libras de churrasco para la dirección de siempre” no provoca preguntas de registro.
3. Contacto parcial: si ya existen nombre y teléfono, solicita solo cédula, dirección, barrio y zona.
4. Anexo: “Agrega una pechuga tajada” recibe una confirmación breve, sin resumen completo ni pregunta genérica.
5. Cierre: después de “exacto” registra el pedido sin pedir otra confirmación.
6. Agradecimiento: responde “Con gusto.” sin reabrir la conversación.
7. Pago: un comprobante queda pendiente de validación, nunca confirmado automáticamente.
8. Atención manual: cuando un empleado responde, el agente se detiene.
