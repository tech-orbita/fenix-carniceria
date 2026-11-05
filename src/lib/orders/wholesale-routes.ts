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

export function wholesaleRouteLabel(route: string) {
  return wholesaleRoutes.includes(route as (typeof wholesaleRoutes)[number]) ? `Ruta ${route}` : route;
}

function normalizedIdentityPart(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
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
