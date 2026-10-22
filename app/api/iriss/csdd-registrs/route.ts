import { NextResponse } from "next/server";
import { runAutoparksRegistryPush } from "@/lib/iriss-autoparks-registry-dropbox";
import { verifyCsddRegistrsToken } from "@/lib/iriss-csdd-registrs-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2_000_000;

/**
 * Hetzner cron (relay/csdd-registrs): pilns CSDD tirdzniecības reģistra nolasījums (`iriss-csdd-tirdzn-registrs/v1` + `snapshot`)
 * -> Autoparks pēc VIN. Bearer `IRISS_CSDD_REGISTRS_TOKEN`. Atbildē tikai skaiti, bez VIN saraksta.
 */
export async function POST(req: Request) {
  if (!verifyCsddRegistrsToken(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const out = await runAutoparksRegistryPush(raw);
  if (!out.ok) return NextResponse.json({ ok: false, error: out.error }, { status: out.status });
  return NextResponse.json({ ...out, unmatched: out.unmatched.length });
}
