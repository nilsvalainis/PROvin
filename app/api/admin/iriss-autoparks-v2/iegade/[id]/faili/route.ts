import { PDF_MAX_FILE_BYTES } from "@/lib/pdf-api-limits";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { iegadeDocDropboxFileName, iegadeStockDocFolder, uploadIegadeDocumentToStock } from "@/lib/iriss-autoparks-v2-iegade-dropbox";
import { autoparksV2IegadeView } from "@/lib/iriss-autoparks-v2-iegade";
import { sniffContentType } from "@/lib/iriss-autoparks-v2-sniff";
import { readAutoparksV2Car } from "@/lib/iriss-autoparks-v2-store";
import { setCabinetDocumentDropboxPath, upsertCabinetDocument } from "@/lib/iriss-logistics-cabinet-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** Iegādes dokumenta augšupielāde (J30 F1): kabineta dokuments + labākā piepūle sinhronizēt Dropbox /STOCK `doc/` mapē. */
export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("iegade");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const got = await readAutoparksV2Car(id);
  if (!got) return autoparksV2Json({ error: "not_found" }, 404);
  const { car } = got;
  // Ar roku "+ Auto" pievienotiem ierakstiem (nekad nav bijis Loģistikas pasūtījuma) kabineta
  // dokumenti tiek glabāti tieši zem auto id - sk. `upsertCabinetDocument` paplašināto pārbaudi.
  const cabinetCarId = car.orderId || car.id;

  let bytes: Buffer | undefined;
  let fileName = "";
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (file instanceof File) {
      if (file.size > PDF_MAX_FILE_BYTES) return autoparksV2Json({ error: "too_large" }, 413);
      bytes = Buffer.from(await file.arrayBuffer());
      fileName = file.name;
    }
  } catch {
    return autoparksV2Json({ error: "invalid_body" }, 400);
  }
  // Pārlūka `file.type` bieži ir tukšs vai neprecīzs (atkarīgs no OS MIME reģistra) - PDF pazīme
  // tiek pārbaudīta pēc faila baitiem ("%PDF"), ne pēc pārlūka ziņotā tipa (sk. `sniffContentType`).
  if (!bytes || sniffContentType(bytes, "") !== "application/pdf") return autoparksV2Json({ error: "invalid_file" }, 400);

  const title = (fileName.replace(/\.[a-z0-9]{2,5}$/i, "").trim() || "Dokuments").slice(0, 150);
  let result: Awaited<ReturnType<typeof upsertCabinetDocument>>;
  try {
    result = await upsertCabinetDocument({
      carId: cabinetCarId,
      section: "A",
      type: "other",
      typeLabel: title,
      source: "upload",
      bytes,
      contentType: "application/pdf",
      fileName,
      uploadedBy: gate.actorId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "save_failed";
    return autoparksV2Json({ error: msg }, msg === "order_not_found" ? 404 : 500);
  }

  const folder = iegadeStockDocFolder(car);
  if (folder && !result.duplicate) {
    const dropboxPath = await uploadIegadeDocumentToStock(folder, iegadeDocDropboxFileName(result.document.title, fileName, "application/pdf"), bytes);
    if (dropboxPath) await setCabinetDocumentDropboxPath(result.document.id, dropboxPath);
  }

  const iegade = await autoparksV2IegadeView(id, gate.perms);
  return autoparksV2Json({ ok: true, iegade }, result.duplicate ? 200 : 201);
}
