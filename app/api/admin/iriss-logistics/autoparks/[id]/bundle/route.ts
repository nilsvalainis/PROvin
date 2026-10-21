import { NextResponse } from "next/server";
import { AUTOPARKS_STAGES, autoparksBundleName, isAutoparksStage } from "@/lib/iriss-autoparks";
import { mergePdfs } from "@/lib/iriss-autoparks-pdf";
import { getAutoparksRoom, readAutoparksFileBytes } from "@/lib/iriss-autoparks-store";
import { irissLogisticsScopeHeader, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** Visi istabas (vai viena posma, `?stage=`) PDF vienā failā - ērti nosūtīt grāmatvedei vai servisam. */
export async function GET(req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const room = await getAutoparksRoom(id);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  const stageRaw = new URL(req.url).searchParams.get("stage");
  const stage = isAutoparksStage(stageRaw) ? stageRaw : null;
  const order = new Map(AUTOPARKS_STAGES.map((s, i) => [s, i]));
  const pdfs = room.files
    .filter((f) => f.contentType.includes("pdf") && (!stage || f.stage === stage))
    .sort((a, b) => order.get(a.stage)! - order.get(b.stage)! || a.createdAt.localeCompare(b.createdAt));
  if (pdfs.length === 0) return NextResponse.json({ error: "no_pdf" }, { status: 404, headers: irissLogisticsScopeHeader() });
  const bytes = [];
  for (const f of pdfs) {
    const found = await readAutoparksFileBytes(f.id);
    if (found) bytes.push(found.bytes);
  }
  const merged = await mergePdfs(bytes);
  const name = autoparksBundleName(room.car, stage);
  return new NextResponse(new Uint8Array(merged.bytes), {
    headers: {
      ...irissLogisticsScopeHeader(),
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "x-skipped": String(merged.skipped),
    },
  });
}
