type PipelineStage = {
  id: string;
  name: string;
};

type Pipeline = {
  id: string;
  name: string;
  stages?: PipelineStage[];
};

type Opportunity = {
  id: string;
  name?: string;
};

type Conversation = {
  id?: string;
  lastMessageType?: string;
  conversationProviderId?: string;
  lastChannelAccount?: Array<{ value?: string }>;
};

type ConversationMessage = {
  id?: string;
  messageType?: string;
  conversationProviderId?: string;
  direction?: string;
  dateAdded?: string;
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

export type HighLevelConversationLookup =
  | { ok: true; found: true; context: Required<HighLevelContext> }
  | { ok: true; found: false; context?: HighLevelContext }
  | { ok: false; found: false; message: string };

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

function messageTime(value?: string) {
  if (!value) return 0;
  const numeric = Number(value);
  if (/^\d+$/.test(value) && Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function configuration(context: HighLevelContext) {
  const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim();
  const locationId = context.locationId?.trim() || process.env.GHL_LOCATION_ID?.trim();
  const contactId = context.contactId?.trim();
  if (!token || !locationId || !contactId) return null;
  return { token, locationId, contactId };
}

async function resolvedConfiguration(context: HighLevelContext) {
  const configured = configuration(context);
  if (configured) return configured;
  const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim();
  const contactId = context.contactId?.trim();
  if (!token || !contactId) return null;
  try {
    const result = await ghlFetch<{ contact?: { locationId?: string }; locationId?: string }>(
      `/contacts/${encodeURIComponent(contactId)}`,
      token,
      { headers: { Version: "2021-07-28" } },
    );
    const locationId = result.contact?.locationId?.trim() || result.locationId?.trim();
    return locationId ? { token, contactId, locationId } : null;
  } catch (error) {
    console.error("[highlevel-context] No se pudo resolver la subcuenta del contacto", {
      message: error instanceof Error ? error.message : "Error desconocido",
    });
    return null;
  }
}

async function resolvedMessageConfiguration(context: HighLevelContext) {
  const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim();
  const conversationId = context.conversationId?.trim();
  // La conversación es la fuente más confiable para responder: además evita
  // confundir conversationId con contactId en pedidos manuales o recuperados.
  if (token && conversationId) {
    try {
      const conversation = await ghlFetch<{ contactId?: string; locationId?: string }>(
        `/conversations/${encodeURIComponent(conversationId)}`,
        token,
        { headers: { Version: "v3" } },
      );
      const contactId = conversation.contactId?.trim();
      const locationId = conversation.locationId?.trim() || context.locationId?.trim();
      if (contactId && locationId) return { token, contactId, locationId };
    } catch (error) {
      console.error("[highlevel-message] No se pudo resolver el contacto desde la conversación", {
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
  return resolvedConfiguration(context);
}

class HighLevelHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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
  const body = await response.text();
  if (!response.ok) {
    let detail = body;
    try {
      const parsed = JSON.parse(body) as { message?: string; error?: string };
      detail = parsed.message ?? parsed.error ?? body;
    } catch { /* La respuesta puede no ser JSON. */ }
    throw new HighLevelHttpError(response.status, `Orbita respondió ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
  return (body ? JSON.parse(body) : {}) as T;
}

function highLevelPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+57${digits}`;
  return `+${digits}`;
}

export async function findHighLevelConversationByPhone(phone: string): Promise<HighLevelConversationLookup> {
  const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim();
  const locationId = process.env.GHL_LOCATION_ID?.trim();
  const normalizedPhone = highLevelPhone(phone);
  if (!token || !locationId || !normalizedPhone) {
    return { ok: false, found: false, message: "Falta configurar Orbita o el teléfono no es válido." };
  }

  try {
    const contactSearch = new URLSearchParams({ locationId, phone: normalizedPhone, limit: "20" });
    const contactResult = await ghlFetch<{ contacts?: Array<{ id?: string; phone?: string }> }>(
      `/contacts/lookup?${contactSearch}`,
      token,
      { headers: { Version: "v3" } },
    );
    const requestedDigits = normalizedPhone.replace(/\D/g, "");
    const contact = contactResult.contacts?.find((candidate) => candidate.phone?.replace(/\D/g, "") === requestedDigits)
      ?? contactResult.contacts?.find((candidate) => candidate.id);
    if (!contact?.id) return { ok: true, found: false };

    const conversationSearch = new URLSearchParams({ locationId, contactId: contact.id, sort: "desc", limit: "20" });
    const conversationResult = await ghlFetch<{ conversations?: Array<{ id?: string; contactId?: string }> }>(
      `/conversations/search?${conversationSearch}`,
      token,
      { headers: { Version: "v3" } },
    );
    const conversation = conversationResult.conversations?.find((candidate) => candidate.id && (!candidate.contactId || candidate.contactId === contact.id));
    if (!conversation?.id) return { ok: true, found: false, context: { locationId, contactId: contact.id } };
    return { ok: true, found: true, context: { locationId, contactId: contact.id, conversationId: conversation.id } };
  } catch (error) {
    return {
      ok: false,
      found: false,
      message: error instanceof Error ? error.message : "No se pudo consultar la conversación de Orbita.",
    };
  }
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
  const config = await resolvedConfiguration(context);
  if (!config) return { ok: false as const, skipped: true as const, message: "Integración de Orbita sin configurar o sin contactId." };
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
    return { ok: false as const, skipped: false as const, message: error instanceof Error ? error.message : "No se pudieron actualizar los campos de Orbita." };
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
  const config = await resolvedConfiguration(context);
  if (!config) return { ok: false as const, skipped: true as const, message: "Integración de Orbita sin configurar o sin contactId." };

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
    const found = await ghlFetch<{ opportunities?: Opportunity[] }>(`/opportunities/search?${search}`, config.token);
    // Cada formulario representa un pedido diferente. Se reutiliza únicamente la
    // oportunidad del mismo pedido (mismo nombre/número), nunca la primera del
    // contacto, para conservar los pedidos anteriores en HighLevel.
    const orderNumber = normalize(opportunityName.split("·").at(-1) ?? opportunityName);
    const exactOpportunity = found.opportunities?.find((candidate) => {
      if (!candidate.name) return false;
      const candidateName = normalize(candidate.name);
      return candidateName === normalize(opportunityName) || candidateName.includes(orderNumber);
    });
    // Compatibilidad defensiva si HighLevel omite `name` en una búsqueda de una
    // sola oportunidad. Al recibir un formulario nuevo no se usa este fallback.
    const unnamedExisting = stage !== "order_placed" && found.opportunities?.length === 1 && !found.opportunities[0].name
      ? found.opportunities[0]
      : undefined;
    const opportunity = exactOpportunity ?? unnamedExisting;
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
      const createBody = { ...body, locationId: config.locationId, contactId: config.contactId };
      try {
        await ghlFetch("/opportunities/", config.token, { method: "POST", body: JSON.stringify(createBody) });
      } catch (error) {
        // Algunas subcuentas no permiten oportunidades duplicadas por contacto.
        // En ese caso, upsert conserva un único registro y sí permite moverlo.
        if (!(error instanceof HighLevelHttpError) || error.status !== 400) throw error;
        await ghlFetch("/opportunities/upsert", config.token, { method: "POST", body: JSON.stringify(createBody) });
      }
    }
    return { ok: true as const, skipped: false as const };
  } catch (error) {
    console.error("[highlevel-pipeline] No se pudo sincronizar", {
      segment,
      stage,
      message: error instanceof Error ? error.message : "Error desconocido",
    });
    return { ok: false as const, skipped: false as const, message: error instanceof Error ? error.message : "No se pudo sincronizar Orbita." };
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

export async function sendHighLevelMessage(
  context: HighLevelContext,
  message: string,
  options: { channel?: "SMS" | "WhatsApp"; replyViaOriginProvider?: boolean } = {},
) {
  const config = await resolvedMessageConfiguration(context);
  if (!config) return { ok: false as const, message: "El pedido no tiene un contacto de Orbita asociado." };
  try {
    const search = new URLSearchParams({ locationId: config.locationId, contactId: config.contactId });
    const result = await ghlFetch<{ conversations?: Conversation[] }>(`/conversations/search?${search}`, config.token, { headers: { Version: "2021-04-15" } });
    const conversation = result.conversations?.find((candidate) => candidate.id === context.conversationId) ?? result.conversations?.[0];
    const messageType = conversation?.lastMessageType?.toUpperCase() ?? "";
    // Fénix opera sus números conectados a GHL desde el compositor SMS. Aunque
    // el proveedor entregue finalmente por WhatsApp, pedir `WhatsApp` a la API
    // falla porque ese canal nativo no está conectado en la subcuenta.
    const requestedChannel = options.channel ?? "SMS";
    const usesSmsChannel = requestedChannel === "SMS";
    let originMessage: ConversationMessage | undefined;
    let providerId = options.replyViaOriginProvider
      ? undefined
      : conversation?.lastChannelAccount?.[0]?.value ?? conversation?.conversationProviderId;

    // La búsqueda de conversaciones no siempre devuelve el proveedor del canal.
    // En conversaciones SMS personalizadas (como el número conectado por QR), el
    // identificador sí viene en el historial y GHL lo exige para enviar como Custom.
    if (usesSmsChannel && conversation?.id && (options.replyViaOriginProvider || (!providerId && (requestedChannel === "SMS" || messageType === "TYPE_CUSTOM_PROVIDER_SMS")))) {
      try {
        const history = await ghlFetch<{ messages?: { messages?: ConversationMessage[] } }>(
          `/conversations/${encodeURIComponent(conversation.id)}/messages?limit=20`,
          config.token,
          { headers: { Version: "v3" } },
        );
        const messages = history.messages?.messages ?? [];
        originMessage = options.replyViaOriginProvider
          ? messages
            .filter((item) => item.direction?.toLowerCase() === "inbound" && item.conversationProviderId)
            .sort((left, right) => messageTime(right.dateAdded) - messageTime(left.dateAdded))[0]
          : undefined;
        providerId = originMessage?.conversationProviderId ?? messages.find((item) => item.conversationProviderId)?.conversationProviderId;
      } catch (error) {
        if (options.replyViaOriginProvider) {
          return {
            ok: false as const,
            message: error instanceof Error
              ? `No se pudo identificar el proveedor de origen de la conversación: ${error.message}`
              : "No se pudo identificar el proveedor de origen de la conversación.",
          };
        }
        // Si el token no permite consultar el historial, GHL todavía puede enviar
        // por el proveedor SMS predeterminado sin conversationProviderId.
      }
    }

    if (options.replyViaOriginProvider && !providerId) {
      return {
        ok: false as const,
        message: "La conversación minorista no tiene un mensaje entrante con proveedor de origen. No se envió por otro canal.",
      };
    }

    const originMessageType = originMessage?.messageType?.toUpperCase() ?? "";
    // Un proveedor puede reemplazar al SMS predeterminado o crear un canal
    // Custom adicional. Solo el segundo se envía como Custom; el primero se
    // selecciona con type=SMS y no acepta conversationProviderId.
    const usesCustomProvider = usesSmsChannel && Boolean(providerId) && (
      originMessageType.includes("CUSTOM") || messageType === "TYPE_CUSTOM_PROVIDER_SMS"
    );
    const send = (customProvider: boolean) => ghlFetch("/conversations/messages", config.token, {
      method: "POST",
      headers: { Version: "v3" },
      body: JSON.stringify({
        type: customProvider ? "Custom" : usesSmsChannel ? "SMS" : "WhatsApp",
        contactId: config.contactId,
        message,
        status: "pending",
        ...(customProvider ? { conversationProviderId: providerId } : {}),
        ...(customProvider && originMessage?.id ? { replyMessageId: originMessage.id } : {}),
      }),
    });
    try {
      await send(usesCustomProvider);
    } catch (error) {
      // Algunos proveedores reportan mensajes entrantes como Custom aunque en
      // la subcuenta estén configurados como reemplazo del SMS predeterminado.
      // El 400 confirma que nada fue encolado, por lo que el reintento no duplica.
      const unsupportedProvider = usesCustomProvider
        && error instanceof HighLevelHttpError
        && error.status === 400
        && /doesn't support the specified conversation provider|does not support the specified conversation provider/i.test(error.message);
      if (!unsupportedProvider) throw error;
      await send(false);
    }
    return { ok: true as const, channel: usesSmsChannel ? "SMS" as const : "WhatsApp" as const };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "No se pudo enviar el mensaje." };
  }
}

export async function ensureHighLevelContactTag(context: HighLevelContext, tag: string) {
  const config = await resolvedConfiguration(context);
  if (!config) return { ok: false as const, skipped: true as const, message: "Integración de Orbita sin configurar o sin contactId." };
  try {
    await ghlFetch(`/contacts/${encodeURIComponent(config.contactId)}/tags`, config.token, {
      method: "POST",
      headers: { Version: "v3" },
      body: JSON.stringify({ tags: [tag] }),
    });
    return { ok: true as const, skipped: false as const };
  } catch (error) {
    return { ok: false as const, skipped: false as const, message: error instanceof Error ? error.message : "No se pudo etiquetar el contacto." };
  }
}

export async function sendWholesalePaymentSummary(context: HighLevelContext, customer: string, orderNumber: string, total: number) {
  return sendHighLevelMessage(
    context,
    `Hola ${customer}. El valor de tu pedido ${orderNumber} es ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(total)}. Por favor envíanos el comprobante cuando realices el pago.`,
  );
}
