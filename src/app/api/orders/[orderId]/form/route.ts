import { NextResponse } from "next/server";

import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

type Payload = Record<string, unknown>;

function objectValue(value: unknown): Payload {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Payload : {};
}

export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  await requireViewer();
  const { orderId } = await context.params;
  if (!/^\d+$/.test(orderId)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("order_number,source_payload")
    .eq("id", Number(orderId))
    .maybeSingle();

  if (error || !order) return NextResponse.json({ error: "No se encontró el pedido o no tienes acceso." }, { status: 404 });

  const payload = objectValue(order.source_payload);
  const form = objectValue(payload.form_data);
  const orderText = typeof form.order_text === "string" ? form.order_text.trim() : "";
  if (!orderText) return NextResponse.json({ error: "El formulario no incluyó texto de pedido." }, { status: 404 });

  return NextResponse.json({
    form: typeof form.form === "string" && form.form.trim() ? form.form.trim() : "Pedido mayorista",
    orderText,
  }, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
