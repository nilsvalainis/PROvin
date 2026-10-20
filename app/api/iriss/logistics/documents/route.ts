import { NextResponse } from "next/server";
import { PDF_MAX_FILE_BYTES } from "@/lib/pdf-api-limits";
import { auto1InvoiceNumberFromUrl, isCabinetDocType, isCabinetSectionId } from "@/lib/iriss-logistics-cabinet";
import { appendCabinetAudit, upsertCabinetDocument } from "@/lib/iriss-logistics-cabinet-store";
import {
  IRISS_LOGISTICS_UPLOAD_TOKEN_ENV,
  irissLogisticsUploadTokenConfigured,
  verifyIrissLogisticsUploadToken,
} from "@/lib/iriss-logistics-upload-token";
import { findLogisticsOrderByVin, getLogisticsOrder, upsertLogisticsOrderByVin } from "@/lib/iriss-logistics-store";
import { isLogisticsUpsertVin, normalizeLogisticsVin } from "@/lib/iriss-logistics-car-upsert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  if (!irissLogisticsUploadTokenConfigured()) {
    return NextResponse.json(
      { error: "not_configured", env: IRISS_LOGISTICS_UPLOAD_TOKEN_ENV },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  if (!verifyIrissLogisticsUploadToken(req.headers.get("authorization"))) return unauthorized();

  const ct = req.headers.get("content-type") ?? "";
  let carId = "";
  let vin = "";
  let section = "A";
  let type = "car_invoice";
  let typeLabel = "";
  let docNumber = "";
  let source = "auto1";
  let sourceUrl = "";
  let bytes: Buffer | undefined;
  let contentType = "";
  let fileName = "";

  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      carId = String(form.get("carId") ?? "");
      vin = String(form.get("vin") ?? "");
      section = String(form.get("section") ?? "A");
      type = String(form.get("type") ?? "car_invoice");
      typeLabel = String(form.get("typeLabel") ?? "");
      docNumber = String(form.get("docNumber") ?? "");
      source = String(form.get("source") ?? "auto1");
      sourceUrl = String(form.get("sourceUrl") ?? "");
      const file = form.get("file");
      if (file instanceof File) {
        if (file.size > PDF_MAX_FILE_BYTES) {
          return NextResponse.json({ error: "too_large" }, { status: 413 });
        }
        bytes = Buffer.from(await file.arrayBuffer());
        contentType = file.type || "application/octet-stream";
        fileName = file.name;
      }
    } else {
      const body = (await req.json()) as Record<string, unknown>;
      carId = typeof body.carId === "string" ? body.carId : "";
      vin = typeof body.vin === "string" ? body.vin : "";
      section = typeof body.section === "string" ? body.section : "A";
      type = typeof body.type === "string" ? body.type : "car_invoice";
      typeLabel = typeof body.typeLabel === "string" ? body.typeLabel : "";
      docNumber = typeof body.docNumber === "string" ? body.docNumber : "";
      source = typeof body.source === "string" ? body.source : "auto1";
      sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl : "";
    }
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!isCabinetSectionId(section) || !isCabinetDocType(type)) {
    return NextResponse.json({ error: "invalid_document" }, { status: 400 });
  }
  if (!docNumber && sourceUrl) docNumber = auto1InvoiceNumberFromUrl(sourceUrl);

  let order = carId ? await getLogisticsOrder(carId) : vin ? await findLogisticsOrderByVin(vin) : null;
  if (!order) {
    const needle = normalizeLogisticsVin(vin);
    if (!isLogisticsUpsertVin(needle)) {
      return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    }
    const created = await upsertLogisticsOrderByVin(needle, { vin: needle });
    order = created.order;
    await appendCabinetAudit({
      actorId: "upload-api",
      action: "upsert",
      carId: order.id,
      documentId: "",
      section: "",
      docType: "",
      detail: created.created ? "created" : "updated",
    });
  }

  try {
    const result = await upsertCabinetDocument({
      carId: order.id,
      section,
      type,
      typeLabel,
      docNumber,
      source,
      sourceUrl,
      bytes,
      contentType,
      fileName,
      uploadedBy: "upload-api",
    });
    await appendCabinetAudit({
      actorId: "upload-api",
      action: "upload",
      carId: order.id,
      documentId: result.document.id,
      section,
      docType: type,
      detail: result.duplicate ? "duplicate" : "created",
    });
    return NextResponse.json(
      { ok: true, duplicate: result.duplicate, document: { id: result.document.id, title: result.document.title, carId: order.id } },
      { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "save_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
