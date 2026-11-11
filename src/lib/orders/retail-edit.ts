export function formatRetailNumberInput(value: number) {
  if (!Number.isFinite(value) || value === 0) return "";
  return String(value).replace(".", ",");
}

export function parseRetailNumberInput(value: string, emptyValue = Number.NaN) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return emptyValue;
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}
