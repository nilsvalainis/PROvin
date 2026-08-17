import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

/** RSC pirmajai krāsai — noņem data URL, atstāj metadatus (id, nosaukums, izmērs). */
export function stripIrissOfferImageDataUrls(rec: IrissPasutijumsRecord): IrissPasutijumsRecord {
  return {
    ...rec,
    offers: rec.offers.map((o) => ({
      ...o,
      attachments: o.attachments.map((a) => (a.dataUrl ? { ...a, dataUrl: "" } : a)),
    })),
  };
}

export function irissRecordNeedsOfferImageHydration(rec: IrissPasutijumsRecord): boolean {
  return rec.offers.some((o) => o.attachments.some((a) => a.size > 0 && !a.dataUrl));
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
        attachments: o.attachments.map((a) => {
          if (a.dataUrl) return a;
          const f = byAtt.get(a.id);
          return f?.dataUrl ? { ...a, dataUrl: f.dataUrl } : a;
        }),
      };
    }),
  };
}
