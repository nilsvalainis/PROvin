import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { canSeeWaybillOrders, loadIrissPavadzimesPageData } from "@/lib/iriss-pavadzimes-list";
import { uploadIrissPavadzime } from "@/lib/iriss-pavadzimes-store";
import { PDF_MAX_FILE_BYTES } from "@/lib/pdf-api-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
  const fileName = file.name.trim() || "pavadzime.pdf";
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "not_pdf" }, { status: 400 });
  }
  if (file.size > PDF_MAX_FILE_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const vin = typeof form.get("vin") === "string" ? String(form.get("vin")) : "";
  const brandModel = typeof form.get("brandModel") === "string" ? String(form.get("brandModel")) : "";
  const plate = typeof form.get("plate") === "string" ? String(form.get("plate")) : "";

  try {
    await uploadIrissPavadzime({ fileName, bytes, vin, brandModel, plate });
    const data = await loadIrissPavadzimesPageData(new Date(), { withOrders: canSeeWaybillOrders(gate.actor) });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "upload_failed" }, { status: 500 });
  }
}
