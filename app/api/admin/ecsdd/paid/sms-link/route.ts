import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { requestEcsddPaidSmsLink } from "@/lib/ecsdd-paid";
import { buildSmsHref } from "@/lib/ecsdd-paid-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Admin: CSDD maksas izziņas SMS (numurs + teksts) no e.csdd "Sagatavot īsziņu". SMS nesūta un nemaksā -
 * to dara Nils savā telefonā. `login: true` drīkst sākt Smart-ID (tikai pogas klikšķis).
 * Atbilde: { status: "ok", number, body, href, hrefOther, price, vehicle, plate } | needs_login | ...
 */
async function handle(query: string, login: boolean) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!/^[A-Za-z0-9 -]{2,20}$/.test(query.trim())) return NextResponse.json({ status: "error", code: "invalid_query" }, { status: 400 });
  const out = await requestEcsddPaidSmsLink(query, { login });
  if (out.status === "ok") {
    return NextResponse.json({ ...out, href: buildSmsHref(out, "apple"), hrefOther: buildSmsHref(out, "other") });
  }
  return NextResponse.json(out, { status: out.status === "error" || out.status === "unreachable" ? 502 : 200 });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  return handle(typeof body.query === "string" ? body.query : "", body.login === true);
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  return handle(sp.get("query") ?? "", sp.get("login") === "1");
}
