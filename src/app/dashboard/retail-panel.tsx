"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { toKilograms } from "@/lib/orders/product-parser";
import { retailBillMessage } from "@/lib/orders/retail-bill";

import { addDays, bogotaDay, dateTime, dayLabel, Icon, isPaid, money, orderTotal, phaseForStatus, phaseLabels, phaseOrder } from "./panel-shared";
import type { OperationalPhase } from "./panel-shared";
import type { Order } from "./types";

export type EditableOrderDetails = Pick<Order, "customer" | "phone" | "address"> & {
  notes: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    preparation: string;
  }>;
};

type PaymentFilter = "all" | "paid" | "pending";
type RangePreset = "today" | "yesterday" | "week" | "month" | "custom";
type DateRange = { from: string; to: string };

const LOGO_SRC = "/logo-fenix.png";
const quantityFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 });
const rangeLabels: Record<RangePreset, string> = { today: "Hoy", yesterday: "Ayer", week: "Últimos 7 días", month: "Este mes", custom: "Elegir fechas" };
const phaseHints: Record<OperationalPhase, string> = {
  new: "Recién ingresados",
  preparing: "En alistamiento",
  dispatched: "Ya salieron",
  help: "Necesitan atención",
};
const paymentFilterLabels: Record<PaymentFilter, string> = { all: "Todos", paid: "Pagados", pending: "Por cobrar" };
const paymentMethodLabels: Record<string, string> = { cash: "Efectivo", transfer: "Transferencia", credit: "Crédito", other: "Otro" };

function receivedDay(order: Order) {
  return bogotaDay.format(new Date(order.receivedAt));
}

function presetRange(preset: RangePreset, today: string, custom: DateRange): DateRange {
  if (preset === "today") return { from: today, to: today };
  if (preset === "yesterday") return { from: addDays(today, -1), to: addDays(today, -1) };
  if (preset === "week") return { from: addDays(today, -6), to: today };
  if (preset === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from };
}

function formatDay(day: string) {
  return dayLabel.format(new Date(`${day}T12:00:00Z`));
}

function rangeTitle(range: DateRange) {
  return range.from === range.to ? formatDay(range.from) : `${formatDay(range.from)} – ${formatDay(range.to)}`;
}

function paymentMethodLabel(order: Order) {
  return order.paymentMethod ? paymentMethodLabels[order.paymentMethod] ?? order.paymentMethod : "Por definir";
}

function itemQuantity(item: Order["items"][number]) {
  return item.actualQuantity ?? item.quantity;
}

function pendingWeight(item: Order["items"][number]) {
  return item.actualQuantity == null && item.unit !== "kg";
}

function billableQuantity(item: Order["items"][number]) {
  return item.actualQuantity ?? (item.unit === "kg" ? item.quantity : 0);
}

function itemsSubtotal(order: Order) {
  return order.items.reduce((total, item) => total + billableQuantity(item) * item.unitPrice, 0);
}

function isQuote(order: Order) {
  return Boolean(order.formData) && order.items.length === 0;
}

function initials(name: string) {
  return name.split(/\s+/).filter((part) => /^\p{L}/u.test(part)).map((part) => part[0]).slice(0, 2).join("").toLocaleUpperCase("es");
}

async function downloadRetailOrders(orders: Order[], range: DateRange) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Pedidos minoristas");
  const currency = '"$"#,##0';
  worksheet.columns = [
    { header: "Pedido", key: "orderNumber", width: 14 },
    { header: "Fecha", key: "receivedAt", width: 20 },
    { header: "Cliente", key: "customer", width: 26 },
    { header: "Teléfono", key: "phone", width: 16 },
    { header: "Dirección", key: "address", width: 36 },
    { header: "Entrega", key: "fulfillment", width: 14 },
    { header: "Estado", key: "phase", width: 16 },
    { header: "Pago", key: "payment", width: 16 },
    { header: "Método de pago", key: "method", width: 16 },
    { header: "Productos", key: "products", width: 52 },
    { header: "Subtotal", key: "subtotal", width: 14, style: { numFmt: currency } },
    { header: "Domicilio", key: "deliveryFee", width: 12, style: { numFmt: currency } },
    { header: "Total", key: "total", width: 14, style: { numFmt: currency } },
  ];
  orders.forEach((order) => worksheet.addRow({
    orderNumber: order.orderNumber,
    receivedAt: dateTime.format(new Date(order.receivedAt)),
    customer: order.businessName ?? order.customer,
    phone: order.phone,
    address: order.address,
    fulfillment: order.fulfillment === "delivery" ? "Domicilio" : "Recoge",
    phase: phaseLabels[phaseForStatus(order.status)],
    payment: isPaid(order) ? "Pagado" : "Pendiente",
    method: paymentMethodLabel(order),
    products: order.items.map((item) => `${item.productName} ${quantityFormat.format(itemQuantity(item))} ${item.unit}`).join("; "),
    subtotal: itemsSubtotal(order),
    deliveryFee: order.deliveryFee,
    total: orderTotal(order),
  }));
  const totalRow = worksheet.addRow({
    orderNumber: "TOTAL",
    customer: `${orders.length} ${orders.length === 1 ? "pedido" : "pedidos"}`,
    subtotal: orders.reduce((sum, order) => sum + itemsSubtotal(order), 0),
    deliveryFee: orders.reduce((sum, order) => sum + order.deliveryFee, 0),
    total: orders.reduce((sum, order) => sum + orderTotal(order), 0),
  });
  totalRow.font = { bold: true };
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1769E0" } };
  worksheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = { from: "A1", to: `${worksheet.getColumn(worksheet.columnCount).letter}1` };
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = range.from === range.to ? `pedidos-minoristas-${range.from}.xlsx` : `pedidos-minoristas-${range.from}-a-${range.to}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

// El logo solo se muestra cuando el archivo existe, para no imprimir una imagen rota.
function useLogoAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const image = new Image();
    image.onload = () => setAvailable(true);
    image.src = LOGO_SRC;
  }, []);
  return available;
}

function OrderCard({ order, selected, onSelect }: { order: Order; selected: boolean; onSelect: () => void }) {
  const paid = isPaid(order);
  return (
    <button aria-pressed={selected} className={selected ? "rt-card is-selected" : "rt-card"} onClick={onSelect} type="button">
      <span className="rt-card-top"><strong>{order.businessName ?? order.customer}</strong><b>{isQuote(order) ? "Por cotizar" : money.format(orderTotal(order))}</b></span>
      <span className="rt-card-meta"><span>{order.orderNumber} · {dateTime.format(new Date(order.receivedAt))}</span><span className={paid ? "rt-pill is-paid" : "rt-pill is-pending"}>{paid ? "Pagado" : "Por cobrar"}</span></span>
      <span className="rt-card-address"><Icon name="address" /><span>{order.address}</span></span>
      <span className="rt-card-foot"><span>{isQuote(order) ? "Pedido por cotizar" : `${order.items.length} ${order.items.length === 1 ? "producto" : "productos"}`}</span><span>{order.fulfillment === "delivery" ? order.route : "Recoge en tienda"}</span></span>
    </button>
  );
}

function ThermalTicket({ order, logo }: { order: Order; logo: boolean }) {
  return (
    <article aria-label={`Comanda ${order.orderNumber}`} className="thermal-ticket">
      {/* eslint-disable-next-line @next/next/no-img-element -- la comanda impresa necesita una imagen simple, sin optimización */}
      <div className="ticket-brand">{logo ? <img alt="Fénix J.A." className="ticket-logo" src={LOGO_SRC} /> : <strong>FÉNIX J.A.</strong>}<span>COMANDA DE PEDIDO</span></div>
      <div className="ticket-rule" />
      <dl className="ticket-meta">
        <div><dt>Pedido</dt><dd>{order.orderNumber}</dd></div><div><dt>Fecha</dt><dd>{dateTime.format(new Date(order.receivedAt))}</dd></div>
        <div><dt>Cliente</dt><dd>{order.businessName ?? order.customer}</dd></div><div><dt>Tel.</dt><dd>{order.phone}</dd></div>
        <div><dt>Entrega</dt><dd>{order.fulfillment === "delivery" ? "Domicilio" : "Recoge"}</dd></div><div><dt>Dirección</dt><dd>{order.address}</dd></div>
      </dl>
      <div className="ticket-rule" />
      {order.items.map((item) => <div className="ticket-line" key={item.id}><strong>{item.productName}</strong>{pendingWeight(item) ? <><span>{quantityFormat.format(item.quantity)} und · peso pendiente</span><b>Por pesar</b></> : <><span>{quantityFormat.format(itemQuantity(item))} kg × {money.format(item.unitPrice)}/kg</span><b>{money.format(billableQuantity(item) * item.unitPrice)}</b></>}{item.preparation && <small>{item.preparation}</small>}</div>)}
      <div className="ticket-rule" />
      {order.deliveryFee > 0 && <div className="ticket-subtotal"><span>Domicilio</span><span>{money.format(order.deliveryFee)}</span></div>}
      {order.adjustments !== 0 && <div className="ticket-subtotal"><span>Ajustes</span><span>{money.format(order.adjustments)}</span></div>}
      <div className="ticket-total"><span>TOTAL</span><strong>{isQuote(order) ? "Por cotizar" : money.format(orderTotal(order))}</strong></div>
      <p className="ticket-payment">Pago: {paymentMethodLabel(order)} · {isPaid(order) ? "PAGADO" : "PENDIENTE"}</p>
      {order.formData && <p className="ticket-notes" style={{ whiteSpace: "pre-wrap" }}><b>Pedido por cotizar:</b> {order.formData.order_text}</p>}
      {order.notes && <p className="ticket-notes"><b>Nota:</b> {order.notes}</p>}
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
    items: order.items.map((item) => {
      const normalized = pendingWeight(item) ? { quantity: 0, unit: "kg" } : toKilograms(itemQuantity(item), item.unit);
      return {
        id: item.id,
        productName: item.productName,
        quantity: normalized.quantity,
        unit: "kg",
        unitPrice: item.unitPrice,
        preparation: item.preparation ?? "",
      };
    }),
  });
  const updateItem = (index: number, values: Partial<EditableOrderDetails["items"][number]>) => {
    setDetails((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item) }));
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (await onSave(details)) onCancel(); };
  return (
    <form className="rt-edit" onSubmit={(event) => void submit(event)}>
      <div className="rt-edit-head"><div><span className="rt-kicker">Editando {order.orderNumber}</span><h2>Información del pedido</h2></div><button aria-label="Cerrar edición" onClick={onCancel} type="button">×</button></div>
      <div className="rt-edit-grid">
        <label>Cliente<input onChange={(event) => setDetails((current) => ({ ...current, customer: event.target.value }))} required value={details.customer} /></label>
        <label>Teléfono<input onChange={(event) => setDetails((current) => ({ ...current, phone: event.target.value }))} required value={details.phone} /></label>
        <label className="rt-wide">Dirección<input onChange={(event) => setDetails((current) => ({ ...current, address: event.target.value }))} required value={details.address} /></label>
        <label className="rt-wide">Indicaciones<textarea onChange={(event) => setDetails((current) => ({ ...current, notes: event.target.value }))} rows={3} value={details.notes} /></label>
      </div>
      <fieldset className="rt-edit-items">
        <legend>Productos · ajusta el gramaje y el precio real</legend>
        {details.items.map((item, index) => <div className="rt-edit-row" key={item.id}>
          <label>Producto<input onChange={(event) => updateItem(index, { productName: event.target.value })} required value={item.productName} />{order.items[index]?.notes && <small>Pedido: {order.items[index].notes}</small>}</label>
          <label>Peso real<input min="0.001" onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} placeholder="0" required step="0.001" type="number" value={item.quantity || ""} /></label>
          <label>Unidad<input aria-label="Unidad fija en kilogramos" readOnly value="kg" /></label>
          <label>Precio por kg<input min="0" onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })} required step="100" type="number" value={item.unitPrice} /></label>
          <label>Preparación<input onChange={(event) => updateItem(index, { preparation: event.target.value })} placeholder="Sin indicaciones" value={item.preparation} /></label>
        </div>)}
      </fieldset>
      <div className="rt-edit-actions"><button className="rt-button" onClick={onCancel} type="button">Cancelar</button><button className="rt-button is-primary" disabled={saving} type="submit">{saving ? "Guardando…" : "Guardar cambios"}</button></div>
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
  return <div className="rt-note"><strong>Pedido del formulario · {form.form === "nuevo-mayorista" ? "Nuevo mayorista" : "Mayorista cliente"}</strong>
    <p style={{ whiteSpace: "pre-wrap" }}>{form.order_text}</p>
    <p>Pendiente de desglosar y cotizar los productos.</p>
    {form.tax_id && <p><b>NIT o cédula:</b> {form.tax_id}</p>}
    {form.billing && <p><b>Facturación:</b> {form.billing}</p>}
    {form.receiver_phone && <p><b>Teléfono de quien recibe:</b> {form.receiver_phone}</p>}
    {maps && <p><a href={maps} target="_blank" rel="noreferrer">Ver ubicación de Maps</a></p>}
    {proof && <p><a href={proof} target="_blank" rel="noreferrer">Ver comprobante de pago</a> · Pendiente de verificar</p>}
  </div>;
}

function OrderDetail({ order, pending, logo, onMove, onPaymentChange, onResolveHelp, onSave, onSendBill }: { order: Order; pending: boolean; logo: boolean; onMove: (order: Order, phase: OperationalPhase) => void; onPaymentChange: (order: Order, status: "paid" | "pending") => void; onResolveHelp: (order: Order) => void; onSave: (order: Order, details: EditableOrderDetails) => Promise<boolean>; onSendBill: (order: Order) => void }) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const phase = phaseForStatus(order.status);
  const paid = isPaid(order);
  const canBill = order.items.length > 0;
  const copyBill = async () => {
    try {
      await navigator.clipboard.writeText(retailBillMessage(order));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* El navegador puede bloquear el portapapeles; el envío directo por GHL sigue disponible. */ }
  };
  if (editing) return <EditOrderForm key={order.id} onCancel={() => setEditing(false)} onSave={(details) => onSave(order, details)} order={order} saving={pending} />;
  return (
    <div className="rt-detail">
      <div className="rt-detail-body">
        <header className="rt-detail-head">
          <div><span className="rt-kicker">Pedido</span><h2>{order.orderNumber}</h2><p>Recibido {dateTime.format(new Date(order.receivedAt))}</p></div>
          <span className={`rt-badge phase-${phase}`}>{phaseLabels[phase]}</span>
        </header>
        <section className="rt-customer">
          <div className="rt-avatar">{initials(order.customer)}</div>
          <div className="rt-customer-info">
            <strong>{order.businessName ?? order.customer}</strong>
            <span>{order.phone}</span>
            <span className="rt-address"><Icon name="address" />{order.address}</span>
          </div>
          <span className="rt-chip">{order.fulfillment === "delivery" ? <Icon name="truck" /> : <Icon name="shop" />}{order.fulfillment === "delivery" ? order.route : "Recoge"}</span>
        </section>
        <div className="rt-control-panel">
          <div className="rt-control-row">
            <div className="rt-control-section">
              <span className="rt-control-label">Comunicación</span>
              <div className="rt-control-actions">
                <a className="rt-button is-chat" href={`/api/highlevel/conversation/${encodeURIComponent(order.id)}`} rel="noreferrer" target="_blank"><Icon name="chat" /> Abrir conversación</a>
                {canBill && <button className="rt-button is-bill" disabled={pending} onClick={() => onSendBill(order)} title="Envía el resumen directamente por la conversación de HighLevel" type="button"><Icon name="receipt" /> {pending ? "Enviando…" : "Enviar cobro"}</button>}
              </div>
            </div>
            <div className="rt-control-section is-order">
              <span className="rt-control-label">Pedido</span>
              <div className="rt-control-actions">
                {canBill && <button className="rt-button is-quiet" onClick={() => void copyBill()} title="Copia el resumen para pegarlo en otra conversación" type="button"><Icon name={copied ? "check" : "copy"} /> {copied ? "Copiado" : "Copiar"}</button>}
                <button className="rt-button is-quiet" onClick={() => setEditing(true)} type="button"><Icon name="edit" /> Editar</button>
                <button className="rt-button is-quiet" onClick={() => window.print()} type="button"><Icon name="print" /> Imprimir</button>
              </div>
            </div>
            <button className={paid ? "rt-button rt-payment-action is-paid" : "rt-button rt-payment-action is-pay"} disabled={pending} onClick={() => onPaymentChange(order, paid ? "pending" : "paid")} type="button">{pending ? "Guardando…" : paid ? "Marcar pendiente" : "Marcar como pagado"}</button>
          </div>
          <div className="rt-stage-row">
            <span className="rt-control-label">Etapa del pedido</span>
            <div aria-label="Cambiar etapa" className="rt-stage-actions" role="group">
              {phaseOrder.map((option) => <button aria-pressed={phase === option} className={phase === option ? "rt-button is-current" : "rt-button"} disabled={pending || phase === option} key={option} onClick={() => onMove(order, option)} type="button">{phaseLabels[option]}</button>)}
              {phase !== "help" && <button className="rt-button is-help" disabled={pending} onClick={() => onMove(order, "help")} type="button"><Icon name="help" /> Requiere ayuda</button>}
              {phase === "help" && <button className="rt-button is-paid" disabled={pending} onClick={() => onResolveHelp(order)} type="button"><Icon name="check" /> {pending ? "Guardando…" : "Solucionado"}</button>}
            </div>
          </div>
        </div>
        <FormDetails order={order} />
        {order.items.length > 0 && <table className="rt-lines">
          <thead><tr><th scope="col">Producto</th><th scope="col">Cantidad</th><th scope="col">Precio</th><th scope="col">Subtotal</th></tr></thead>
          <tbody>{order.items.map((item) => <tr key={item.id}>
            <th scope="row">{item.productName}{item.notes && <small>Pedido: {item.notes}</small>}{item.preparation && <small>Preparación: {item.preparation}</small>}</th>
            <td>{pendingWeight(item) ? <>{quantityFormat.format(item.quantity)} und<small>Peso pendiente</small></> : <>{quantityFormat.format(itemQuantity(item))} kg</>}</td>
            <td>{money.format(item.unitPrice)}<small>por kg</small></td>
            <td>{pendingWeight(item) ? "Por pesar" : money.format(billableQuantity(item) * item.unitPrice)}</td>
          </tr>)}</tbody>
        </table>}
        {order.notes && <div className="rt-note"><strong>Indicaciones</strong><p>{order.notes}</p></div>}
        <section className="rt-totals">
          <div className="rt-payment">
            <span>Pago · {paymentMethodLabel(order)}</span>
            <strong className={paid ? "rt-pill is-paid" : "rt-pill is-pending"}>{paid ? "Pagado" : "Pendiente por pago"}</strong>
          </div>
          <dl>
            {order.items.length > 0 && <div><dt>Subtotal</dt><dd>{money.format(itemsSubtotal(order))}</dd></div>}
            {order.deliveryFee > 0 && <div><dt>Domicilio</dt><dd>{money.format(order.deliveryFee)}</dd></div>}
            {order.adjustments !== 0 && <div><dt>Ajustes</dt><dd>{money.format(order.adjustments)}</dd></div>}
            <div className="rt-grand-total"><dt>Total</dt><dd>{isQuote(order) ? "Por cotizar" : money.format(orderTotal(order))}</dd></div>
          </dl>
        </section>
      </div>
      <ThermalTicket logo={logo} order={order} />
    </div>
  );
}

export function RetailPanel({ orders, pendingId, onMove, onPaymentChange, onResolveHelp, onSave, onSendBill }: { orders: Order[]; pendingId?: string; onMove: (order: Order, phase: OperationalPhase) => void; onPaymentChange: (order: Order, status: "paid" | "pending") => void; onResolveHelp: (order: Order) => void; onSave: (order: Order, details: EditableOrderDetails) => Promise<boolean>; onSendBill: (order: Order) => void }) {
  // "Hoy" se recalcula en cada refresco para que el periodo avance solo al cambiar el día.
  const today = bogotaDay.format(new Date());
  const [preset, setPreset] = useState<RangePreset>("today");
  const [custom, setCustom] = useState<DateRange>({ from: today, to: today });
  const [activePhase, setActivePhase] = useState<OperationalPhase>("new");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const logo = useLogoAvailable();
  const range = presetRange(preset, today, custom);
  const normalized = query.trim().toLocaleLowerCase("es");

  const rangeOrders = useMemo(() => orders.filter((order) => {
    const day = receivedDay(order);
    return day >= range.from && day <= range.to;
  }), [orders, range.from, range.to]);
  const searchedOrders = useMemo(() => rangeOrders.filter((order) => !normalized || `${order.orderNumber} ${order.customer} ${order.businessName ?? ""} ${order.phone} ${order.address}`.toLocaleLowerCase("es").includes(normalized)), [normalized, rangeOrders]);
  const phaseCounts = searchedOrders.reduce<Record<OperationalPhase, number>>((totals, order) => { totals[phaseForStatus(order.status)] += 1; return totals; }, { new: 0, preparing: 0, dispatched: 0, help: 0 });
  const phaseOrders = searchedOrders.filter((order) => phaseForStatus(order.status) === activePhase);
  const paymentCounts: Record<PaymentFilter, number> = { all: phaseOrders.length, paid: phaseOrders.filter(isPaid).length, pending: phaseOrders.filter((order) => !isPaid(order)).length };
  const visibleOrders = phaseOrders.filter((order) => paymentFilter === "all" || (paymentFilter === "paid" ? isPaid(order) : !isPaid(order)));
  const selected = visibleOrders.find((order) => order.id === selectedId) ?? visibleOrders[0];

  // Resumen del periodo: los cancelados no suman ventas.
  const billable = rangeOrders.filter((order) => order.status !== "cancelled");
  const sales = billable.reduce((sum, order) => sum + orderTotal(order), 0);
  const paidOrders = billable.filter(isPaid);
  const collected = paidOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const deliveries = billable.filter((order) => order.fulfillment === "delivery").length;

  // Pedidos sin despachar de días anteriores al periodo, para que no se queden olvidados.
  const staleOpen = orders.filter((order) => phaseForStatus(order.status) !== "dispatched" && order.status !== "cancelled" && receivedDay(order) < range.from);
  const showStale = () => {
    const oldest = staleOpen.reduce((min, order) => receivedDay(order) < min ? receivedDay(order) : min, range.from);
    setCustom({ from: oldest, to: range.to });
    setPreset("custom");
  };

  return (
    <section className="rt-panel">
      <div className="rt-toolbar">
        <div aria-label="Periodo" className="rt-range" role="group">
          <Icon name="calendar" />
          {(Object.keys(rangeLabels) as RangePreset[]).map((option) => <button aria-pressed={preset === option} key={option} onClick={() => { if (option === "custom") setCustom(range); setPreset(option); }} type="button">{rangeLabels[option]}</button>)}
        </div>
        {preset === "custom" && <div className="rt-dates">
          <label>Desde<input max={today} onChange={(event) => event.target.value && setCustom((current) => ({ ...current, from: event.target.value }))} type="date" value={custom.from} /></label>
          <label>Hasta<input max={today} onChange={(event) => event.target.value && setCustom((current) => ({ ...current, to: event.target.value }))} type="date" value={custom.to} /></label>
        </div>}
        <label className="rt-search"><Icon name="search" /><span className="sr-only">Buscar pedido</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, pedido, teléfono o dirección" type="search" value={query} /></label>
        <button className="rt-button" disabled={!rangeOrders.length} onClick={() => void downloadRetailOrders(rangeOrders, range)} title="Descarga todos los pedidos del periodo" type="button"><Icon name="download" /> Descargar Excel</button>
      </div>

      <div aria-label={`Resumen · ${rangeTitle(range)}`} className="rt-summary" role="group">
        <div className="rt-stat rt-stat-period"><span>Periodo</span><strong>{preset === "custom" ? "Personalizado" : rangeLabels[preset]}</strong><small>{rangeTitle(range)}</small></div>
        <div className="rt-stat"><span>Pedidos</span><strong>{billable.length}</strong><small>{deliveries} {deliveries === 1 ? "domicilio" : "domicilios"}</small></div>
        <div className="rt-stat"><span>Ventas</span><strong>{money.format(sales)}</strong><small>Total del periodo</small></div>
        <div className="rt-stat is-paid"><span>Cobrado</span><strong>{money.format(collected)}</strong><small>{paidOrders.length} {paidOrders.length === 1 ? "pedido pagado" : "pedidos pagados"}</small></div>
        <div className="rt-stat is-pending"><span>Por cobrar</span><strong>{money.format(sales - collected)}</strong><small>{billable.length - paidOrders.length} {billable.length - paidOrders.length === 1 ? "pedido pendiente" : "pedidos pendientes"}</small></div>
      </div>

      {staleOpen.length > 0 && <div className="rt-alert" role="status"><Icon name="help" /><span>Hay <b>{staleOpen.length}</b> {staleOpen.length === 1 ? "pedido sin despachar" : "pedidos sin despachar"} de días anteriores a este periodo.</span><button onClick={showStale} type="button">Verlos</button></div>}

      <nav aria-label="Estado de los pedidos" className="rt-phases">
        {(Object.keys(phaseLabels) as OperationalPhase[]).map((phase) => <button aria-pressed={activePhase === phase} className={`phase-${phase}`} key={phase} onClick={() => setActivePhase(phase)} type="button">
          <span>{phase === "help" && <Icon name="help" />}{phaseLabels[phase]}<small>{phaseHints[phase]}</small></span>
          <strong>{phaseCounts[phase]}</strong>
        </button>)}
      </nav>

      <div className="rt-workspace">
        <aside className="rt-list">
          <div className="rt-list-head">
            <div><h2>{phaseLabels[activePhase]}</h2><p>{visibleOrders.length} {visibleOrders.length === 1 ? "pedido" : "pedidos"}</p></div>
            <div aria-label="Filtrar por estado de pago" className="rt-segment" role="group">{(["all", "paid", "pending"] as PaymentFilter[]).map((filter) => <button aria-pressed={paymentFilter === filter} key={filter} onClick={() => setPaymentFilter(filter)} type="button">{paymentFilterLabels[filter]}<b>{paymentCounts[filter]}</b></button>)}</div>
          </div>
          <div className="rt-cards">
            {visibleOrders.map((order) => <OrderCard key={order.id} onSelect={() => setSelectedId(order.id)} order={order} selected={selected?.id === order.id} />)}
            {!visibleOrders.length && <div className="rt-empty"><strong>No hay pedidos aquí</strong><span>{normalized ? "Ningún pedido coincide con la búsqueda." : `No hay pedidos en “${phaseLabels[activePhase]}” para ${preset === "custom" ? "estas fechas" : rangeLabels[preset].toLocaleLowerCase("es")}.`}</span></div>}
          </div>
        </aside>
        <div className="rt-detail-panel">{selected
          ? <OrderDetail key={selected.id} logo={logo} onMove={onMove} onPaymentChange={onPaymentChange} onResolveHelp={onResolveHelp} onSave={onSave} onSendBill={onSendBill} order={selected} pending={pendingId === selected.id} />
          : <div className="rt-empty is-detail"><strong>Selecciona un pedido</strong><span>Cambia el periodo, la fase o el filtro de pago para ver otros pedidos.</span></div>}</div>
      </div>
    </section>
  );
}
