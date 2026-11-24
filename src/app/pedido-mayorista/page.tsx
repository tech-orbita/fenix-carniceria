import type { Metadata } from "next";
import Image from "next/image";

import "./wholesale-order.css";
import { WholesaleOrderForm } from "./wholesale-order-form";

export const metadata: Metadata = {
  title: "Pedido mayorista | Fénix Carnes",
  description: "Realiza tu pedido mayorista directamente con Fénix Carnes.",
};

export default async function WholesaleOrderPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo: demoParam } = await searchParams;
  const demo = demoParam === "formulario" && (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview");
  return (
    <main className="wholesale-order-page">
      <div className="wholesale-order-shell">
        <header className="wholesale-order-brand">
          <Image alt="Fénix Carnes" height={120} priority src="/logo-fenix-bn.svg" width={230} />
          <div><span>Portal mayorista</span><h1>Haz tu pedido directamente</h1><p>Cada producto se conserva en su propio renglón y recibirás un número de confirmación real.</p></div>
        </header>
        {demo && <div className="portal-demo-banner" role="status">Vista de prueba · El pedido aparecerá en el panel con la marca PRUEBA y no activará automatizaciones</div>}
        <WholesaleOrderForm demo={demo} />
        <footer>Fénix Carnes · Pedido seguro para clientes mayoristas registrados</footer>
      </div>
    </main>
  );
}

