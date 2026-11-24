export const wholesaleRoutes = [
  "Centro",
  "Cacique",
  "Cordialidad",
  "Soledad",
  "Norte",
  "Galapa",
  "Barrio",
] as const;

export const unassignedWholesaleRoute = "Sin clasificar";

const allowedWholesaleRouteFilters = new Set<string>([...wholesaleRoutes, unassignedWholesaleRoute]);

export function wholesaleRouteFilters(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : value ?? "";
  return [...new Set(raw.split(",").map((route) => route.trim()).filter((route) => allowedWholesaleRouteFilters.has(route)))];
}

export function splitWholesaleRouteFilters(routes: string[]) {
  return {
    assigned: routes.filter((route) => route !== unassignedWholesaleRoute),
    includeUnassigned: routes.includes(unassignedWholesaleRoute),
  };
}

export function wholesaleRouteRank(route: string) {
  const index = [...wholesaleRoutes, unassignedWholesaleRoute].indexOf(route as (typeof wholesaleRoutes)[number] | typeof unassignedWholesaleRoute);
  return index < 0 ? wholesaleRoutes.length + 1 : index;
}

export function wholesaleCustomerRouteId(
  existingCustomer: { route_id: number | null } | null | undefined,
  incomingRouteId: number | null,
) {
  return existingCustomer ? existingCustomer.route_id : incomingRouteId;
}

export function wholesaleRouteLabel(route: string) {
  return wholesaleRoutes.includes(route as (typeof wholesaleRoutes)[number]) ? `Ruta ${route}` : route;
}

function normalizedIdentityPart(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

export function normalizedWholesaleBusiness(value?: string | null) {
  return normalizedIdentityPart(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizedTaxId(value?: string | null) {
  return (value ?? "").replace(/[^a-z0-9]/gi, "").toLocaleLowerCase("es");
}

export function normalizedCustomerPhone(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

export function normalizedWholesalePhone(value?: string | null) {
  const digits = normalizedCustomerPhone(value);
  return digits.length === 10 && digits.startsWith("3") ? `57${digits}` : digits;
}

export function customerIdentityKey(
  customerType: "retail" | "wholesale",
  values: { businessName?: string; name: string; phone?: string },
) {
  if (customerType === "wholesale") {
    const business = normalizedIdentityPart(values.businessName || values.name);
    return business ? `business:${business}` : "";
  }
  const phone = (values.phone ?? "").replace(/\D/g, "");
  return phone ? `phone:${phone}` : "";
}
