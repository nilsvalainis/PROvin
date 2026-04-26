import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createIrissPasutijums, isIrissPasutijumiStoreEnabled, listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";

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

export async function POST() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isIrissPasutijumiStoreEnabled()) {
    return NextResponse.json({ error: "store_disabled" }, { status: 503 });
  }
  const r = await createIrissPasutijums();
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ id: r.id });
}
