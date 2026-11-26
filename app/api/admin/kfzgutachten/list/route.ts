/**
 * Admin: kfzgutachten.at bezmaksas §57a saraksts pēc VIN + precīza 1. reģ. datuma caur releja Chrome.
 * Pasūtījuma «Austrija · §57a apskates» bloks to izsauc pats (saraksts ielasās automātiski).
 * Relejs: kešs 7 d, ≤1 īsts vaicājums / 2 min (pārējie rindā), reCAPTCHA atteikumam atdzišana 20 min -> 3 h.
 * Neko nepērk: atzinumi (1,19 €) - tikai Nils pats.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { kfzAtUncheckedSummary, kfzAtFoundSummary, kfzAtNoneSummary } from "@/lib/kfzgutachten/kfz-at-result";
import { kfzExactDateDdMmYyyy } from "@/lib/kfzgutachten/kfzgutachten";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { fetchVinSourceViaRelay, vinSourceRelayConfigured } from "@/lib/vin-scan/vinsource-relay";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { vin?: unknown; date?: unknown };
  const vin = normalizeVin(String(body.vin ?? ""));
  const date = kfzExactDateDdMmYyyy(String(body.date ?? ""));
  if (!isValidVin(vin)) return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  if (!date) {
    return NextResponse.json({ ok: true, status: "unchecked", summary: kfzAtUncheckedSummary("nav precīza 1. reģ. datuma"), rows: [] });
  }
  if (!vinSourceRelayConfigured()) {
    return NextResponse.json({ ok: true, status: "unchecked", summary: kfzAtUncheckedSummary("relejs nav konfigurēts"), rows: [] });
  }
  const got = await fetchVinSourceViaRelay("kfz_at", vin, { date });
  if (!got.ok) {
    return NextResponse.json({
      ok: true,
      status: "unchecked",
      // «queued» - relejs nolasīs pats; bloks pajautā vēlreiz pēc brīža (kešs).
      queued: got.kind === "queued",
      summary: kfzAtUncheckedSummary(got.reason.replace(/^kfzgutachten\.at:\s*/i, "")),
      rows: [],
    });
  }
  const rows = (got.kind === "found" ? (got.rows ?? []) : []).filter((r) => !r.vin || r.vin === vin);
  if (rows.length === 0) return NextResponse.json({ ok: true, status: "none", summary: kfzAtNoneSummary(date), rows: [] });
  return NextResponse.json({
    ok: true,
    status: "found",
    summary: kfzAtFoundSummary(rows.map((r) => r.date)),
    rows: rows.map((r) => ({ date: r.date, plate: r.plate, vin: r.vin || vin, model: r.model })),
  });
}
