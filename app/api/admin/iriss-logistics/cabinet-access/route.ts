import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isCabinetAccessDocKey, isCabinetAccessRole } from "@/lib/iriss-logistics-cabinet-access";
import { isCabinetSectionId } from "@/lib/iriss-logistics-cabinet";
import {
  appendCabinetAudit,
  listCabinetAccessRules,
  listCabinetAudit,
  removeCabinetAccessRule,
  upsertCabinetAccessRule,
} from "@/lib/iriss-logistics-cabinet-store";
import { ENV_ADMIN_USER_ID } from "@/lib/staff-roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [rules, audit] = await Promise.all([listCabinetAccessRules(), listCabinetAudit(80)]);
  return NextResponse.json({ ok: true, rules, audit }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.action === "delete" && typeof body.id === "string") {
    const ok = await removeCabinetAccessRule(body.id);
    if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await appendCabinetAudit({
      actorId: ENV_ADMIN_USER_ID,
      action: "access_change",
      carId: "",
      documentId: body.id,
      section: "",
      docType: "",
      detail: "delete",
    });
    return NextResponse.json({ ok: true, rules: await listCabinetAccessRules() });
  }
  const section = body.section === "" || isCabinetSectionId(body.section) ? body.section : null;
  const docType = body.docType === "" || isCabinetAccessDocKey(body.docType) ? body.docType : null;
  const role = body.role === "" || isCabinetAccessRole(body.role) ? body.role : null;
  if (section === null || docType === null || role === null) {
    return NextResponse.json({ error: "invalid_rule" }, { status: 400 });
  }
  const rule = await upsertCabinetAccessRule({
    id: typeof body.id === "string" ? body.id : undefined,
    userId: typeof body.userId === "string" ? body.userId : "",
    role,
    carId: typeof body.carId === "string" ? body.carId : "",
    section,
    docType,
    allow: body.allow !== false,
    updatedBy: ENV_ADMIN_USER_ID,
  });
  await appendCabinetAudit({
    actorId: ENV_ADMIN_USER_ID,
    action: "access_change",
    carId: rule.carId,
    documentId: rule.id,
    section: rule.section,
    docType: rule.docType,
    detail: rule.allow ? "allow" : "deny",
  });
  return NextResponse.json({ ok: true, rule, rules: await listCabinetAccessRules() });
}
