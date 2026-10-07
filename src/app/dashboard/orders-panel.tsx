"use client";

import ExcelJS from "exceljs";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import { updateOrderDetails, updateOrderStatus } from "./actions";
import type { CustomerType, Order, OrderStatus } from "./types";

type OperationalPhase = "new" | "preparing" | "dispatched" | "help";
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
const dateTime = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });

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
      <span className="workflow-card-topline"><strong>{order.businessName ?? order.customer}</strong><b>{money.format(orderTotal(order))}</b></span>
      <span className="workflow-card-meta">{order.orderNumber} · {dateTime.format(new Date(order.receivedAt))}</span>
      <span className="workflow-card-address"><Icon name="address" />{order.address}</span>
      <span className="workflow-card-bottom"><span>{order.items.length} productos</span><span>{order.fulfillment === "delivery" ? order.route : "Recoge en tienda"}</span></span>
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
      <div className="ticket-rule" /><div className="ticket-total"><span>TOTAL</span><strong>{money.format(orderTotal(order))}</strong></div>
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

function OrderDetail({ order, pending, onMove, onSave }: { order: Order; pending: boolean; onMove: (order: Order, phase: OperationalPhase) => void; onSave: (order: Order, details: EditableOrderDetails) => Promise<boolean> }) {
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
      <div className="retail-lines"><div className="line-heading"><span>Producto</span><span>Cant. / preparación</span><span>Subtotal</span></div>{order.items.map((item) => <div className="retail-line" key={item.id}><strong>{item.productName}</strong><span>{item.actualQuantity ?? item.quantity} {item.unit}<small>{item.preparation ?? "Sin indicaciones especiales"}</small></span><b>{money.format((item.actualQuantity ?? item.quantity) * item.unitPrice)}</b></div>)}</div>
      {order.notes && <div className="order-note"><strong>Indicaciones</strong><p>{order.notes}</p></div>}
      <div className="payment-summary"><div><span>Pago</span><strong>{order.paymentMethod ?? "Por definir"}</strong><small>{order.paymentStatus}</small></div><div><span>Total</span><strong>{money.format(orderTotal(order))}</strong></div></div>
      <div className="workflow-actions">
        <button className="outline-action" onClick={() => window.print()} type="button"><Icon name="print" /> Imprimir</button>
        {phase === "help" ? <button className="outline-action" disabled={pending} onClick={() => onMove(order, "new")} type="button">Enviar a Nuevos</button> : <>{previousPhase && <button className="outline-action" disabled={pending} onClick={() => onMove(order, previousPhase)} type="button">← {phaseLabels[previousPhase]}</button>}{nextPhase && <button className="primary-action" disabled={pending} onClick={() => onMove(order, nextPhase)} type="button">{pending ? "Guardando…" : `Mover a ${phaseLabels[nextPhase]}`} →</button>}</>}
        {phase !== "help" && <button className="help-action" disabled={pending} onClick={() => onMove(order, "help")} type="button"><Icon name="help" /> Requiere ayuda</button>}
      </div>
      <ThermalTicket order={order} />
    </div>
  );
}

async function downloadWholesaleOrders(orders: Order[], phase: OperationalPhase) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Pedidos mayoristas");
  worksheet.columns = [
    { header: "Pedido", key: "order", width: 18 }, { header: "Cliente", key: "customer", width: 28 },
    { header: "Teléfono", key: "phone", width: 18 }, { header: "Dirección", key: "address", width: 36 },
    { header: "Ruta", key: "route", width: 20 }, { header: "Productos", key: "items", width: 55 }, { header: "Total", key: "total", width: 16 },
  ];
  orders.forEach((order) => worksheet.addRow({ order: order.orderNumber, customer: order.businessName ?? order.customer, phone: order.phone, address: order.address, route: order.route, items: order.items.map((item) => `${item.productName}: ${item.actualQuantity ?? item.quantity} ${item.unit}`).join(" · "), total: orderTotal(order) }));
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1769E0" } };
  worksheet.getColumn("total").numFmt = "$#,##0";
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a"); link.href = url; link.download = `pedidos-mayoristas-${phase}.xlsx`; link.click(); URL.revokeObjectURL(url);
}

function OrdersWorkspace({ activePhase, customerType, orders, pendingId, onMove, onSave }: { activePhase: OperationalPhase; customerType: CustomerType; orders: Order[]; pendingId?: string; onMove: (order: Order, phase: OperationalPhase) => void; onSave: (order: Order, details: EditableOrderDetails) => Promise<boolean> }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const normalized = query.trim().toLocaleLowerCase("es");
  const visibleOrders = useMemo(() => orders.filter((order) => phaseForStatus(order.status) === activePhase && (!normalized || `${order.orderNumber} ${order.customer} ${order.businessName ?? ""} ${order.phone} ${order.address}`.toLocaleLowerCase("es").includes(normalized))), [activePhase, normalized, orders]);
  const selected = visibleOrders.find((order) => order.id === selectedId) ?? visibleOrders[0];
  return (
    <section className="workflow-workspace">
      <aside className="workflow-list-panel">
        <div className="workflow-list-heading"><div><span className="section-kicker">{customerType === "wholesale" ? "Canal mayorista" : "Consumo hogar"}</span><h2>{phaseLabels[activePhase]}</h2><p>{visibleOrders.length} {visibleOrders.length === 1 ? "pedido" : "pedidos"}</p></div>{customerType === "wholesale" && <button className="icon-action" onClick={() => void downloadWholesaleOrders(visibleOrders, activePhase)} title="Descargar esta lista" type="button"><Icon name="download" /><span className="sr-only">Descargar esta lista</span></button>}</div>
        <label className="search-control"><Icon name="search" /><span className="sr-only">Buscar pedido</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Cliente, pedido, teléfono o dirección" type="search" value={query} /></label>
        <div className="workflow-card-list">{visibleOrders.map((order) => <OrderCard key={order.id} onSelect={() => setSelectedId(order.id)} order={order} selected={selected?.id === order.id} />)}{!visibleOrders.length && <div className="workflow-empty"><strong>No hay pedidos aquí</strong><span>Cuando un pedido llegue a esta fase aparecerá en esta lista.</span></div>}</div>
      </aside>
      <div className="workflow-detail-panel">{selected ? <OrderDetail key={selected.id} onMove={onMove} onSave={onSave} order={selected} pending={pendingId === selected.id} /> : <div className="workflow-empty detail-empty"><strong>Selecciona otra fase</strong><span>No hay un pedido para mostrar en esta bandeja.</span></div>}</div>
    </section>
  );
}

export function OrdersPanel({ demo, initialOrders }: { demo: boolean; initialOrders: Order[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [activeType, setActiveType] = useState<CustomerType>("wholesale");
  const [activePhase, setActivePhase] = useState<OperationalPhase>("new");
  const [pendingId, setPendingId] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const typeOrders = orders.filter((order) => order.customerType === activeType);
  const wholesale = orders.filter((order) => order.customerType === "wholesale");
  const retail = orders.filter((order) => order.customerType === "retail");
  const counts = typeOrders.reduce<Record<OperationalPhase, number>>((totals, order) => { const phase = phaseForStatus(order.status); totals[phase] += 1; return totals; }, { new: 0, preparing: 0, dispatched: 0, help: 0 });

  const moveOrder = async (order: Order, phase: OperationalPhase) => {
    const status = phaseStatus[phase]; setPendingId(order.id); setNotice(undefined);
    if (!demo) { const result = await updateOrderStatus(order.id, status); if (!result.ok) { setNotice(result.message); setPendingId(undefined); return; } }
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item));
    setNotice(`${order.orderNumber} pasó a “${phaseLabels[phase]}”.`); setPendingId(undefined);
  };

  const saveOrder = async (order: Order, details: EditableOrderDetails) => {
    setPendingId(order.id); setNotice(undefined);
    if (!demo) {
      const result = await updateOrderDetails(order.id, details);
      if (!result.ok) { setNotice(result.message); setPendingId(undefined); return false; }
    }
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

  return (
    <div className="orders-app"><main className="dashboard-content">
      <section className="dashboard-intro"><div><p className="eyebrow">Centro de pedidos</p><h1>Cada pedido, en el momento correcto.</h1><p>Revisa conversaciones, prepara pedidos y coordina despachos desde una sola vista.</p></div>{demo && <span className="demo-badge">Datos de demostración</span>}</section>
      <section aria-label="Tipo de cliente" className="segment-switch"><button aria-pressed={activeType === "wholesale"} onClick={() => setActiveType("wholesale")} type="button"><Icon name="truck" /><span><strong>Mayoristas</strong><small>{wholesale.length} pedidos de negocios</small></span></button><button aria-pressed={activeType === "retail"} onClick={() => setActiveType("retail")} type="button"><Icon name="shop" /><span><strong>Minoristas</strong><small>{retail.length} pedidos de hogares</small></span></button></section>
      <PhaseNavigation activePhase={activePhase} counts={counts} onChange={setActivePhase} />
      {notice && <div className="operation-notice" role="status">{notice}</div>}
      <OrdersWorkspace activePhase={activePhase} customerType={activeType} onMove={(order, phase) => void moveOrder(order, phase)} onSave={saveOrder} orders={typeOrders} pendingId={pendingId} />
    </main></div>
  );
}
