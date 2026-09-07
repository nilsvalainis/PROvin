/** OneAuto Vehicle Imagery: Image Search by VIN → Image from ID. */

export const ONEAUTO_IMAGE_SEARCH_BY_VIN_PATH = "/vehicleimagery/imagesearchfromvin/";
export const ONEAUTO_IMAGE_FROM_ID_PATH = "/vehicleimagery/imagefromid/";

/** Meklēšana 0,18 € + katrs Image from ID 0,18 €. */
export const ONEAUTO_IMAGE_SEARCH_PRICE_CENTS = 18;
export const ONEAUTO_IMAGE_FROM_ID_PRICE_CENTS = 18;

/** Preferētie skati (ārpuse); iekšpusi ņemam tikai ja ārējo nav. */
export const ONEAUTO_IMAGE_PREFERRED_VIEWS = [
  "front",
  "front_right",
  "right",
  "rear_right",
  "rear",
  "rear_left",
  "left",
  "front_left",
] as const;

export const ONEAUTO_IMAGE_MAX_VIEWS = 4;

export const ONEAUTO_PHOTO_GROUP_TITLE = "OneAuto kataloga foto";

export type OneautoImageViewId = {
  view: string;
  imageId: string;
};

export type OneautoImageSearchMatch = {
  manufacturer: string;
  modelRange: string;
  manufacturedYear: number | null;
  colourHints: string[];
  views: OneautoImageViewId[];
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function unwrapResult(payload: unknown): unknown {
  const o = asRecord(payload);
  if (!o) return payload;
  if (o.result != null) return o.result;
  if (o.data != null) return o.data;
  return payload;
}

/** Izvelk image_id sarakstu no Image Search by VIN atbildes. */
export function parseOneautoImageSearchPayload(payload: unknown): OneautoImageSearchMatch | null {
  const result = asRecord(unwrapResult(payload));
  if (!result) return null;
  const images = Array.isArray(result.images) ? result.images : [];
  if (images.length === 0) return null;

  const first = asRecord(images[0]);
  if (!first) return null;
  const ids = asRecord(first.image_ids) ?? asRecord(first.imageIds);
  if (!ids) return null;

  const views: OneautoImageViewId[] = [];
  const seen = new Set<string>();
  const pushView = (view: string, raw: unknown) => {
    if (typeof raw !== "string") return;
    const imageId = raw.trim();
    if (!imageId || seen.has(imageId)) return;
    seen.add(imageId);
    views.push({ view: view.slice(0, 40), imageId: imageId.slice(0, 120) });
  };

  for (const view of ONEAUTO_IMAGE_PREFERRED_VIEWS) {
    pushView(view, ids[view]);
  }
  for (const [view, raw] of Object.entries(ids)) {
    if (views.length >= ONEAUTO_IMAGE_MAX_VIEWS) break;
    if (/^inside/i.test(view)) continue;
    pushView(view, raw);
  }
  if (views.length === 0) {
    for (const [view, raw] of Object.entries(ids)) {
      if (views.length >= ONEAUTO_IMAGE_MAX_VIEWS) break;
      pushView(view, raw);
    }
  }

  const trimmed = views.slice(0, ONEAUTO_IMAGE_MAX_VIEWS);
  if (trimmed.length === 0) return null;

  const colourRaw = first.colour_desc_list ?? first.colourDescList ?? result.colour_desc_list;
  const colourHints = Array.isArray(colourRaw)
    ? colourRaw.filter((c): c is string => typeof c === "string" && c.trim().length > 0).slice(0, 12)
    : [];

  const yearRaw = first.manufactured_year ?? first.manufacturedYear;
  const manufacturedYear =
    typeof yearRaw === "number" && Number.isFinite(yearRaw)
      ? yearRaw
      : typeof yearRaw === "string" && /^\d{4}$/.test(yearRaw.trim())
        ? Number(yearRaw)
        : null;

  return {
    manufacturer: String(first.manufacturer_desc ?? first.manufacturerDesc ?? "").trim().slice(0, 80),
    modelRange: String(first.model_range_desc ?? first.modelRangeDesc ?? "").trim().slice(0, 80),
    manufacturedYear,
    colourHints,
    views: trimmed,
  };
}

export function parseOneautoImageFromIdUrl(payload: unknown): string | null {
  const result = asRecord(unwrapResult(payload));
  if (!result) return null;
  const url = result.image_url ?? result.imageUrl ?? result.url;
  if (typeof url !== "string") return null;
  const t = url.trim();
  if (!/^https?:\/\//i.test(t)) return null;
  return t.slice(0, 4000);
}

export function oneautoImageFetchCostCents(viewCount: number): number {
  const n = Math.max(0, Math.min(ONEAUTO_IMAGE_MAX_VIEWS, Math.floor(viewCount)));
  return ONEAUTO_IMAGE_SEARCH_PRICE_CENTS + n * ONEAUTO_IMAGE_FROM_ID_PRICE_CENTS;
}

export function formatOneautoImageCostEur(viewCount: number): string {
  const n = oneautoImageFetchCostCents(viewCount) / 100;
  return `€${n.toFixed(2)}`;
}
