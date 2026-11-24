import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import "../auth.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Historial de ingresos | Fénix Carnes" };

const dateTime = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
const statusLabels: Record<string, string> = {
  received: "Formulario recibido",
  processing: "Procesando ahora",
  created: "Guardado en el panel",
  needs_review: "Revisar",
  failed: "No se pudo completar",
};
const integrationLabels: Record<string, string> = {
  not_required: "No necesitó GHL",
  pending: "Pendiente de enviar",
  sent: "Actualizado en GHL",
  failed: "No se actualizó GHL",
};
const formLabels: Record<string, string> = { wholesale_registration: "Registro mayorista", wholesale_order: "Pedido mayorista", wholesale_payment: "Comprobante de pago" };

export default async function FormSubmissionsPage() {
  const viewer = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_submissions")
    .select("id,form_type,status,integration_status,error_message,submitted_at,customers(name,business_name),orders(order_number,status)")
    .order("submitted_at", { ascending: false })
    .limit(300);
  return (
    <main className="users-page form-submissions-page">
      <header className="users-header"><div><span className="customers-kicker">Control de formularios</span><h1>Formularios recibidos</h1><p>Confirma aquí que cada registro o pedido llegó al sistema y quedó guardado correctamente.</p></div><div className="session-bar"><span>{viewer.email}</span><Link href="/clientes-mayoristas">Clientes mayoristas</Link><Link href="/">Volver a pedidos</Link></div></header>
      <section className="users-panel">
        <div className="customers-summary"><strong>{data?.length ?? 0}</strong><span>formularios recientes</span><small>Los pedidos correctos aparecen en Pedidos. Si alguno necesita atención, aparecerá en Requiere ayuda.</small></div>
        <div className="submissions-guide" aria-label="Explicación de las columnas">
          <div><strong>Estado en el panel</strong><span>Confirma si el formulario ya quedó guardado o necesita revisión.</span></div>
          <div><strong>Envío a GHL</strong><span>Indica si también se actualizó el contacto y su automatización en GHL.</span></div>
          <div><strong>Dónde quedó</strong><span>Muestra el número del pedido o la sección donde debe revisarse.</span></div>
        </div>
        {error ? <p className="users-notice is-error">No se pudo cargar el historial.</p> : (
          !data?.length ? <div className="submissions-empty"><strong>Todavía no hay formularios recibidos</strong><span>Cuando un cliente complete el registro o envíe un pedido desde los enlaces nuevos, aparecerá aquí automáticamente.</span></div> :
          <div className="form-submissions-table-wrap"><table className="form-submissions-table"><thead><tr><th>Fecha y hora</th><th>Formulario</th><th>Cliente o negocio</th><th>Dónde quedó</th><th>Estado en el panel</th><th>Envío a GHL</th><th>Observación</th></tr></thead><tbody>
            {(data ?? []).map((submission) => {
              const customer = Array.isArray(submission.customers) ? submission.customers[0] : submission.customers;
              const order = Array.isArray(submission.orders) ? submission.orders[0] : submission.orders;
              const destination = order?.order_number ? `Pedido ${order.order_number}` : submission.form_type === "wholesale_registration" && customer ? "Clientes mayoristas" : submission.status === "needs_review" || submission.status === "failed" ? "Requiere ayuda" : "Procesando";
              return <tr key={submission.id}><td data-label="Fecha y hora">{dateTime.format(new Date(submission.submitted_at))}</td><td data-label="Formulario">{formLabels[submission.form_type] || submission.form_type}</td><td data-label="Cliente o negocio"><strong>{customer?.business_name || customer?.name || "Sin identificar"}</strong></td><td data-label="Dónde quedó"><strong>{destination}</strong></td><td data-label="Estado en el panel"><span className={`submission-status is-${submission.status}`}>{statusLabels[submission.status] || submission.status}</span></td><td data-label="Envío a GHL"><span className={`submission-status integration-status is-${submission.integration_status}`}>{integrationLabels[submission.integration_status] || submission.integration_status}</span></td><td data-label="Observación">{submission.error_message || "Sin novedades"}</td></tr>;
            })}
          </tbody></table></div>
        )}
      </section>
    </main>
  );
}
