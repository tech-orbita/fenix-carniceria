import type { Order, OrderStatus } from "./types";

export type OperationalPhase = "new" | "preparing" | "dispatched" | "help";

export const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export const dateTime = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

export const bogotaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" });
export const dayLabel = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
export const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(day: string, amount: number) {
  return new Date(new Date(`${day}T12:00:00Z`).getTime() + amount * DAY_MS).toISOString().slice(0, 10);
}

export function isPaid(order: Order) {
  return ["paid", "verified", "pagado", "verificado"].includes(order.paymentStatus.toLocaleLowerCase("es"));
}

export const phaseOrder: OperationalPhase[] = ["new", "preparing", "dispatched"];
export const phaseLabels: Record<OperationalPhase, string> = {
  new: "Nuevos",
  preparing: "En preparación",
  dispatched: "Despachados",
  help: "Requiere ayuda",
};
export const phaseStatus: Record<OperationalPhase, OrderStatus> = {
  new: "received",
  preparing: "preparing",
  dispatched: "dispatched",
  help: "incident",
};

export function phaseForStatus(status: OrderStatus): OperationalPhase {
  if (["needs_review", "incident", "cancelled"].includes(status)) return "help";
  if (["preparing", "ready"].includes(status)) return "preparing";
  if (["dispatched", "delivered"].includes(status)) return "dispatched";
  return "new";
}

export function orderTotal(order: Order) {
  return order.items.reduce((total, item) => total + (item.actualQuantity ?? item.quantity) * item.unitPrice, order.deliveryFee + order.adjustments);
}

export function whatsappUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  const international = digits.length === 10 ? `57${digits}` : digits;
  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}

export type IconName = "address" | "calendar" | "chat" | "check" | "copy" | "download" | "edit" | "filter" | "help" | "print" | "receipt" | "search" | "shop" | "truck";

export function Icon({ name }: { name: IconName }) {
  const paths = {
    filter: <path d="M3 5h18l-7 8v6l-4 2v-8Z" />,
    address: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    calendar: <><rect height="17" rx="2" width="18" x="3" y="4" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></>,
    check: <path d="m5 12 5 5L20 7" />,
    copy: <><rect height="13" rx="2" width="13" x="8" y="8" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.3 1-1.3 1.7" /><path d="M12 17h.01" /></>,
    print: <><path d="M7 8V3h10v5" /><path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7z" /></>,
    receipt: <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    shop: <><path d="M4 10v11h16V10" /><path d="M3 10 5 3h14l2 7" /><path d="M8 21v-7h8v7" /></>,
    truck: <><path d="M3 6h11v10H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
  };
  return <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">{paths[name]}</svg>;
}
