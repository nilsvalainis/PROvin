import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

/** RSC pirmajai krāsai — noņem data URL, atstāj metadatus (id, nosaukums, izmērs). */
export function stripIrissOfferImageDataUrls(rec: IrissPasutijumsRecord): IrissPasutijumsRecord {
  return {
    ...rec,
    offers: rec.offers.map((o) => ({
      ...o,
      attachments: o.attachments.map((a) => ({
        ...a,
        ...(a.dataUrl ? { dataUrl: "" } : {}),
        ...(a.thumbDataUrl ? { thumbDataUrl: "" } : {}),
      })),
    })),
  };
}

export function irissRecordNeedsOfferImageHydration(rec: IrissPasutijumsRecord): boolean {
  return rec.offers.some((o) =>
    o.attachments.some((a) => {
      if (a.dataUrl || a.thumbDataUrl) return false;
      return a.size > 0 || Boolean(a.blobPath);
    }),
  );
}

/** Aizpilda tukšos dataUrl no pilnā ieraksta, nemainot lietotāja jau rediģētos laukus. */
export function mergeIrissOfferImageDataUrls(
  current: IrissPasutijumsRecord,
  full: IrissPasutijumsRecord,
): IrissPasutijumsRecord {
  const byOffer = new Map(full.offers.map((o) => [o.id, o]));
  return {
    ...current,
    offers: current.offers.map((o) => {
      const src = byOffer.get(o.id);
      if (!src) return o;
      const byAtt = new Map(src.attachments.map((a) => [a.id, a]));
      return {
        ...o,
        coverAttachmentId: o.coverAttachmentId || src.coverAttachmentId,
        attachments: o.attachments.map((a) => {
          const f = byAtt.get(a.id);
          const dataUrl = a.dataUrl || f?.dataUrl || "";
          const thumbDataUrl = a.thumbDataUrl || f?.thumbDataUrl || "";
          return {
            ...a,
            ...(dataUrl ? { dataUrl } : {}),
            ...(thumbDataUrl ? { thumbDataUrl } : {}),
            ...(!a.blobPath && f?.blobPath ? { blobPath: f.blobPath } : {}),
            ...(!a.blobUrl && f?.blobUrl ? { blobUrl: f.blobUrl } : {}),
            ...(!a.thumbBlobPath && f?.thumbBlobPath ? { thumbBlobPath: f.thumbBlobPath } : {}),
            ...(!a.thumbUrl && f?.thumbUrl ? { thumbUrl: f.thumbUrl } : {}),
          };
        }),
      };
    }),
  };
}
