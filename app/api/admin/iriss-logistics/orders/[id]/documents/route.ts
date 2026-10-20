import { NextResponse } from "next/server";
import { PDF_MAX_FILE_BYTES } from "@/lib/pdf-api-limits";
import { irissLogisticsScopeHeader, logisticsCabinetAccessQuery, logisticsCabinetActorId, logisticsCabinetWriteForbidden, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";
import { evaluateCabinetAccess } from "@/lib/iriss-logistics-cabinet-access";
import { isCabinetDocType, isCabinetSectionId } from "@/lib/iriss-logistics-cabinet";
import { appendCabinetAudit, listCabinetAccessRules, upsertCabinetDocument } from "@/lib/iriss-logistics-cabinet-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const denied = logisticsCabinetWriteForbidden(gate.actor);
  if (denied) return denied;
  const { id } = await ctx.params;
  const ct = req.headers.get("content-type") ?? "";
  let section = "";
  let type = "";
  let typeLabel = "";
  let docNumber = "";
  let source = "upload";
  let sourceUrl = "";
  let bytes: Buffer | undefined;
  let contentType = "";
  let fileName = "";

  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      section = String(form.get("section") ?? "");
      type = String(form.get("type") ?? "");
      typeLabel = String(form.get("typeLabel") ?? "");
      docNumber = String(form.get("docNumber") ?? "");
      source = String(form.get("source") ?? "upload");
      sourceUrl = String(form.get("sourceUrl") ?? "");
      const file = form.get("file");
      if (file instanceof File) {
        if (file.size > PDF_MAX_FILE_BYTES) {
          return NextResponse.json({ error: "too_large" }, { status: 413, headers: irissLogisticsScopeHeader() });
        }
        bytes = Buffer.from(await file.arrayBuffer());
        contentType = file.type || "application/octet-stream";
        fileName = file.name;
      }
    } else {
      const body = (await req.json()) as Record<string, unknown>;
      section = typeof body.section === "string" ? body.section : "";
      type = typeof body.type === "string" ? body.type : "";
      typeLabel = typeof body.typeLabel === "string" ? body.typeLabel : "";
      docNumber = typeof body.docNumber === "string" ? body.docNumber : "";
      source = typeof body.source === "string" ? body.source : "upload";
      sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl : "";
    }
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }

  if (!isCabinetSectionId(section) || !isCabinetDocType(type)) {
    return NextResponse.json({ error: "invalid_document" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }

  const rules = await listCabinetAccessRules();
  const allowed = evaluateCabinetAccess({ ...logisticsCabinetAccessQuery(gate.actor, id), section, docType: type }, rules);
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: irissLogisticsScopeHeader() });
  }

  try {
    const result = await upsertCabinetDocument({
      carId: id,
      section,
      type,
      typeLabel,
      docNumber,
      source,
      sourceUrl,
      bytes,
      contentType,
      fileName,
      uploadedBy: logisticsCabinetActorId(gate.actor),
    });
    await appendCabinetAudit({
      actorId: logisticsCabinetActorId(gate.actor),
      action: "upload",
      carId: id,
      documentId: result.document.id,
      section,
      docType: type,
      detail: result.duplicate ? "duplicate" : "created",
    });
    return NextResponse.json(
      { ok: true, duplicate: result.duplicate, document: result.document },
      { status: result.duplicate ? 200 : 201, headers: irissLogisticsScopeHeader() },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "save_failed";
    const status = msg === "order_not_found" ? 404 : msg === "type_section_mismatch" ? 400 : 500;
    return NextResponse.json({ error: msg }, { status, headers: irissLogisticsScopeHeader() });
  }
}
