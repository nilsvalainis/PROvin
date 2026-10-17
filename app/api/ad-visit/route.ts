import { NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { parseAdVisitIncrement } from "@/lib/admin-ad-visits";
import { incrementAdVisit } from "@/lib/admin-ad-visit-store";

export const runtime = "nodejs";

const MAX_PER_WINDOW = 40;
const WINDOW_MS = 10 * 60 * 1000;

/** Public, consent-gated from the client. Daily counters only. No PII. */
export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const rl = checkRateLimit(`ad-visit:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json({ ok: false }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const inc = parseAdVisitIncrement(raw);
  if (!inc) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await incrementAdVisit(inc);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Izmanto POST." }, { status: 405, headers: { Allow: "POST" } });
}
