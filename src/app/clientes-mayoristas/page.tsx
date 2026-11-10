import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { canAccess, requireViewer } from "@/lib/auth/viewer";
import { unassignedWholesaleRoute } from "@/lib/orders/wholesale-routes";
import { createClient } from "@/lib/supabase/server";

import "../auth.css";
import { signOut } from "../login/actions";
import { WholesaleRouteManager } from "./route-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clientes mayoristas | Fénix Carnes" };

const dateTime = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

export default async function WholesaleCustomersPage() {
  const viewer = await requireViewer();
  if (!canAccess(viewer, "wholesale")) redirect("/");
  const supabase = await createClient();
  const { data: customers, error } = await supabase
    .from("customers")
    .select("id,name,business_name,tax_id,phone,email,address,neighborhood,city,requires_e_invoice,wholesale_registered_at,ghl_sync_status,routes(name)")
    .eq("customer_type", "wholesale")
    .not("wholesale_registered_at", "is", null)
    .order("wholesale_registered_at", { ascending: false });

  return (
    <main className="users-page wholesale-customers-page">
      <header className="users-header">
        <div><span className="customers-kicker">Directorio comercial</span><h1>Clientes mayoristas</h1></div>
        <div className="session-bar">
          <span>{viewer.email}</span>
          <Link href="/registro-mayorista" target="_blank">Abrir formulario</Link>
          <Link href="/">Volver a pedidos</Link>
          <form action={signOut}><button type="submit">Salir</button></form>
        </div>
      </header>
      <section className="users-panel">
        <div className="customers-summary"><strong>{customers?.length ?? 0}</strong><span>mayoristas inscritos</span></div>
        {error ? <p className="users-notice is-error">No se pudieron cargar las inscripciones.</p> : (
          <WholesaleRouteManager customers={(customers ?? []).map((customer) => {
            const route = Array.isArray(customer.routes) ? customer.routes[0] : customer.routes;
            return {
              id: String(customer.id),
              name: customer.name,
              businessName: customer.business_name || customer.name,
              taxId: customer.tax_id || "",
              phone: customer.phone || "",
              email: customer.email || "",
              location: [customer.address, customer.neighborhood, customer.city].filter(Boolean).join(", "),
              requiresInvoice: customer.requires_e_invoice,
              syncStatus: customer.ghl_sync_status || "pending",
              registeredAt: customer.wholesale_registered_at ? dateTime.format(new Date(customer.wholesale_registered_at)) : "—",
              routeName: route?.name || unassignedWholesaleRoute,
            };
          })} />
        )}
      </section>
    </main>
  );
}
