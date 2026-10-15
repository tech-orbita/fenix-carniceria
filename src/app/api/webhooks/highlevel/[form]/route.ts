import { NextRequest, NextResponse } from "next/server";
import { authorized, ingestOrder } from "@/lib/orders/ingest";
import { mapHighLevelForm } from "@/lib/orders/highlevel";

export async function POST(request: NextRequest, context: { params: Promise<{ form: string }> }) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { form } = await context.params;
  if (form !== "mayorista-cliente" && form !== "nuevo-mayorista") return NextResponse.json({ error: "Unknown form" }, { status: 404 });
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  let order;
  try { order = mapHighLevelForm(payload, form); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid form" }, { status: 422 }); }
  return ingestOrder(order);
}
