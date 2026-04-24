import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createIrissScan, isIrissScanStoreEnabled, listIrissScan } from "@/lib/iriss-scan-store";

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

export async function POST() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isIrissScanStoreEnabled()) {
    return NextResponse.json({ error: "store_disabled" }, { status: 503 });
  }
  const r = await createIrissScan();
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ id: r.id });
}
