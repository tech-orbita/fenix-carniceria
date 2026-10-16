"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { updateOrderDetails, updateOrderPaymentStatus, updateOrderStatus } from "./actions";
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

const wholesaleProducts = [
  { category: "Carne de res", name: "Carne blanda", aliases: ["carne blanda", "blanda"] },
  { category: "Carne de res", name: "Espaldilla", aliases: ["espaldilla", "espaldi"] },
  { category: "Carne de res", name: "Molida especial", aliases: ["molida especial"] },
  { category: "Carne de res", name: "Atravesado", aliases: ["atravesado", "pollo atravesado"] },
  { category: "Carne de res", name: "Costilla", aliases: ["costilla", "costilla de res"], exact: true },
  { category: "Carne de res", name: "Hueso carnudo", aliases: ["hueso carnudo", "hueso"] },
  { category: "Carne de cerdo", name: "Costilla de cerdo", aliases: ["costilla de cerdo"] },
  { category: "Carne de cerdo", name: "Pulpa de cerdo", aliases: ["pulpa de cerdo"] },
  { category: "Carne de cerdo", name: "Panceta", aliases: ["panceta"] },
  { category: "Aves", name: "Filete de pechuga", aliases: ["filete de pechuga"] },
  { category: "Aves", name: "Pechuga congelada", aliases: ["pechuga congelada"] },
  { category: "Aves", name: "Pernil mixto (contramuslo)", aliases: ["pernil mixto", "contramuslo"] },
  { category: "Aves", name: "Muslo", aliases: ["muslo"], exact: true },
] as const;

function normalizeProductName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim();
}

function productQuantity(order: Order, product: (typeof wholesaleProducts)[number]) {
  const amounts = new Map<string, number>();
  order.items.forEach((item) => {
    const normalized = normalizeProductName(item.productName);
    const matches = "exact" in product && product.exact
      ? product.aliases.some((alias) => normalized === alias)
      : product.aliases.some((alias) => normalized.includes(alias));
    if (matches) amounts.set(item.unit, (amounts.get(item.unit) ?? 0) + (item.actualQuantity ?? item.quantity));
  });
  return [...amounts.entries()].map(([unit, quantity]) => `${quantity} ${unit}`).join(" / ");
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

function Icon({ name }: { name: "address" | "chat" | "download" | "edit" | "help" | "print" | "search" | "shop" | "truck" }) {
  const paths = {
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

async function downloadWholesaleOrders(orders: Order[]) {
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
    ...wholesaleProducts.map((product, index) => ({ header: product.name, key: `product${index}`, width: 20 })),
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
    ...Object.fromEntries(wholesaleProducts.map((product, index) => [`product${index}`, productQuantity(order, product)])),
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

function WholesaleOrdersTable({ orders }: { orders: Order[] }) {
  const [query, setQuery] = useState("");
  const [selectedZone, setSelectedZone] = useState("all");
  const normalized = query.trim().toLocaleLowerCase("es");
  const zoneOptions = useMemo(() => {
    const counts = new Map<string, number>();
    orders.forEach((order) => counts.set(order.route, (counts.get(order.route) ?? 0) + 1));
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => left.name.localeCompare(right.name, "es"));
  }, [orders]);
  const visibleOrders = useMemo(() => orders.filter((order) => (
    (selectedZone === "all" || order.route === selectedZone)
    && (!normalized || `${order.orderNumber} ${order.customer} ${order.businessName ?? ""}`.toLocaleLowerCase("es").includes(normalized))
  )), [normalized, orders, selectedZone]);
  const categories = [
    { name: "Carne de res", count: wholesaleProducts.filter((product) => product.category === "Carne de res").length },
    { name: "Carne de cerdo", count: wholesaleProducts.filter((product) => product.category === "Carne de cerdo").length },
    { name: "Aves", count: wholesaleProducts.filter((product) => product.category === "Aves").length },
  ];
  return (
    <section className="wholesale-workspace">
      <div className="section-toolbar"><div><span className="section-kicker">Canal mayorista</span><h2>Plantilla de pedidos</h2><p>{visibleOrders.length} {visibleOrders.length === 1 ? "pedido" : "pedidos"} {selectedZone === "all" ? "en todas las zonas" : `en ${selectedZone}`}.</p></div><div className="toolbar-actions"><label className="zone-filter"><span className="sr-only">Filtrar pedidos por zona</span><select aria-label="Filtrar pedidos por zona" onChange={(event) => setSelectedZone(event.target.value)} value={selectedZone}><option value="all">Todas las zonas ({orders.length})</option>{zoneOptions.map((zone) => <option key={zone.name} value={zone.name}>{zone.name} ({zone.count})</option>)}</select></label><label className="search-control wholesale-search"><Icon name="search" /><span className="sr-only">Buscar cliente o pedido</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente o pedido" type="search" value={query} /></label><button className="outline-action" onClick={() => void downloadWholesaleOrders(visibleOrders)} type="button"><Icon name="download" /> Descargar Excel</button><button className="outline-action" onClick={() => window.print()} type="button"><Icon name="print" /> Imprimir</button></div></div>
      <div className="matrix-scroll"><table className="order-matrix wholesale-matrix"><thead><tr className="category-row"><th colSpan={5}>Pedido recibido</th>{categories.map((category) => <th colSpan={category.count} key={category.name}>{category.name}</th>)}</tr><tr><th>Cliente</th><th>Teléfono</th><th>Zona</th><th>Pedido solicitado</th><th>Facturación</th>{wholesaleProducts.map((product) => <th key={product.name}>{product.name}</th>)}</tr></thead><tbody>{visibleOrders.map((order) => <tr key={order.id}><th scope="row"><strong>{order.businessName ?? order.customer}</strong><small>{order.orderNumber}</small></th><td>{order.phone}</td><td>{order.route}</td><td className="order-request-cell">{order.formData?.order_text || "—"}</td><td>{order.formData?.billing || "—"}</td>{wholesaleProducts.map((product) => <td key={product.name}>{productQuantity(order, product) || "—"}</td>)}</tr>)}{!visibleOrders.length && <tr><td className="matrix-empty" colSpan={wholesaleProducts.length + 5}>No hay pedidos mayoristas para mostrar.</td></tr>}</tbody></table></div>
      <p className="matrix-note">Los datos llegan directamente de los formularios. El archivo de Excel incluye el pedido completo, el contacto, la entrega y las observaciones.</p>
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
      <section className="dashboard-intro"><div><p className="eyebrow">Centro de pedidos</p><h1>Cada pedido, en el momento correcto.</h1><p>Revisa conversaciones, prepara pedidos y coordina despachos desde una sola vista.</p></div><span className="live-badge">Actualización automática</span></section>
      <section aria-label="Tipo de cliente" className="segment-switch"><button aria-pressed={activeType === "wholesale"} onClick={() => { setActiveType("wholesale"); setNotice(undefined); }} type="button"><Icon name="truck" /><span><strong>Mayoristas</strong><small>{wholesale.length} pedidos de negocios</small></span></button><button aria-pressed={activeType === "retail"} onClick={() => { setActiveType("retail"); setNotice(undefined); }} type="button"><Icon name="shop" /><span><strong>Minoristas</strong><small>{retail.length} pedidos de hogares</small></span></button></section>
      {notice && <div className="operation-notice" role="status">{notice}</div>}
      {activeType === "wholesale" ? <WholesaleOrdersTable orders={wholesale} /> : <><PhaseNavigation activePhase={activePhase} counts={counts} onChange={setActivePhase} /><OrdersWorkspace activePhase={activePhase} onMove={(order, phase) => void moveOrder(order, phase)} onPaymentChange={(order, status) => void changePaymentStatus(order, status)} onSave={saveOrder} orders={retail} pendingId={pendingId} /></>}
    </main></div>
  );
}
