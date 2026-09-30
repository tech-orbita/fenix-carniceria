# Pedidos Fenix

Base de una aplicación de pedidos construida con Next.js 16, Supabase y Vercel.

## Stack

- Next.js App Router, React, TypeScript y Tailwind CSS.
- Supabase para PostgreSQL y autenticación SSR con cookies.
- Vercel para compilación y despliegue conectado a GitHub.

## Configuración local

1. Copia `.env.example` como `.env.local`.
2. Completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
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
