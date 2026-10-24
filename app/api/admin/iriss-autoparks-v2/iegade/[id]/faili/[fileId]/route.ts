import { NextResponse } from "next/server";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { autoparksV2IegadeView, readAutoparksV2IegadeFile } from "@/lib/iriss-autoparks-v2-iegade";
import { deleteIegadeDocumentFromStock, iegadeDocDropboxFileName, renameIegadeDocumentInStock } from "@/lib/iriss-autoparks-v2-iegade-dropbox";
import { IEGADE_DOC_TYPE_OPTIONS } from "@/lib/iriss-autoparks-v2-iegade-files";
import { readAutoparksV2Car } from "@/lib/iriss-autoparks-v2-store";
import type { CabinetDocType } from "@/lib/iriss-logistics-cabinet";
import { getCabinetDocument, renameCabinetDocument, setCabinetDocumentDropboxPath, setCabinetDocumentType, softDeleteCabinetDocument } from "@/lib/iriss-logistics-cabinet-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string; fileId: string }> };

/** Tikai kabineta dokumenti (`c:...`) ir ar roku pārdēvējami/dzēšami (J30 F1) - v1 faili un numuru akts nē. */
async function editableCabinetDoc(id: string, fileId: string) {
  if (!fileId.startsWith("c:")) return null;
  const got = await readAutoparksV2Car(id);
  if (!got) return null;
  const cabinetCarId = got.car.orderId || got.car.id;
  const doc = await getCabinetDocument(fileId.slice(2));
  if (!doc || doc.deletedAt || doc.carId !== cabinetCarId) return null;
  return doc;
}

/** Iegādes fails caur serveri (Dropbox/Blob nekad tieši). Fails no citas kategorijas vai cita auto - 404. `?dl=1` lejupielāde. */
export async function GET(req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("iegade");
  if (!gate.ok) return gate.response;
  const { id, fileId } = await ctx.params;
  const got = await readAutoparksV2IegadeFile(id, decodeURIComponent(fileId));
  if (!got) return autoparksV2Json({ error: "not_found" }, 404);
  const ext = got.contentType.includes("pdf") ? ".pdf" : "";
  const name = `${got.name.replace(/[^\p{L}\p{N} ._-]+/gu, "").trim() || "dokuments"}${ext}`;
  const dl = new URL(req.url).searchParams.get("dl") === "1";
  return new NextResponse(new Uint8Array(got.bytes), {
    headers: {
      "Content-Type": got.contentType || "application/octet-stream",
      "Content-Disposition": `${dl ? "attachment" : "inline"}; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * Pārdēvē un/vai maina tipu ar roku pievienotam Iegādes dokumentam (J30 F1 + J61 pildspalvas tipa
 * izvēle, lai Auto1 "Trūkst dokumenta" brīdinājums tīrītos pēc pārklasificēšanas) + labākā piepūle
 * sinhronizēt Dropbox /STOCK.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("iegade");
  if (!gate.ok) return gate.response;
  const { id, fileId: rawFileId } = await ctx.params;
  const fileId = decodeURIComponent(rawFileId);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return autoparksV2Json({ error: "invalid_json" }, 400);
  }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  const type = typeof body.type === "string" ? body.type : "";
  if (!title && !type) return autoparksV2Json({ error: "invalid_title" }, 400);
  if (type && !IEGADE_DOC_TYPE_OPTIONS.includes(type as CabinetDocType)) return autoparksV2Json({ error: "invalid_type" }, 400);
  const doc = await editableCabinetDoc(id, fileId);
  if (!doc) return autoparksV2Json({ error: "not_found" }, 404);
  let updated = doc;
  if (title) {
    const renamed = await renameCabinetDocument(doc.id, title);
    if (!renamed) return autoparksV2Json({ error: "not_found" }, 404);
    updated = renamed;
  }
  if (type && type !== updated.type) {
    const retyped = await setCabinetDocumentType(doc.id, type as CabinetDocType);
    if (!retyped) return autoparksV2Json({ error: "not_found" }, 404);
    updated = retyped;
  }
  if (updated.dropboxPath && title) {
    const newName = iegadeDocDropboxFileName(title, updated.dropboxPath, "application/pdf");
    const newPath = await renameIegadeDocumentInStock(updated.dropboxPath, newName);
    if (newPath) await setCabinetDocumentDropboxPath(doc.id, newPath);
  }
  return autoparksV2Json({ ok: true, iegade: await autoparksV2IegadeView(id, gate.perms) });
}

/** Dzēš ar roku pievienotu Iegādes dokumentu (soft-delete, atgūstams) + labākā piepūle dzēst no Dropbox /STOCK (J30 F1). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("iegade");
  if (!gate.ok) return gate.response;
  const { id, fileId: rawFileId } = await ctx.params;
  const fileId = decodeURIComponent(rawFileId);
  const doc = await editableCabinetDoc(id, fileId);
  if (!doc) return autoparksV2Json({ error: "not_found" }, 404);
  const deleted = await softDeleteCabinetDocument(doc.id, gate.actorId);
  if (deleted?.dropboxPath) await deleteIegadeDocumentFromStock(deleted.dropboxPath);
  return autoparksV2Json({ ok: true, iegade: await autoparksV2IegadeView(id, gate.perms) });
}
