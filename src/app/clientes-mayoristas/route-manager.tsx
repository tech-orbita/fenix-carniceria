"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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

function normalizedSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

export function WholesaleRouteManager({ customers }: { customers: WholesaleCustomerRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [bulkRoute, setBulkRoute] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string }>();
  const [isPending, startTransition] = useTransition();
  const searchTerm = normalizedSearch(search);
  const visibleCustomers = useMemo(() => searchTerm
    ? customers.filter((customer) => normalizedSearch(`${customer.businessName} ${customer.name}`).includes(searchTerm))
    : customers, [customers, searchTerm]);
  const visibleIds = visibleCustomers.map((customer) => customer.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

  const toggleVisible = () => setSelected((current) => {
    if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
    return [...new Set([...current, ...visibleIds])];
  });
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
      <form className="customer-search-toolbar" onSubmit={(event) => { event.preventDefault(); toggleVisible(); }} role="search">
        <label htmlFor="wholesale-customer-search">Buscar cliente</label>
        <div>
          <input autoComplete="off" id="wholesale-customer-search" onChange={(event) => setSearch(event.target.value)} placeholder="Escribe el negocio o el nombre del contacto" type="search" value={search} />
          <span aria-live="polite">{visibleCustomers.length} {visibleCustomers.length === 1 ? "resultado" : "resultados"}</span>
          <button disabled={!visibleCustomers.length} type="submit">{allVisibleSelected ? "Quitar selección" : "Seleccionar resultados"}</button>
          {search ? <button className="is-secondary" onClick={() => setSearch("")} type="button">Limpiar búsqueda</button> : null}
        </div>
      </form>
      {notice && <p className={notice.kind === "error" ? "users-notice is-error" : "users-notice is-success"} role="status">{notice.message}</p>}
      <div className="users-table-wrap">
        <table className="users-table customers-table">
          <thead><tr><th className="customer-select-cell"><input aria-label="Seleccionar los clientes mostrados" checked={allVisibleSelected} onChange={toggleVisible} type="checkbox" /></th><th>Negocio / contacto</th><th>Ruta</th><th>Identificación</th><th>Contacto</th><th>Ubicación</th><th>Factura</th><th>Orbita</th><th>Inscripción</th></tr></thead>
          <tbody>
            {visibleCustomers.map((customer) => <tr key={customer.id}>
              <td className="customer-select-cell" data-label="Seleccionar"><input aria-label={`Seleccionar ${customer.businessName}`} checked={selected.includes(customer.id)} onChange={() => toggleCustomer(customer.id)} type="checkbox" /></td>
              <td data-label="Negocio / contacto"><strong>{customer.businessName}</strong><small>{customer.name}</small></td>
              <td data-label="Ruta"><select aria-label={`Ruta de ${customer.businessName}`} className={customer.routeName === unassignedWholesaleRoute ? "customer-route-select is-unassigned" : "customer-route-select"} disabled={isPending} onChange={(event) => assign([customer.id], event.target.value)} value={customer.routeName}>{routeOptions.map((route) => <option key={route} value={route}>{routeLabel(route)}</option>)}</select></td>
              <td data-label="Identificación">{customer.taxId || "—"}</td>
              <td data-label="Contacto">{customer.phone ? <a href={`https://wa.me/${customer.phone.replace(/\D/g, "")}`} rel="noreferrer" target="_blank">{customer.phone}</a> : "—"}<small>{customer.email}</small></td>
              <td data-label="Ubicación">{customer.location || "—"}</td>
              <td data-label="Factura">{customer.requiresInvoice ? "Sí" : "No"}</td>
              <td data-label="Orbita"><span className={`sync-badge is-${customer.syncStatus || "pending"}`}>{customer.syncStatus === "synced" ? "Sincronizado" : customer.syncStatus === "error" ? "Pendiente" : "En proceso"}</span></td>
              <td data-label="Inscripción">{customer.registeredAt}</td>
            </tr>)}
            {!visibleCustomers.length && <tr className="customers-empty-row"><td className="customers-empty" colSpan={9}>{customers.length ? "No encontramos clientes con ese nombre." : "Todavía no hay clientes mayoristas activos."}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
