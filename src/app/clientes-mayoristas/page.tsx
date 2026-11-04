import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { canAccess, requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import "../auth.css";
import { signOut } from "../login/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clientes mayoristas | Fénix Carnes" };

const dateTime = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

export default async function WholesaleCustomersPage() {
  const viewer = await requireViewer();
  if (!canAccess(viewer, "wholesale")) redirect("/");
  const supabase = await createClient();
  const { data: customers, error } = await supabase
    .from("customers")
    .select("id,name,business_name,tax_id,phone,email,address,neighborhood,city,requires_e_invoice,wholesale_registered_at,ghl_sync_status")
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
          <div className="users-table-wrap">
            <table className="users-table customers-table">
              <thead><tr><th>Negocio / contacto</th><th>Identificación</th><th>Contacto</th><th>Ubicación</th><th>Factura</th><th>HighLevel</th><th>Inscripción</th></tr></thead>
              <tbody>
                {(customers ?? []).map((customer) => <tr key={customer.id}>
                  <td><strong>{customer.business_name}</strong><small>{customer.name}</small></td>
                  <td>{customer.tax_id || "—"}</td>
                  <td><a href={`https://wa.me/${customer.phone.replace(/\D/g, "")}`} rel="noreferrer" target="_blank">{customer.phone}</a><small>{customer.email}</small></td>
                  <td>{[customer.address, customer.neighborhood, customer.city].filter(Boolean).join(", ")}</td>
                  <td>{customer.requires_e_invoice ? "Sí" : "No"}</td>
                  <td><span className={`sync-badge is-${customer.ghl_sync_status ?? "pending"}`}>{customer.ghl_sync_status === "synced" ? "Sincronizado" : customer.ghl_sync_status === "error" ? "Pendiente" : "En proceso"}</span></td>
                  <td>{customer.wholesale_registered_at ? dateTime.format(new Date(customer.wholesale_registered_at)) : "—"}</td>
                </tr>)}
                {!customers?.length && <tr><td className="customers-empty" colSpan={7}>Todavía no hay clientes inscritos desde el formulario.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
