"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { catalogProductFor, normalizeProductName, toKilograms, wholesaleProductCatalog } from "@/lib/orders/product-parser";
import type { WholesaleProduct } from "@/lib/orders/product-parser";

import { updateOrderDetails, updateOrderPaymentStatus, updateOrderStatus, updateWholesaleTable } from "./actions";
import type { CustomerType, Order, OrderStatus } from "./types";

type OperationalPhase = "new" | "preparing" | "dispatched" | "help";
type PaymentFilter = "all" | "paid" | "pending";
type EditableOrderDetails = Pick<Order, "customer" | "phone" | "address"> & {
  notes: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unit: string;
    preparation: string;
  }>;
};

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

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

const bogotaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" });
const dayLabel = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
const SERVICE_DAY_CUTOFF_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Los pedidos recibidos entre las 3 a. m. del día anterior y las 3 a. m. del día D (hora Bogotá) se despachan el día D.
function serviceDay(order: Order) {
  return bogotaDay.format(new Date(new Date(order.receivedAt).getTime() - SERVICE_DAY_CUTOFF_MS + DAY_MS));
}

function addDays(day: string, amount: number) {
  return new Date(new Date(`${day}T12:00:00Z`).getTime() + amount * DAY_MS).toISOString().slice(0, 10);
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

function isPaid(order: Order) {
  return ["paid", "verified", "pagado", "verificado"].includes(order.paymentStatus.toLocaleLowerCase("es"));
}

const phaseOrder: OperationalPhase[] = ["new", "preparing", "dispatched"];
const phaseLabels: Record<OperationalPhase, string> = {
  new: "Nuevos",
  preparing: "En preparación",
  dispatched: "Despachados",
  help: "Requiere ayuda",
};
const phaseDescriptions: Record<OperationalPhase, string> = {
  new: "Pedidos recién ingresados",
  preparing: "Pedidos en alistamiento",
  dispatched: "Pedidos que ya salieron",
  help: "Conversaciones que requieren atención",
};
const phaseStatus: Record<OperationalPhase, OrderStatus> = {
  new: "received",
  preparing: "preparing",
  dispatched: "dispatched",
  help: "incident",
};

function phaseForStatus(status: OrderStatus): OperationalPhase {
  if (["needs_review", "incident", "cancelled"].includes(status)) return "help";
  if (["preparing", "ready"].includes(status)) return "preparing";
  if (["dispatched", "delivered"].includes(status)) return "dispatched";
  return "new";
}

function orderTotal(order: Order) {
  return order.items.reduce((total, item) => total + (item.actualQuantity ?? item.quantity) * item.unitPrice, order.deliveryFee + order.adjustments);
}

function conversationUrl(order: Order) {
  const digits = order.phone.replace(/\D/g, "");
  const international = digits.length === 10 ? `57${digits}` : digits;
  const message = encodeURIComponent(`Hola ${order.customer}, te escribimos sobre tu pedido ${order.orderNumber}.`);
  return `https://wa.me/${international}?text=${message}`;
}

function Icon({ name }: { name: "address" | "chat" | "download" | "edit" | "filter" | "help" | "print" | "search" | "shop" | "truck" }) {
  const paths = {
    filter: <path d="M3 5h18l-7 8v6l-4 2v-8Z" />,
    address: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.3 1-1.3 1.7" /><path d="M12 17h.01" /></>,
    print: <><path d="M7 8V3h10v5" /><path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    shop: <><path d="M4 10v11h16V10" /><path d="M3 10 5 3h14l2 7" /><path d="M8 21v-7h8v7" /></>,
    truck: <><path d="M3 6h11v10H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
  };
  return <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">{paths[name]}</svg>;
}

function PhaseNavigation({ activePhase, counts, onChange }: { activePhase: OperationalPhase; counts: Record<OperationalPhase, number>; onChange: (phase: OperationalPhase) => void }) {
  return (
    <nav aria-label="Estado de los pedidos" className="phase-navigation">
      {(Object.keys(phaseLabels) as OperationalPhase[]).map((phase) => (
        <button aria-pressed={activePhase === phase} className={phase === "help" ? "phase-help" : ""} key={phase} onClick={() => onChange(phase)} type="button">
          <span>{phase === "help" && <Icon name="help" />}{phaseLabels[phase]}</span>
          <strong>{counts[phase]}</strong>
          <small>{phaseDescriptions[phase]}</small>
        </button>
      ))}
    </nav>
  );
}

function OrderCard({ order, selected, onSelect }: { order: Order; selected: boolean; onSelect: () => void }) {
  return (
    <button aria-pressed={selected} className={selected ? "workflow-card is-selected" : "workflow-card"} onClick={onSelect} type="button">
      <span className="workflow-card-topline"><strong>{order.businessName ?? order.customer}</strong><b>{(order.formData && order.items.length === 0 ? "Por cotizar" : money.format(orderTotal(order)))}</b></span>
      <span className="workflow-card-meta">{order.orderNumber} · {dateTime.format(new Date(order.receivedAt))}</span>
      <span className="workflow-card-address"><Icon name="address" />{order.address}</span>
      <span className="workflow-card-bottom"><span>{order.items.length === 0 && order.formData ? "Pedido por cotizar" : `${order.items.length} productos`}</span><span>{order.fulfillment === "delivery" ? order.route : "Recoge en tienda"}</span></span>
    </button>
  );
}

function ThermalTicket({ order }: { order: Order }) {
  return (
    <article aria-label={`Comanda ${order.orderNumber}`} className="thermal-ticket">
      <div className="ticket-brand"><strong>FÉNIX J.A.</strong><span>COMANDA DE PEDIDO</span></div>
      <div className="ticket-rule" />
      <dl className="ticket-meta">
        <div><dt>Pedido</dt><dd>{order.orderNumber}</dd></div><div><dt>Fecha</dt><dd>{dateTime.format(new Date(order.receivedAt))}</dd></div>
        <div><dt>Cliente</dt><dd>{order.businessName ?? order.customer}</dd></div><div><dt>Tel.</dt><dd>{order.phone}</dd></div>
        <div><dt>Entrega</dt><dd>{order.fulfillment === "delivery" ? "Domicilio" : "Recoge"}</dd></div><div><dt>Dirección</dt><dd>{order.address}</dd></div>
      </dl>
      <div className="ticket-rule" />
      {order.items.map((item) => <div className="ticket-line" key={item.id}><strong>{item.productName}</strong><span>{item.actualQuantity ?? item.quantity} {item.unit} × {money.format(item.unitPrice)}</span><b>{money.format((item.actualQuantity ?? item.quantity) * item.unitPrice)}</b>{item.preparation && <small>{item.preparation}</small>}</div>)}
      <div className="ticket-rule" /><div className="ticket-total"><span>TOTAL</span><strong>{(order.formData && order.items.length === 0 ? "Por cotizar" : money.format(orderTotal(order)))}</strong></div>
      {order.formData && <p className="ticket-notes" style={{ whiteSpace: "pre-wrap" }}><b>Pedido por cotizar:</b> {order.formData.order_text}</p>}
      {order.notes && <p className="ticket-notes"><b>Nota:</b> {order.notes}</p>}<p className="ticket-address"><b>Dirección:</b> {order.address}</p>
      <p className="ticket-footer">Comprobante de pedido · No es factura electrónica</p>
    </article>
  );
}

function EditOrderForm({ order, saving, onCancel, onSave }: { order: Order; saving: boolean; onCancel: () => void; onSave: (details: EditableOrderDetails) => Promise<boolean> }) {
  const [details, setDetails] = useState<EditableOrderDetails>({
    customer: order.customer,
    phone: order.phone,
    address: order.address,
    notes: order.notes ?? "",
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.actualQuantity ?? item.quantity,
      unit: item.unit,
      preparation: item.preparation ?? "",
    })),
  });
  const updateItem = (index: number, values: Partial<EditableOrderDetails["items"][number]>) => {
    setDetails((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item) }));
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (await onSave(details)) onCancel(); };
  return (
    <form className="order-edit-form" onSubmit={(event) => void submit(event)}>
      <div className="edit-form-heading"><div><span>Editando</span><h3>Información del pedido</h3></div><button aria-label="Cerrar edición" onClick={onCancel} type="button">×</button></div>
      <div className="edit-form-grid">
        <label>Cliente<input onChange={(event) => setDetails((current) => ({ ...current, customer: event.target.value }))} required value={details.customer} /></label>
        <label>Teléfono<input onChange={(event) => setDetails((current) => ({ ...current, phone: event.target.value }))} required value={details.phone} /></label>
        <label className="edit-wide">Dirección<input onChange={(event) => setDetails((current) => ({ ...current, address: event.target.value }))} required value={details.address} /></label>
        <label className="edit-wide">Indicaciones<textarea onChange={(event) => setDetails((current) => ({ ...current, notes: event.target.value }))} rows={3} value={details.notes} /></label>
      </div>
      <fieldset className="edit-items"><legend>Productos del pedido</legend>{details.items.map((item, index) => <div className="edit-item-row" key={item.id}><label>Producto<input onChange={(event) => updateItem(index, { productName: event.target.value })} required value={item.productName} /></label><label>Cantidad<input min="0.001" onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} required step="0.001" type="number" value={item.quantity} /></label><label>Unidad<input onChange={(event) => updateItem(index, { unit: event.target.value })} required value={item.unit} /></label><label>Preparación<input onChange={(event) => updateItem(index, { preparation: event.target.value })} placeholder="Sin indicaciones" value={item.preparation} /></label></div>)}</fieldset>
      <div className="edit-form-actions"><button className="outline-action" onClick={onCancel} type="button">Cancelar</button><button className="primary-action" disabled={saving} type="submit">{saving ? "Guardando…" : "Guardar cambios"}</button></div>
    </form>
  );
}

function safeExternalUrl(value?: string) {
  try { const url = new URL(value ?? ""); return ["http:", "https:"].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}

function FormDetails({ order }: { order: Order }) {
  const form = order.formData;
  if (!form) return null;
  const maps = safeExternalUrl(form.maps_url);
  const proof = safeExternalUrl(form.payment_proof);
  return <div className="order-note"><strong>Pedido del formulario · {form.form === "nuevo-mayorista" ? "Nuevo mayorista" : "Mayorista cliente"}</strong>
    <p style={{ whiteSpace: "pre-wrap" }}>{form.order_text}</p>
    <p>Pendiente de desglosar y cotizar los productos.</p>
    {form.tax_id && <p><b>NIT o cédula:</b> {form.tax_id}</p>}
    {form.billing && <p><b>Facturación:</b> {form.billing}</p>}
    {form.receiver_phone && <p><b>Teléfono de quien recibe:</b> {form.receiver_phone}</p>}
    {maps && <p><a href={maps} target="_blank" rel="noreferrer">Ver ubicación de Maps</a></p>}
    {proof && <p><a href={proof} target="_blank" rel="noreferrer">Ver comprobante de pago</a> · Pendiente de verificar</p>}
  </div>;
}

function OrderDetail({ order, pending, onMove, onPaymentChange, onSave }: { order: Order; pending: boolean; onMove: (order: Order, phase: OperationalPhase) => void; onPaymentChange: (order: Order, status: "paid" | "pending") => void; onSave: (order: Order, details: EditableOrderDetails) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const phase = phaseForStatus(order.status);
  const phaseIndex = phaseOrder.indexOf(phase);
  const previousPhase = phaseIndex > 0 ? phaseOrder[phaseIndex - 1] : undefined;
  const nextPhase = phaseIndex >= 0 && phaseIndex < phaseOrder.length - 1 ? phaseOrder[phaseIndex + 1] : undefined;
  if (editing) return <EditOrderForm key={order.id} onCancel={() => setEditing(false)} onSave={(details) => onSave(order, details)} order={order} saving={pending} />;
  return (
    <div className="workflow-detail">
      <div className="detail-topline"><div><span>Pedido seleccionado</span><h2>{order.orderNumber}</h2></div><span className={`workflow-phase-badge phase-${phase}`}>{phaseLabels[phase]}</span></div>
      <div className="customer-summary"><div className="customer-avatar">{order.customer.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><strong>{order.businessName ?? order.customer}</strong><span>{order.phone}</span></div><div className="delivery-chip">{order.fulfillment === "delivery" ? <Icon name="truck" /> : <Icon name="shop" />}<span>{order.fulfillment === "delivery" ? "Domicilio" : "Recoge"}</span></div></div>
      <div className="contact-actions"><a className="chat-action" href={conversationUrl(order)} rel="noreferrer" target="_blank"><Icon name="chat" /> Abrir conversación</a><button className="outline-action" onClick={() => setEditing(true)} type="button"><Icon name="edit" /> Editar pedido</button></div>
      <p className="delivery-address"><Icon name="address" /><span><b>Dirección del cliente</b>{order.address}</span></p>
      <FormDetails order={order} />
      <div className="retail-lines"><div className="line-heading"><span>Producto</span><span>Cant. / preparación</span><span>Subtotal</span></div>{order.items.map((item) => <div className="retail-line" key={item.id}><strong>{item.productName}</strong><span>{item.actualQuantity ?? item.quantity} {item.unit}<small>{item.preparation ?? "Sin indicaciones especiales"}</small></span><b>{money.format((item.actualQuantity ?? item.quantity) * item.unitPrice)}</b></div>)}</div>
      {order.notes && <div className="order-note"><strong>Indicaciones</strong><p>{order.notes}</p></div>}
      <div className="payment-summary"><div><span>Pago</span><strong>{order.paymentMethod ?? "Por definir"}</strong><small className={isPaid(order) ? "payment-state is-paid" : "payment-state is-pending"}>{isPaid(order) ? "Pagado" : "Pendiente por pago"}</small></div><div><span>Total</span><strong>{(order.formData && order.items.length === 0 ? "Por cotizar" : money.format(orderTotal(order)))}</strong></div></div>
      <div className="workflow-actions">
        <button className="outline-action" onClick={() => window.print()} type="button"><Icon name="print" /> Imprimir</button>
        <button className={isPaid(order) ? "payment-action is-paid" : "payment-action"} disabled={pending} onClick={() => onPaymentChange(order, isPaid(order) ? "pending" : "paid")} type="button">{pending ? "Guardando…" : isPaid(order) ? "Marcar pendiente" : "Marcar como pagado"}</button>
        {phase === "help" ? <button className="outline-action" disabled={pending} onClick={() => onMove(order, "new")} type="button">Enviar a Nuevos</button> : <>{previousPhase && <button className="outline-action" disabled={pending} onClick={() => onMove(order, previousPhase)} type="button">← {phaseLabels[previousPhase]}</button>}{nextPhase && <button className="primary-action" disabled={pending} onClick={() => onMove(order, nextPhase)} type="button">{pending ? "Guardando…" : `Mover a ${phaseLabels[nextPhase]}`} →</button>}</>}
        {phase !== "help" && <button className="help-action" disabled={pending} onClick={() => onMove(order, "help")} type="button"><Icon name="help" /> Requiere ayuda</button>}
      </div>
      <ThermalTicket order={order} />
    </div>
  );
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

function OrdersWorkspace({ activePhase, orders, pendingId, onMove, onPaymentChange, onSave }: { activePhase: OperationalPhase; orders: Order[]; pendingId?: string; onMove: (order: Order, phase: OperationalPhase) => void; onPaymentChange: (order: Order, status: "paid" | "pending") => void; onSave: (order: Order, details: EditableOrderDetails) => Promise<boolean> }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const normalized = query.trim().toLocaleLowerCase("es");
  const phaseOrders = useMemo(() => orders.filter((order) => phaseForStatus(order.status) === activePhase), [activePhase, orders]);
  const paymentCounts = { all: phaseOrders.length, paid: phaseOrders.filter(isPaid).length, pending: phaseOrders.filter((order) => !isPaid(order)).length };
  const visibleOrders = useMemo(() => phaseOrders.filter((order) => (paymentFilter === "all" || (paymentFilter === "paid" ? isPaid(order) : !isPaid(order))) && (!normalized || `${order.orderNumber} ${order.customer} ${order.businessName ?? ""} ${order.phone} ${order.address}`.toLocaleLowerCase("es").includes(normalized))), [normalized, paymentFilter, phaseOrders]);
  const selected = visibleOrders.find((order) => order.id === selectedId) ?? visibleOrders[0];
  return (
    <section className="workflow-workspace">
      <aside className="workflow-list-panel">
        <div className="workflow-list-heading"><div><span className="section-kicker">Consumo hogar</span><h2>{phaseLabels[activePhase]}</h2><p>{visibleOrders.length} {visibleOrders.length === 1 ? "pedido" : "pedidos"}</p></div></div>
        <nav aria-label="Filtrar por estado de pago" className="payment-filters">{(["all", "paid", "pending"] as PaymentFilter[]).map((filter) => <button aria-pressed={paymentFilter === filter} key={filter} onClick={() => setPaymentFilter(filter)} type="button"><span>{filter === "all" ? "Todos" : filter === "paid" ? "Pagados" : "Pendientes"}</span><strong>{paymentCounts[filter]}</strong></button>)}</nav>
        <label className="search-control"><Icon name="search" /><span className="sr-only">Buscar pedido</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Cliente, pedido, teléfono o dirección" type="search" value={query} /></label>
        <div className="workflow-card-list">{visibleOrders.map((order) => <OrderCard key={order.id} onSelect={() => setSelectedId(order.id)} order={order} selected={selected?.id === order.id} />)}{!visibleOrders.length && <div className="workflow-empty"><strong>No hay pedidos aquí</strong><span>Cuando un pedido llegue a esta fase aparecerá en esta lista.</span></div>}</div>
      </aside>
      <div className="workflow-detail-panel">{selected ? <OrderDetail key={selected.id} onMove={onMove} onPaymentChange={onPaymentChange} onSave={onSave} order={selected} pending={pendingId === selected.id} /> : <div className="workflow-empty detail-empty"><strong>No hay pedidos para mostrar</strong><span>Cambia el filtro de pago o selecciona otra fase.</span></div>}</div>
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
  const [activePhase, setActivePhase] = useState<OperationalPhase>("new");
  const [pendingId, setPendingId] = useState<string>();
  const [notice, setNotice] = useState<string | undefined>(loadError);
  const typeOrders = orders.filter((order) => order.customerType === activeType);
  const wholesale = orders.filter((order) => order.customerType === "wholesale");
  const retail = orders.filter((order) => order.customerType === "retail");
  const counts = typeOrders.reduce<Record<OperationalPhase, number>>((totals, order) => { const phase = phaseForStatus(order.status); totals[phase] += 1; return totals; }, { new: 0, preparing: 0, dispatched: 0, help: 0 });

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
      {activeType === "wholesale" ? <WholesaleOrdersTable onStatusChange={(order, phase) => void moveOrder(order, phase)} orders={wholesale} pendingId={pendingId} /> : <><PhaseNavigation activePhase={activePhase} counts={counts} onChange={setActivePhase} /><OrdersWorkspace activePhase={activePhase} onMove={(order, phase) => void moveOrder(order, phase)} onPaymentChange={(order, status) => void changePaymentStatus(order, status)} onSave={saveOrder} orders={retail} pendingId={pendingId} /></>}
    </main></div>
  );
}
