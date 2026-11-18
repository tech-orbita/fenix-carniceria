export type WholesaleProduct = {
  category: string;
  name: string;
  aliases: readonly string[];
  defaultUnit?: "kg" | "und";
};

export const wholesaleProductCatalog: readonly WholesaleProduct[] = [
  { category: "Res · cortes", name: "Blanda", aliases: ["carne blanda", "blanda", "capon", "capón", "lomo ancho", "lomo", "tetafulla", "tetafula", "calavera", "carabela", "caravela", "relajado", "relajada", "relado", "relada", "abierto", "abierta"] },
  { category: "Res · cortes", name: "Molida especial", aliases: ["molida especial", "carne molida especial", "carne molida", "molida"] },
  { category: "Res · cortes", name: "Espaldilla", aliases: ["espaldilla", "espaldi"] },
  { category: "Res · cortes", name: "Atravesado", aliases: ["pollo atravesado", "atravesado"] },
  { category: "Res · cortes", name: "Bollo", aliases: ["bollito pequeño", "bollito pequeno", "bollito", "bollo pequeño", "bollo pequeno", "bollo"] },
  { category: "Res · cortes", name: "Costilla", aliases: ["costilla de res", "costilla res", "costilla", "costillo"] },
  { category: "Res · cortes", name: "Costillita", aliases: ["costillitas", "costillita"] },
  { category: "Res · cortes", name: "Hueso carnudo", aliases: ["huesos de res carnudos", "hueso de res carnudo", "huesos carnudos", "hueso carnudo"] },
  { category: "Res · cortes", name: "Hueso negro", aliases: ["huesos negros especiales", "hueso negro especial", "huesos negros", "hueso negro"] },
  { category: "Res · cortes", name: "Hueso especial", aliases: ["huesos especiales", "hueso especial"] },
  { category: "Res · cortes", name: "Hueso", aliases: ["hueso de res", "hueso res", "huesos", "hueso"] },
  { category: "Res · vísceras", name: "Hígado", aliases: ["higado", "hígado"] },
  { category: "Res · vísceras", name: "Corazón", aliases: ["corazon", "corazón"] },
  { category: "Res · vísceras", name: "Panza", aliases: ["panza"] },
  { category: "Res · vísceras", name: "Bofe", aliases: ["bofe"] },
  { category: "Res · cortes", name: "Filete", aliases: ["filete"] },
  { category: "Res · cortes", name: "Semi blanda", aliases: ["semiblanda", "semi blanda"] },
  { category: "Res · cortes", name: "Falda", aliases: ["falda"] },
  { category: "Res · cortes", name: "Punta gorda", aliases: ["punta gorda"] },
  { category: "Cerdo", name: "Pulpa cerdo", aliases: ["pulpa de cerdo", "pulpa cerdo", "pulpa de cedo", "pulpa cedo"] },
  { category: "Cerdo", name: "Lomo cerdo", aliases: ["lomo de cerdo", "lomo cerdo", "cerdo lomo", "cerdo"] },
  { category: "Cerdo", name: "Pata cerdo", aliases: ["pata de cerdo", "pata cerdo", "cerdo pata"] },
  { category: "Cerdo", name: "Costillita de cerdo", aliases: ["costillitas de cerdo", "costillita de cerdo", "costillas de cerdo", "costilla de cerdo", "costillitas cerdo", "costillita cerdo", "costillas cerdo", "costilla cerdo"] },
  { category: "Cerdo", name: "Hueso de cerdo", aliases: ["huesos de cerdo", "hueso de cerdo", "huesos cerdo", "hueso cerdo"] },
  { category: "Cerdo", name: "Chuleta ahumada", aliases: ["chuletas ahumadas", "chuleta ahumada"] },
  { category: "Cerdo", name: "Chuleta", aliases: ["chuleta"] },
  { category: "Res · cortes", name: "Churrasco", aliases: ["churrascos", "churrasco"] },
  { category: "Otros productos", name: "Chuleto", aliases: ["chuletos", "chuleto"] },
  { category: "Res · cortes", name: "Asado de Tira", aliases: ["asado de tira"] },
  { category: "Res · cortes", name: "Jarreton", aliases: ["jarreton", "jarretón"] },
  { category: "Res · cortes", name: "Jarrete", aliases: ["jarrete", "jarrtee"] },
  { category: "Res · cortes", name: "Hueso paleta", aliases: ["huesos paleteros", "hueso paletero", "hueso de paleta", "hueso paleta"] },
  { category: "Res · cortes", name: "Molida corriente", aliases: ["molida corriente", "carne molida corriente"] },
  { category: "Res · cortes", name: "Sobrebarriga", aliases: ["sobrebarriga", "sobre barriga"] },
  { category: "Res · vísceras", name: "Pata", aliases: ["patas de res", "pata de res", "para de res", "pata res", "patas", "pata"], defaultUnit: "und" },
  { category: "Cerdo", name: "Pezuña cerdo", aliases: ["pezuña de cerdo", "pezuna de cerdo", "pezuña cerdo", "pezuna cerdo"] },
  { category: "Pollo", name: "Contramuslo", aliases: ["pernil mixto", "contramuslo"] },
  { category: "Res · vísceras", name: "Lenguas", aliases: ["lengua de res", "lenguas", "lengua"] },
  { category: "Res · cortes", name: "Chocosuela", aliases: ["chocosuela", "choco"] },
  { category: "Pollo", name: "Hueso pollo", aliases: ["hueso de pollo", "hueso pollo"] },
  { category: "Pollo", name: "Pata pollo", aliases: ["pata de pollo", "pata pollo"] },
  { category: "Res · vísceras", name: "Rabo res", aliases: ["rabo de res", "rabo res", "rabo"] },
  { category: "Res · cortes", name: "Hueso blanco", aliases: ["hueso blanco"] },
  { category: "Pollo", name: "Muslo colombina", aliases: ["muslo colombina", "colombina"] },
  { category: "Pollo", name: "Muslos de pollo", aliases: ["muslos de pollo", "muslo de pollo", "muslos pollo"] },
  { category: "Pollo", name: "Pechuga", aliases: ["pechuga relajada", "pechuga relajado", "pechuga", "pechugas"] },
  { category: "Pollo", name: "Pechuga congela", aliases: ["pechuga congelada", "pechuga congela"] },
  { category: "Pollo", name: "Pollo entero", aliases: ["pollos enteros", "pollo entero", "pollos", "pollo"] },
  { category: "Pescado", name: "Bassa selecta", aliases: ["bassa selecta", "basa selecta"] },
  { category: "Pescado", name: "Bassa", aliases: ["bassa", "basa"] },
  { category: "Otros productos", name: "Butifarra", aliases: ["butifarra"] },
  { category: "Otros productos", name: "Chorizo", aliases: ["chorizo"] },
  { category: "Res · vísceras", name: "Pajarilla", aliases: ["pajarilla"] },
  { category: "Res · vísceras", name: "Ubre", aliases: ["ubre"] },
  { category: "Res · vísceras", name: "Chinchurria", aliases: ["chinchurria", "chinchulín", "chinchulin"] },
  { category: "Res · vísceras", name: "Cuajo", aliases: ["cuajo"] },
  { category: "Res · vísceras", name: "3 tela", aliases: ["tres tela", "3 tela"] },
  { category: "Res · cortes", name: "Lomo pinga", aliases: ["lomo pinga"] },
  { category: "Res · cortes", name: "Tira tira", aliases: ["tira tira", "tira"] },
  { category: "Res · cortes", name: "Lomo fino", aliases: ["lomo fino", "lomos finos", "finos"] },
  { category: "Res · vísceras", name: "Ojo de res", aliases: ["ojos de res", "ojo de res"] },
  { category: "Otros productos", name: "Deshuesada", aliases: ["deshuesada", "deshuesado"] },
  { category: "Procesados", name: "Ahumada", aliases: ["lomo ahumado", "ahumada"] },
  { category: "Procesados", name: "Salchicha XL", aliases: ["salchicha xl"] },
  { category: "Otros productos", name: "Comodín", aliases: ["comodin", "comodín", "otro producto"] },
] as const;

export type BlandaIndicator = "C" | "L" | "T" | "B" | "R";

// Valor interno para una cantidad cuyo formulario no indicó kg, lb ni unidades.
// La interfaz lo oculta para mostrar exactamente el número escrito por el cliente.
export const UNSPECIFIED_WHOLESALE_UNIT = "cantidad";

export function blandaIndicatorFor(value: string): BlandaIndicator | undefined {
  const normalized = normalizeProductName(value);
  const explicit = normalized.match(/(?:^| )blanda ([cltbr])(?: |$)/)?.[1]?.toUpperCase() as BlandaIndicator | undefined;
  if (explicit) return explicit;
  if (/(?:^| )capon(?: |$)/.test(normalized)) return "C";
  if (/(?:^| )lomos?(?: |$)/.test(normalized) && !/(?:fino|pinga)/.test(normalized)) return "L";
  if (/(?:^| )(?:tetafulla|tetafula)(?: |$)/.test(normalized)) return "T";
  if (/(?:^| )(?:calavera|carabela|caravela)(?: |$)/.test(normalized)) return "B";
  if (/(?:^| )(?:relajado|relajada|abierto|abierta)(?: |$)/.test(normalized)) return "R";
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

// Una línea social o de cortesía puede compartir el mismo campo libre con el
// pedido. No debe convertirse en producto ni crear una columna en la planilla.
export function isWholesaleCommunicationText(value: string) {
  const normalized = normalizeProductName(value);
  const withoutGreeting = normalized.replace(/^(?:hola )?(?:(?:muy )?buenos dias|buen dia|buenas tardes|buena tarde|buenas noches|buena noche)(?: senores| equipo| muchachos)?(?: |$)/, "");
  if (normalized && !withoutGreeting) return true;
  return [
    /^(?:hola|buen dia|buena tarde|buena noche)$/,
    /^(?:muchas )?gracias(?: de antemano)?$/,
    /^(?:este|ese) es (?:mi|el) pedido(?: para (?:hoy|manana))?$/,
    /^(?:mi )?pedido(?: para (?:hoy|manana))?$/,
    /^les envio (?:mi|el) pedido$/,
    /^quedo (?:atento|atenta|pendiente)(?: gracias)?$/,
    /^(?:feliz|bendecido) dia$/,
    /^por favor(?: me| nos)? (?:pueden|podrian|piden) (?:enviar|mandar|despachar)(?: lo siguiente)?$/,
    /^por favor$/,
    /^por (?:ahora|haora) (?:eso|seria todo)$/,
    /^(?:eso es|seria) todo(?: por ahora)?$/,
    /^pedido no especificado$/,
    /^pago del pedido\b/,
  ].some((pattern) => pattern.test(withoutGreeting));
}

export function catalogProductFor(value: string) {
  const normalized = normalizeProductName(value);
  const candidates = wholesaleProductCatalog.flatMap((product) =>
    product.aliases.map((alias) => ({ product, alias: normalizeProductName(alias) })),
  ).filter(({ product, alias }) => {
    if (normalized === alias) return true;
    // "Hueso" solo identifica la columna genérica cuando viene solo. Un
    // descriptor desconocido (p. ej. "hueso rojo") debe conservarse como una
    // columna independiente, no sumarse silenciosamente como hueso de res.
    if (product.name === "Hueso" && ["hueso", "huesos"].includes(alias)) return false;
    return normalized.includes(alias);
  })
    // Priorizar el primer producto escrito evita que "rabo sin hueso" se
    // clasifique como Hueso. Si empiezan en la misma posición gana el alias
    // más específico (por ejemplo, "hueso de paleta" sobre "hueso").
    .sort((left, right) => normalized.indexOf(left.alias) - normalized.indexOf(right.alias) || right.alias.length - left.alias.length);

  return candidates[0]?.product;
}

export function wholesaleUnitFor(value: string) {
  return catalogProductFor(value)?.defaultUnit ?? "kg";
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
  if (["und", "unds", "unidad", "unidades", "pieza", "piezas"].includes(unit)) return "und";
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

export type ParsedWholesaleItem = { product_name: string; quantity: number; unit: string; preparation?: string; notes?: string };

export type ParsedWholesaleOrder = {
  items: ParsedWholesaleItem[];
  unresolved: string[];
};

export function parseOrderTextDetailed(text: string): ParsedWholesaleOrder {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const unit = "(?:kilogramos|kilogramo|kilos|kilo|kgs|kg|k|libras|libra|lbs|lb|lib|unidades|unidad|unds|und|piezas|pieza|pedazos|pedazo|bolsas|bolsa)";
  const items: ParsedWholesaleItem[] = [];
  const unresolved: string[] = [];

  const numberWords: Record<string, number> = { medio: 0.5, media: 0.5, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20 };
  const numericValue = (value: string) => String(numberWords[normalizeProductName(value)] ?? value);

  const preparationFor = (requestedName: string, catalogName?: string) => {
    const normalized = normalizeProductName(requestedName);
    const relaxed = /(?:^| )(?:relajado|relajada|relado|relada|abierto|abierta)(?: |$)/.test(normalized);
    if (catalogName === "Blanda") {
      const base = /(?:^| )lomo ancho(?: |$)/.test(normalized) ? "Ancho" : blandaIndicatorFor(requestedName);
      const markers = [base, relaxed ? "R" : undefined].filter(Boolean);
      return [...new Set(markers)].join("/") || undefined;
    }
    if (relaxed) return "R";
    if (/(?:^| )lomo ancho(?: |$)/.test(normalized)) return "Ancho";
    if (/\bsin\s+hueso\b/i.test(requestedName)) return "Sin hueso";
    return undefined;
  };

  const addItem = (quantityValue: string, unitValue: string | undefined, productValue: string, originalChunk: string, preserveText = true) => {
    const quantity = Number(numericValue(quantityValue).replace(",", "."));
    const requestedName = readableProductName(productValue);
    const catalogProduct = catalogProductFor(requestedName);
    if (!Number.isFinite(quantity) || quantity < 0 || !requestedName) return;
    if (!catalogProduct || catalogProduct.name === "Comodín") unresolved.push(originalChunk);
    const preparation = preparationFor(requestedName, catalogProduct?.name);
    const normalizedUnit = normalizeWholesaleUnit(unitValue ?? UNSPECIFIED_WHOLESALE_UNIT);
    const startsWithQuantity = new RegExp(`^(?:\\d+(?:[.,]\\d+)?|${Object.keys(numberWords).join("|")})\\b`, "i").test(originalChunk.trim());
    const preserveOriginal = preserveText && (
      ![UNSPECIFIED_WHOLESALE_UNIT, "kg", "lb", "und"].includes(normalizedUnit)
      || (normalizedUnit === UNSPECIFIED_WHOLESALE_UNIT && !startsWithQuantity)
    );
    items.push({
      product_name: catalogProduct?.name ?? "Comodín",
      quantity,
      unit: normalizedUnit,
      ...(preparation
        ? { preparation }
        : !catalogProduct ? { preparation: requestedName } : {}),
      ...(preserveOriginal ? { notes: originalChunk.trim() } : {}),
    });
  };

  // Los clientes habituales a veces piden "costilla, rabo, sobrebarriga" sin
  // cantidad. El producto debe llegar a la planilla con 0 para que Fénix defina
  // cuánto despacha, en vez de desaparecer del pedido.
  const addItemWithoutQuantity = (productValue: string) => {
    const requestedName = readableProductName(productValue);
    if (isWholesaleCommunicationText(requestedName)) return;
    const catalogProduct = catalogProductFor(requestedName);
    if (!requestedName) return;
    unresolved.push(productValue.trim());
    if (!catalogProduct || catalogProduct.name === "Comodín") {
      items.push({ product_name: "Comodín", quantity: 0, unit: UNSPECIFIED_WHOLESALE_UNIT, preparation: requestedName });
      return;
    }
    addItem("0", undefined, requestedName, productValue, /\b(?:mucho|poco|varios|varias)\b/i.test(productValue));
  };

  const quantityWord = "(?:medio|media|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)";
  const splitEmbeddedQuantities = (line: string) => {
    // Una porción puede incluir su gramaje después del producto. Ese segundo
    // número describe la misma línea ("3 porciones ... 350 gr"), no abre otro
    // producto.
    if (new RegExp(`^(?:\\d+(?:[.,]\\d+)?|${quantityWord})\\s+porciones?\\b`, "i").test(line)) return [line];
    // No partir expresiones válidas con el producto primero, como
    // "molida especial 4 lib" o "Molida 3 bolsas".
    const productFirst = line.match(new RegExp(`^(.+?)\\s+(?:\\d+(?:[.,]\\d+)?|${quantityWord})\\s*(${unit})\\b$`, "i"));
    const productFirstWithoutUnit = line.match(new RegExp(`^(.+?)\\s+(?:\\d+(?:[.,]\\d+)?|${quantityWord})$`, "i"));
    if (productFirst || (productFirstWithoutUnit && catalogProductFor(productFirstWithoutUnit[1]))) return [line];
    return line.split(new RegExp(`\\s+(?=(?:\\d+(?:[.,]\\d+)?|${quantityWord})\\s)`, "i"));
  };
  const chunks = normalized
    .split(/[;\n]+|[.!?](?:\s+|$)/)
    .flatMap((line) => line.split(/\s+y\s+/i))
    .flatMap((line) => line.split(/,(?!\d)/))
    // Un mismo campo puede traer todo el pedido corrido: cada nueva cantidad
    // abre un producto sin exigir saltos de línea ni comas.
    .flatMap(splitEmbeddedQuantities)
    .map((line) => line.replace(/^[\s\-*•]+/, "").trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const portionFirst = chunk.match(new RegExp(`^(\\d+(?:[.,]\\d+)?|${quantityWord})\\s+porciones?\\s+(?:de\\s+)?(.+)$`, "i"));
    if (portionFirst) {
      addItem(portionFirst[1], "porciones", portionFirst[2], chunk);
      continue;
    }

    const quantityFirst = chunk.match(new RegExp(`^(\\d+(?:[.,]\\d+)?|${quantityWord})\\s*(?:(${unit})\\b\\s*)?(?:de\\s+)?(.+)$`, "i"));
    if (quantityFirst) {
      addItem(quantityFirst[1], quantityFirst[2], quantityFirst[3], chunk);
      continue;
    }

    const productFirst = chunk.match(new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?|${quantityWord})\\s*(${unit})\\b$`, "i"));
    if (productFirst) {
      addItem(productFirst[2], productFirst[3], productFirst[1], chunk);
      continue;
    }

    const unitFirst = chunk.match(new RegExp(`^(${unit})\\b\\s+(.+?)\\s+(\\d+(?:[.,]\\d+)?)$`, "i"));
    if (unitFirst) {
      addItem(unitFirst[3], unitFirst[1], unitFirst[2], chunk);
      continue;
    }

    const productFirstWithoutUnit = chunk.match(new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?|${quantityWord})$`, "i"));
    if (productFirstWithoutUnit && catalogProductFor(productFirstWithoutUnit[1])) {
      addItem(productFirstWithoutUnit[2], undefined, productFirstWithoutUnit[1], chunk);
      continue;
    }

    addItemWithoutQuantity(chunk);
  }

  return { items, unresolved: [...new Set(unresolved.filter(Boolean))] };
}

export function parseOrderText(text: string) {
  return parseOrderTextDetailed(text).items;
}
