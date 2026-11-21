import type { Metadata } from "next";
import Image from "next/image";

import { wholesaleProductCatalog } from "@/lib/orders/product-parser";

import "../wholesale-order.css";
import { CatalogOrderForm } from "./catalog-order-form";

export const metadata: Metadata = {
  title: "Prueba de pedido por catálogo | Fénix Carnes",
  description: "Prueba del formulario mayorista seleccionando productos de una lista.",
};

export default async function CatalogOrderPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo: demoParam } = await searchParams;
  const demo = demoParam === "formulario" && (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview");
  const products = wholesaleProductCatalog.map(({ name, category, defaultUnit }) => ({ name, category, defaultUnit }));
  return (
    <main className="wholesale-order-page">
      <div className="wholesale-order-shell">
        <header className="wholesale-order-brand">
          <Image alt="Fénix Carnes" height={120} priority src="/logo-fenix-bn.svg" width={230} />
          <div><span>Portal mayorista · opción catálogo</span><h1>Escoge cada producto</h1><p>Agrega tantos renglones como necesites. Puedes repetir el mismo producto y cada renglón se conservará por separado.</p></div>
        </header>
        {demo ? <div className="portal-demo-banner" role="status">Vista de prueba · Ningún dato será guardado ni enviado</div> : null}
        <CatalogOrderForm demo={demo} products={products} />
        <footer>Fénix Carnes · Prueba comparativa del formulario mayorista</footer>
      </div>
    </main>
  );
}
