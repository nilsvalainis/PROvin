import { NextResponse } from "next/server";
import { autoparksDownloadName, isAutoparksFileKind, isAutoparksStage } from "@/lib/iriss-autoparks";
import { autoparksActor } from "@/lib/iriss-autoparks-access";
import { patchAutoparksFile, readAutoparksFileBytes, softDeleteAutoparksFile } from "@/lib/iriss-autoparks-store";
import { irissLogisticsScopeHeader, logisticsCabinetWriteForbidden, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ fileId: string }> };

/** `?dl=1` lejupielādē, citādi atver pārlūkā (PDF skatītājs). */
export async function GET(req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const { fileId } = await ctx.params;
  const found = await readAutoparksFileBytes(fileId);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  const name = autoparksDownloadName(found.car, found.file);
  const download = new URL(req.url).searchParams.get("dl") === "1";
  return new NextResponse(new Uint8Array(found.bytes), {
    headers: {
      ...irissLogisticsScopeHeader(),
      "Content-Type": found.contentType || "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const denied = logisticsCabinetWriteForbidden(gate.actor);
  if (denied) return denied;
  const { fileId } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const file = await patchAutoparksFile(fileId, {
    stage: isAutoparksStage(body.stage) ? body.stage : undefined,
    kind: isAutoparksFileKind(body.kind) ? body.kind : undefined,
    title: typeof body.title === "string" ? body.title : undefined,
  });
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  return NextResponse.json({ ok: true, file }, { headers: irissLogisticsScopeHeader() });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const denied = logisticsCabinetWriteForbidden(gate.actor);
  if (denied) return denied;
  const { fileId } = await ctx.params;
  const file = await softDeleteAutoparksFile(fileId, autoparksActor(gate.actor));
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  return NextResponse.json({ ok: true, file }, { headers: irissLogisticsScopeHeader() });
}
