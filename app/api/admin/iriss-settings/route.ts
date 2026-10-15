import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  readIrissTameCommissionSettings,
  writeIrissTameCommissionSettings,
} from "@/lib/iriss-tame-commission-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const settings = await readIrissTameCommissionSettings();
  return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const settings = await writeIrissTameCommissionSettings(body);
    return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Neizdevās saglabāt.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
