import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import type { B2bPartnerWriteInput } from "@/lib/b2b-partner-account";
import { createB2bPartner, listB2bPartners } from "@/lib/b2b-partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readWriteInput(raw: Record<string, unknown>): B2bPartnerWriteInput {
  const str = (key: string) => (typeof raw[key] === "string" ? raw[key] : "");
  return {
    companyName: str("companyName"),
    companyReg: str("companyReg"),
    companyAddress: str("companyAddress"),
    contactName: str("contactName"),
    email: str("email"),
    phone: str("phone"),
  };
}

export async function GET() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const partners = await listB2bPartners();
  return NextResponse.json({ partners });
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const password = typeof raw.password === "string" ? raw.password : "";
  const result = await createB2bPartner(readWriteInput(raw), password);
  if (!result.ok) {
    const status = result.error === "email_taken" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ partner: result.partner }, { status: 201 });
}
