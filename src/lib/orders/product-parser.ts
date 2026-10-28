export type WholesaleProduct = {
  category: string;
  name: string;
  aliases: readonly string[];
};

export const wholesaleProductCatalog: readonly WholesaleProduct[] = [
  { category: "Res · cortes", name: "Blanda", aliases: ["carne blanda", "blanda", "capon", "capón", "lomo", "tetafulla", "tetafula", "calavera"] },
  { category: "Res · cortes", name: "Molida especial", aliases: ["molida especial"] },
  { category: "Res · cortes", name: "Espaldilla", aliases: ["espaldilla", "espaldi"] },
  { category: "Res · cortes", name: "Atravesado", aliases: ["pollo atravesado", "atravesado"] },
  { category: "Res · cortes", name: "Bollo", aliases: ["bollo"] },
  { category: "Res · cortes", name: "Costilla", aliases: ["costilla de res", "costilla res", "costilla"] },
  { category: "Res · cortes", name: "Hueso", aliases: ["hueso de res", "hueso res", "hueso"] },
  { category: "Res · vísceras", name: "Hígado", aliases: ["higado", "hígado"] },
  { category: "Res · vísceras", name: "Corazón", aliases: ["corazon", "corazón"] },
  { category: "Res · vísceras", name: "Panza", aliases: ["panza"] },
  { category: "Res · vísceras", name: "Bofe", aliases: ["bofe"] },
  { category: "Res · cortes", name: "Filete", aliases: ["filete"] },
  { category: "Res · cortes", name: "Semi blanda", aliases: ["semiblanda", "semi blanda"] },
  { category: "Res · cortes", name: "Falda", aliases: ["falda"] },
  { category: "Res · cortes", name: "Punta gorda", aliases: ["punta gorda"] },
  { category: "Cerdo", name: "Pulpa cerdo", aliases: ["pulpa de cerdo", "pulpa cerdo"] },
  { category: "Cerdo", name: "Lomo cerdo", aliases: ["lomo de cerdo", "lomo cerdo", "cerdo lomo"] },
  { category: "Cerdo", name: "Costilla cerdo", aliases: ["costilla de cerdo", "costilla cerdo"] },
  { category: "Cerdo", name: "Chuleta", aliases: ["chuleta"] },
  { category: "Res · cortes", name: "Asado de Tira", aliases: ["asado de tira"] },
  { category: "Res · cortes", name: "Jarreton", aliases: ["jarreton", "jarretón"] },
  { category: "Res · cortes", name: "Jarrete", aliases: ["jarrete"] },
  { category: "Res · cortes", name: "Hueso paleta", aliases: ["hueso de paleta", "hueso paleta"] },
  { category: "Res · cortes", name: "Molida corriente", aliases: ["molida corriente", "carne molida corriente"] },
  { category: "Res · cortes", name: "Sobrebarriga", aliases: ["sobrebarriga"] },
  { category: "Res · vísceras", name: "Pata", aliases: ["pata de res", "pata res", "pata"] },
  { category: "Cerdo", name: "Pezuña cerdo", aliases: ["pezuña de cerdo", "pezuna de cerdo", "pezuña cerdo", "pezuna cerdo"] },
  { category: "Pollo", name: "Contramuslo", aliases: ["pernil mixto", "contramuslo"] },
  { category: "Res · vísceras", name: "Lenguas", aliases: ["lengua de res", "lenguas", "lengua"] },
  { category: "Res · cortes", name: "Chocosuela", aliases: ["chocosuela"] },
  { category: "Pollo", name: "Hueso pollo", aliases: ["hueso de pollo", "hueso pollo"] },
  { category: "Pollo", name: "Pata pollo", aliases: ["pata de pollo", "pata pollo"] },
  { category: "Res · vísceras", name: "Rabo res", aliases: ["rabo de res", "rabo res", "rabo"] },
  { category: "Cerdo", name: "Costillita", aliases: ["costillita"] },
  { category: "Res · cortes", name: "Hueso blanco", aliases: ["hueso blanco"] },
  { category: "Pollo", name: "Muslo colombina", aliases: ["muslo colombina", "colombina"] },
  { category: "Pollo", name: "Pechuga congela", aliases: ["pechuga congelada", "pechuga congela"] },
  { category: "Pollo", name: "Pollo entero", aliases: ["pollo entero"] },
  { category: "Res · vísceras", name: "Pajarilla", aliases: ["pajarilla"] },
  { category: "Res · vísceras", name: "Ubre", aliases: ["ubre"] },
  { category: "Res · vísceras", name: "Chinchurria", aliases: ["chinchurria", "chinchulín", "chinchulin"] },
  { category: "Res · vísceras", name: "Cuajo", aliases: ["cuajo"] },
  { category: "Res · vísceras", name: "3 tela", aliases: ["tres tela", "3 tela"] },
  { category: "Res · cortes", name: "Lomo pinga", aliases: ["lomo pinga"] },
  { category: "Res · cortes", name: "Tira tira", aliases: ["tira tira"] },
  { category: "Res · cortes", name: "Lomo fino", aliases: ["lomo fino"] },
  { category: "Procesados", name: "Ahumada", aliases: ["ahumada"] },
  { category: "Procesados", name: "Salchicha XL", aliases: ["salchicha xl"] },
  { category: "Otros productos", name: "Comodín", aliases: ["comodin", "comodín", "otro producto"] },
] as const;

export type BlandaIndicator = "C" | "L" | "T" | "B";

export function blandaIndicatorFor(value: string): BlandaIndicator | undefined {
  const normalized = normalizeProductName(value);
  const explicit = normalized.match(/(?:^| )blanda ([cltb])(?: |$)/)?.[1]?.toUpperCase() as BlandaIndicator | undefined;
  if (explicit) return explicit;
  if (/(?:^| )capon(?: |$)/.test(normalized)) return "C";
  if (/(?:^| )lomo(?: |$)/.test(normalized) && !/(?:fino|pinga)/.test(normalized)) return "L";
  if (/(?:^| )(?:tetafulla|tetafula)(?: |$)/.test(normalized)) return "T";
  if (/(?:^| )calavera(?: |$)/.test(normalized)) return "B";
  return undefined;
}

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

export function normalizeWholesaleUnit(value: string) {
  const unit = normalizeProductName(value);
  if (["k", "kg", "kgs", "kilo", "kilos", "kilogramo", "kilogramos"].includes(unit)) return "kg";
  if (["lb", "lbs", "lib", "libra", "libras"].includes(unit)) return "lb";
  return unit;
}

// En la operación una libra equivale a medio kilo.
export const KG_PER_LB = 0.5;

// Lleva cualquier cantidad en libras o kilos a kilos; otras unidades (und, paquete…) se dejan igual.
export function toKilograms(quantity: number, unit: string) {
  const normalized = normalizeWholesaleUnit(unit);
  if (normalized === "lb") return { quantity: Math.round(quantity * KG_PER_LB * 1000) / 1000, unit: "kg" };
  return { quantity, unit: normalized };
}

export function parseOrderText(text: string) {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const unit = "(?:kilogramos|kilogramo|kilos|kilo|kgs|kg|k|libras|libra|lbs|lb|lib)";
  const items: Array<{ product_name: string; quantity: number; unit: string; preparation?: string }> = [];

  const addItem = (quantityValue: string, unitValue: string | undefined, productValue: string) => {
    const quantity = Number(quantityValue.replace(",", "."));
    const requestedName = readableProductName(productValue);
    const catalogProduct = catalogProductFor(requestedName);
    if (!Number.isFinite(quantity) || quantity <= 0 || !requestedName) return;
    items.push({
      product_name: catalogProduct?.name ?? "Comodín",
      quantity,
      unit: normalizeWholesaleUnit(unitValue ?? "kg"),
      ...(catalogProduct?.name === "Blanda" && blandaIndicatorFor(requestedName)
        ? { preparation: blandaIndicatorFor(requestedName) }
        : !catalogProduct ? { preparation: requestedName } : {}),
    });
  };

  const chunks = normalized
    .split(/[;\n]+/)
    .flatMap((line) => line.split(/\s+y\s+(?=\d)/i))
    .map((line) => line.replace(/^[\s\-*•]+/, "").trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const quantityFirst = chunk.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(?:(${unit})\\b\\s*)?(?:de\\s+)?(.+)$`, "i"));
    if (quantityFirst) {
      addItem(quantityFirst[1], quantityFirst[2], quantityFirst[3]);
      continue;
    }

    const productFirst = chunk.match(new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${unit})\\b$`, "i"));
    if (productFirst) {
      addItem(productFirst[2], productFirst[3], productFirst[1]);
      continue;
    }

    const unitFirst = chunk.match(new RegExp(`^(${unit})\\b\\s+(.+?)\\s+(\\d+(?:[.,]\\d+)?)$`, "i"));
    if (unitFirst) addItem(unitFirst[3], unitFirst[1], unitFirst[2]);
  }

  return items;
}
