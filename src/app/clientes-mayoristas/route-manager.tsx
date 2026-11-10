"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { unassignedWholesaleRoute, wholesaleRouteLabel, wholesaleRoutes } from "@/lib/orders/wholesale-routes";

import { assignWholesaleCustomerRoutes } from "./actions";

export type WholesaleCustomerRow = {
  id: string;
  name: string;
  businessName: string;
  taxId: string;
  phone: string;
  email: string;
  location: string;
  requiresInvoice: boolean;
  syncStatus: string;
  registeredAt: string;
  routeName: string;
};

const routeOptions = [unassignedWholesaleRoute, ...wholesaleRoutes];

function routeLabel(route: string) {
  return route === unassignedWholesaleRoute ? route : wholesaleRouteLabel(route);
}

export function WholesaleRouteManager({ customers }: { customers: WholesaleCustomerRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkRoute, setBulkRoute] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string }>();
  const [isPending, startTransition] = useTransition();
  const allSelected = customers.length > 0 && selected.length === customers.length;

  const toggleAll = () => setSelected(allSelected ? [] : customers.map((customer) => customer.id));
  const toggleCustomer = (customerId: string) => setSelected((current) => (
    current.includes(customerId) ? current.filter((id) => id !== customerId) : [...current, customerId]
  ));
  const assign = (customerIds: string[], routeName: string, clearSelection = false) => {
    setNotice(undefined);
    startTransition(async () => {
      try {
        const result = await assignWholesaleCustomerRoutes(customerIds, routeName);
        setNotice({ kind: result.ok ? "success" : "error", message: result.message });
        if (result.ok) {
          if (clearSelection) setSelected([]);
          router.refresh();
        }
      } catch {
        setNotice({ kind: "error", message: "No se pudo guardar la ruta. Intenta nuevamente." });
      }
    });
  };

  return (
    <>
      <div className="route-bulk-toolbar">
        <div><strong>Asignación de rutas</strong><small>La ruta se guardará en el cliente y se aplicará a sus pedidos pendientes y futuros.</small></div>
        <span>{selected.length} seleccionados</span>
        <label><span className="sr-only">Ruta para clientes seleccionados</span><select disabled={isPending || selected.length === 0} onChange={(event) => setBulkRoute(event.target.value)} value={bulkRoute}><option value="">Selecciona una ruta</option>{routeOptions.map((route) => <option key={route} value={route}>{routeLabel(route)}</option>)}</select></label>
        <button disabled={isPending || selected.length === 0 || !bulkRoute} onClick={() => assign(selected, bulkRoute, true)} type="button">{isPending ? "Guardando…" : "Asignar ruta"}</button>
      </div>
      {notice && <p className={notice.kind === "error" ? "users-notice is-error" : "users-notice is-success"} role="status">{notice.message}</p>}
      <div className="users-table-wrap">
        <table className="users-table customers-table">
          <thead><tr><th className="customer-select-cell"><input aria-label="Seleccionar todos los clientes" checked={allSelected} onChange={toggleAll} type="checkbox" /></th><th>Negocio / contacto</th><th>Ruta</th><th>Identificación</th><th>Contacto</th><th>Ubicación</th><th>Factura</th><th>Orbita</th><th>Inscripción</th></tr></thead>
          <tbody>
            {customers.map((customer) => <tr key={customer.id}>
              <td className="customer-select-cell"><input aria-label={`Seleccionar ${customer.businessName}`} checked={selected.includes(customer.id)} onChange={() => toggleCustomer(customer.id)} type="checkbox" /></td>
              <td><strong>{customer.businessName}</strong><small>{customer.name}</small></td>
              <td><select aria-label={`Ruta de ${customer.businessName}`} className={customer.routeName === unassignedWholesaleRoute ? "customer-route-select is-unassigned" : "customer-route-select"} disabled={isPending} onChange={(event) => assign([customer.id], event.target.value)} value={customer.routeName}>{routeOptions.map((route) => <option key={route} value={route}>{routeLabel(route)}</option>)}</select></td>
              <td>{customer.taxId || "—"}</td>
              <td>{customer.phone ? <a href={`https://wa.me/${customer.phone.replace(/\D/g, "")}`} rel="noreferrer" target="_blank">{customer.phone}</a> : "—"}<small>{customer.email}</small></td>
              <td>{customer.location || "—"}</td>
              <td>{customer.requiresInvoice ? "Sí" : "No"}</td>
              <td><span className={`sync-badge is-${customer.syncStatus || "pending"}`}>{customer.syncStatus === "synced" ? "Sincronizado" : customer.syncStatus === "error" ? "Pendiente" : "En proceso"}</span></td>
              <td>{customer.registeredAt}</td>
            </tr>)}
            {!customers.length && <tr><td className="customers-empty" colSpan={9}>Todavía no hay clientes inscritos desde el formulario.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
