export type WholesaleProduct = {
  category: string;
  name: string;
  aliases: readonly string[];
};

export const wholesaleProductCatalog: readonly WholesaleProduct[] = [
  { category: "Carne de res", name: "Carne blanda", aliases: ["carne blanda", "blanda"] },
  { category: "Carne de res", name: "Espaldilla", aliases: ["espaldilla", "espaldi"] },
  { category: "Carne de res", name: "Molida especial", aliases: ["molida especial", "carne molida", "molida"] },
  { category: "Carne de res", name: "Atravesado", aliases: ["pollo atravesado", "atravesado"] },
  { category: "Carne de res", name: "Costilla", aliases: ["costilla de res", "costilla res", "costilla"] },
  { category: "Carne de res", name: "Hueso carnudo", aliases: ["hueso carnudo", "hueso"] },
  { category: "Carne de cerdo", name: "Costilla de cerdo", aliases: ["costilla de cerdo", "costilla cerdo"] },
  { category: "Carne de cerdo", name: "Pulpa de cerdo", aliases: ["pulpa de cerdo", "pulpa cerdo"] },
  { category: "Carne de cerdo", name: "Panceta", aliases: ["panceta"] },
  { category: "Aves", name: "Filete de pechuga", aliases: ["filete de pechuga", "filete pechuga", "pechuga"] },
  { category: "Aves", name: "Pechuga congelada", aliases: ["pechuga congelada"] },
  { category: "Aves", name: "Pernil mixto (contramuslo)", aliases: ["pernil mixto", "contramuslo"] },
  { category: "Aves", name: "Muslo", aliases: ["muslo"] },
] as const;

export function normalizeProductName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function catalogProductFor(value: string) {
  const normalized = normalizeProductName(value);
  const candidates = wholesaleProductCatalog.flatMap((product) =>
    product.aliases.map((alias) => ({ product, alias: normalizeProductName(alias) })),
  ).sort((left, right) => right.alias.length - left.alias.length);

  return candidates.find(({ alias }) =>
    normalized === alias || normalized.includes(alias),
  )?.product;
}

function readableProductName(value: string) {
  const cleaned = value
    .replace(/^(?:de\s+|del\s+)/i, "")
    .replace(/\b(?:no preparar|sin preparar|preparar.*)$/i, "")
    .trim();
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => index === 0 ? `${word[0]?.toLocaleUpperCase("es") ?? ""}${word.slice(1).toLocaleLowerCase("es")}` : word.toLocaleLowerCase("es"))
    .join(" ");
}

function normalizeUnit(value: string) {
  const unit = normalizeProductName(value);
  if (["kg", "kgs", "kilo", "kilos", "kilogramo", "kilogramos"].includes(unit)) return "kg";
  if (["lb", "lbs", "lib", "libra", "libras"].includes(unit)) return "lb";
  return unit;
}

export function parseOrderText(text: string) {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const unit = "(?:kg|kgs|kilo|kilos|kilogramo|kilogramos|lb|lbs|lib|libra|libras)";
  const expression = new RegExp(
    `(\\d+(?:[.,]\\d+)?)\\s*(${unit})\\b\\s*(?:de\\s+)?(.+?)(?=(?:[,;\\n.]|\\s+y\\s+\\d+(?:[.,]\\d+)?\\s*${unit}|$))`,
    "gi",
  );
  const items: Array<{ product_name: string; quantity: number; unit: string }> = [];

  for (const match of normalized.matchAll(expression)) {
    const quantity = Number(match[1].replace(",", "."));
    const requestedName = readableProductName(match[3]);
    const catalogProduct = catalogProductFor(requestedName);
    if (!Number.isFinite(quantity) || quantity <= 0 || !requestedName) continue;
    items.push({
      product_name: catalogProduct?.name ?? requestedName,
      quantity,
      unit: normalizeUnit(match[2]),
    });
  }

  return items;
}
