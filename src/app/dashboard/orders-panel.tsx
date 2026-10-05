"use client";

import { useMemo, useState } from "react";

import { logout } from "./actions";

type OrderStatus = "Nuevo" | "Preparando" | "Listo" | "Entregado";

type Order = {
  id: string;
  customer: string;
  phone: string;
  createdAt: string;
  relativeTime: string;
  delivery: "Domicilio" | "Recoge en tienda";
  address: string;
  payment: string;
  total: number;
  status: OrderStatus;
  items: Array<{ name: string; quantity: string; price: number }>;
  notes?: string;
};

const statusOrder: OrderStatus[] = ["Nuevo", "Preparando", "Listo", "Entregado"];

const initialOrders: Order[] = [
  {
    id: "FEN-1048",
    customer: "María Fernanda",
    phone: "+57 310 245 8091",
    createdAt: "12:42 p. m.",
    relativeTime: "Hace 4 min",
    delivery: "Domicilio",
    address: "Cra. 32 # 18-45, Apto. 301",
    payment: "Transferencia",
    total: 94600,
    status: "Nuevo",
    items: [
      { name: "Punta de anca", quantity: "2 kg", price: 58000 },
      { name: "Chorizo artesanal", quantity: "1 kg", price: 21600 },
      { name: "Costilla de cerdo", quantity: "500 g", price: 15000 },
    ],
    notes: "Porcionar la punta de anca en cortes de 250 g.",
  },
  {
    id: "FEN-1047",
    customer: "Carlos Ramírez",
    phone: "+57 300 688 1452",
    createdAt: "12:31 p. m.",
    relativeTime: "Hace 15 min",
    delivery: "Recoge en tienda",
    address: "Sede principal",
    payment: "Efectivo",
    total: 48200,
    status: "Preparando",
    items: [
      { name: "Carne molida especial", quantity: "2 kg", price: 36000 },
      { name: "Hueso carnudo", quantity: "1 kg", price: 12200 },
    ],
  },
  {
    id: "FEN-1046",
    customer: "Juliana Gómez",
    phone: "+57 315 427 9033",
    createdAt: "12:18 p. m.",
    relativeTime: "Hace 28 min",
    delivery: "Domicilio",
    address: "Calle 14 # 8-22",
    payment: "Contraentrega",
    total: 126400,
    status: "Listo",
    items: [
      { name: "Lomo de res", quantity: "2 kg", price: 82000 },
      { name: "Pechuga de pollo", quantity: "2 kg", price: 32400 },
      { name: "Morcilla", quantity: "500 g", price: 12000 },
    ],
  },
  {
    id: "FEN-1045",
    customer: "Andrés Molina",
    phone: "+57 301 902 1148",
    createdAt: "11:54 a. m.",
    relativeTime: "Hace 52 min",
    delivery: "Recoge en tienda",
    address: "Sede principal",
    payment: "Tarjeta",
    total: 65800,
    status: "Entregado",
    items: [
      { name: "Sobrebarriga", quantity: "1.5 kg", price: 43800 },
      { name: "Chicharrón carnudo", quantity: "1 kg", price: 22000 },
    ],
  },
];

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function Icon({ name }: { name: "search" | "clock" | "bag" | "pin" | "user" | "spark" }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    bag: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    spark: <><path d="m12 3 1.25 3.75L17 8l-3.75 1.25L12 13l-1.25-3.75L7 8l3.75-1.25L12 3Z" /><path d="m18.5 14 .75 2.25L21.5 17l-2.25.75L18.5 20l-.75-2.25L15.5 17l2.25-.75L18.5 14Z" /></>,
  };

  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
      {paths[name]}
    </svg>
  );
}

export function OrdersPanel({ email }: { email: string }) {
  const [orders, setOrders] = useState(initialOrders);
  const [activeStatus, setActiveStatus] = useState<"Todos" | OrderStatus>("Todos");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(initialOrders[0].id);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");

    return orders.filter((order) => {
      const matchesStatus = activeStatus === "Todos" || order.status === activeStatus;
      const matchesQuery =
        !normalizedQuery ||
        order.id.toLocaleLowerCase("es").includes(normalizedQuery) ||
        order.customer.toLocaleLowerCase("es").includes(normalizedQuery) ||
        order.phone.includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [activeStatus, orders, query]);

  const selectedOrder =
    orders.find((order) => order.id === selectedId) ?? filteredOrders[0] ?? orders[0];

  const filterByStatus = (status: "Todos" | OrderStatus) => {
    setActiveStatus(status);
    if (status !== "Todos") {
      const firstMatch = orders.find((order) => order.status === status);
      if (firstMatch) setSelectedId(firstMatch.id);
    }
  };

  const advanceOrder = () => {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== selectedOrder.id) return order;
        const currentIndex = statusOrder.indexOf(order.status);
        const nextStatus = statusOrder[Math.min(currentIndex + 1, statusOrder.length - 1)];
        return { ...order, status: nextStatus };
      }),
    );
  };

  const counts = Object.fromEntries(
    statusOrder.map((status) => [status, orders.filter((order) => order.status === status).length]),
  ) as Record<OrderStatus, number>;

  return (
    <div className="orders-app">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark">F</div>
          <div>
            <strong>Fénix Carnes</strong>
            <span>Centro de pedidos</span>
          </div>
        </div>
        <div className="header-actions">
          <span className="connection-state"><i /> Agente IA conectado</span>
          <div className="user-chip" title={email}><Icon name="user" /><span>{email}</span></div>
          <form action={logout}>
            <button className="quiet-button" type="submit">Salir</button>
          </form>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="dashboard-intro">
          <div>
            <p className="eyebrow"><Icon name="spark" /> Operación en tiempo real</p>
            <h1>Pedidos recibidos por el agente</h1>
            <p>Revisa, prepara y entrega cada pedido desde un solo lugar.</p>
          </div>
          <div className="today-summary">
            <span>Ventas de hoy</span>
            <strong>{money.format(335000)}</strong>
            <small>4 pedidos registrados</small>
          </div>
        </section>

        <section aria-label="Resumen de pedidos" className="metrics-grid">
          {statusOrder.map((status, index) => (
            <button className={`metric-card metric-${index}`} key={status} onClick={() => filterByStatus(status)} type="button">
              <span>{status}</span>
              <strong>{counts[status]}</strong>
              <small>{index === 0 ? "Requiere atención" : index === 3 ? "Completado" : "En operación"}</small>
            </button>
          ))}
        </section>

        <section className="workspace-card">
          <div className="orders-column">
            <div className="orders-toolbar">
              <div>
                <h2>Pedidos</h2>
                <span>{filteredOrders.length} visibles</span>
              </div>
              <label className="search-field">
                <span className="sr-only">Buscar pedido</span>
                <Icon name="search" />
                <input onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente o pedido" type="search" value={query} />
              </label>
            </div>

            <div aria-label="Filtrar por estado" className="status-filters">
              {(["Todos", ...statusOrder] as const).map((status) => (
                <button aria-pressed={activeStatus === status} key={status} onClick={() => filterByStatus(status)} type="button">{status}</button>
              ))}
            </div>

            <div className="orders-list">
              {filteredOrders.map((order) => (
                <button className={`order-row ${selectedOrder.id === order.id ? "is-selected" : ""}`} key={order.id} onClick={() => setSelectedId(order.id)} type="button">
                  <div className="order-row-top">
                    <strong>{order.customer}</strong>
                    <span className={`status-badge status-${order.status.toLocaleLowerCase("es")}`}>{order.status}</span>
                  </div>
                  <div className="order-meta"><span>{order.id}</span><span>{order.relativeTime}</span></div>
                  <div className="order-row-bottom">
                    <span><Icon name="bag" /> {order.items.length} productos</span>
                    <strong>{money.format(order.total)}</strong>
                  </div>
                </button>
              ))}
              {!filteredOrders.length && <div className="empty-state"><strong>No encontramos pedidos</strong><span>Prueba con otro filtro o término de búsqueda.</span></div>}
            </div>
          </div>

          <aside className="detail-column">
            <div className="detail-heading">
              <div><span>Detalle del pedido</span><h2>{selectedOrder.id}</h2></div>
              <span className={`status-badge status-${selectedOrder.status.toLocaleLowerCase("es")}`}>{selectedOrder.status}</span>
            </div>

            <div className="customer-card">
              <div className="avatar">{selectedOrder.customer.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
              <div><strong>{selectedOrder.customer}</strong><span>{selectedOrder.phone}</span></div>
            </div>

            <dl className="detail-facts">
              <div><dt><Icon name="clock" /> Hora</dt><dd>{selectedOrder.createdAt}</dd></div>
              <div><dt><Icon name="pin" /> Entrega</dt><dd>{selectedOrder.delivery}<small>{selectedOrder.address}</small></dd></div>
              <div><dt>Pago</dt><dd>{selectedOrder.payment}</dd></div>
            </dl>

            <div className="items-block">
              <h3>Productos</h3>
              {selectedOrder.items.map((item) => (
                <div className="line-item" key={item.name}>
                  <div><strong>{item.name}</strong><span>{item.quantity}</span></div>
                  <span>{money.format(item.price)}</span>
                </div>
              ))}
              <div className="order-total"><span>Total</span><strong>{money.format(selectedOrder.total)}</strong></div>
            </div>

            {selectedOrder.notes && <div className="notes-box"><strong>Indicaciones</strong><p>{selectedOrder.notes}</p></div>}

            <button className="primary-action" disabled={selectedOrder.status === "Entregado"} onClick={advanceOrder} type="button">
              {selectedOrder.status === "Entregado" ? "Pedido completado" : `Marcar como ${statusOrder[statusOrder.indexOf(selectedOrder.status) + 1]}`}
            </button>
            <p className="demo-caption">Vista demostrativa. Los cambios todavía no se guardan en la base de datos.</p>
          </aside>
        </section>
      </main>
    </div>
  );
}
