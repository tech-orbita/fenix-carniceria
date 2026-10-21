import { NextRequest, NextResponse } from "next/server";

import { authorized } from "@/lib/orders/ingest";
import { upsertRetailOrder } from "@/lib/orders/retail-agent";

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return upsertRetailOrder(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
