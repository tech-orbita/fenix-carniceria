import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, context: { params: Promise<{ attachmentId: string }> }) {
  await requireAdmin();
  const { attachmentId } = await context.params;
  if (!/^\d+$/.test(attachmentId)) return NextResponse.json({ error: "Comprobante inválido." }, { status: 404 });
  const supabase = createAdminClient();
  const { data: attachment } = await supabase
    .from("order_attachments")
    .select("storage_path,kind,orders(customer_type)")
    .eq("id", Number(attachmentId))
    .eq("kind", "payment_proof")
    .maybeSingle();
  const order = Array.isArray(attachment?.orders) ? attachment?.orders[0] : attachment?.orders;
  if (!attachment || order?.customer_type !== "wholesale") return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
  const { data, error } = await supabase.storage.from("wholesale-payment-proofs").createSignedUrl(attachment.storage_path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "No pudimos abrir el comprobante." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}

