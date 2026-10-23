import { NextRequest, NextResponse } from "next/server";

import { authorizedRetail, flagRetailHelpRequest } from "@/lib/orders/retail-agent";

export async function POST(request: NextRequest) {
  if (!authorizedRetail(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return flagRetailHelpRequest(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
