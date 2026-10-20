import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { parseIrissListingOrderOv } from "@/lib/iriss-listing-order-ov";
import {
  isIrissPasutijumiStoreEnabled,
  readIrissListingOrderOv,
  writeIrissListingOrderOv,
} from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireIrissSectionApi("sludinajumi");
  if (!gate.ok) return gate.response;
  if (!isIrissPasutijumiStoreEnabled()) {
    return NextResponse.json({ error: "store_disabled", orderOv: {} }, { status: 503 });
  }
  const orderOv = await readIrissListingOrderOv();
  return NextResponse.json({ orderOv });
}

export async function PUT(req: Request) {
  const gate = await requireIrissSectionApi("sludinajumi");
  if (!gate.ok) return gate.response;
  if (!isIrissPasutijumiStoreEnabled()) {
    return NextResponse.json({ error: "store_disabled" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const raw = body && typeof body === "object" && "orderOv" in body ? (body as { orderOv: unknown }).orderOv : body;
  const orderOv = parseIrissListingOrderOv(raw);
  const w = await writeIrissListingOrderOv(orderOv);
  if (!w.ok) return NextResponse.json({ error: w.error }, { status: 500 });
  return NextResponse.json({ ok: true, orderOv });
}
