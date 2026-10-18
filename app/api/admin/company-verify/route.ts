import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isCompanyVerifyDecision, type CompanyVerifySubjectKind } from "@/lib/b2b-company-verify";
import { applyCompanyVerifyDecision, runCompanyVerify } from "@/lib/b2b-company-verify-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readKind(raw: unknown): CompanyVerifySubjectKind | null {
  return raw === "lead" || raw === "partner" ? raw : null;
}

function readId(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const kind = readKind(url.searchParams.get("kind"));
  const id = readId(url.searchParams.get("id"));
  if (!kind || !id) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const view = await runCompanyVerify({ kind, id });
  if (!view) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...view });
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const kind = readKind(raw.kind);
  const id = readId(raw.id);
  if (!kind || !id) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (isCompanyVerifyDecision(raw.decision)) {
    const view = await applyCompanyVerifyDecision({ kind, id, decision: raw.decision });
    if (!view) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, ...view });
  }
  const view = await runCompanyVerify({ kind, id, refresh: raw.refresh === true });
  if (!view) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...view });
}
