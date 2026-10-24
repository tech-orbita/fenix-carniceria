import { NextResponse } from "next/server";

import { requireViewer } from "@/lib/auth/viewer";
import { highLevelConversationUrl, safeHighLevelConversationUrl } from "@/lib/orders/highlevel-conversation-url";
import { createClient } from "@/lib/supabase/server";

type Payload = Record<string, unknown>;

function objectValue(value: unknown): Payload {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Payload : {};
}

function textValue(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
}

export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  await requireViewer();
  const { orderId } = await context.params;
  if (!/^\d+$/.test(orderId)) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("source_payload,customer_type")
    .eq("id", Number(orderId))
    .maybeSingle();
  if (error || !order) {
    return NextResponse.json({ error: "No se encontró el pedido o no tienes acceso." }, { status: 404 });
  }

  const payload = objectValue(order.source_payload);
  const form = objectValue(payload.form_data);
  const locationId = textValue(form.location_id, form.locationId, payload.location_id, payload.locationId, process.env.GHL_LOCATION_ID);
  const conversationId = textValue(form.conversation_id, form.conversationId, payload.conversation_id, payload.conversationId);
  const contactId = textValue(form.contact_id, form.contactId, payload.contact_id, payload.contactId);
  const explicitUrl = safeHighLevelConversationUrl(textValue(form.conversation_url, form.conversationUrl, payload.conversation_url, payload.conversationUrl));

  if (explicitUrl) return NextResponse.redirect(explicitUrl);
  if (locationId && conversationId) return NextResponse.redirect(highLevelConversationUrl(locationId, conversationId));
  if (!locationId || !contactId) {
    return NextResponse.json({ error: "El pedido no tiene una conversación de HighLevel asociada." }, { status: 404 });
  }

  const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ error: "Falta configurar la conexión con HighLevel." }, { status: 503 });
  }

  const search = new URLSearchParams({ locationId, contactId });
  const response = await fetch(`https://services.leadconnectorhq.com/conversations/search?${search}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      Version: "2021-04-15",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    return NextResponse.json({ error: "HighLevel no pudo localizar la conversación del cliente." }, { status: 502 });
  }

  const result = await response.json() as { conversations?: Array<{ id?: string }> };
  const foundId = result.conversations?.find((conversation) => conversation.id)?.id;
  if (!foundId) {
    return NextResponse.json({ error: "Este cliente todavía no tiene una conversación en HighLevel." }, { status: 404 });
  }

  return NextResponse.redirect(highLevelConversationUrl(locationId, foundId));
}
