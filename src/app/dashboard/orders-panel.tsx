"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { catalogProductFor, normalizeProductName, toKilograms, wholesaleProductCatalog } from "@/lib/orders/product-parser";
import type { WholesaleProduct } from "@/lib/orders/product-parser";

import { updateOrderDetails, updateOrderPaymentStatus, updateOrderStatus, updateWholesaleTable } from "./actions";
import { addDays, bogotaDay, dateTime, dayLabel, DAY_MS, Icon, phaseLabels, phaseStatus } from "./panel-shared";
import type { OperationalPhase } from "./panel-shared";
import { RetailPanel } from "./retail-panel";
import type { EditableOrderDetails } from "./retail-panel";
import type { CustomerType, Order } from "./types";

// Sin separador de miles para que el valor se pueda volver a editar y guardar tal cual.
const quantityFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3, useGrouping: false });

function productAmounts(order: Order, product: WholesaleProduct, into = new Map<string, number>()) {
  order.items.forEach((item) => {
    const itemCatalog = catalogProductFor(item.productName);
    const matches = itemCatalog
      ? itemCatalog.name === product.name
      : normalizeProductName(item.productName) === normalizeProductName(product.name);
    if (!matches) return;
    // La tabla mayorista trabaja todo en kilos: las libras se convierten a 0,5 kg.
    const { quantity, unit } = toKilograms(item.actualQuantity ?? item.quantity, item.unit);
    into.set(unit, (into.get(unit) ?? 0) + quantity);
  });
  return into;
}

// Los kilos se muestran solo como número (la unidad va en el encabezado); otras unidades conservan su nombre.
function formatAmounts(amounts: Map<string, number>) {
  return [...amounts.entries()].map(([unit, quantity]) => unit === "kg" ? quantityFormat.format(quantity) : `${quantityFormat.format(quantity)} ${unit}`).join(" / ");
}

function productQuantity(order: Order, product: WholesaleProduct) {
  return formatAmounts(productAmounts(order, product));
}

const SERVICE_DAY_CUTOFF_MS = 3 * 60 * 60 * 1000;

// Los pedidos recibidos entre las 3 a. m. del día anterior y las 3 a. m. del día D (hora Bogotá) se despachan el día D.
function serviceDay(order: Order) {
  return bogotaDay.format(new Date(new Date(order.receivedAt).getTime() - SERVICE_DAY_CUTOFF_MS + DAY_MS));
}

function serviceDayName(day: string, today: string) {
  if (day === today) return "Hoy";
  if (day === addDays(today, 1)) return "Mañana";
  if (day === addDays(today, -1)) return "Ayer";
  return "";
}

function isClosed(order: Order) {
  return ["dispatched", "delivered", "cancelled"].includes(order.status);
}

function FilterMenu({ label, options, selected, onChange }: { label: string; options: Array<{ value: string; label: string; count: number }>; selected: string[]; onChange: (values: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const term = search.trim().toLocaleLowerCase("es");
  const shown = options.filter((option) => !term || option.label.toLocaleLowerCase("es").includes(term));
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  return (
    <div className="filter-menu" ref={ref}>
      <button aria-expanded={open} className={selected.length ? "outline-action is-filtered" : "outline-action"} onClick={() => setOpen((current) => !current)} type="button">
        <Icon name="filter" />{label}{selected.length > 0 && <b>{selected.length}</b>}
      </button>
      {open && (
        <div className="filter-popover" role="dialog" aria-label={`Filtrar por ${label.toLocaleLowerCase("es")}`}>
          {options.length > 6 && <input className="filter-search" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar…" type="search" value={search} />}
          <div className="filter-quick"><button onClick={() => onChange(options.map((option) => option.value))} type="button">Seleccionar todo</button><button onClick={() => onChange([])} type="button">Limpiar</button></div>
          <div className="filter-options">
            {shown.map((option) => <label key={option.value}><input checked={selected.includes(option.value)} onChange={() => toggle(option.value)} type="checkbox" /><span>{option.label}</span><small>{option.count}</small></label>)}
            {!shown.length && <p>Sin opciones</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function productsForOrders(orders: Order[]) {
  const products: WholesaleProduct[] = [...wholesaleProductCatalog];
  const known = new Set(products.map((product) => normalizeProductName(product.name)));
  for (const order of orders) {
    for (const item of order.items) {
      if (catalogProductFor(item.productName)) continue;
      const normalized = normalizeProductName(item.productName);
      if (!normalized || known.has(normalized)) continue;
      known.add(normalized);
      products.push({ category: "Otros productos", name: item.productName, aliases: [item.productName] });
    }
  }
  return products;
}

async function downloadWholesaleOrders(orders: Order[], products: WholesaleProduct[]) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Pedidos mayoristas");
  worksheet.columns = [
    { header: "Pedido", key: "orderNumber", width: 16 },
    { header: "Fecha", key: "receivedAt", width: 22 },
    { header: "Cliente", key: "customer", width: 28 },
    { header: "Teléfono", key: "phone", width: 18 },
    { header: "Zona", key: "zone", width: 18 },
    { header: "Entrega", key: "fulfillment", width: 18 },
    { header: "Facturación", key: "billing", width: 18 },
    { header: "Pedido solicitado", key: "orderText", width: 52 },
    { header: "Observaciones", key: "notes", width: 42 },
    { header: "NIT o cédula", key: "taxId", width: 20 },
    ...products.map((product, index) => ({ header: `${product.name} (kg)`, key: `product${index}`, width: 20 })),
  ];
  orders.forEach((order) => worksheet.addRow({
    orderNumber: order.orderNumber,
    receivedAt: dateTime.format(new Date(order.receivedAt)),
    customer: order.businessName ?? order.customer,
    phone: order.phone,
    zone: order.route,
    fulfillment: order.fulfillment === "delivery" ? "Domicilio" : "Recoge en tienda",
    billing: order.formData?.billing ?? "",
    orderText: order.formData?.order_text ?? "",
    notes: order.notes ?? "",
    taxId: order.formData?.tax_id ?? "",
    ...Object.fromEntries(products.map((product, index) => {
      const amounts = productAmounts(order, product);
      // Celdas numéricas cuando todo está en kilos, para poder sumar en Excel.
      return [`product${index}`, amounts.size === 1 && amounts.has("kg") ? amounts.get("kg") : formatAmounts(amounts)];
    })),
  }));
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1769E0" } };
  worksheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  worksheet.eachRow((row, rowNumber) => {
    row.alignment = { vertical: "middle", wrapText: true };
    if (rowNumber > 1) row.height = 24;
  });
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = { from: "A1", to: `${worksheet.getColumn(worksheet.columnCount).letter}1` };
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a"); link.href = url; link.download = "pedidos-mayoristas.xlsx"; link.click(); URL.revokeObjectURL(url);
}

type TableFilter = "zones" | "cuts" | "query";

function WholesaleOrdersTable({ orders: allOrders, pendingId, onStatusChange }: { orders: Order[]; pendingId?: string; onStatusChange: (order: Order, phase: OperationalPhase) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dayOffset, setDayOffset] = useState(0);
  const [showDispatched, setShowDispatched] = useState(false);
  const [zones, setZones] = useState<string[]>([]);
  const [cuts, setCuts] = useState<string[]>([]);
  const [extraColumns, setExtraColumns] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editNotice, setEditNotice] = useState<string>();
  const [draftRows, setDraftRows] = useState<Record<string, { notes: string; quantities: Record<string, string> }>>({});
  const normalized = query.trim().toLocaleLowerCase("es");
  // "Hoy" se recalcula en cada refresco para que el panel avance solo al cambiar el día.
  const today = bogotaDay.format(new Date());
  const selectedDay = addDays(today, dayOffset);
  const dayOrders = allOrders.filter((order) => serviceDay(order) === selectedDay);
  const dispatchedCount = dayOrders.filter(isClosed).length;
  const orders = showDispatched ? dayOrders : dayOrders.filter((order) => !isClosed(order));
  const pendingByDay = (offset: number) => allOrders.filter((order) => !isClosed(order) && serviceDay(order) === addDays(today, offset)).length;
  const products = useMemo(() => productsForOrders(orders), [orders]);
  const orderCuts = useMemo(() => new Map(orders.map((order) => [
    order.id,
    new Set(products.filter((product) => productAmounts(order, product).size > 0).map((product) => product.name)),
  ])), [orders, products]);

  // Cada filtro calcula sus opciones con los demás filtros aplicados, como el autofiltro de Excel.
  const passes = (order: Order, skip?: TableFilter) => (
    (skip === "zones" || !zones.length || zones.includes(order.route))
    && (skip === "cuts" || !cuts.length || cuts.some((cut) => orderCuts.get(order.id)?.has(cut)))
    && (skip === "query" || !normalized || `${order.orderNumber} ${order.customer} ${order.businessName ?? ""} ${order.phone}`.toLocaleLowerCase("es").includes(normalized))
  );
  const countBy = (filter: TableFilter, keyOf: (order: Order) => string[]) => {
    const counts = new Map<string, number>();
    orders.filter((order) => passes(order, filter)).forEach((order) => keyOf(order).forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1)));
    return counts;
  };
  const zoneCounts = countBy("zones", (order) => [order.route]);
  const zoneOptions = [...new Set(orders.map((order) => order.route))].sort((left, right) => left.localeCompare(right, "es")).map((zone) => ({ value: zone, label: zone, count: zoneCounts.get(zone) ?? 0 }));
  const cutCounts = countBy("cuts", (order) => [...(orderCuts.get(order.id) ?? [])]);
  const cutOptions = products.filter((product) => cutCounts.has(product.name) || cuts.includes(product.name)).map((product) => ({ value: product.name, label: product.name, count: cutCounts.get(product.name) ?? 0 }));

  const visibleOrders = orders.filter((order) => passes(order));
  const visibleProducts = products.filter((product) => {
    if (cuts.length) return cuts.includes(product.name) || (editing && extraColumns.includes(product.name));
    if (visibleOrders.some((order) => orderCuts.get(order.id)?.has(product.name))) return true;
    return editing && (extraColumns.includes(product.name) || visibleOrders.some((order) => draftRows[order.id]?.quantities[product.name]?.trim()));
  });
  const hiddenProducts = products.filter((product) => !visibleProducts.includes(product));
  const categories = visibleProducts.reduce<Array<{ name: string; count: number }>>((groups, product) => {
    const last = groups.at(-1);
    if (last?.name === product.category) last.count += 1;
    else groups.push({ name: product.category, count: 1 });
    return groups;
  }, []);
  const totals = visibleProducts.map((product) => formatAmounts(visibleOrders.reduce((sum, order) => productAmounts(order, product, sum), new Map<string, number>())));
  const hasFilters = zones.length > 0 || cuts.length > 0 || normalized.length > 0;
  const clearFilters = () => { setZones([]); setCuts([]); setQuery(""); };

  const beginEditing = () => {
    setDraftRows(Object.fromEntries(orders.map((order) => [order.id, {
      notes: order.notes ?? "",
      quantities: Object.fromEntries(products.map((product) => [product.name, productQuantity(order, product)])),
    }])));
    setExtraColumns([]);
    setEditNotice(undefined);
    setEditing(true);
  };
  const stopEditing = () => { setEditing(false); setExtraColumns([]); };
  const updateDraft = (orderId: string, field: "notes" | string, value: string) => {
    setDraftRows((current) => ({
      ...current,
      [orderId]: field === "notes"
        ? { ...current[orderId], notes: value }
        : { ...current[orderId], quantities: { ...current[orderId]?.quantities, [field]: value } },
    }));
  };
  const saveTable = async () => {
    setSaving(true);
    setEditNotice(undefined);
    const result = await updateWholesaleTable(visibleOrders.map((order) => ({
      orderId: order.id,
      notes: draftRows[order.id]?.notes ?? "",
      quantities: visibleProducts.map((product) => ({ productName: product.name, value: draftRows[order.id]?.quantities[product.name] ?? "" })),
    })));
    setSaving(false);
    setEditNotice(result.message);
    if (result.ok) {
      stopEditing();
      router.refresh();
    }
  };
  return (
    <section className="wholesale-workspace">
      <div className="section-toolbar">
        <div className="table-filters">
          <div aria-label="Día de despacho" className="day-navigator" role="group">
            <button aria-label="Día anterior" disabled={editing} onClick={() => setDayOffset((current) => current - 1)} title={`${pendingByDay(dayOffset - 1)} pendientes`} type="button">‹</button>
            <span><strong>{serviceDayName(selectedDay, today) || "Despacho"}</strong>{dayLabel.format(new Date(`${selectedDay}T12:00:00Z`))}</span>
            <button aria-label="Día siguiente" disabled={editing} onClick={() => setDayOffset((current) => current + 1)} title={`${pendingByDay(dayOffset + 1)} pendientes`} type="button">›</button>
            {dayOffset !== 0 && <button className="day-today" disabled={editing} onClick={() => setDayOffset(0)} type="button">Hoy</button>}
          </div>
          <p className="toolbar-count"><strong>{visibleOrders.length}</strong> {visibleOrders.length === 1 ? "pedido" : "pedidos"} · <strong>{visibleProducts.length}</strong> {visibleProducts.length === 1 ? "corte" : "cortes"}</p>
          <FilterMenu label="Zona" onChange={setZones} options={zoneOptions} selected={zones} />
          <FilterMenu label="Corte" onChange={setCuts} options={cutOptions} selected={cuts} />
          <label className="search-control wholesale-search"><Icon name="search" /><span className="sr-only">Buscar cliente o pedido</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, pedido o teléfono" type="search" value={query} /></label>
          {dispatchedCount > 0 && <label className="dispatched-toggle"><input checked={showDispatched} onChange={(event) => setShowDispatched(event.target.checked)} type="checkbox" />Ver despachados ({dispatchedCount})</label>}
          {hasFilters && <button className="clear-filters" onClick={clearFilters} type="button">Limpiar filtros</button>}
        </div>
        <div className="toolbar-actions">
          {editing ? <>
            {hiddenProducts.length > 0 && <label className="zone-filter"><span className="sr-only">Agregar columna de corte</span><select aria-label="Agregar columna de corte" onChange={(event) => { if (event.target.value) setExtraColumns((current) => [...current, event.target.value]); }} value=""><option value="">+ Agregar corte</option>{hiddenProducts.map((product) => <option key={product.name} value={product.name}>{product.name}</option>)}</select></label>}
            <button className="outline-action" disabled={saving} onClick={stopEditing} type="button">Cancelar</button>
            <button className="primary-action" disabled={saving} onClick={() => void saveTable()} type="button">{saving ? "Guardando…" : "Guardar cambios"}</button>
          </> : <button className="outline-action" onClick={beginEditing} type="button"><Icon name="edit" /> Editar tabla</button>}
          <button className="outline-action" onClick={() => void downloadWholesaleOrders(visibleOrders, visibleProducts)} type="button"><Icon name="download" /> Excel</button>
          <button className="outline-action" onClick={() => window.print()} type="button"><Icon name="print" /> Imprimir</button>
        </div>
      </div>
      {editNotice && <div className="table-edit-notice" role="status">{editNotice}</div>}
      <div className="matrix-scroll">
        <table className="order-matrix wholesale-matrix">
          <thead>
            <tr className="category-row"><th colSpan={5}>Pedido recibido</th>{categories.map((category, index) => <th colSpan={category.count} key={`${category.name}-${index}`}>{category.name}</th>)}</tr>
            <tr><th>Cliente</th><th>Teléfono</th><th>Zona</th><th>Facturación</th><th>Comentario</th>{visibleProducts.map((product) => <th key={product.name}>{product.name}<small className="unit-label">kg</small></th>)}</tr>
          </thead>
          <tbody>
            {visibleOrders.map((order) => <tr className={isClosed(order) ? "is-dispatched" : undefined} key={order.id}>
              <th scope="row"><div className="matrix-client"><span><strong>{order.businessName ?? order.customer}</strong><small>{order.orderNumber}</small></span>{isClosed(order)
                ? <button className="dispatch-action is-done" disabled={pendingId === order.id || editing} onClick={() => onStatusChange(order, "new")} title="Volver a pendiente" type="button">{pendingId === order.id ? "…" : "Deshacer"}</button>
                : <button className="dispatch-action" disabled={pendingId === order.id || editing} onClick={() => onStatusChange(order, "dispatched")} title="Confirmar que el pedido salió" type="button">{pendingId === order.id ? "Guardando…" : "✓ Despachado"}</button>}</div></th>
              <td>{order.phone}</td>
              <td>{order.route}</td>
              <td>{order.formData?.billing || "—"}</td>
              <td className="matrix-comment-cell">{editing ? <textarea aria-label={`Comentario para ${order.orderNumber}`} onChange={(event) => updateDraft(order.id, "notes", event.target.value)} placeholder="Añade un comentario" rows={2} value={draftRows[order.id]?.notes ?? ""} /> : order.notes || "—"}</td>
              {visibleProducts.map((product) => {
                const value = productQuantity(order, product);
                return <td className={editing ? "matrix-quantity-cell is-editing" : value ? "matrix-quantity-cell has-value" : "matrix-quantity-cell"} key={product.name}>{editing ? <input aria-label={`${product.name} de ${order.orderNumber}`} onChange={(event) => updateDraft(order.id, product.name, event.target.value)} placeholder="kg" title="Cantidad en kg. También puedes escribir “2 lb” y se guarda como 1 kg." value={draftRows[order.id]?.quantities[product.name] ?? ""} /> : value || ""}</td>;
              })}
            </tr>)}
            {!visibleOrders.length && <tr><td className="matrix-empty" colSpan={visibleProducts.length + 5}>{hasFilters ? "Ningún pedido coincide con los filtros." : "No hay pedidos pendientes para este día."}</td></tr>}
          </tbody>
          {visibleOrders.length > 0 && visibleProducts.length > 0 && <tfoot><tr><th scope="row">Total</th><td colSpan={4}>{visibleOrders.length} {visibleOrders.length === 1 ? "pedido" : "pedidos"}</td>{totals.map((total, index) => <td key={visibleProducts[index].name}>{total || "—"}</td>)}</tr></tfoot>}
        </table>
      </div>
    </section>
  );
}

export function OrdersPanel({ initialOrders, loadError }: { initialOrders: Order[]; loadError?: string }) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  // Sincroniza los datos del refresco automático sin remontar el panel (conserva día, filtros y edición).
  const [syncedOrders, setSyncedOrders] = useState(initialOrders);
  if (syncedOrders !== initialOrders) {
    setSyncedOrders(initialOrders);
    setOrders(initialOrders);
  }
  const [activeType, setActiveType] = useState<CustomerType>("wholesale");
  const [pendingId, setPendingId] = useState<string>();
  const [notice, setNotice] = useState<string | undefined>(loadError);
  const wholesale = orders.filter((order) => order.customerType === "wholesale");
  const retail = orders.filter((order) => order.customerType === "retail");

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [router]);

  const moveOrder = async (order: Order, phase: OperationalPhase) => {
    const status = phaseStatus[phase]; setPendingId(order.id); setNotice(undefined);
    const result = await updateOrderStatus(order.id, status); if (!result.ok) { setNotice(result.message); setPendingId(undefined); return; }
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item));
    setNotice(`${order.orderNumber} pasó a “${phaseLabels[phase]}”.`); setPendingId(undefined);
  };

  const saveOrder = async (order: Order, details: EditableOrderDetails) => {
    setPendingId(order.id); setNotice(undefined);
    const result = await updateOrderDetails(order.id, details);
    if (!result.ok) { setNotice(result.message); setPendingId(undefined); return false; }
    setOrders((current) => current.map((item) => item.id === order.id ? {
      ...item,
      customer: details.customer,
      phone: details.phone,
      address: details.address,
      notes: details.notes || undefined,
      items: item.items.map((orderItem) => {
        const edited = details.items.find((candidate) => candidate.id === orderItem.id);
        return edited ? { ...orderItem, productName: edited.productName, actualQuantity: edited.quantity, unit: edited.unit, preparation: edited.preparation || undefined } : orderItem;
      }),
    } : item));
    setNotice(`Los datos de ${order.orderNumber} fueron actualizados.`); setPendingId(undefined); return true;
  };

  const changePaymentStatus = async (order: Order, paymentStatus: "paid" | "pending") => {
    setPendingId(order.id); setNotice(undefined);
    const result = await updateOrderPaymentStatus(order.id, paymentStatus);
    if (!result.ok) { setNotice(result.message); setPendingId(undefined); return; }
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, paymentStatus } : item));
    setNotice(`${order.orderNumber} quedó ${paymentStatus === "paid" ? "pagado" : "pendiente por pago"}.`);
    setPendingId(undefined);
  };

  return (
    <div className="orders-app"><main className="dashboard-content">
      <div className="dashboard-topbar">
        <section aria-label="Tipo de cliente" className="segment-switch"><button aria-pressed={activeType === "wholesale"} onClick={() => { setActiveType("wholesale"); setNotice(undefined); }} type="button"><Icon name="truck" /><strong>Mayoristas</strong><b>{wholesale.length}</b></button><button aria-pressed={activeType === "retail"} onClick={() => { setActiveType("retail"); setNotice(undefined); }} type="button"><Icon name="shop" /><strong>Minoristas</strong><b>{retail.length}</b></button></section>
        <span className="live-badge">Actualización automática</span>
      </div>
      {notice && <div className="operation-notice" role="status">{notice}</div>}
      {activeType === "wholesale" ? <WholesaleOrdersTable onStatusChange={(order, phase) => void moveOrder(order, phase)} orders={wholesale} pendingId={pendingId} /> : <RetailPanel onMove={(order, phase) => void moveOrder(order, phase)} onPaymentChange={(order, status) => void changePaymentStatus(order, status)} onSave={saveOrder} orders={retail} pendingId={pendingId} />}
    </main></div>
  );
}
