/**
 * Pasūtījumam: „Šis VIN jau pārbaudīts” un iepriekš nopirkto transportlīdzekļa datu pārnešana.
 * Klienta personas dati netiek kopēti. Tikai administratoram: atbilde satur PRO pasūtījumus (klienta vārds/e-pasts)
 * un POST raksta PRO pasūtījumā - IRISS darbiniekam (arī ar VIN pārbaudi) PRO nav pieejams.
 */
import { NextResponse } from "next/server";

import { requireAdminOnlyApi } from "@/lib/staff-auth";
import { findVinHistory, reuseVehicleData } from "@/lib/vin-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SAFE_SESSION = /^[A-Za-z0-9_]{6,200}$/;

export async function GET(req: Request) {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  const url = new URL(req.url);
  const sessionId = (url.searchParams.get("sessionId") ?? "").trim();
  const keys = url.searchParams.getAll("vin").map((v) => v.trim()).filter(Boolean);
  const entries = await findVinHistory(keys, { sessionId }).catch(() => []);
  return NextResponse.json({ ok: true, entries });
}

export async function POST(req: Request) {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
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
