# Pedidos Fenix

Panel embebible para gestionar los pedidos que recibe el agente de IA de Fénix
Carnes. Está construido con Next.js 16, Supabase y Vercel.

## Stack

- Next.js App Router, React, TypeScript y Tailwind CSS.
- Supabase para PostgreSQL y autenticación SSR con cookies.
- Vercel para compilación y despliegue conectado a GitHub.
- Panel responsive preparado para mostrarse como página embebida en GoHighLevel.

## Estado funcional

- `/dashboard` incluye la base visual del centro de pedidos, búsqueda, filtros,
  detalle y avance local de estados.
- Los pedidos actuales son datos demostrativos y los cambios no se persisten.
- La autenticación SSR existente de Supabase protege el panel.
- Si las variables de Supabase no están configuradas, el panel entra en modo
  demostración y solo muestra los registros ficticios incluidos en el código.
- La respuesta de `/dashboard` permite ser embebida por dominios de HighLevel y
  LeadConnector mediante `frame-ancestors`.

El próximo paso de datos debe definir el contrato que enviará el agente de IA,
las tablas de pedidos y sus políticas RLS antes de conectar información real.

## Configuración local

1. Copia `.env.example` como `.env.local`.
2. Completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   Si conectarás GoHighLevel, completa también `GHL_PRIVATE_INTEGRATION_TOKEN`.
3. Instala las dependencias con `npm install`.
4. Inicia el proyecto con `npm run dev`.

El proyecto local de Supabase está enlazado al proyecto remoto
`bmqfijttiihcjthsgmhz` (`Pedidos_Fenix`). No se han creado tablas ni aplicado
migraciones remotas todavía.

## Validación

```bash
npm run lint
npm run build
```
