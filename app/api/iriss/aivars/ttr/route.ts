import { NextResponse } from "next/server";
import { irissAivarsApiTokenConfigured, verifyIrissAivarsApiToken } from "@/lib/iriss-aivars-api-token";
import { parseTtrServerReport } from "@/lib/iriss-ttr-control";
import { readTtrControlDoc, saveTtrServerReport } from "@/lib/iriss-ttr-control-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

function gate(req: Request): NextResponse | null {
  if (!irissAivarsApiTokenConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503, ...NO_STORE });
  if (!verifyIrissAivarsApiToken(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, ...NO_STORE });
  }
  return null;
}

/** Hetzner iriss-vpn-ctl: vai kāds lūdz atslēgt servera VPN. */
export async function GET(req: Request) {
  const denied = gate(req);
  if (denied) return denied;
  const doc = await readTtrControlDoc();
  return NextResponse.json(
    { ok: true, stopRequestedAt: doc.stopRequestedAt, handledStopAt: doc.server.handledStopAt },
    NO_STORE,
  );
}

/** Hetzner iriss-vpn-ctl ziņo VPN stāvokli (pie izmaiņām un ik 5 min). */
export async function POST(req: Request) {
  const denied = gate(req);
  if (denied) return denied;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, ...NO_STORE });
  }
  const report = parseTtrServerReport(raw);
  if (!report) return NextResponse.json({ error: "invalid_report" }, { status: 400, ...NO_STORE });
  await saveTtrServerReport(report);
  return NextResponse.json({ ok: true }, NO_STORE);
}
