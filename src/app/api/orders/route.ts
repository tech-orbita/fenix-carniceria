import { NextRequest } from "next/server";
import { POST as handleOrder } from "@/lib/orders/ingest";
export async function POST(request: NextRequest) { return handleOrder(request); }
