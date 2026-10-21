import { NextResponse } from "next/server";
import { isAutoparksFileKind, isAutoparksStage } from "@/lib/iriss-autoparks";
import { autoparksActor } from "@/lib/iriss-autoparks-access";
import { imagesToPdf } from "@/lib/iriss-autoparks-pdf";
import { addAutoparksFile } from "@/lib/iriss-autoparks-store";
import { irissLogisticsScopeHeader, logisticsCabinetWriteForbidden, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel ķermeņa limits ~4,5 MB: klients bildes saspiež pirms sūtīšanas. */
const MAX_BYTES = 4 * 1024 * 1024;

type Ctx = { params: Promise<{ id: string }> };

/**
 * Faila augšupielāde istabā. `scan=1` + viena vai vairākas bildes (`file`) -> viens PDF (katra bilde = lapa).
 * Citādi katrs fails saglabājas kā ir (PDF, bilde, cits dokuments).
 */
export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const denied = logisticsCabinetWriteForbidden(gate.actor);
  if (denied) return denied;
  const { id } = await ctx.params;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const stageRaw = form.get("stage");
  const kindRaw = form.get("kind");
  const stage = isAutoparksStage(stageRaw) ? stageRaw : "service";
  const kind = isAutoparksFileKind(kindRaw) ? kindRaw : "invoice";
  const title = String(form.get("title") ?? "");
  const scan = form.get("scan") === "1";
  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return NextResponse.json({ error: "missing_file" }, { status: 400, headers: irissLogisticsScopeHeader() });
  if (files.some((f) => f.size > MAX_BYTES)) {
    return NextResponse.json({ error: "too_large" }, { status: 413, headers: irissLogisticsScopeHeader() });
  }
  const actor = autoparksActor(gate.actor);
  const saved = [];
  try {
    if (scan) {
      const images = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
      const pdf = await imagesToPdf(images);
      const stamp = new Date().toLocaleString("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const res = await addAutoparksFile({
        carId: id,
        stage,
        kind,
        title: title || `Skenēts ${stamp}`,
        fileName: "skenets.pdf",
        contentType: "application/pdf",
        bytes: pdf,
        scanned: true,
        actor,
      });
      if (!res) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
      saved.push(res);
    } else {
      for (const f of files) {
        const res = await addAutoparksFile({
          carId: id,
          stage,
          kind,
          title: files.length === 1 ? title : "",
          fileName: f.name || "dokuments",
          contentType: f.type || "application/octet-stream",
          bytes: Buffer.from(await f.arrayBuffer()),
          scanned: false,
          actor,
        });
        if (!res) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
        saved.push(res);
      }
    }
  } catch {
    return NextResponse.json({ error: "upload_failed" }, { status: 500, headers: irissLogisticsScopeHeader() });
  }
  return NextResponse.json(
    { ok: true, files: saved.map((s) => s.file), duplicates: saved.filter((s) => s.duplicate).length },
    { headers: irissLogisticsScopeHeader() },
  );
}
