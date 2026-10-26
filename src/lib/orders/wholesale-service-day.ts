const bogotaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const SERVICE_DAY_CUTOFF_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(day: string, amount: number) {
  return new Date(new Date(`${day}T12:00:00Z`).getTime() + amount * DAY_MS).toISOString().slice(0, 10);
}

function nextMonday(day: string) {
  let result = day;
  while (new Date(`${result}T12:00:00Z`).getUTCDay() !== 1) result = addDays(result, 1);
  return result;
}

// Algoritmo gregoriano de Meeus/Jones/Butcher para calcular el domingo de Pascua.
function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function colombianHolidays(year: number) {
  const easter = easterSunday(year);
  const fixed = ["01-01", "05-01", "07-20", "08-07", "12-08", "12-25"].map((date) => `${year}-${date}`);
  const mondayized = ["01-06", "03-19", "06-29", "08-15", "10-12", "11-01", "11-11"]
    .map((date) => nextMonday(`${year}-${date}`));
  const easterBased = [-3, -2, 43, 64, 71].map((days) => addDays(easter, days));
  return new Set([...fixed, ...mondayized, ...easterBased]);
}

export function isWholesaleOperatingDay(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  return date.getUTCDay() !== 0 && !colombianHolidays(date.getUTCFullYear()).has(day);
}

export function wholesaleServiceDay(receivedAt: string, requestedDeliveryDay?: string) {
  if (requestedDeliveryDay) return requestedDeliveryDay;
  let day = bogotaDay.format(new Date(new Date(receivedAt).getTime() - SERVICE_DAY_CUTOFF_MS + DAY_MS));
  while (!isWholesaleOperatingDay(day)) day = addDays(day, 1);
  return day;
}
