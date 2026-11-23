import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { fetchEcsddPaidReport } from "@/lib/ecsdd-paid";
import { isEcsddPlate } from "@/lib/ecsdd-paid-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Admin: apmaksātā CSDD maksas izziņa (e.csdd "Apmaksātās izziņas") -> teksts + CSDD lauki (esošais CSDD parsers).
 * `{ plate, since }`: jaunākā izziņa šim numuram, kas apmaksāta pēc `since`. Relejs nespiež "Nosūtīt uz e-pastu".
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const plate = typeof body.plate === "string" ? body.plate : "";
  if (!isEcsddPlate(plate)) return NextResponse.json({ status: "error", code: "invalid_plate" }, { status: 400 });
  const since = typeof body.since === "string" && !Number.isNaN(Date.parse(body.since)) ? body.since : undefined;
  const out = await fetchEcsddPaidReport(plate, since);
  return NextResponse.json(out, { status: out.status === "error" || out.status === "unreachable" ? 502 : 200 });
}
