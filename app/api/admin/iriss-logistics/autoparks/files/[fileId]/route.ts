import { NextResponse } from "next/server";
import { autoparksDownloadName, isAutoparksFileKind, isAutoparksStage } from "@/lib/iriss-autoparks";
import { autoparksActor } from "@/lib/iriss-autoparks-access";
import { autoparksTemporaryLink, readAutoparksThumbnail } from "@/lib/iriss-autoparks-files";
import { findAutoparksFile, patchAutoparksFile, readAutoparksFileBytes, softDeleteAutoparksFile } from "@/lib/iriss-autoparks-store";
import { irissLogisticsScopeHeader, logisticsCabinetWriteForbidden, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ fileId: string }> };

/** Vercel atbildes ķermeņa limits ~4,5 MB: lielākus Dropbox failus atveram ar īslaicīgu (4 h) Dropbox saiti. */
const PROXY_MAX_BYTES = 4 * 1024 * 1024;

/** `?dl=1` lejupielādē, citādi atver pārlūkā (PDF skatītājs). `?thumb=1` = mazs JPEG sīktēls bildēm. */
export async function GET(req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const { fileId } = await ctx.params;
  const params = new URL(req.url).searchParams;
  if (params.get("thumb") === "1") {
    const meta = await findAutoparksFile(fileId);
    const thumb = meta ? await readAutoparksThumbnail(meta.file) : null;
    if (!thumb) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
    return new NextResponse(new Uint8Array(thumb), {
      headers: { ...irissLogisticsScopeHeader(), "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
    });
  }
  const meta = await findAutoparksFile(fileId);
  if (meta && meta.file.size > PROXY_MAX_BYTES && (meta.file.dropboxId || meta.file.dropboxPath)) {
    const link = await autoparksTemporaryLink(meta.file);
    if (link) return NextResponse.redirect(link, { status: 302, headers: { ...irissLogisticsScopeHeader(), "Cache-Control": "private, no-store" } });
  }
  const found = await readAutoparksFileBytes(fileId);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  const name = autoparksDownloadName(found.car, found.file);
  const download = params.get("dl") === "1";
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
