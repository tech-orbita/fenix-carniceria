"use client";

import ExcelJS from "exceljs";
import { useState, useTransition } from "react";

import { updateOrderStatus } from "./actions";
import type { CustomerType, Order, OrderStatus } from "./types";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const labels: Record<OrderStatus, string> = {
  needs_review: "Revisar",
  received: "Recibido",
  quoted: "Cotizado",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Listo",
  dispatched: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  incident: "Incidencia",
};

const retailFlow: OrderStatus[] = ["received", "quoted", "confirmed", "preparing", "ready", "dispatched", "delivered"];
const wholesaleFlow: OrderStatus[] = ["received", "confirmed", "preparing", "ready", "dispatched", "delivered"];

const wholesaleZones = [
  "Riomar",
  "Norte-Centro Histórico",
  "Metropolitana",
  "Suroccidente",
  "Suroriente",
] as const;

const wholesaleProducts = [
  "Carne blanda",
  "Espaldilla",
  "Molida especial",
  "Atravesado",
  "Costilla",
  "Hueso carnudo",
  "Costilla de cerdo",
  "Pulpa de cerdo",
  "Panceta",
  "Filete de pechuga",
  "Pechuga congelada",
  "Pernil mixto (contramuslo)",
  "Muslo",
] as const;

function orderTotal(order: Order) {
  return order.items.reduce(
    (total, item) => total + (item.actualQuantity ?? item.quantity) * item.unitPrice,
    order.deliveryFee + order.adjustments,
  );
}

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function zoneFor(order: Order) {
  const route = normalizeLabel(order.route);
  if (route.includes("riomar")) return "Riomar";
  if (route.includes("norte") || route.includes("centro") || route.includes("historico")) return "Norte-Centro Histórico";
  if (route.includes("metropolitana") || route.includes("soledad")) return "Metropolitana";
  if (route.includes("suroccidente") || route.includes("sur occidente") || route === "sur") return "Suroccidente";
  if (route.includes("suroriente") || route.includes("sur oriente") || route.includes("oriente")) return "Suroriente";
  return order.route;
}

function productMatches(productName: string, product: (typeof wholesaleProducts)[number]) {
  const name = normalizeLabel(productName);
  const aliases: Record<(typeof wholesaleProducts)[number], string[]> = {
    "Carne blanda": ["carne blanda", "blanda"],
    Espaldilla: ["espaldilla"],
    "Molida especial": ["molida especial"],
    Atravesado: ["atravesado", "pollo atravesado"],
    Costilla: ["costilla"],
    "Hueso carnudo": ["hueso carnudo", "hueso"],
    "Costilla de cerdo": ["costilla de cerdo"],
    "Pulpa de cerdo": ["pulpa de cerdo"],
    Panceta: ["panceta"],
    "Filete de pechuga": ["filete de pechuga", "filete pechuga"],
    "Pechuga congelada": ["pechuga congelada"],
    "Pernil mixto (contramuslo)": ["pernil mixto", "contramuslo"],
    Muslo: ["muslo"],
  };
  if (product === "Costilla") return name === "costilla";
  return aliases[product].some((alias) => name === alias || name.includes(alias));
}

function Icon({ name }: { name: "search" | "download" | "print" | "user" | "truck" | "shop" }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    print: <><path d="M7 8V3h10v5" /><path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7z" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    truck: <><path d="M3 6h11v10H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
    shop: <><path d="M4 10v11h16V10" /><path d="M3 10 5 3h14l2 7" /><path d="M8 21v-7h8v7" /></>,
  };

  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
      {paths[name]}
    </svg>
  );
}

function WholesaleMatrix({ orders, onAdvance, pendingId }: { orders: Order[]; onAdvance: (order: Order) => void; pendingId?: string }) {
  const [zone, setZone] = useState("Todas las zonas");
  const visible = zone === "Todas las zonas" ? orders : orders.filter((order) => zoneFor(order) === zone);
  const products = wholesaleProducts;

  const quantityFor = (order: Order, product: string) => {
    const item = order.items.find((candidate) => productMatches(candidate.productName, product as (typeof wholesaleProducts)[number]));
    return item ? `${item.actualQuantity ?? item.quantity} ${item.unit}` : "";
  };

  const quantityTotal = (product: string) => visible.reduce((total, order) => {
    const item = order.items.find((candidate) => productMatches(candidate.productName, product as (typeof wholesaleProducts)[number]));
    return total + (item?.actualQuantity ?? item?.quantity ?? 0);
  }, 0);

  const download = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Orbita IA";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("Planilla mayoristas", {
      views: [{ state: "frozen", ySplit: 1, xSplit: 2, showGridLines: true }],
    });
    worksheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalDpi: 300,
      verticalDpi: 300,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };
    worksheet.pageSetup.printTitlesRow = "1:1";

    const headers = ["Zona", "Cliente", "Pedido", "Estado", ...products];
    worksheet.addRow(headers);
    visible.forEach((order) => {
      worksheet.addRow([
        zoneFor(order),
        order.businessName ?? order.customer,
        order.orderNumber,
        labels[order.status],
        ...products.map((product) => quantityFor(order, product)),
      ]);
    });
    worksheet.addRow(["", "TOTAL A PREPARAR", "", "", ...products.map((product) => quantityTotal(product))]);

    const lastRow = worksheet.rowCount;
    const lastColumn = worksheet.columnCount;
    const tableRange = `A1:${worksheet.getColumn(lastColumn).letter}${lastRow}`;
    const headerFill = "1769E0";
    const border = { style: "thin" as const, color: { argb: "FFD9E2F0" } };
    const allBorders = { top: border, left: border, bottom: border, right: border };

    worksheet.getRow(1).height = 30;
    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerFill } };
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = allBorders;
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.height = 22;
      row.eachCell((cell, columnNumber) => {
        cell.font = { name: "Arial", size: 10, color: { argb: "FF0B1736" } };
        cell.alignment = { horizontal: columnNumber <= 4 ? "left" : "center", vertical: "middle" };
        cell.border = allBorders;
      });
    });

    const totalRow = worksheet.getRow(lastRow);
    totalRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0B1736" } };
    totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF2FF" } };
    totalRow.eachCell((cell, columnNumber) => {
      cell.alignment = { horizontal: columnNumber <= 4 ? "left" : "center", vertical: "middle" };
      cell.border = allBorders;
    });

    const widths = [24, 28, 16, 17, ...products.map((product) => Math.max(16, Math.min(23, product.length + 4)))];
    widths.forEach((width, index) => { worksheet.getColumn(index + 1).width = width; });
    worksheet.autoFilter = { from: "A1", to: `${worksheet.getColumn(lastColumn).letter}${Math.max(1, lastRow - 1)}` };
    worksheet.pageSetup.printArea = tableRange;

    const buffer = await workbook.xlsx.writeBuffer();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    link.download = `planilla-mayoristas-${zone.toLocaleLowerCase("es").replaceAll(" ", "-")}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section className="wholesale-workspace">
      <div className="section-toolbar">
        <div><span className="section-kicker">Planilla mayorista</span><h2>Clientes × productos</h2><p>Consolidado para preparar y despachar por ruta.</p></div>
        <div className="toolbar-actions">
          <label><span className="sr-only">Filtrar por zona</span><select onChange={(event) => setZone(event.target.value)} value={zone}>{["Todas las zonas", ...wholesaleZones].map((item) => <option key={item}>{item}</option>)}</select></label>
          <button className="outline-action" onClick={() => void download()} type="button"><Icon name="download" /> Descargar Excel</button>
          <button className="outline-action" onClick={() => window.print()} type="button"><Icon name="print" /> Imprimir</button>
        </div>
      </div>

      <div className="route-strip">
        {wholesaleZones.map((item) => (
          <button className={zone === item ? "is-active" : ""} key={item} onClick={() => setZone(item)} type="button"><span>{item}</span><strong>{orders.filter((order) => zoneFor(order) === item).length}</strong></button>
        ))}
      </div>

      <div className="matrix-scroll">
        <table className="order-matrix">
          <thead><tr><th>Cliente</th><th>Estado</th>{products.map((product) => <th key={product}>{product}</th>)}<th>Acción</th></tr></thead>
          <tbody>
            {visible.map((order) => (
              <tr key={order.id}>
                <th><strong>{order.businessName ?? order.customer}</strong><small>{order.orderNumber} · {zoneFor(order)}</small></th>
                <td><span className={`status-pill status-${order.status}`}>{labels[order.status]}</span></td>
                {products.map((product) => <td key={product}>{quantityFor(order, product)}</td>)}
                <td><button className="matrix-action" disabled={order.status === "delivered" || pendingId === order.id} onClick={() => onAdvance(order)} type="button">{order.status === "delivered" ? "Completo" : pendingId === order.id ? "Guardando…" : "Avanzar"}</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><th>Total a preparar</th><td />{products.map((product) => <td key={product}>{quantityTotal(product)}</td>)}<td /></tr></tfoot>
        </table>
        {!visible.length && <div className="empty-state">No hay pedidos mayoristas para esta ruta.</div>}
      </div>
      <p className="matrix-note">La descarga incluye las zonas de Barranquilla y las columnas fijas de productos para impresión.</p>
    </section>
  );
}

function ThermalTicket({ order }: { order: Order }) {
  return (
    <article className="thermal-ticket" aria-label={`Comanda ${order.orderNumber}`}>
      <div className="ticket-brand"><strong>FÉNIX J.A.</strong><span>COMANDA DE PEDIDO</span></div>
      <div className="ticket-rule" />
      <dl className="ticket-meta">
        <div><dt>Pedido</dt><dd>{order.orderNumber}</dd></div>
        <div><dt>Fecha</dt><dd>{dateTime.format(new Date(order.receivedAt))}</dd></div>
        <div><dt>Cliente</dt><dd>{order.customer}</dd></div>
        <div><dt>Tel.</dt><dd>{order.phone}</dd></div>
        <div><dt>Entrega</dt><dd>{order.fulfillment === "delivery" ? "Domicilio" : "Recoge"}</dd></div>
      </dl>
      <div className="ticket-rule" />
      {order.items.map((item) => (
        <div className="ticket-line" key={item.id}>
          <strong>{item.productName}</strong><span>{item.actualQuantity ?? item.quantity} {item.unit} × {money.format(item.unitPrice)}</span><b>{money.format((item.actualQuantity ?? item.quantity) * item.unitPrice)}</b>
          {item.preparation && <small>{item.preparation}</small>}
        </div>
      ))}
      <div className="ticket-rule" />
      <div className="ticket-total"><span>TOTAL</span><strong>{money.format(orderTotal(order))}</strong></div>
      {order.notes && <p className="ticket-notes"><b>Nota:</b> {order.notes}</p>}
      <p className="ticket-address">{order.address}</p>
      <p className="ticket-footer">Comprobante de pedido · No es factura electrónica</p>
    </article>
  );
}

function RetailOrders({ orders, onAdvance, pendingId }: { orders: Order[]; onAdvance: (order: Order) => void; pendingId?: string }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(orders[0]?.id ?? "");
  const normalized = query.trim().toLocaleLowerCase("es");
  const visible = orders.filter((order) => !normalized || `${order.orderNumber} ${order.customer} ${order.phone}`.toLocaleLowerCase("es").includes(normalized));
  const selected = orders.find((order) => order.id === selectedId) ?? visible[0];

  if (!selected) return <section className="empty-panel">No hay pedidos minoristas registrados.</section>;

  const flow = selected.fulfillment === "pickup" ? retailFlow.filter((status) => status !== "dispatched") : retailFlow;
  const currentIndex = flow.indexOf(selected.status);
  const nextStatus = flow[Math.min(Math.max(currentIndex, 0) + 1, flow.length - 1)];

  return (
    <section className="retail-workspace">
      <div className="retail-list-panel">
        <div className="retail-list-head"><div><span className="section-kicker">Consumo hogar</span><h2>Pedidos minoristas</h2></div><label className="search-control"><Icon name="search" /><span className="sr-only">Buscar</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Cliente o pedido" type="search" value={query} /></label></div>
        <div className="retail-orders">
          {visible.map((order) => (
            <button className={selected.id === order.id ? "retail-order is-selected" : "retail-order"} key={order.id} onClick={() => setSelectedId(order.id)} type="button">
              <div><strong>{order.customer}</strong><span>{order.orderNumber} · {dateTime.format(new Date(order.receivedAt))}</span></div>
              <span className={`status-pill status-${order.status}`}>{labels[order.status]}</span>
              <p>{order.items.length} productos · {order.fulfillment === "delivery" ? order.route : "Recoge"}</p><b>{money.format(orderTotal(order))}</b>
            </button>
          ))}
        </div>
      </div>

      <div className="retail-detail-panel">
        <div className="detail-topline"><div><span>Pedido seleccionado</span><h2>{selected.orderNumber}</h2></div><span className={`status-pill status-${selected.status}`}>{labels[selected.status]}</span></div>
        <div className="customer-summary"><div className="customer-avatar">{selected.customer.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><strong>{selected.customer}</strong><span>{selected.phone}</span></div><div className="delivery-chip">{selected.fulfillment === "delivery" ? <Icon name="truck" /> : <Icon name="shop" />}<span>{selected.fulfillment === "delivery" ? "Domicilio" : "Recoge"}</span></div></div>
        <p className="delivery-address">{selected.address}</p>
        <div className="retail-lines">
          <div className="line-heading"><span>Producto</span><span>Cant. / preparación</span><span>Subtotal</span></div>
          {selected.items.map((item) => <div className="retail-line" key={item.id}><strong>{item.productName}</strong><span>{item.actualQuantity ?? item.quantity} {item.unit}<small>{item.preparation ?? "Sin indicaciones especiales"}</small></span><b>{money.format((item.actualQuantity ?? item.quantity) * item.unitPrice)}</b></div>)}
        </div>
        {selected.notes && <div className="order-note"><strong>Indicaciones</strong><p>{selected.notes}</p></div>}
        <div className="payment-summary"><div><span>Pago</span><strong>{selected.paymentMethod ?? "Por definir"}</strong><small>{selected.paymentStatus}</small></div><div><span>Total</span><strong>{money.format(orderTotal(selected))}</strong></div></div>
        <div className="detail-actions"><button className="outline-action" onClick={() => window.print()} type="button"><Icon name="print" /> Imprimir comanda</button><button className="primary-action" disabled={selected.status === "delivered" || pendingId === selected.id} onClick={() => onAdvance(selected)} type="button">{selected.status === "delivered" ? "Pedido completado" : pendingId === selected.id ? "Guardando…" : `Marcar como ${labels[nextStatus]}`}</button></div>
        <ThermalTicket order={selected} />
      </div>
    </section>
  );
}

export function OrdersPanel({ demo, initialOrders }: { demo: boolean; initialOrders: Order[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [activeType, setActiveType] = useState<CustomerType>("wholesale");
  const [pendingId, setPendingId] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [, startTransition] = useTransition();

  const wholesale = orders.filter((order) => order.customerType === "wholesale");
  const retail = orders.filter((order) => order.customerType === "retail");
  const deliveredToday = orders.filter((order) => order.status === "delivered");
  const todaySales = deliveredToday.reduce((total, order) => total + orderTotal(order), 0);

  const advance = (order: Order) => {
    const baseFlow = order.customerType === "wholesale" ? wholesaleFlow : retailFlow;
    const flow = order.fulfillment === "pickup" ? baseFlow.filter((status) => status !== "dispatched") : baseFlow;
    const currentIndex = flow.indexOf(order.status);
    const next = flow[Math.min(Math.max(currentIndex, 0) + 1, flow.length - 1)];
    if (next === order.status) return;

    setPendingId(order.id);
    setNotice(undefined);
    startTransition(async () => {
      if (!demo) {
        const result = await updateOrderStatus(order.id, next);
        if (!result.ok) { setNotice(result.message); setPendingId(undefined); return; }
      }
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: next } : item));
      setNotice(`El pedido ${order.orderNumber} quedó como ${labels[next].toLocaleLowerCase("es")}.`);
      setPendingId(undefined);
    });
  };

  return (
    <div className="orders-app">
      <main className="dashboard-content">
        <section className="dashboard-intro"><div><p className="eyebrow">Operación del día</p><h1>Todos los pedidos, listos para coordinar.</h1><p>El administrador recibe, prepara, imprime y marca cada envío desde aquí.</p></div><div className="today-summary"><span>Ventas entregadas</span><strong>{money.format(todaySales)}</strong><small>{deliveredToday.length} pedidos completados</small></div></section>
        <section className="metrics-grid" aria-label="Resumen de pedidos">
          <article className="metric-card metric-0"><span>Pedidos activos</span><strong>{orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length}</strong><small>En operación</small></article>
          <article className="metric-card"><span>Nuevos hoy</span><strong>{orders.filter((order) => new Date(order.receivedAt).toDateString() === new Date().toDateString()).length}</strong><small>Recibidos por el agente</small></article>
          <article className="metric-card"><span>Por preparar</span><strong>{orders.filter((order) => ["received", "confirmed", "preparing"].includes(order.status)).length}</strong><small>Requieren atención</small></article>
        </section>
        <section className="segment-switch" aria-label="Tipo de pedido">
          <button aria-pressed={activeType === "wholesale"} onClick={() => setActiveType("wholesale")} type="button"><Icon name="truck" /><span><strong>Mayoristas</strong><small>{wholesale.length} pedidos · planilla por ruta</small></span></button>
          <button aria-pressed={activeType === "retail"} onClick={() => setActiveType("retail")} type="button"><Icon name="shop" /><span><strong>Minoristas</strong><small>{retail.length} pedidos · comanda térmica</small></span></button>
        </section>
        {notice && <div className="operation-notice" role="status">{notice}</div>}
        {activeType === "wholesale" ? <WholesaleMatrix onAdvance={advance} orders={wholesale} pendingId={pendingId} /> : <RetailOrders onAdvance={advance} orders={retail} pendingId={pendingId} />}
      </main>
    </div>
  );
}
