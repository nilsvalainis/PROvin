import { NextResponse } from "next/server";
import { irissLogisticsScopeHeader, logisticsCabinetActorId, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";
import { readCabinetDocumentBytes, softDeleteCabinetDocument } from "@/lib/iriss-logistics-cabinet-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const file = await readCabinetDocumentBytes(id);
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
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
  const { id } = await ctx.params;
  const document = await softDeleteCabinetDocument(id, logisticsCabinetActorId(gate.actor));
  if (!document) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  return NextResponse.json({ ok: true, document }, { headers: irissLogisticsScopeHeader() });
}
