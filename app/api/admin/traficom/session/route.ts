import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { releaseTraficomFiRelaySession, submitTraficomFiBrowserCode } from "@/lib/traficom-fi-auto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Admin: «Atbrīvot sesiju» (`release`) - relejs aizver pārlūku un izdzēš sīkdatnes (eParaksts pārlūka apstiprinājums paliek);
 * `browser_code` {code} - kods no eParaksts lietotnes pārlūka apstiprināšanai; `browser_code_renew` - «Pieprasīt jaunu kodu».
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.action === "browser_code" || body.action === "browser_code_renew") {
    const out = await submitTraficomFiBrowserCode(body.action === "browser_code_renew" ? { renew: true } : { code: typeof body.code === "string" ? body.code : "" });
    const status = out.ok ? 200 : out.error === "invalid_code" ? 400 : out.error === "not_waiting" ? 409 : 502;
    return NextResponse.json(out, { status });
  }
  if (body.action !== "release") return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  const out = await releaseTraficomFiRelaySession();
  return NextResponse.json(out, { status: out.ok ? 200 : 502 });
}
