/**
 * Pasūtījumam: „Šis VIN jau pārbaudīts” un iepriekš nopirkto transportlīdzekļa datu pārnešana.
 * Klienta personas dati netiek kopēti.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { findVinHistory, reuseVehicleData } from "@/lib/vin-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SAFE_SESSION = /^[A-Za-z0-9_]{6,200}$/;

export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const sessionId = (url.searchParams.get("sessionId") ?? "").trim();
  const keys = url.searchParams.getAll("vin").map((v) => v.trim()).filter(Boolean);
  const entries = await findVinHistory(keys, { sessionId }).catch(() => []);
  return NextResponse.json({ ok: true, entries });
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const sessionId = String(b.sessionId ?? "").trim();
  const fromId = String(b.fromId ?? "").trim();
  if (!SAFE_SESSION.test(sessionId) || !fromId) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const r = await reuseVehicleData(fromId, {
    kind: "order",
    sessionId,
    vin: String(b.vin ?? ""),
    listingUrl: String(b.listingUrl ?? ""),
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
