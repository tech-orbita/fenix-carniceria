import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import "../auth.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Envíos de formularios | Fénix Carnes" };

const dateTime = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
const statusLabels: Record<string, string> = { received: "Recibido", processing: "Procesando", created: "Pedido creado", needs_review: "Requiere revisión", failed: "Error" };
const integrationLabels: Record<string, string> = { not_required: "No aplica", pending: "Pendiente", sent: "Enviado", failed: "Error" };
const proofLabels: Record<string, string> = { none: "Sin comprobante", received: "Recibido", forwarded: "Enviado a WhatsApp", failed: "Error de envío" };

export default async function FormSubmissionsPage() {
  const viewer = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_submissions")
    .select("id,form_type,status,integration_status,payment_proof_status,error_message,submitted_at,customers(name,business_name),orders(order_number,status)")
    .order("submitted_at", { ascending: false })
    .limit(300);
  return (
    <main className="users-page form-submissions-page">
      <header className="users-header"><div><span className="customers-kicker">Auditoría de recepción</span><h1>Envíos de formularios</h1></div><div className="session-bar"><span>{viewer.email}</span><Link href="/clientes-mayoristas">Clientes mayoristas</Link><Link href="/">Volver a pedidos</Link></div></header>
      <section className="users-panel">
        <div className="customers-summary"><strong>{data?.length ?? 0}</strong><span>envíos recientes</span><small>Pedidos creados, comprobantes, integraciones pendientes y errores visibles en un solo lugar.</small></div>
        {error ? <p className="users-notice is-error">No se pudo cargar la auditoría de formularios.</p> : (
          <div className="form-submissions-table-wrap"><table className="form-submissions-table"><thead><tr><th>Fecha</th><th>Formulario</th><th>Cliente</th><th>Pedido</th><th>Recepción</th><th>Comprobante</th><th>Integración</th><th>Detalle</th></tr></thead><tbody>
            {(data ?? []).map((submission) => {
              const customer = Array.isArray(submission.customers) ? submission.customers[0] : submission.customers;
              const order = Array.isArray(submission.orders) ? submission.orders[0] : submission.orders;
              return <tr key={submission.id}><td>{dateTime.format(new Date(submission.submitted_at))}</td><td>{submission.form_type === "wholesale_registration" ? "Registro mayorista" : "Pedido mayorista"}</td><td><strong>{customer?.business_name || customer?.name || "Sin identificar"}</strong></td><td>{order?.order_number || "—"}</td><td><span className={`submission-status is-${submission.status}`}>{statusLabels[submission.status] || submission.status}</span></td><td>{proofLabels[submission.payment_proof_status] || submission.payment_proof_status}</td><td>{integrationLabels[submission.integration_status] || submission.integration_status}</td><td>{submission.error_message || "—"}</td></tr>;
            })}
          </tbody></table></div>
        )}
      </section>
    </main>
  );
}

