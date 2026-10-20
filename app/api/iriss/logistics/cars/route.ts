import { NextResponse } from "next/server";
import { PDF_MAX_FILE_BYTES } from "@/lib/pdf-api-limits";
import { parseLogisticsCarUpsertInput } from "@/lib/iriss-logistics-car-upsert";
import { auto1InvoiceNumberFromUrl, isCabinetDocType, isCabinetSectionId } from "@/lib/iriss-logistics-cabinet";
import { appendCabinetAudit, upsertCabinetDocument, upsertCabinetPickup } from "@/lib/iriss-logistics-cabinet-store";
import {
  IRISS_LOGISTICS_UPLOAD_TOKEN_ENV,
  irissLogisticsUploadTokenConfigured,
  verifyIrissLogisticsUploadToken,
} from "@/lib/iriss-logistics-upload-token";
import { upsertLogisticsOrderByVin } from "@/lib/iriss-logistics-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
}

function asRecord(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
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
  let fields: Record<string, unknown> = {};
  let bytes: Buffer | undefined;
  let contentType = "";
  let fileName = "";
  let section = "A";
  let type = "car_invoice";
  let typeLabel = "";
  let docNumber = "";
  let source = "auto1";
  let sourceUrl = "";

  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      fields = asRecord(form);
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
      fields = (await req.json()) as Record<string, unknown>;
      section = typeof fields.section === "string" ? fields.section : "A";
      type = typeof fields.type === "string" ? fields.type : "car_invoice";
      typeLabel = typeof fields.typeLabel === "string" ? fields.typeLabel : "";
      docNumber = typeof fields.docNumber === "string" ? fields.docNumber : "";
      source = typeof fields.source === "string" ? fields.source : "auto1";
      sourceUrl = typeof fields.sourceUrl === "string" ? fields.sourceUrl : "";
    }
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = parseLogisticsCarUpsertInput(fields);
  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }

  try {
    const { order, created } = await upsertLogisticsOrderByVin(parsed.vin, parsed.patch);
    await upsertCabinetPickup({
      carId: order.id,
      pickupCode: order.pickupRef,
      pickupDate: order.pickupDate,
      notes: order.notes,
      updatedBy: "upload-api",
    });
    await appendCabinetAudit({
      actorId: "upload-api",
      action: "upsert",
      carId: order.id,
      documentId: "",
      section: "",
      docType: "",
      detail: created ? "created" : "updated",
    });

    let document: { id: string; title: string; carId: string } | undefined;
    let duplicate = false;
    if (bytes) {
      if (!isCabinetSectionId(section) || !isCabinetDocType(type)) {
        return NextResponse.json({ error: "invalid_document" }, { status: 400 });
      }
      if (!docNumber && sourceUrl) docNumber = auto1InvoiceNumberFromUrl(sourceUrl);
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
      duplicate = result.duplicate;
      document = { id: result.document.id, title: result.document.title, carId: order.id };
      await appendCabinetAudit({
        actorId: "upload-api",
        action: "upload",
        carId: order.id,
        documentId: result.document.id,
        section,
        docType: type,
        detail: result.duplicate ? "duplicate" : "created",
      });
    }

    return NextResponse.json(
      {
        ok: true,
        created,
        order: {
          id: order.id,
          vin: order.vin,
          auction: order.auction,
          stockNo: order.stockNo,
          make: order.make,
          model: order.model,
          pickupPointId: order.pickupPointId,
          pickupAddress: order.pickupAddress,
          status: order.status,
          pickupRef: order.pickupRef,
          freeParkingUntil: order.freeParkingUntil,
          notes: order.notes,
        },
        ...(document ? { duplicate, document } : {}),
      },
      { status: created ? 201 : 200, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "save_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
