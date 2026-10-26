import { NextRequest, NextResponse } from "next/server";

import { authorizedWholesaleHelp, flagWholesaleHelpRequest } from "@/lib/orders/wholesale-help";

export async function POST(request: NextRequest) {
  if (!authorizedWholesaleHelp(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return flagWholesaleHelpRequest(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
