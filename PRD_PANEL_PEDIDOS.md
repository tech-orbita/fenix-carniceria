# PRD — Panel de pedidos Fénix J.A.

**Versión:** 1.0  
**Estado:** Propuesta para validación  
**Fecha:** 5 de octubre de 2026  
**Producto:** Panel operativo de pedidos para Distribuidora de Carnes Fénix J.A.  
**Fuente principal:** Transcripción del onboarding del 25 de septiembre (79 minutos)

## 1. Resumen ejecutivo

Fénix J.A. recibe pedidos por dos líneas de WhatsApp con operaciones distintas:

- **Mayoristas:** tiendas, restaurantes y otras distribuidoras que realizan pedidos recurrentes, normalmente para entrega al día siguiente. El equipo consolida manualmente cada chat en una planilla de clientes contra productos y organiza el despacho por rutas.
- **Minoristas o consumo hogar:** consumidores finales cuyos pedidos requieren más detalle de presentación, corte, porcionado, peso, precio, pago y entrega. Hoy se cotizan y facturan manualmente.

El panel debe centralizar los pedidos capturados desde formulario, texto o nota de voz en WhatsApp y convertirlos en registros operables. Debe eliminar la revisión chat por chat, reducir errores de transcripción y mostrar cada línea de negocio con una interfaz adaptada a su trabajo real.

El MVP tendrá, como mínimo:

1. Una **interfaz mayorista** en formato matriz, agrupada por ruta, que permita consolidar cantidades por producto, imprimir y exportar.
2. Una **interfaz minorista** en formato bandeja de pedidos, que permita revisar especificaciones, cotizar, registrar el pago, imprimir un comprobante y avanzar el estado del pedido.

## 2. Problema

Los pedidos llegan durante la tarde, noche y madrugada. A primera hora, una persona invierte aproximadamente una hora en abrir cada conversación y copiar el pedido a una planilla. Este proceso:

- retrasa la preparación y salida de las rutas;
- puede omitir pedidos o mezclar zonas;
- introduce errores al interpretar productos, unidades y notas de voz;
- dificulta sumar la demanda total de un producto;
- obliga a cotizar y escribir comprobantes minoristas a mano;
- separa la evidencia de pago, el pedido y su estado;
- impide consultar ventas y conciliación del día en tiempo real.

## 3. Objetivos

### 3.1 Objetivo principal

Reducir el trabajo manual entre la recepción del pedido y su preparación, dando al equipo una fuente única para revisar, confirmar, producir, despachar y consultar pedidos mayoristas y minoristas.

### 3.2 Resultados esperados

- Reducir en al menos 70 % el tiempo dedicado a consolidar pedidos mayoristas.
- Evitar que un pedido confirmado quede fuera de su ruta.
- Mantener trazabilidad desde el mensaje o formulario original hasta la entrega.
- Permitir cotizar un pedido minorista sin elaborar una factura manuscrita.
- Mostrar ventas minoristas del día, separadas por medio de pago y canal.
- Informar al cliente por WhatsApp cuando cambia un estado relevante.

### 3.3 No objetivos del MVP

- Facturación electrónica ante la DIAN.
- Reemplazo o integración completa con Siigo.
- Contabilidad, cartera o inventario contable.
- Optimización automática de rutas o seguimiento GPS.
- Comercio electrónico con catálogo y pago en línea.
- Gestión de compras a proveedores.
- Resolución automática de reclamos, devoluciones o disputas de saldo.

## 4. Usuario y permisos

El MVP tiene un único rol: **Administrador**. Este usuario gestiona clientes,
productos, precios, rutas, pedidos, pagos, impresión, descargas, preparación,
despacho y cierre. También es quien marca un pedido como enviado y entregado.
No existe registro público ni selector de roles.

Toda modificación de cantidades, precios, estado o pago debe registrar usuario,
fecha y valor anterior para conservar trazabilidad.

## 5. Principios de producto

- **Una fuente operativa:** el panel es el registro canónico de los pedidos aceptados.
- **Dos operaciones, dos vistas:** mayoristas y minoristas comparten datos, pero no una interfaz idéntica.
- **La IA propone; una persona confirma:** los pedidos interpretados desde texto o audio deben mostrar su nivel de confianza y conservar el contenido original.
- **Datos recurrentes una sola vez:** el cliente se identifica por teléfono y reutiliza sus datos; puede actualizarlos cuando cambien.
- **La excepción debe ser visible:** faltantes, pagos dudosos, campos incompletos y reclamos requieren una cola de revisión.
- **Impresión operativa:** las vistas críticas deben funcionar en pantalla y en papel.

## 6. Alcance del MVP

### 6.1 Funciones compartidas

- Inicio de sesión y control de acceso.
- Panel con selector principal: **Minoristas** / **Mayoristas**.
- Búsqueda por número de pedido, cliente, teléfono, negocio o producto.
- Filtros por fecha de entrega, estado, origen, ruta/zona y estado de pago.
- Alta automática o manual de pedidos.
- Vista del mensaje, nota de voz transcrita o formulario que originó el pedido.
- Edición controlada de productos, cantidades, unidades y observaciones.
- Historial de cambios y estados.
- Alertas por información incompleta, baja confianza o pedido duplicado.
- Notificaciones de WhatsApp por eventos configurados.
- Exportación de datos en Excel/CSV.
- Diseño responsive y uso dentro de GoHighLevel mediante vista embebida.

### 6.2 Canales de entrada

El sistema debe distinguir el origen:

1. **Formulario enlazado desde WhatsApp:** canal recomendado. Entrega campos estructurados y permite adjuntar comprobante.
2. **Mensaje de texto:** el agente extrae cliente, productos, cantidades, unidades y observaciones.
3. **Nota de voz:** el agente transcribe y extrae el pedido.
4. **Carga manual:** un operador registra o corrige un pedido desde el panel.

Los pedidos de texto o audio no deben quedar confirmados automáticamente cuando falte un producto, cantidad o unidad, o cuando la confianza de extracción sea inferior al umbral configurado.

## 7. Interfaz de pedidos mayoristas

### 7.1 Propósito

Convertir los pedidos de tiendas, restaurantes y distribuidoras en una planilla consolidada que facilite compras, alistamiento y despacho por rutas.

### 7.2 Vista principal: matriz de producción y rutas

La vista predeterminada debe usar:

- **filas:** clientes o puntos de entrega;
- **columnas:** productos;
- **celdas:** cantidad y unidad solicitada;
- **agrupación:** fecha de entrega y ruta/zona;
- **totales:** suma por producto, subtotal por cliente y total de pedidos de la ruta.

La matriz debe permitir:

- alternar entre “Clientes × productos” y una lista compacta de pedidos;
- fijar encabezados y primera columna al desplazarse;
- ocultar productos sin demanda;
- marcar un pedido o una ruta como revisada, en preparación o despachada;
- detectar clientes sin ruta y pedidos con datos incompletos;
- imprimir una o varias hojas con encabezado, fecha, ruta y numeración de páginas;
- exportar exactamente lo filtrado a Excel/CSV;
- mostrar totales consolidados por producto para saber cuánto preparar o repartir;
- abrir el detalle de un pedido sin perder el contexto de la matriz.

### 7.3 Agrupación por rutas

Las rutas iniciales mencionadas son:

- Soledad;
- Centro / Centro histórico;
- Norte;
- Sur / sector cercano al Estadio Metropolitano;
- Galapa;
- Sin clasificar.

Cada cliente mayorista debe tener una ruta guardada. El sistema propondrá la ruta en pedidos futuros y permitirá cambiarla para un pedido específico. Ningún pedido listo para despacho puede permanecer en “Sin clasificar”.

### 7.4 Detalle mayorista

Debe mostrar:

- número de pedido;
- fecha y hora de recepción;
- fecha solicitada o prometida de entrega;
- razón social y nombre comercial;
- NIT o identificación;
- persona y teléfono de contacto;
- persona y teléfono de recepción, si difieren;
- dirección, barrio, municipio y ruta;
- líneas de producto con cantidad, unidad y observaciones;
- pedido original y canal de origen;
- forma de pago, condición de crédito y comprobantes;
- requerimiento de factura electrónica;
- observaciones generales;
- estado e historial.

### 7.5 Estados mayoristas propuestos

`Revisión requerida` → `Confirmado` → `En preparación` → `Listo para ruta` → `Despachado` → `Entregado`

Estados alternos: `Cancelado` e `Incidencia`.

La transición a `Confirmado` requiere cliente identificado, fecha de entrega, ruta, al menos una línea válida y ausencia de ambigüedades bloqueantes.

## 8. Interfaz de pedidos minoristas

### 8.1 Propósito

Gestionar cada pedido de consumo hogar como un caso individual, conservando las instrucciones de corte y permitiendo cotizar, cobrar, imprimir y despachar con rapidez.

### 8.2 Vista principal: bandeja de pedidos

La vista debe presentar tarjetas o filas en orden de llegada con:

- número de pedido y hora;
- cliente y teléfono;
- domicilio o recogida en tienda;
- zona/barrio;
- cantidad de líneas;
- total cotizado;
- estado de pago;
- estado operativo;
- alertas de instrucciones especiales o revisión humana.

El operador podrá filtrar por estado y abrir el pedido en un panel de detalle. La prioridad inicial será el orden de llegada, con capacidad de destacar pedidos urgentes autorizados.

### 8.3 Detalle y cotización minorista

Cada línea debe permitir capturar:

- producto;
- cantidad solicitada;
- unidad: kg, libra, gramo, onza, unidad u otra configurada;
- presentación o corte: entero, porcionado, tajado/rebanado, cubos, posta u otra;
- número o peso de porciones;
- instrucciones de limpieza, empaque o preparación;
- peso real preparado, si difiere de lo solicitado;
- precio unitario vigente;
- subtotal calculado.

El detalle debe calcular subtotal, domicilio, ajustes y total. Antes de enviar o imprimir, un operador debe confirmar los precios y el total.

### 8.4 Comprobante de venta

El MVP debe generar un comprobante comercial no electrónico que pueda:

- enviarse por WhatsApp;
- imprimirse en papel térmico tipo POS;
- reimprimirse desde el historial.

Debe incluir marca, número de pedido, fecha, cliente, líneas con cantidades/precios, domicilio, total, forma de pago y notas. Debe indicar expresamente que no es factura electrónica mientras no exista integración autorizada con DIAN o Siigo.

### 8.5 Entrega minorista

- Opciones: `Domicilio` y `Recoge en tienda`.
- Para domicilio se requieren dirección, barrio, municipio, contacto y teléfono de quien recibe.
- Para recogida se ocultan los campos de dirección y se avisa cuando el pedido esté listo.
- La entrega minorista es gratuita desde COP 100.000.
- El costo y tratamiento de pedidos inferiores a COP 100.000 queda pendiente de definición.

### 8.6 Estados minoristas propuestos

`Revisión requerida` → `Recibido` → `Cotizado` → `Confirmado` → `En preparación` → `Listo` → `Despachado` → `Entregado`

Estados alternos: `Cancelado` e `Incidencia`.

`Despachado` solo aplica a domicilio; los pedidos de recogida pasan de `Listo` a `Entregado`.

## 9. Clientes

### 9.1 Registro inicial

En la primera compra se debe recopilar, como mínimo:

- tipo de cliente: minorista o mayorista;
- nombre completo;
- teléfono de WhatsApp;
- teléfono y nombre de quien recibe, si difieren;
- dirección completa;
- barrio, municipio y zona/ruta;
- aceptación de tratamiento de datos y condiciones del servicio.

Para mayoristas o clientes que solicitan factura electrónica también se deben contemplar:

- razón social;
- NIT o documento;
- correo de facturación;
- dirección de facturación;
- nombre comercial y tipo de negocio.

La lista fiscal definitiva debe validarse con Fénix antes de implementar campos obligatorios.

### 9.2 Clientes recurrentes

El número de teléfono será el identificador primario de búsqueda. En pedidos posteriores el formulario debe recuperar los datos guardados y solicitar solamente:

- confirmación o cambio de dirección;
- pedido;
- observaciones;
- modalidad de entrega;
- información de pago cuando aplique.

## 10. Pagos, crédito y comprobantes

El pedido debe registrar:

- modalidad: anticipado, contraentrega o crédito;
- medio: efectivo, transferencia u otro configurado;
- estado: `No requerido`, `Pendiente`, `Comprobante recibido`, `Verificado`, `Rechazado`, `Pagado` o `Crédito`;
- valor pagado y saldo;
- imagen o enlace del comprobante;
- usuario y hora de verificación.

La recepción de un comprobante no equivale a pago verificado. Los desacuerdos sobre saldos, cartera o pagos deben crear una incidencia y derivarse a una persona.

## 11. Catálogo y precios

- El catálogo contempla aproximadamente 87 productos, unos 30 en la lista de precios y cerca de 15 de alta rotación.
- Debe soportar carne de res y cerdo desde el inicio y permitir agregar aves en el futuro.
- Cada producto tendrá nombre, categoría, aliases usados por clientes, unidades permitidas, estado activo y observaciones.
- Los precios deben tener vigencia y pueden diferir por tipo de cliente.
- Un cambio de precio no debe modificar pedidos ya cotizados o confirmados.
- Las expresiones genéricas —por ejemplo, “carne blanda”— deben poder mapearse a productos específicos, pero requieren confirmación si existe ambigüedad.

## 12. Automatizaciones de WhatsApp

Los mensajes deben usar tono amable, cortés y neutral, sin exceso de emojis. Eventos mínimos:

- pedido recibido y número asignado;
- pedido que requiere aclaración;
- cotización disponible con total y medios de pago;
- pedido confirmado;
- inicio de preparación;
- pedido listo para recoger;
- pedido despachado;
- pedido entregado;
- entrega programada para el siguiente día hábil.

Las quejas, devoluciones, producto en mal estado, reclamos por saldo y verificación dudosa de pagos deben detener la automatización y asignarse a atención humana.

## 13. Reglas de negocio conocidas

1. Los pedidos se reciben 24/7, aunque el despacho opera en horario limitado.
2. El punto físico atiende de 6:00 a. m. a 4:00 p. m.
3. Los domicilios se realizan de 6:00 a. m. a 2:00 p. m.
4. La promesa estándar es entrega en la mañana del día siguiente.
5. Puede aceptarse un pedido el mismo día si la ruta no ha salido y existe capacidad; requiere confirmación manual.
6. Los pedidos minoristas se priorizan inicialmente por orden de llegada.
7. El tiempo exacto de preparación no se promete, pues depende del volumen.
8. El domicilio mayorista es gratuito.
9. El domicilio minorista es gratuito desde COP 100.000.
10. La cobertura mencionada incluye Barranquilla, Soledad y Galapa, sujeta a clasificación por ruta.
11. Un pedido tomado el sábado para una operación cerrada el domingo debe programarse para el siguiente día hábil; el calendario definitivo está por confirmar.

## 14. Modelo de datos conceptual

| Entidad | Campos esenciales |
| --- | --- |
| Cliente | ID, tipo, nombre, negocio, NIT/documento, teléfonos, datos fiscales, estado |
| Dirección | Cliente, dirección, barrio, municipio, ruta, instrucciones, principal |
| Producto | ID, nombre, categoría, aliases, unidades, activo |
| Precio | Producto, segmento, unidad, valor, vigencia |
| Pedido | Número, segmento, cliente, origen, recepción, entrega, modalidad, ruta, estado, total |
| Línea de pedido | Producto, texto original, cantidad, unidad, corte/presentación, peso real, precio, subtotal, notas |
| Pago | Pedido, modalidad, medio, valor, saldo, estado, comprobante, verificador |
| Estado de pedido | Pedido, estado anterior/nuevo, fecha, usuario, comentario |
| Incidencia | Pedido/cliente, tipo, detalle, responsable, estado, resolución |
| Mensaje de origen | Pedido, canal, contenido/transcripción, archivo, confianza de extracción |

## 15. Reportes

### 15.1 Mayoristas

- Planilla diaria por fecha y ruta.
- Consolidado de cantidades por producto y unidad.
- Pedidos no asignados, incompletos o no despachados.
- Exportación de la matriz a Excel/CSV.

### 15.2 Minoristas

- Ventas del día: pedidos entregados, subtotal, domicilios, ajustes y total.
- Totales por efectivo, transferencia, crédito y otros medios.
- Separación entre domicilio y punto físico/recogida.
- Pedidos pendientes de pago o comprobante.
- Exportación del detalle de ventas a Excel/CSV.

### 15.3 Indicadores operativos

- pedidos recibidos por segmento y canal;
- porcentaje que requiere corrección humana;
- tiempo de recepción a confirmación;
- tiempo de confirmación a despacho;
- pedidos entregados, cancelados y con incidencia;
- valor promedio del pedido minorista;
- porcentaje de entregas omitidas de una ruta: objetivo 0 %.

## 16. Requisitos no funcionales

- Responsive desde 360 px y usable en escritorio.
- Accesible por teclado, con labels, foco visible y contraste suficiente.
- Zona horaria operativa de Colombia.
- Formato monetario COP y fechas en español.
- Actualización de pedidos sin recargar toda la pantalla.
- Operaciones comunes con respuesta percibida menor a 2 segundos bajo carga normal.
- Persistencia en Supabase con Row Level Security.
- Evidencias de pago en almacenamiento privado mediante URLs firmadas.
- Registro de auditoría para cambios críticos.
- Copias de seguridad y política de retención por definir.
- Los errores de notificación no deben revertir cambios operativos; deben quedar en una cola reintentable.
- La interfaz embebida debe limitar `frame-ancestors` a dominios autorizados de GoHighLevel/LeadConnector.

## 17. Criterios de aceptación del MVP

### 17.1 Mayoristas

- Un pedido estructurado aparece en la ruta correcta sin copiar datos manualmente.
- Un pedido sin ruta queda visible en `Sin clasificar` y no puede marcarse listo para ruta.
- La matriz muestra clientes, productos, cantidades y totales por producto.
- El usuario puede filtrar una fecha/ruta, imprimir la matriz y exportar el mismo conjunto a Excel/CSV.
- Corregir una cantidad actualiza los totales y genera una entrada de auditoría.
- El usuario puede avanzar uno o varios pedidos hasta `Despachado`.

### 17.2 Minoristas

- Un pedido aparece en orden de llegada y conserva todas las instrucciones de corte.
- El operador puede completar peso real y precio unitario; el total se recalcula correctamente.
- El sistema calcula la regla conocida de domicilio gratuito desde COP 100.000.
- El usuario puede generar, enviar e imprimir un comprobante no electrónico en formato térmico.
- El estado `Listo` o `Despachado` dispara la notificación correspondiente y registra el resultado.
- El cierre diario muestra solo pedidos entregados y permite desglosar sus medios de pago.

### 17.3 Captura e incidencias

- Los pedidos por formulario se guardan con su contenido completo y archivos adjuntos.
- Los pedidos interpretados desde texto/audio muestran origen, transcripción y confianza.
- Un pedido ambiguo entra en `Revisión requerida` y no se suma a producción hasta confirmarse.
- Una queja, devolución o disputa de saldo crea una incidencia asignable y pausa la automatización.

## 18. Fases propuestas

### Fase 1 — Operación básica

- Autenticación de un administrador único.
- Clientes, productos, precios y rutas.
- Ingreso manual/webhook de pedidos.
- Bandeja minorista y matriz mayorista.
- Estados, búsqueda, filtros, impresión y exportación.
- Cotización minorista y comprobante térmico.

### Fase 2 — Automatización

- Integración bidireccional con WhatsApp/GoHighLevel.
- Formularios de cliente nuevo y recurrente.
- Adjuntos de comprobante.
- Transcripción/extracción de texto y audio con revisión humana.
- Notificaciones automáticas y cola de incidencias.

### Fase 3 — Control y crecimiento

- Reportes y cierre de caja avanzados.
- Cartera/crédito con reglas aprobadas.
- Integración con Siigo o facturación DIAN, después de un análisis específico.
- Inventario y planeación de abastecimiento, si se define como nuevo alcance.

## 19. Decisiones pendientes

Antes de cerrar diseño y modelo de datos, Fénix debe confirmar:

1. Lista final de datos obligatorios para clientes minoristas y mayoristas.
2. Catálogo definitivo, aliases, unidades, presentaciones y listas de precios.
3. Criterios exactos que asignan barrio/municipio a cada ruta.
4. Hora de corte y reglas para aceptar pedidos el mismo día.
5. Calendario de días no laborables y tratamiento de festivos.
6. Costo de domicilio minorista por debajo de COP 100.000.
7. Medios de pago vigentes, cuentas y texto que se enviará al cliente.
8. Reglas de crédito: clientes habilitados, cupo, plazo y manejo de saldos.
9. Quién verifica comprobantes y qué bloquea el despacho.
10. Estados y mensajes de WhatsApp definitivos para cada segmento.
11. Tamaño/modelo de impresora térmica y ancho de papel.
12. Fuente técnica de los pedidos: webhooks y capacidades reales de GoHighLevel/WhatsApp.
13. Umbral de confianza para aceptar extracción desde texto o audio.
14. Si se requiere separar venta de domicilio y venta en punto físico dentro del MVP.
15. Política de cambios, devoluciones, tratamiento de datos y retención de comprobantes.

## 20. Dependencias y riesgos

| Riesgo o dependencia | Impacto | Mitigación |
| --- | --- | --- |
| Pedidos libres por voz/texto se interpretan mal | Producción incorrecta | Formulario recomendado, aliases, confianza y revisión humana |
| Productos genéricos o unidades mezcladas | Totales y preparación erróneos | Catálogo canónico, conversión explícita y bloqueo ante ambigüedad |
| Precios cambian con frecuencia | Cotizaciones desactualizadas | Vigencias, responsable de precios y confirmación antes de enviar |
| Datos de clientes incompletos | Facturación o entrega fallida | Registro inicial y cola de datos pendientes |
| Ruta incorrecta u omitida | Pedido queda sin entregar | Ruta persistente, grupo `Sin clasificar` y validación previa al despacho |
| Comprobante falso o no conciliado | Pérdida financiera | Estado separado de verificación y revisión humana |
| Dependencia de WhatsApp/GoHighLevel | Notificaciones o captura interrumpidas | Cola de reintentos, monitoreo y operación manual de respaldo |
| Confusión entre comprobante y factura electrónica | Riesgo legal/fiscal | Etiqueta explícita y mantener facturación electrónica fuera del MVP |

## 21. Definición de éxito del lanzamiento

El MVP estará listo para operación piloto cuando Fénix pueda completar un día real de trabajo en el panel con ambas líneas de negocio y demostrar que:

- todos los pedidos aceptados están registrados una sola vez;
- el mayorista se prepara desde una planilla agrupada por ruta;
- el minorista se cotiza y despacha desde su ficha individual;
- los cambios de estado son trazables;
- la impresión y exportación coinciden con la información en pantalla;
- el cierre diario concilia pedidos entregados y pagos registrados;
- ningún dato fiscal o regla comercial pendiente se presenta como confirmado.
