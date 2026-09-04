import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isSafeB2bPartnerId, toPublicPartner, type B2bPartnerStatus } from "@/lib/b2b-partner-account";
import { getB2bPartnerById, updateB2bPartner } from "@/lib/b2b-partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeB2bPartnerId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const partner = await getB2bPartnerById(id);
  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ partner: toPublicPartner(partner) });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeB2bPartnerId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const str = (key: string) => (typeof raw[key] === "string" ? raw[key] : undefined);
  const statusRaw = str("status");
  const status: B2bPartnerStatus | undefined =
    statusRaw === "active" || statusRaw === "disabled" ? statusRaw : undefined;

  const result = await updateB2bPartner(id, {
    companyName: str("companyName"),
    companyReg: str("companyReg"),
    companyAddress: str("companyAddress"),
    contactName: str("contactName"),
    email: str("email"),
    phone: str("phone"),
    password: str("password"),
    status,
  });
  if (!result.ok) {
    const statusCode = result.error === "not_found" ? 404 : result.error === "email_taken" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status: statusCode });
  }
  return NextResponse.json({ partner: result.partner });
}
