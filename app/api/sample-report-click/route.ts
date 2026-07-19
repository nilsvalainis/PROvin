import { NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { incrementSampleReportClick } from "@/lib/sample-report-click-store";

export const runtime = "nodejs";

const MAX_PER_WINDOW = 30;
const WINDOW_MS = 10 * 60 * 1000;

/** Publisks: +1 pie AUDITS atskaites piemēra klikšķa (bez PII). */
export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const rl = checkRateLimit(`sample-report-click:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  try {
    const stats = await incrementSampleReportClick();
    return NextResponse.json({ ok: true, total: stats.total });
  } catch {
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Izmanto POST, lai reģistrētu klikšķi." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
