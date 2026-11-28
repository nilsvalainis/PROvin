/**
 * Pretrunu mācīšanās (24.11):
 * - POST {sessionId?, vin?, entry, severity?} - lēmuma rinda Blob žurnālā (bez personas datiem).
 * - GET ?vin=... - šī VIN lēmumi (citos pasūtījumos pelēki) + automātiski pazeminātie noteikumi.
 * - GET ?days=N - statistika pa noteikumiem (admin lapa «Pretrunu statistika»).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import {
  AUTO_DOWNGRADE_WINDOW_DAYS,
  autoDowngradedRuleKeys,
  computeRuleFeedbackStats,
  parseContradictionFeedback,
  sanitizeFeedbackSample,
  type ContradictionFeedbackEntry,
} from "@/lib/contradiction-feedback";
import {
  appendContradictionFeedbackLog,
  loadContradictionFeedbackSummary,
  readContradictionFeedbackLog,
} from "@/lib/contradiction-feedback-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{11,17}$/;

export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const vin = (url.searchParams.get("vin") ?? "").trim().toUpperCase();
  if (vin) {
    if (!VIN_RE.test(vin)) return NextResponse.json({ ok: true, entries: [], downgraded: [] });
    const now = Date.now();
    const lines = await readContradictionFeedbackLog(180, now);
    const byFp = new Map<string, ContradictionFeedbackEntry>();
    for (const l of lines.filter((x) => (x.vin ?? "").toUpperCase() === vin).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
      byFp.set(l.fp, { fp: l.fp, rule: l.rule, origin: l.origin, verdict: l.verdict, at: l.at, ...(l.pair ? { pair: l.pair } : {}) });
    }
    const downgraded = autoDowngradedRuleKeys(computeRuleFeedbackStats(lines, now, AUTO_DOWNGRADE_WINDOW_DAYS));
    return NextResponse.json({ ok: true, entries: [...byFp.values()], downgraded });
  }
  const daysRaw = Number(url.searchParams.get("days") ?? "");
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 365) : AUTO_DOWNGRADE_WINDOW_DAYS;
  return NextResponse.json({ ok: true, ...(await loadContradictionFeedbackSummary(days)) });
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const entry = parseContradictionFeedback([body.entry])?.[0];
  if (!entry) return NextResponse.json({ error: "invalid_entry" }, { status: 400 });
  const vin = typeof body.vin === "string" ? body.vin.trim().toUpperCase() : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim().slice(0, 120) : "";
  const severity = typeof body.severity === "string" ? body.severity.trim().slice(0, 12) : "";
  // 28.11: teikums nedēļas kopsavilkumam - bez personas datiem (e-pasti, tālr., VIN, numurzīmes, vārdi).
  const sample = sanitizeFeedbackSample(body.sample);
  const kind = typeof body.kind === "string" ? body.kind.trim().slice(0, 60) : "";
  const factId = typeof body.factId === "string" ? body.factId.trim().slice(0, 120) : "";
  // Piezīme var saturēt brīvu tekstu - žurnālā to neliek (paliek tikai pasūtījumā).
  const { note: _note, ...clean } = entry;
  void _note;
  const ok = await appendContradictionFeedbackLog({
    ...clean,
    ...(VIN_RE.test(vin) ? { vin } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(severity ? { severity } : {}),
    ...(sample ? { sample } : {}),
    ...(kind ? { kind } : {}),
    ...(factId ? { factId } : {}),
  });
  return NextResponse.json({ ok });
}
