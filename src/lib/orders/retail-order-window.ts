const BOGOTA_OFFSET = "-05:00";
const CUTOFF_HOUR = 14;
const DAY_MS = 24 * 60 * 60 * 1_000;

function bogotaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function previousDay(day: string) {
  return new Date(new Date(`${day}T12:00:00Z`).getTime() - DAY_MS).toISOString().slice(0, 10);
}

function nextDay(day: string) {
  return new Date(new Date(`${day}T12:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10);
}

// Cada ventana operativa va de las 2:00 p. m. de un día a las 1:59:59 p. m. del siguiente.
// Después de la hora de corte nunca se modifica automáticamente el pedido de la ventana anterior.
export function retailOrderWindowStart(now = new Date()) {
  const parts = bogotaParts(now);
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const windowDay = Number(parts.hour) >= CUTOFF_HOUR ? day : previousDay(day);
  return new Date(`${windowDay}T14:00:00${BOGOTA_OFFSET}`).toISOString();
}

export function belongsToCurrentRetailWindow(receivedAt: string, now = new Date()) {
  const received = new Date(receivedAt);
  return !Number.isNaN(received.getTime()) && received >= new Date(retailOrderWindowStart(now));
}

// El panel nombra la ventana por el día en que se prepara: un pedido recibido
// después de las 2 p. m. pertenece operativamente al día siguiente. Así, por
// ejemplo, un pedido del lunes a las 5 p. m. sigue visible en "Hoy" el martes.
export function retailServiceDay(receivedAt: string) {
  const received = new Date(receivedAt);
  if (Number.isNaN(received.getTime())) return "";
  const parts = bogotaParts(received);
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return Number(parts.hour) >= CUTOFF_HOUR ? nextDay(day) : day;
}

export function retailDeliveryDay(receivedAt: string, requestedDeliveryDate?: string) {
  if (requestedDeliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDeliveryDate)) return requestedDeliveryDate;
  return retailServiceDay(receivedAt);
}
