import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { submitCarverticalEmailCode } from "@/lib/carvertical-auto";
import { extractBearerToken } from "@/lib/iriss-aivars-api-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CarVertical pieteikšanās kods no konta e-pasta (Google Apps Script info@provin.lv kontā,
 * docs/apps-script/csdd-pdf-inbox.gs `processCarverticalCodes`). Tas pats `Authorization: Bearer <CSDD_PDF_INBOX_TOKEN>`
 * kā CSDD PDF savācējam (viena skripta vērtība; bez env >= 24 zīmēm - izslēgts).
 * Body: { code, receivedAt, messageId? }. Kods netiek logots un netiek glabāts.
 * -> 200 {status:"accepted"|"rejected"} | 204 (relejs negaida kodu / vēstule vecāka par pieteikšanos) | 400 | 401 | 503 (mēģināt vēlreiz)
 */
function verifyToken(header: string | null): boolean {
  const secret = (process.env.CSDD_PDF_INBOX_TOKEN ?? "").trim();
  if (secret.length < 24) return false;
  const given = extractBearerToken(header);
  if (!given) return false;
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!verifyToken(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const out = await submitCarverticalEmailCode({ code: body.code, receivedAt: body.receivedAt });
  if (out.httpStatus === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ status: out.outcome }, { status: out.httpStatus });
}
