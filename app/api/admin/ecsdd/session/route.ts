import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { ecsddRelaySessionAction } from "@/lib/ecsdd-auto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Admin: e.csdd sesija serverī.
 * `{action:"login"}` - sākt Smart-ID (izmetīs Nila e.csdd sesiju citā pārlūkā, kad viņš apstiprinās telefonā);
 * `{action:"release", minutes}` - serveris iziet un `minutes` laikā pats nepiesakās.
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.action !== "login" && body.action !== "release") return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  const minutes = typeof body.minutes === "number" && Number.isFinite(body.minutes) ? Math.round(body.minutes) : 60;
  const out = await ecsddRelaySessionAction(body.action, minutes);
  return NextResponse.json(out, { status: out.ok ? 200 : 502 });
}
