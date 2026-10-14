import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createIrissScan, isIrissScanStoreEnabled, isSafeIrissScanId, listIrissScan } from "@/lib/iriss-scan-store";
import { emptyIrissScanRecord } from "@/lib/iriss-scan-types";
import { irissScanHasOperatorContent } from "@/lib/iriss-scan-vin";

export const runtime = "nodejs";

export async function GET() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isIrissScanStoreEnabled()) {
    return NextResponse.json({ error: "store_disabled", rows: [] }, { status: 503 });
  }
  const rows = await listIrissScan();
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isIrissScanStoreEnabled()) {
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
  const id = idRaw && isSafeIrissScanId(idRaw) ? idRaw : crypto.randomUUID();
  const now = new Date().toISOString();
  const seed = { ...emptyIrissScanRecord(id, now), ...rawRecord, id };

  if (!irissScanHasOperatorContent(seed)) {
    return NextResponse.json({ error: "empty_record" }, { status: 400 });
  }

  const r = await createIrissScan(seed);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ id: r.id, record: r.record });
}
