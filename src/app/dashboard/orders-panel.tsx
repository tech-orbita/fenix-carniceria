"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { catalogProductFor, normalizeProductName, toKilograms, wholesaleProductCatalog } from "@/lib/orders/product-parser";
import type { WholesaleProduct } from "@/lib/orders/product-parser";
import { wholesaleServiceDay } from "@/lib/orders/wholesale-service-day";

import { resolveOrderHelp, scheduleWholesaleOrder, sendRetailPaymentSummary, updateOrderDetails, updateOrderPaymentStatus, updateOrderStatus, updateWholesalePayment, updateWholesaleTable } from "./actions";
import { addDays, bogotaDay, dateTime, dayLabel, Icon, phaseLabels, phaseStatus } from "./panel-shared";
import type { OperationalPhase } from "./panel-shared";
import { RetailPanel } from "./retail-panel";
import type { EditableOrderDetails } from "./retail-panel";
import type { CustomerType, Order } from "./types";
import { useOrdersRealtime } from "./use-orders-realtime";
import { signOut } from "../login/actions";
import type { Viewer } from "@/lib/auth/viewer";

// Sin separador de miles para que el valor se pueda volver a editar y guardar tal cual.
const quantityFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3, useGrouping: false });
const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function productAmounts(order: Order, product: WholesaleProduct, into = new Map<string, number>()) {
  order.items.forEach((item) => {
    const itemCatalog = catalogProductFor(item.productName);
    const productCatalog = catalogProductFor(product.name);
    const itemLabel = itemCatalog?.name === "Comodín" && item.preparation ? item.preparation : item.productName;
    const matches = product.name === "Comodín"
      ? itemCatalog?.name === "Comodín" && !item.preparation
      : productCatalog && productCatalog.name !== "Comodín"
        ? itemCatalog?.name === productCatalog.name
        : normalizeProductName(itemLabel) === normalizeProductName(product.name);
    if (!matches) return;
    // La operación mayorista trabaja en kilos: las libras se convierten a 0,5 kg.
    const { quantity, unit } = toKilograms(item.actualQuantity ?? item.quantity, item.unit);
    const detail = product.name === "Blanda" && /^[CLTB]$/i.test(item.preparation ?? "")
      ? item.preparation!.toUpperCase()
      : "";
    const key = `${unit}|${detail}`;
    into.set(key, (into.get(key) ?? 0) + quantity);
  });
  return into;
}

// Cada cantidad conserva su unidad original; una misma celda puede contener kilos y libras.
function formatAmounts(amounts: Map<string, number>) {
  return [...amounts.entries()].map(([unitAndDetail, quantity]) => {
    const [unit, detail] = unitAndDetail.split("|");
    return `${quantityFormat.format(quantity)} ${unit}${detail ? ` ${detail}` : ""}`;
  }).join(" / ");
}

function productQuantity(order: Order, product: WholesaleProduct) {
  return formatAmounts(productAmounts(order, product));
}

// Los pedidos recibidos entre las 3 a. m. del día anterior y las 3 a. m. del día D (hora Bogotá) se despachan el día D.
function serviceDay(order: Order) {
  // Una solicitud de ayuda sin formulario debe ser visible el mismo día en que llegó.
  if (isHelpWithoutOrder(order)) return bogotaDay.format(new Date(order.receivedAt));
  return wholesaleServiceDay(order.receivedAt, order.deliveryDate === "Sin fecha" ? undefined : order.deliveryDate);
}

function serviceDayName(day: string, today: string) {
  if (day === today) return "Hoy";
  if (day === addDays(today, 1)) return "Mañana";
  if (day === addDays(today, -1)) return "Ayer";
  return "";
}

// Búsqueda sin tildes ni mayúsculas; los teléfonos se comparan solo por dígitos.
function searchText(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
}

function matchesSearch(order: Order, terms: string[]) {
  if (!terms.length) return true;
  const haystack = searchText([order.orderNumber, order.customer, order.businessName ?? "", order.phone, order.route, order.notes ?? ""].join(" "));
  const phoneDigits = order.phone.replace(/\D/g, "");
  return terms.every((term) => haystack.includes(term) || (/^\d+$/.test(term) && phoneDigits.includes(term)));
}

function isClosed(order: Order) {
  return ["dispatched", "delivered", "cancelled"].includes(order.status);
}

function isHelpWithoutOrder(order: Order) {
  return ["needs_review", "incident"].includes(order.status) && order.items.length === 0;
}

function highLevelConversationUrl(order: Order) {
  return `/api/highlevel/conversation/${encodeURIComponent(order.id)}`;
}

function hasHighLevelConversation(order: Order) {
  return Boolean(order.highLevel?.conversationUrl || order.highLevel?.conversationId || order.highLevel?.contactId);
}

function ConversationLink({ order }: { order: Order }) {
  const customer = order.businessName ?? order.customer;
  if (!hasHighLevelConversation(order)) {
    return <button aria-label={`Conversación no disponible para ${customer}`} className="conversation-link is-disabled" disabled title="Este pedido no tiene una conversación asociada" type="button"><Icon name="chat" /><span className="sr-only">Conversación no disponible</span></button>;
  }
  return <a aria-label={`Abrir conversación con ${customer}`} className="conversation-link" href={highLevelConversationUrl(order)} rel="noreferrer" target="_blank" title={`Abrir conversación con ${customer}`}><Icon name="chat" /><span className="sr-only">Abrir conversación</span></a>;
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
  const products: WholesaleProduct[] = wholesaleProductCatalog
    .filter((product) => product.name !== "Comodín")
    .map((product) => ({ ...product }));
  const known = new Set(products.map((product) => normalizeProductName(product.name)));
  let needsFallback = false;

  orders.forEach((order) => order.items.forEach((item) => {
    const catalog = catalogProductFor(item.productName);
    const name = catalog?.name === "Comodín" ? item.preparation?.trim() : catalog ? undefined : item.productName.trim();
    if (!name) {
      if (catalog?.name === "Comodín") needsFallback = true;
      return;
    }
    const key = normalizeProductName(name);
    if (!key || known.has(key)) return;
    known.add(key);
    products.push({ category: "Otros productos", name, aliases: [name] });
  }));

  if (needsFallback) products.push({ category: "Otros productos", name: "Comodín", aliases: ["comodín"] });
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
    { header: "Dirección", key: "address", width: 34 },
    { header: "Zona", key: "zone", width: 18 },
    { header: "Entrega", key: "fulfillment", width: 18 },
    { header: "Facturación", key: "billing", width: 18 },
    { header: "Estado", key: "status", width: 20 },
    { header: "Observaciones", key: "notes", width: 42 },
    { header: "NIT o cédula", key: "taxId", width: 20 },
    ...products.map((product, index) => ({ header: product.name === "Blanda" ? "Blanda (kg; C=Capón, L=Lomo, T=Tetafula, B=Calavera)" : `${product.name} (kg)`, key: `product${index}`, width: product.name === "Blanda" ? 28 : 20 })),
  ];
  orders.forEach((order) => worksheet.addRow({
    orderNumber: order.orderNumber,
    receivedAt: dateTime.format(new Date(order.receivedAt)),
    customer: order.businessName ?? order.customer,
    phone: order.phone,
    address: order.address,
    zone: order.route,
    fulfillment: order.fulfillment === "delivery" ? "Domicilio" : "Recoge en tienda",
    billing: order.formData?.billing ?? "",
    status: ["needs_review", "incident"].includes(order.status) ? "Requiere ayuda" : isClosed(order) ? "Despachado" : "Pendiente",
    notes: order.notes ?? "",
    taxId: order.formData?.tax_id ?? "",
    ...Object.fromEntries(products.map((product, index) => {
      const amounts = productAmounts(order, product);
      return [`product${index}`, formatAmounts(amounts)];
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

function WholesaleWallet({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dayOffset, setDayOffset] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(orders.map((order) => [order.id, String(order.total || "")])));
  const [pendingId, setPendingId] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  const today = bogotaDay.format(new Date());
  const selectedDay = addDays(today, dayOffset);
  const shown = orders.filter((order) => order.status !== "cancelled" && !isHelpWithoutOrder(order) && serviceDay(order) === selectedDay && matchesSearch(order, terms));
  const countForDay = (offset: number) => orders.filter((order) => order.status !== "cancelled" && !isHelpWithoutOrder(order) && serviceDay(order) === addDays(today, offset)).length;
  const save = async (order: Order, paymentStatus: "pending" | "paid", sendSummary = false) => {
    const total = Number((values[order.id] ?? "").replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(total) || total < 0) { setNotice("Escribe un valor válido para el pedido."); return; }
    setPendingId(order.id);
    setNotice(undefined);
    const result = await updateWholesalePayment(order.id, total, paymentStatus, sendSummary);
    setPendingId(undefined);
    setNotice(result.message);
    if (result.ok) router.refresh();
  };
  return <section className="wholesale-wallet">
    <div className="section-toolbar">
      <div className="table-filters"><div aria-label="Día de cartera" className="day-navigator" role="group"><button aria-label="Día anterior" onClick={() => setDayOffset((current) => current - 1)} title={`${countForDay(dayOffset - 1)} pedidos`} type="button">‹</button><span><strong>{serviceDayName(selectedDay, today) || "Cartera"}</strong>{dayLabel.format(new Date(`${selectedDay}T12:00:00Z`))}</span><button aria-label="Día siguiente" onClick={() => setDayOffset((current) => current + 1)} title={`${countForDay(dayOffset + 1)} pedidos`} type="button">›</button>{dayOffset !== 0 && <button className="day-today" onClick={() => setDayOffset(0)} type="button">Hoy</button>}</div><label className="table-search"><Icon name="search" /><span className="sr-only">Buscar en cartera</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, teléfono o pedido" value={query} /></label></div>
      <p className="wallet-scope">Control por pedido · no reemplaza el libro contable ni Siigo</p>
    </div>
    {notice && <div className="table-edit-notice" role="status">{notice}</div>}
    <div className="matrix-scroll"><table className="order-matrix wallet-table"><thead><tr><th>Cliente</th><th>Pedido</th><th>Fecha</th><th>Valor</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {shown.map((order) => <tr key={order.id}><th scope="row"><div className="wallet-client"><span><strong>{order.businessName ?? order.customer}</strong><small>{order.phone}</small></span><ConversationLink order={order} /></div></th><td>{order.orderNumber}</td><td>{dateTime.format(new Date(order.receivedAt))}</td><td><label className="wallet-value"><span>$</span><input aria-label={`Valor de ${order.orderNumber}`} inputMode="numeric" onChange={(event) => setValues((current) => ({ ...current, [order.id]: event.target.value }))} placeholder="0" value={values[order.id] ?? ""} /></label></td><td><span className={order.paymentStatus === "paid" ? "wallet-status is-paid" : "wallet-status"}>{order.paymentStatus === "paid" ? "Pago realizado" : "Pendiente por pago"}</span></td><td><div className="wallet-actions"><button disabled={pendingId === order.id} onClick={() => void save(order, "pending")} type="button">Pendiente</button><button className="is-paid" disabled={pendingId === order.id} onClick={() => void save(order, "paid")} type="button">Pagado</button><button disabled={pendingId === order.id} onClick={() => void save(order, "pending", true)} type="button">Enviar resumen</button></div></td></tr>)}
      {!shown.length && <tr><td className="matrix-empty" colSpan={6}>No hay pedidos que coincidan con la búsqueda.</td></tr>}
    </tbody><tfoot><tr><th colSpan={3}>Total visible</th><td>{money.format(shown.reduce((sum, order) => sum + order.total, 0))}</td><td colSpan={2}>{shown.length} pedidos</td></tr></tfoot></table></div>
  </section>;
}

function WholesaleOrdersTable({ orders: allOrders, pendingId, onStatusChange }: { orders: Order[]; pendingId?: string; onStatusChange: (order: Order, phase: OperationalPhase) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"orders" | "wallet">("orders");
  const [dayOffset, setDayOffset] = useState(0);
  const [showDispatched, setShowDispatched] = useState(false);
  const [listMode, setListMode] = useState<"orders" | "help">("orders");
  const [zones, setZones] = useState<string[]>([]);
  const [cuts, setCuts] = useState<string[]>([]);
  const [extraColumns, setExtraColumns] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editNotice, setEditNotice] = useState<string>();
  const [draftRows, setDraftRows] = useState<Record<string, { notes: string; quantities: Record<string, string> }>>({});
  const searchTerms = searchText(query).split(/[\s\-()+]+/).filter(Boolean);
  // "Hoy" se recalcula en cada refresco para que el panel avance solo al cambiar el día.
  const today = bogotaDay.format(new Date());
  const selectedDay = addDays(today, dayOffset);
  const dayOrders = allOrders.filter((order) => serviceDay(order) === selectedDay);
  const dispatchedCount = dayOrders.filter(isClosed).length;
  const openOrders = showDispatched ? dayOrders : dayOrders.filter((order) => !isClosed(order));
  const orders = openOrders.filter((order) => listMode === "help"
    ? ["needs_review", "incident"].includes(order.status)
    : !["needs_review", "incident"].includes(order.status));
  const helpCount = dayOrders.filter((order) => ["needs_review", "incident"].includes(order.status)).length;
  const orderCount = dayOrders.filter((order) => !["needs_review", "incident"].includes(order.status)).length;
  const pendingByDay = (offset: number) => allOrders.filter((order) => !isClosed(order) && serviceDay(order) === addDays(today, offset)).length;
  const products = productsForOrders(orders);
  const orderCuts = new Map(orders.map((order) => [
    order.id,
    new Set(products.filter((product) => productAmounts(order, product).size > 0).map((product) => product.name)),
  ]));

  // Cada filtro calcula sus opciones con los demás filtros aplicados, como el autofiltro de Excel.
  const passes = (order: Order, skip?: TableFilter) => (
    (skip === "zones" || !zones.length || zones.includes(order.route))
    && (skip === "cuts" || !cuts.length || cuts.some((cut) => orderCuts.get(order.id)?.has(cut)))
    && (skip === "query" || matchesSearch(order, searchTerms))
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
  const visibleHelpWithoutOrder = visibleOrders.filter(isHelpWithoutOrder).length;
  const visibleOrderCount = visibleOrders.length - visibleHelpWithoutOrder;
  const visibleSummary = [
    visibleOrderCount > 0 ? `${visibleOrderCount} ${visibleOrderCount === 1 ? "pedido" : "pedidos"}` : "",
    visibleHelpWithoutOrder > 0 ? `${visibleHelpWithoutOrder} ${visibleHelpWithoutOrder === 1 ? "solicitud de ayuda" : "solicitudes de ayuda"}` : "",
  ].filter(Boolean).join(" · ");
  const hasFilters = zones.length > 0 || cuts.length > 0 || searchTerms.length > 0;
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
  const advanceOrder = async (order: Order) => {
    setSaving(true);
    setEditNotice(undefined);
    const result = await scheduleWholesaleOrder(order.id, today);
    setSaving(false);
    setEditNotice(result.message);
    if (result.ok) router.refresh();
  };
  if (view === "wallet") return <><div className="wholesale-tabs"><button onClick={() => setView("orders")} type="button">Pedidos</button><button aria-current="page" type="button">Cartera</button></div><WholesaleWallet orders={allOrders} /></>;
  return (
    <>
    <div className="wholesale-tabs"><button aria-current="page" type="button">Pedidos</button><button onClick={() => setView("wallet")} type="button">Cartera</button></div>
    <section className="wholesale-workspace">
      <div className="section-toolbar">
        <div className="table-filters">
          <div aria-label="Día de despacho" className="day-navigator" role="group">
            <button aria-label="Día anterior" disabled={editing} onClick={() => setDayOffset((current) => current - 1)} title={`${pendingByDay(dayOffset - 1)} pendientes`} type="button">‹</button>
            <span><strong>{serviceDayName(selectedDay, today) || "Despacho"}</strong>{dayLabel.format(new Date(`${selectedDay}T12:00:00Z`))}</span>
            <button aria-label="Día siguiente" disabled={editing} onClick={() => setDayOffset((current) => current + 1)} title={`${pendingByDay(dayOffset + 1)} pendientes`} type="button">›</button>
            {dayOffset !== 0 && <button className="day-today" disabled={editing} onClick={() => setDayOffset(0)} type="button">Hoy</button>}
          </div>
          <FilterMenu label="Zona" onChange={setZones} options={zoneOptions} selected={zones} />
          <FilterMenu label="Corte" onChange={setCuts} options={cutOptions} selected={cuts} />
          <label className={query ? "table-search is-filtered" : "table-search"}>
            <Icon name="search" />
            <span className="sr-only">Buscar cliente, pedido o teléfono</span>
            <input onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }} placeholder="Buscar cliente o teléfono" type="text" value={query} />
            {query && <button aria-label="Borrar búsqueda" onClick={() => setQuery("")} type="button">×</button>}
          </label>
          {dispatchedCount > 0 && <label className="dispatched-toggle"><input checked={showDispatched} onChange={(event) => setShowDispatched(event.target.checked)} type="checkbox" />Ver despachados ({dispatchedCount})</label>}
          <div aria-label="Tipo de registro" className="request-mode-filters" role="group">
            <button aria-pressed={listMode === "orders"} className={listMode === "orders" ? "orders-filter is-active" : "orders-filter"} onClick={() => setListMode("orders")} type="button">Pedidos ({orderCount})</button>
            {helpCount > 0 && <button aria-pressed={listMode === "help"} className={listMode === "help" ? "help-filter is-active" : "help-filter"} onClick={() => setListMode("help")} type="button">Requiere ayuda ({helpCount})</button>}
          </div>
          {hasFilters && <button className="clear-filters" onClick={clearFilters} type="button">Limpiar filtros</button>}
        </div>
        <div className="toolbar-actions">
          {editing ? <>
            {hiddenProducts.length > 0 && <label className="zone-filter"><span className="sr-only">Agregar columna de corte</span><select aria-label="Agregar columna de corte" onChange={(event) => { if (event.target.value) setExtraColumns((current) => [...current, event.target.value]); }} value=""><option value="">+ Agregar corte</option>{hiddenProducts.map((product) => <option key={product.name} value={product.name}>{product.name}</option>)}</select></label>}
            <button className="outline-action" disabled={saving} onClick={stopEditing} type="button">Cancelar</button>
            <button className="primary-action" disabled={saving} onClick={() => void saveTable()} type="button">{saving ? "Guardando…" : "Guardar cambios"}</button>
          </> : <button className="outline-action" onClick={beginEditing} type="button"><Icon name="edit" /> Editar tabla</button>}
          <button className="outline-action" onClick={() => void downloadWholesaleOrders(visibleOrders, visibleProducts)} type="button"><Icon name="download" /> Excel</button>
        </div>
      </div>
      {editNotice && <div className="table-edit-notice" role="status">{editNotice}</div>}
      <div className="matrix-scroll">
        <table className="order-matrix wholesale-matrix">
          <thead>
            <tr className="category-row"><th colSpan={5}>Pedido recibido</th>{categories.map((category, index) => <th colSpan={category.count} key={`${category.name}-${index}`}>{category.name}</th>)}</tr>
            <tr><th>Cliente</th><th>Teléfono</th><th>Zona</th><th>Facturación</th><th>Comentario</th>{visibleProducts.map((product) => <th key={product.name} title={product.name === "Blanda" ? "C = Capón · L = Lomo · T = Tetafula · B = Calavera" : undefined}>{product.name}<small className="unit-label">{product.name === "Blanda" ? "kg · C/L/T/B" : "kg"}</small></th>)}</tr>
          </thead>
          <tbody>
            {visibleOrders.map((order) => <tr className={isClosed(order) ? "is-dispatched" : undefined} key={order.id}>
              <th scope="row"><div className="matrix-client"><span><strong>{order.businessName ?? order.customer}</strong><small className="client-address" title={`Pedido ${order.orderNumber}`}>{order.address || order.orderNumber}</small>{["needs_review", "incident"].includes(order.status) && <button className="help-badge" onClick={() => { clearFilters(); setListMode("help"); }} title="Ver pedidos que requieren ayuda" type="button">Requiere ayuda</button>}</span><div className="matrix-row-actions"><ConversationLink order={order} />{isHelpWithoutOrder(order)
                ? <span className="no-order-badge">Sin pedido</span>
                : isClosed(order)
                  ? <button className="dispatch-action is-done" disabled={pendingId === order.id || editing} onClick={() => onStatusChange(order, "new")} title="Volver a pendiente" type="button">{pendingId === order.id ? "…" : "Deshacer"}</button>
                  : <><button className="dispatch-action" disabled={pendingId === order.id || editing} onClick={() => onStatusChange(order, "dispatched")} title="Confirmar que el pedido salió" type="button">{pendingId === order.id ? "Guardando…" : "✓ Despachado"}</button>{dayOffset === 1 && <button className="advance-action" disabled={saving || editing} onClick={() => void advanceOrder(order)} title="Autorizar este pedido para despacho hoy" type="button">Adelantar a hoy</button>}</>}</div></div></th>
              <td>{order.phone}</td>
              <td>{order.route}</td>
              <td>{order.formData?.billing || "—"}</td>
              <td className="matrix-comment-cell">{editing ? <textarea aria-label={`Comentario para ${order.orderNumber}`} onChange={(event) => updateDraft(order.id, "notes", event.target.value)} placeholder="Añade un comentario" rows={2} value={draftRows[order.id]?.notes ?? ""} /> : order.notes || "—"}</td>
              {visibleProducts.map((product) => {
                const value = productQuantity(order, product);
                const placeholder = product.name === "Blanda" ? "kg C/L/T/B" : product.name === "Comodín" ? "kg producto" : "kg";
                const title = product.name === "Blanda" ? "Usa C=capón, L=lomo, T=tetafula y B=calavera. Ejemplo: 5 C / 2 L." : product.name === "Comodín" ? "Escribe cantidad y nombre del producto sin columna. Ejemplo: 2 kg producto especial." : "Cantidad en kg. También puedes escribir “2 lb” y se guarda como 1 kg.";
                return <td className={editing ? "matrix-quantity-cell is-editing" : value ? "matrix-quantity-cell has-value" : "matrix-quantity-cell"} key={product.name}>{editing ? <input aria-label={`${product.name} de ${order.orderNumber}`} onChange={(event) => updateDraft(order.id, product.name, event.target.value)} placeholder={placeholder} title={title} value={draftRows[order.id]?.quantities[product.name] ?? ""} /> : value || ""}</td>;
              })}
            </tr>)}
            {!visibleOrders.length && <tr><td className="matrix-empty" colSpan={visibleProducts.length + 5}>{hasFilters ? "Ningún pedido coincide con los filtros." : "No hay pedidos pendientes para este día."}</td></tr>}
          </tbody>
          {visibleOrders.length > 0 && visibleProducts.length > 0 && <tfoot><tr><th scope="row">Total</th><td colSpan={4}>{visibleSummary}</td>{totals.map((total, index) => <td key={visibleProducts[index].name}>{total || "—"}</td>)}</tr></tfoot>}
        </table>
      </div>
    </section></>
  );
}

export function OrdersPanel({ initialOrders, loadError, viewer }: { initialOrders: Order[]; loadError?: string; viewer?: Viewer }) {
  const [orders, setOrders] = useState(initialOrders);
  // Sincroniza los datos refrescados del servidor sin remontar el panel (conserva día, filtros y edición).
  const [syncedOrders, setSyncedOrders] = useState(initialOrders);
  if (syncedOrders !== initialOrders) {
    setSyncedOrders(initialOrders);
    setOrders(initialOrders);
  }
  // Un operador solo trabaja con su segmento; el administrador puede cambiar entre ambos.
  const assignedType = viewer?.customerType ?? null;
  const [selectedType, setActiveType] = useState<CustomerType>("wholesale");
  const activeType = assignedType ?? selectedType;
  const [pendingId, setPendingId] = useState<string>();
  const [notice, setNotice] = useState<string | undefined>(loadError);
  const wholesale = orders.filter((order) => order.customerType === "wholesale");
  const retail = orders.filter((order) => order.customerType === "retail");
  useOrdersRealtime(assignedType ? [assignedType] : ["wholesale", "retail"]);

  // El aviso se oculta solo tras unos segundos.
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(undefined), 4_000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const moveOrder = async (order: Order, phase: OperationalPhase) => {
    const status = phaseStatus[phase]; setPendingId(order.id); setNotice(undefined);
    const result = await updateOrderStatus(order.id, status); if (!result.ok) { setNotice(result.message); setPendingId(undefined); return; }
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item));
    setNotice(result.message.includes("pipeline") ? result.message : `${order.orderNumber} pasó a “${phaseLabels[phase]}” y se sincronizó con el pipeline.`); setPendingId(undefined);
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
        return edited ? { ...orderItem, productName: edited.productName, actualQuantity: edited.quantity, unit: edited.unit, unitPrice: edited.unitPrice, preparation: edited.preparation || undefined } : orderItem;
      }),
    } : item));
    setNotice(`Los datos de ${order.orderNumber} fueron actualizados.`); setPendingId(undefined); return true;
  };

  const changePaymentStatus = async (order: Order, paymentStatus: "paid" | "pending") => {
    setPendingId(order.id); setNotice(undefined);
    const result = await updateOrderPaymentStatus(order.id, paymentStatus);
    if (!result.ok) { setNotice(result.message); setPendingId(undefined); return; }
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, paymentStatus } : item));
    setNotice(result.message);
    setPendingId(undefined);
  };

  const resolveHelp = async (order: Order) => {
    setPendingId(order.id); setNotice(undefined);
    const result = await resolveOrderHelp(order.id);
    if (!result.ok) { setNotice(result.message); setPendingId(undefined); return; }
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: result.status } : item));
    setNotice(result.message); setPendingId(undefined);
  };

  const sendBill = async (order: Order) => {
    setPendingId(order.id); setNotice(undefined);
    const result = await sendRetailPaymentSummary(order.id);
    setNotice(result.message); setPendingId(undefined);
  };

  return (
    <div className="orders-app"><main className="dashboard-content">
      <div className="dashboard-topbar">
        {!assignedType && <section aria-label="Tipo de cliente" className="segment-switch"><button aria-pressed={activeType === "wholesale"} onClick={() => { setActiveType("wholesale"); setNotice(undefined); }} type="button"><Icon name="truck" /><strong>Mayoristas</strong><b>{wholesale.length}</b></button><button aria-pressed={activeType === "retail"} onClick={() => { setActiveType("retail"); setNotice(undefined); }} type="button"><Icon name="shop" /><strong>Minoristas</strong><b>{retail.length}</b></button></section>}
        {viewer && <div className="session-bar">
          <span>{viewer.email}{assignedType ? ` · ${assignedType === "wholesale" ? "Mayoristas" : "Minoristas"}` : " · Administrador"}</span>
          {viewer.role === "admin" && <Link href="/usuarios">Usuarios</Link>}
          <form action={signOut}><button type="submit">Salir</button></form>
        </div>}
      </div>
      {notice && <div className="operation-notice" role="status">{notice}</div>}
      {activeType === "wholesale" ? <WholesaleOrdersTable onStatusChange={(order, phase) => void moveOrder(order, phase)} orders={wholesale} pendingId={pendingId} /> : <RetailPanel onMove={(order, phase) => void moveOrder(order, phase)} onPaymentChange={(order, status) => void changePaymentStatus(order, status)} onResolveHelp={(order) => void resolveHelp(order)} onSave={saveOrder} onSendBill={(order) => void sendBill(order)} orders={retail} pendingId={pendingId} />}
    </main></div>
  );
}
