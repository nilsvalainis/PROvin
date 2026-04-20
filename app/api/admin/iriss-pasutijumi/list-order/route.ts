import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isIrissPasutijumiStoreEnabled, readIrissListOrder, writeIrissListOrder } from "@/lib/iriss-pasutijumi-store";
import type { IrissPasutijumiListOrder } from "@/lib/iriss-pasutijumi-types";

export const runtime = "nodejs";

export async function GET() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isIrissPasutijumiStoreEnabled()) {
    return NextResponse.json({ error: "store_disabled", listOrder: null }, { status: 503 });
  }
  const listOrder = await readIrissListOrder();
  return NextResponse.json({ listOrder });
}

export async function PUT(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isIrissPasutijumiStoreEnabled()) {
    return NextResponse.json({ error: "store_disabled" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const listOrder: IrissPasutijumiListOrder = {
    pinnedOrder: Array.isArray(o.pinnedOrder) ? o.pinnedOrder : [],
    unpinnedOrder: Array.isArray(o.unpinnedOrder) ? o.unpinnedOrder : [],
  };
  const w = await writeIrissListOrder(listOrder);
  if (!w.ok) return NextResponse.json({ error: w.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
