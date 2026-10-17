/**
 * IRISS pasūtījuma saglabāšana bez bildēm.
 *
 * Teksts un lauki iet uz serveri mazā JSON. Bilde tiek augšupielādēta vienu reizi,
 * kad to pievieno (dataUrl bez blobPath). Kad serveris to saglabājis Blob/FS
 * (blobPath / thumbBlobPath), nākamajās saglabāšanās baiti vairs netiek sūtīti:
 * serveris paturēs atsauci, bet operatora pārlūkā priekšskatījums paliek.
 */

import type { IrissOfferAttachment, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

function attachmentForWire(att: IrissOfferAttachment): IrissOfferAttachment {
  const fullStored = Boolean(att.blobPath && att.blobPath.trim());
  const thumbStored = Boolean(att.thumbBlobPath && att.thumbBlobPath.trim());
  if (!(fullStored && att.dataUrl) && !(thumbStored && att.thumbDataUrl)) return att;
  const next: IrissOfferAttachment = { ...att };
  if (fullStored) next.dataUrl = "";
  if (thumbStored) delete next.thumbDataUrl;
  return next;
}

/**
 * Ko sūtīt PATCH ķermenī: tas pats ieraksts, tikai jau saglabātajām bildēm
 * bez base64 baitiem. Ievades ierakstu nemaina.
 */
export function irissSaveWirePayload(rec: IrissPasutijumsRecord): IrissPasutijumsRecord {
  let changed = false;
  const offers = rec.offers.map((offer) => {
    let offerChanged = false;
    const attachments = offer.attachments.map((att) => {
      const next = attachmentForWire(att);
      if (next !== att) offerChanged = true;
      return next;
    });
    if (!offerChanged) return offer;
    changed = true;
    return { ...offer, attachments };
  });
  return changed ? { ...rec, offers } : rec;
}

/**
 * Pēc veiksmīgas saglabāšanas pārņem no servera bilžu glabātuves atsauces
 * (blobPath, blobUrl, thumbBlobPath, thumbUrl), lai nākamā automātiskā
 * saglabāšana bildi vairs nesūtītu. Lokālie priekšskatījumi (dataUrl,
 * thumbDataUrl) un visi teksta lauki paliek kā lokāli.
 */
export function mergeServerAttachmentStorage(
  local: IrissPasutijumsRecord,
  server: IrissPasutijumsRecord | null | undefined,
): IrissPasutijumsRecord {
  if (!server || !Array.isArray(server.offers) || server.offers.length === 0) return local;
  const serverAtt = new Map<string, IrissOfferAttachment>();
  for (const o of server.offers) {
    for (const a of o.attachments ?? []) serverAtt.set(`${o.id}\u0000${a.id}`, a);
  }
  let changed = false;
  const offers = local.offers.map((offer) => {
    let offerChanged = false;
    const attachments = offer.attachments.map((att) => {
      const s = serverAtt.get(`${offer.id}\u0000${att.id}`);
      if (!s) return att;
      const patch: Partial<IrissOfferAttachment> = {};
      if (!att.blobPath && s.blobPath) patch.blobPath = s.blobPath;
      if (!att.blobUrl && s.blobUrl) patch.blobUrl = s.blobUrl;
      if (!att.thumbBlobPath && s.thumbBlobPath) patch.thumbBlobPath = s.thumbBlobPath;
      if (!att.thumbUrl && s.thumbUrl) patch.thumbUrl = s.thumbUrl;
      if (Object.keys(patch).length === 0) return att;
      offerChanged = true;
      return { ...att, ...patch };
    });
    if (!offerChanged) return offer;
    changed = true;
    return { ...offer, attachments };
  });
  return changed ? { ...local, offers } : local;
}

/** Cik baitu bilžu datu vēl ietu pa vadu (testiem / diagnostikai). */
export function irissWireImageBytes(rec: IrissPasutijumsRecord): number {
  let n = 0;
  for (const o of rec.offers) {
    for (const a of o.attachments) n += (a.dataUrl?.length ?? 0) + (a.thumbDataUrl?.length ?? 0);
  }
  return n;
}
