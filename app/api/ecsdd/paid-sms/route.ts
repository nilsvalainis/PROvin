import { NextResponse } from "next/server";

import { requestEcsddPaidSmsLink, verifyEcsddPaidApiToken } from "@/lib/ecsdd-paid";
import { autoSmsTakeable } from "@/lib/ecsdd-paid-logic";
import { readAutoSms, writeAutoSms } from "@/lib/ecsdd-paid-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ārējam izsaucējam (iPhone Īsceļi), `Authorization: Bearer <ECSDD_PAID_API_TOKEN>` (bez env - izslēgts, 401):
 *  - `GET /api/ecsdd/paid-sms` (bez query): admin pogas "Sūtīt automātiski" pēdējais pieprasījums, VIENREIZ
 *    -> `{ status: "ok", number, body }` | `{ status: "none" }` (Īsceļš ar "Iegūt URL saturu", Back Tap);
 *  - `GET /api/ecsdd/paid-sms?query=AB1234[&login=1]` -> jauna saite no e.csdd `{ number, body }`.
 * SMS nesūta un nemaksā: to dara Īsceļš Nila telefonā.
 */
async function handle(req: Request, query: string, login: boolean) {
  if (!verifyEcsddPaidApiToken(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!/^[A-Za-z0-9 -]{2,20}$/.test(query.trim())) return NextResponse.json({ status: "error", code: "invalid_query" }, { status: 400 });
  const out = await requestEcsddPaidSmsLink(query, { login });
  if (out.status === "ok") return NextResponse.json({ status: "ok", number: out.number, body: out.body, plate: out.plate ?? "" });
  return NextResponse.json(out, { status: out.status === "error" || out.status === "unreachable" ? 502 : 200 });
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  if (!sp.get("query")) {
    if (!verifyEcsddPaidApiToken(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const rec = await readAutoSms();
    const now = new Date();
    if (!rec || !autoSmsTakeable(rec, now)) return NextResponse.json({ status: "none" });
    await writeAutoSms({ ...rec, consumedAt: now.toISOString() });
    return NextResponse.json({ status: "ok", number: rec.number, body: rec.body, plate: rec.plate });
  }
  return handle(req, sp.get("query") ?? "", sp.get("login") === "1");
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  return handle(req, typeof body.query === "string" ? body.query : "", body.login === true);
}
