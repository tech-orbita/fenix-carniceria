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
