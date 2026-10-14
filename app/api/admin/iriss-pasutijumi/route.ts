import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { setListingOrderOvLink } from "@/lib/iriss-listing-order-ov";
import { irissPasutijumsHasOperatorContent } from "@/lib/iriss-pasutijumi-save-safety";
import {
  createIrissPasutijums,
  isIrissPasutijumiStoreEnabled,
  isSafeIrissPasutijumsId,
  listIrissPasutijumi,
  readIrissListingOrderOv,
  writeIrissListingOrderOv,
} from "@/lib/iriss-pasutijumi-store";
import { emptyIrissPasutijums, parseIrissPasutijumsListStatus } from "@/lib/iriss-pasutijumi-types";

export const runtime = "nodejs";

export async function GET() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isIrissPasutijumiStoreEnabled()) {
    return NextResponse.json({ error: "store_disabled", rows: [] }, { status: 503 });
  }
  try {
    const rows = await listIrissPasutijumi();
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "list_failed", rows: [] },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isIrissPasutijumiStoreEnabled()) {
    return NextResponse.json({ error: "store_disabled" }, { status: 503 });
  }

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const rawRecord = o.record && typeof o.record === "object" ? (o.record as Record<string, unknown>) : o;
  const idRaw = typeof rawRecord.id === "string" ? rawRecord.id : typeof o.id === "string" ? o.id : "";
  const id = idRaw && isSafeIrissPasutijumsId(idRaw) ? idRaw : crypto.randomUUID();
  const now = new Date().toISOString();
  const seed = {
    ...emptyIrissPasutijums(id, now),
    ...rawRecord,
    id,
    listStatus: parseIrissPasutijumsListStatus(rawRecord.listStatus),
  };

  if (!irissPasutijumsHasOperatorContent(seed)) {
    return NextResponse.json({ error: "empty_record" }, { status: 400 });
  }

  const r = await createIrissPasutijums(seed);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });

  const vehicleId = typeof o.listingVehicleId === "string" ? o.listingVehicleId.trim() : "";
  if (vehicleId) {
    const ov = await readIrissListingOrderOv();
    await writeIrissListingOrderOv(setListingOrderOvLink(ov, vehicleId, r.id));
  }

  return NextResponse.json({ id: r.id, record: r.record });
}
