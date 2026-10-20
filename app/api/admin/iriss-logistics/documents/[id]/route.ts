import { NextResponse } from "next/server";
import { irissLogisticsScopeHeader, logisticsCabinetAccessQuery, logisticsCabinetActorId, logisticsCabinetWriteForbidden, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";
import { evaluateCabinetAccess } from "@/lib/iriss-logistics-cabinet-access";
import { appendCabinetAudit, getCabinetDocument, listCabinetAccessRules, readCabinetDocumentBytes, softDeleteCabinetDocument } from "@/lib/iriss-logistics-cabinet-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const file = await readCabinetDocumentBytes(id);
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  const rules = await listCabinetAccessRules();
  const allowed = evaluateCabinetAccess(
    { ...logisticsCabinetAccessQuery(gate.actor, file.document.carId), section: file.document.section, docType: file.document.type },
    rules,
  );
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: irissLogisticsScopeHeader() });
  await appendCabinetAudit({
    actorId: logisticsCabinetActorId(gate.actor),
    action: "download",
    carId: file.document.carId,
    documentId: file.document.id,
    section: file.document.section,
    docType: file.document.type,
    detail: "file",
  });
  const name = file.document.title.replace(/[^\w.\- ]+/g, "_") || "dokuments";
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      ...irissLogisticsScopeHeader(),
      "Content-Type": file.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${name}"`,
    },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const denied = logisticsCabinetWriteForbidden(gate.actor);
  if (denied) return denied;
  const { id } = await ctx.params;
  const existing = await getCabinetDocument(id);
  if (existing && !existing.deletedAt) {
    const rules = await listCabinetAccessRules();
    const allowed = evaluateCabinetAccess(
      { ...logisticsCabinetAccessQuery(gate.actor, existing.carId), section: existing.section, docType: existing.type },
      rules,
    );
    if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: irissLogisticsScopeHeader() });
  }
  const document = await softDeleteCabinetDocument(id, logisticsCabinetActorId(gate.actor));
  if (!document) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  await appendCabinetAudit({
    actorId: logisticsCabinetActorId(gate.actor),
    action: "delete",
    carId: document.carId,
    documentId: document.id,
    section: document.section,
    docType: document.type,
    detail: "soft",
  });
  return NextResponse.json({ ok: true, document }, { headers: irissLogisticsScopeHeader() });
}
