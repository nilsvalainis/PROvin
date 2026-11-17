import { NextResponse } from "next/server";
import { cronSecretGate } from "@/lib/cron-bearer";
import { runAutoparksRegistryImport } from "@/lib/iriss-autoparks-registry-dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 1x dienā: CSDD tirdzniecības reģistra JSON no Dropbox -> Autoparka kartītes pēc VIN. `?force=1` importē arī nemainītu failu. */
export async function GET(req: Request) {
  const gate = cronSecretGate(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const force = new URL(req.url).searchParams.get("force") === "1";
  const out = await runAutoparksRegistryImport({ force });
  // VIN sarakstu atbildē nerāda - tikai skaitu.
  if (out.ok && !out.skipped) return NextResponse.json({ ...out, unmatched: out.unmatched.length });
  return NextResponse.json(out, { status: out.ok ? 200 : 502 });
}
