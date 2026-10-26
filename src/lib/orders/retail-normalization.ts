import { normalizeProductName, toKilograms } from "./product-parser.ts";

export type RetailCatalogProduct = {
  id: string;
  name: string;
  catalogKey: string;
  pricePerKg: number;
};

export type RetailInputItem = {
  product_name?: string;
  name?: string;
  quantity?: number;
  unit?: string;
  quantityKind?: "amount" | "quantity";
  preparation?: string;
  notes?: string;
  rawText?: string;
};

export type NormalizedRetailItem = {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit: "kg";
  preparation: string | null;
  notes: string | null;
  unit_price: number;
};

const unitPattern = "(?:kg|kgs|kilo|kilos|kilogramo|kilogramos|lb|lbs|lib|libra|libras)";

const retailAliases: Record<string, string> = {
  "carne molida especial": "molida super especial",
  "molida especial": "molida super especial",
  "muslo colombia": "muslo colombina",
  "muslos colombia": "muslo colombina",
  "pechuga completa": "pechuga congelada",
  pechuga: "pechuga congelada",
  sobrebarriga: "sobre barriga delgada",
  "sobre barriga": "sobre barriga delgada",
  churrasco: "lomo ancho",
};

function singularToken(token: string) {
  if (token.length > 5 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function comparable(value: string) {
  const normalized = normalizeProductName(value);
  return (retailAliases[normalized] ?? normalized)
    .split(" ")
    .filter((token) => token && !["de", "del", "la", "el", "para", "carne"].includes(token))
    .map(singularToken)
    .join(" ");
}

function title(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => index === 0
      ? `${word[0]?.toLocaleUpperCase("es") ?? ""}${word.slice(1).toLocaleLowerCase("es")}`
      : word.toLocaleLowerCase("es"))
    .join(" ");
}

function numericValue(value: string) {
  const compact = value.replace(/\s/g, "");
  if (/^\d{1,3}(?:\.\d{3})+$/.test(compact)) return Number(compact.replace(/\./g, ""));
  if (/^\d{1,3}(?:,\d{3})+$/.test(compact)) return Number(compact.replace(/,/g, ""));
  return Number(compact.replace(",", "."));
}

export function matchRetailProduct(value: string, catalog: readonly RetailCatalogProduct[]) {
  const wanted = comparable(value);
  if (!wanted) return undefined;

  const exact = catalog.find((product) => comparable(product.name) === wanted);
  if (exact) return exact;

  const wantedTokens = new Set(wanted.split(" "));
  const ranked = catalog.map((product) => {
    const candidate = comparable(product.name);
    const candidateTokens = new Set(candidate.split(" "));
    const common = [...wantedTokens].filter((token) => candidateTokens.has(token)).length;
    const coverage = common / Math.max(wantedTokens.size, candidateTokens.size);
    const contained = wanted.includes(candidate) || candidate.includes(wanted);
    const category = normalizeProductName(product.catalogKey.split(":")[0] ?? "");
    const categoryBonus = wantedTokens.has(category) ? 0.2 : 0;
    return { product, score: (contained ? 1 : coverage) + categoryBonus };
  }).sort((left, right) => right.score - left.score);

  if (!ranked[0] || ranked[0].score < 0.6) return undefined;
  if (ranked[1] && ranked[0].score === ranked[1].score && ranked[0].product.name === ranked[1].product.name) {
    const wantedCategory = [...wantedTokens].find((token) => ["res", "cerdo", "pollo", "pescado"].includes(token));
    if (!wantedCategory) return undefined;
  }
  return ranked[0].product;
}

function parsedLine(item: RetailInputItem) {
  const rawText = String(item.rawText ?? item.product_name ?? item.name ?? "").trim();
  const weight = rawText.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${unitPattern})\\b\\s*(?:de\\s+)?(.+)$`, "i"));
  if (weight) {
    return {
      rawText,
      productText: weight[3].trim(),
      quantity: numericValue(weight[1]),
      unit: weight[2],
      amount: null,
    };
  }

  // El agente conserva el pedido literalmente, por lo que es común recibir
  // "punta gorda 2 kilos" en vez de "2 kilos de punta gorda".
  const trailingWeight = rawText.match(new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${unitPattern})\\b(?:\\s+.*)?$`, "i"));
  if (trailingWeight) {
    return {
      rawText,
      productText: trailingWeight[1].trim(),
      quantity: numericValue(trailingWeight[2]),
      unit: trailingWeight[3],
      amount: null,
    };
  }

  const byAmount = rawText.match(/^\$?\s*([\d.,]+)\s*(mil|k)?\s*(?:pesos?)?\s+de\s+(.+)$/i);
  if (byAmount && (byAmount[2] || numericValue(byAmount[1]) >= 1_000 || rawText.startsWith("$"))) {
    let amount = numericValue(byAmount[1]);
    if (byAmount[2] && amount < 1_000) amount *= 1_000;
    return { rawText, productText: byAmount[3].trim(), quantity: null, unit: "COP", amount };
  }

  // Cantidades por pieza no tienen equivalencia segura a kilos. Se usa 1 kg
  // provisional para aplicar el precio del catálogo y se conserva la línea
  // original en notes para que el operario defina el peso real en el panel.
  const counted = rawText.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:(?:unidades?|unds?|piezas?|alas?|muslos?|colombinas?))?$/i);
  if (counted) {
    return {
      rawText,
      productText: counted[1].trim(),
      quantity: 1,
      unit: "kg",
      amount: null,
    };
  }

  const plainQuantity = rawText.match(/^(\d+(?:[.,]\d+)?)\s+(?:de\s+)?(.+)$/i);
  if (plainQuantity) {
    return {
      rawText,
      productText: plainQuantity[2].trim(),
      quantity: numericValue(plainQuantity[1]),
      unit: "kg",
      amount: null,
    };
  }

  const structuredQuantity = Number(item.quantity);
  const isAmount = item.quantityKind === "amount" || normalizeProductName(String(item.unit ?? "")) === "cop";
  if (isAmount && Number.isFinite(structuredQuantity) && structuredQuantity > 0) {
    return { rawText, productText: String(item.product_name ?? item.name ?? rawText).trim(), quantity: null, unit: "COP", amount: structuredQuantity };
  }
  return {
    rawText,
    productText: String(item.product_name ?? item.name ?? rawText).trim(),
    quantity: Number.isFinite(structuredQuantity) && structuredQuantity > 0 ? structuredQuantity : 1,
    unit: String(item.unit ?? "kg").trim() || "kg",
    amount: null,
  };
}

export function normalizeRetailItems(
  supplied: readonly RetailInputItem[],
  rawOrderText: string,
  catalog: readonly RetailCatalogProduct[],
) {
  const fallback: RetailInputItem[] = rawOrderText
    .split(/\r?\n|;+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .map((rawText) => ({ rawText }));
  const input = supplied.length ? supplied : fallback;

  return input.slice(0, 100).map((item): NormalizedRetailItem | null => {
    const parsed = parsedLine(item);
    if (!parsed.productText) return null;
    const product = matchRetailProduct(parsed.productText, catalog);
    const unitPrice = product?.pricePerKg ?? 0;
    const normalizedQuantity = parsed.amount != null
      ? (unitPrice > 0 ? parsed.amount / unitPrice : 1)
      : toKilograms(Number(parsed.quantity), parsed.unit).quantity;
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) return null;

    const canonicalName = product?.name ?? title(parsed.productText);
    const sourceNote = parsed.rawText && comparable(parsed.rawText) !== comparable(canonicalName)
      ? parsed.rawText.slice(0, 500)
      : "";
    return {
      product_id: product?.id ?? null,
      product_name: canonicalName.slice(0, 180),
      quantity: Math.round(normalizedQuantity * 1_000) / 1_000,
      unit: "kg",
      preparation: String(item.preparation ?? "").trim().slice(0, 250) || null,
      notes: String(item.notes ?? sourceNote).trim().slice(0, 500) || null,
      unit_price: unitPrice,
    };
  }).filter((item): item is NormalizedRetailItem => Boolean(item));
}

export function requiresRetailHelp(reason: string) {
  const normalized = normalizeProductName(reason);
  return /\b(?:asesor|asesoria|humano|persona|aclar|aclaracion|duda|confirmar|confirmacion|no entend|ayuda|atencion humana)\b/.test(normalized);
}
