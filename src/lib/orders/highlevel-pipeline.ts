type PipelineStage = {
  id: string;
  name: string;
};

type Pipeline = {
  id: string;
  name: string;
  stages?: PipelineStage[];
};

type CustomField = {
  id: string;
  name?: string;
  fieldKey?: string;
};

export type HighLevelContext = {
  locationId?: string;
  contactId?: string;
  conversationId?: string;
};

export type WholesalePipelineStage =
  | "order_placed"
  | "preparing"
  | "dispatched"
  | "help"
  | "payment_pending"
  | "paid";

export type PipelineSegment = "wholesale" | "retail";
export type OrderPipelineStage = WholesalePipelineStage;

const stageNames: Record<WholesalePipelineStage, string[]> = {
  order_placed: ["realizo pedido", "pedido realizado"],
  preparing: ["en preparacion"],
  dispatched: ["despachados", "despachado"],
  help: ["requiere ayuda"],
  payment_pending: ["pendiente por pago"],
  paid: ["pago realizado", "pagado", "pago"],
};

const pipelineCache = new Map<string, { pipeline: Pipeline; expiresAt: number }>();
const customFieldsCache = new Map<string, { fields: CustomField[]; expiresAt: number }>();

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

function configuration(context: HighLevelContext) {
  const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim();
  const locationId = context.locationId?.trim() || process.env.GHL_LOCATION_ID?.trim();
  const contactId = context.contactId?.trim();
  if (!token || !locationId || !contactId) return null;
  return { token, locationId, contactId };
}

async function ghlFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://services.leadconnectorhq.com${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      Version: "v3",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HighLevel respondió ${response.status}`);
  return response.json() as Promise<T>;
}

async function contactCustomFields(locationId: string, token: string) {
  const cached = customFieldsCache.get(locationId);
  if (cached && cached.expiresAt > Date.now()) return cached.fields;
  const result = await ghlFetch<{ customFields?: CustomField[] }>(
    `/locations/${encodeURIComponent(locationId)}/customFields?model=contact`,
    token,
    { headers: { Version: "2021-07-28" } },
  );
  const fields = result.customFields ?? [];
  customFieldsCache.set(locationId, { fields, expiresAt: Date.now() + 5 * 60_000 });
  return fields;
}

function matchingField(fields: CustomField[], configuredId: string | undefined, names: string[]) {
  if (configuredId) return configuredId;
  return fields.find((field) => {
    const candidates = [field.name, field.fieldKey].filter((value): value is string => Boolean(value)).map(normalize);
    return candidates.some((candidate) => names.includes(candidate) || names.some((name) => candidate.endsWith(`.${name}`)));
  })?.id;
}

export async function syncHighLevelOrderFields(
  context: HighLevelContext,
  values: { orderNumber: string; total?: number },
) {
  const config = configuration(context);
  if (!config) return { ok: false as const, skipped: true as const, message: "Integración de HighLevel sin configurar o sin contactId." };
  try {
    const fields = await contactCustomFields(config.locationId, config.token);
    const orderFieldId = matchingField(fields, process.env.GHL_ORDER_CUSTOM_FIELD_ID?.trim(), ["orden", "numero de orden", "numero del pedido", "pedido"]);
    if (!orderFieldId) throw new Error("No se encontró el campo personalizado Orden");
    const updates: Array<{ id: string; field_value: string | number }> = [{ id: orderFieldId, field_value: values.orderNumber }];
    if (Number.isFinite(values.total)) {
      const totalFieldId = matchingField(fields, process.env.GHL_ORDER_TOTAL_CUSTOM_FIELD_ID?.trim(), ["valor del pedido", "valor pedido", "total del pedido", "total pedido"]);
      if (totalFieldId) updates.push({ id: totalFieldId, field_value: Number(values.total) });
    }
    await ghlFetch(`/contacts/${encodeURIComponent(config.contactId)}`, config.token, {
      method: "PUT",
      headers: { Version: "2021-07-28" },
      body: JSON.stringify({ customFields: updates }),
    });
    return { ok: true as const, skipped: false as const };
  } catch (error) {
    console.error("[highlevel-fields] No se pudieron actualizar los campos del pedido", {
      message: error instanceof Error ? error.message : "Error desconocido",
    });
    return { ok: false as const, skipped: false as const, message: error instanceof Error ? error.message : "No se pudieron actualizar los campos de HighLevel." };
  }
}

const pipelineNames: Record<PipelineSegment, string> = {
  wholesale: "Mayoristas",
  retail: "Minoristas",
};

async function orderPipeline(locationId: string, token: string, segment: PipelineSegment) {
  const configuredId = process.env[segment === "wholesale" ? "GHL_WHOLESALE_PIPELINE_ID" : "GHL_RETAIL_PIPELINE_ID"]?.trim();
  const expectedName = pipelineNames[segment];
  const cacheKey = `${locationId}:${configuredId ?? expectedName}`;
  const cached = pipelineCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.pipeline;

  const result = await ghlFetch<{ pipelines?: Pipeline[] }>(
    `/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
    token,
  );
  let pipeline = (result.pipelines ?? []).find((candidate) => configuredId
    ? candidate.id === configuredId
    : normalize(candidate.name) === normalize(expectedName));
  if (!pipeline) throw new Error(`No se encontró el pipeline ${expectedName}`);
  if (!pipeline.stages?.length) {
    pipeline = await ghlFetch<Pipeline>(`/opportunities/pipelines/${encodeURIComponent(pipeline.id)}`, token);
  }
  pipelineCache.set(cacheKey, { pipeline, expiresAt: Date.now() + 5 * 60_000 });
  return pipeline;
}

function configuredStageId(segment: PipelineSegment, stage: OrderPipelineStage) {
  const keys: Record<WholesalePipelineStage, string> = {
    order_placed: "GHL_STAGE_ORDER_PLACED_ID",
    preparing: "GHL_STAGE_PREPARING_ID",
    dispatched: "GHL_STAGE_DISPATCHED_ID",
    help: "GHL_STAGE_HELP_ID",
    payment_pending: "GHL_STAGE_PAYMENT_PENDING_ID",
    paid: "GHL_STAGE_PAID_ID",
  };
  const retailKeys: Record<OrderPipelineStage, string> = {
    order_placed: "GHL_RETAIL_STAGE_ORDER_PLACED_ID",
    preparing: "GHL_RETAIL_STAGE_PREPARING_ID",
    dispatched: "GHL_RETAIL_STAGE_DISPATCHED_ID",
    help: "GHL_RETAIL_STAGE_HELP_ID",
    payment_pending: "GHL_RETAIL_STAGE_PAYMENT_PENDING_ID",
    paid: "GHL_RETAIL_STAGE_PAID_ID",
  };
  return process.env[segment === "wholesale" ? keys[stage] : retailKeys[stage]]?.trim();
}

export async function syncOrderPipeline(
  context: HighLevelContext,
  segment: PipelineSegment,
  stage: OrderPipelineStage,
  opportunityName: string,
  monetaryValue?: number,
) {
  const config = configuration(context);
  if (!config) return { ok: false as const, skipped: true as const, message: "Integración de HighLevel sin configurar o sin contactId." };

  try {
    const pipeline = await orderPipeline(config.locationId, config.token, segment);
    const stageId = configuredStageId(segment, stage) ?? pipeline.stages?.find((candidate) =>
      stageNames[stage].includes(normalize(candidate.name)),
    )?.id;
    if (!stageId) throw new Error(`No se encontró la etapa ${stageNames[stage][0]}`);

    const search = new URLSearchParams({
      locationId: config.locationId,
      pipelineId: pipeline.id,
      contactId: config.contactId,
      status: "all",
      limit: "20",
    });
    const found = await ghlFetch<{ opportunities?: Array<{ id: string }> }>(`/opportunities/search?${search}`, config.token);
    const opportunity = found.opportunities?.[0];
    const body = {
      pipelineId: pipeline.id,
      pipelineStageId: stageId,
      name: opportunityName.slice(0, 120),
      status: "open",
      ...(Number.isFinite(monetaryValue) ? { monetaryValue } : {}),
    };
    if (opportunity) {
      await ghlFetch(`/opportunities/${encodeURIComponent(opportunity.id)}`, config.token, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    } else {
      await ghlFetch("/opportunities/", config.token, {
        method: "POST",
        body: JSON.stringify({ ...body, locationId: config.locationId, contactId: config.contactId }),
      });
    }
    return { ok: true as const, skipped: false as const };
  } catch (error) {
    console.error("[highlevel-pipeline] No se pudo sincronizar", {
      segment,
      stage,
      message: error instanceof Error ? error.message : "Error desconocido",
    });
    return { ok: false as const, skipped: false as const, message: error instanceof Error ? error.message : "No se pudo sincronizar HighLevel." };
  }
}

export function syncWholesalePipeline(
  context: HighLevelContext,
  stage: WholesalePipelineStage,
  opportunityName: string,
  monetaryValue?: number,
) {
  return syncOrderPipeline(context, "wholesale", stage, opportunityName, monetaryValue);
}

export function syncRetailPipeline(
  context: HighLevelContext,
  stage: OrderPipelineStage,
  opportunityName: string,
  monetaryValue?: number,
) {
  return syncOrderPipeline(context, "retail", stage, opportunityName, monetaryValue);
}

export async function sendHighLevelMessage(context: HighLevelContext, message: string) {
  const config = configuration(context);
  if (!config) return { ok: false as const, message: "El pedido no tiene un contacto de HighLevel asociado." };
  try {
    await ghlFetch("/conversations/messages", config.token, {
      method: "POST",
      headers: { Version: "2021-04-15" },
      body: JSON.stringify({ type: "WhatsApp", contactId: config.contactId, message }),
    });
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "No se pudo enviar el mensaje." };
  }
}

export async function sendWholesalePaymentSummary(context: HighLevelContext, customer: string, orderNumber: string, total: number) {
  return sendHighLevelMessage(
    context,
    `Hola ${customer}. El valor de tu pedido ${orderNumber} es ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(total)}. Por favor envíanos el comprobante cuando realices el pago.`,
  );
}
