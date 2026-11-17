import { NextResponse } from "next/server";
import { irissAivarsApiTokenConfigured, verifyIrissAivarsApiToken } from "@/lib/iriss-aivars-api-token";
import { parseCsddPlatesReport } from "@/lib/iriss-waybill-csdd-plates";
import { readCsddPlatesDoc, saveCsddPlatesReport } from "@/lib/iriss-waybill-csdd-plates-store";

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

/** Hetzner worker: pēdējais saglabātais CSDD numuru stāvoklis (zināmie numuri nākamajai pārbaudei). */
export async function GET(req: Request) {
  const denied = gate(req);
  if (denied) return denied;
  return NextResponse.json({ ok: true, ...(await readCsddPlatesDoc()) }, NO_STORE);
}

/** Hetzner worker (sync.js): aktīvās CSDD pavadzīmes pa tirdzniecības numuriem (arī ar roku izrakstītās). */
export async function POST(req: Request) {
  const denied = gate(req);
  if (denied) return denied;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, ...NO_STORE });
  }
  const entries = parseCsddPlatesReport(raw);
  if (!entries) return NextResponse.json({ error: "invalid_report" }, { status: 400, ...NO_STORE });
  const doc = await saveCsddPlatesReport(entries);
  return NextResponse.json({ ok: true, plates: doc.plates.length }, NO_STORE);
}
