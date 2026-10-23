import { NextResponse } from "next/server";
import { getDropboxClient } from "@/lib/dropbox-client";
import { readWaybillRequestPdfBytes } from "@/lib/iriss-waybill-dropbox";
import { waybillDropboxFileName, waybillPdfAllowed } from "@/lib/iriss-waybill-pdf";
import { readWaybillRequestsDoc } from "@/lib/iriss-waybill-requests-store";
import { requireIrissSectionApi, waybillPdfViewer } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

const NO_STORE = { "Cache-Control": "private, no-store" };

/** HTTP galvenei drošs ASCII vārds + RFC 5987 UTF-8 vārds. */
function contentDisposition(fileName: string, inline: boolean): string {
  const ascii = fileName.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_") || "pavadzime.pdf";
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * "Saglabāt PDF": izdotās pavadzīmes PDF. Sadaļa Pavadzīmes obligāta (deny-by-default);
 * kolēģis (tikai Pavadzīmes) - tikai paša pieprasītās. `?inline=1` - atvērt pārlūkā (iPhone "Saglabāt failos").
 */
export async function GET(req: Request, ctx: Ctx) {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!/^wbr_[a-z0-9]+$/i.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400, headers: NO_STORE });
  try {
    const doc = await readWaybillRequestsDoc();
    const request = doc.requests.find((r) => r.id === id);
    const viewer = waybillPdfViewer(gate.actor);
    // Svešs pieprasījums kolēģim izskatās tāpat kā neesošs.
    if (!request || !waybillPdfAllowed(request, viewer)) {
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
    }
    let bytes: Buffer | null = await readWaybillRequestPdfBytes(request);
    if (!bytes && request.dropboxPath) {
      const client = getDropboxClient();
      if (client) bytes = (await client.download(request.dropboxPath)).bytes;
    }
    if (!bytes || bytes.byteLength === 0) return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
    const fileName =
      waybillDropboxFileName({
        waybillNo: request.waybillNo,
        brandModel: request.vehicle.brandModel,
        plate: request.vehicle.plate,
      }) || `${request.waybillNo || "pavadzime"}.pdf`;
    const inline = new URL(req.url).searchParams.get("inline") === "1";
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": contentDisposition(fileName, inline),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[iriss-waybill] pdf_failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "pdf_failed" }, { status: 500, headers: NO_STORE });
  }
}
