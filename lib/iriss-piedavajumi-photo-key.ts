/**
 * PD bilžu stabilā identitāte (Nils 21.11: «dzēšot tiek izdzēsta nepareizā bilde»).
 *
 * Bilde agrāk tika ielādēta pēc kārtas numura (`/foto/3`) ar `Cache-Control: max-age=3600`. Pēc noņemšanas vai
 * pārkārtošanas tas pats numurs norāda uz citu bildi, bet pārlūks rāda kešoto veco - režģī redzamā bilde
 * nesakrīt ar to, kas tiek noņemta. Tagad katrai bildei ir īss, stabils žetons (`?k=`), ko serveris meklē
 * ierakstā; numurs paliek tikai kā rezerves ceļš vecām saitēm. Žetons ir atslēgas jaucējs - avota adrese un
 * Dropbox id netiek atklāti.
 */

import type { IrissPdPhoto } from "@/lib/iriss-piedavajumi-types";

export function photoKey(p: IrissPdPhoto): string {
  if (p.kind === "dropbox") return `d:${p.ref}:${p.id}`;
  if (p.kind === "order") return `o:${p.orderId}:${p.offerId}:${p.attId}`;
  return `u:${p.url}`;
}

function fnv1a(s: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export const IRISS_PD_PHOTO_TOKEN_RE = /^[0-9a-z]{8,16}$/;

/** Stabils bildes žetons (≈64 biti, nemainās, bildi pārvietojot). */
export function irissPdPhotoToken(p: IrissPdPhoto): string {
  const k = photoKey(p);
  return fnv1a(k, 0x811c9dc5).toString(36).padStart(7, "0") + fnv1a(k, 0x01234567).toString(36).padStart(7, "0");
}

/** Darbiniekam maskētā izsoles adrese nes īstās bildes žetonu (nevis kārtas numuru, kas mainās). */
const MASKED_TOKEN_RE = /^https:\/\/pd\.invalid\/p\/t([0-9a-z]{8,16})$/;

export function maskedIrissPdPhotoTokenUrl(token: string): string {
  return `https://pd.invalid/p/t${token}`;
}

export function maskedIrissPdPhotoToken(url: string): string | null {
  return MASKED_TOKEN_RE.exec(url)?.[1] ?? null;
}

/** Žetons bildei, kā to redz pārlūks (arī darbinieka maskētajai). */
export function irissPdPhotoClientToken(p: IrissPdPhoto): string {
  if (p.kind === "url") {
    const t = maskedIrissPdPhotoToken(p.url);
    if (t) return t;
  }
  return irissPdPhotoToken(p);
}

/**
 * Bildes indekss ierakstā: ar žetonu - tikai pēc žetona (-1, ja tādas vairs nav; nekad «kaimiņa» bilde);
 * bez žetona - vecais ceļš pēc numura.
 */
export function resolveIrissPdPhotoIndex(photos: readonly IrissPdPhoto[], index: number, token: string | null | undefined): number {
  const t = (token ?? "").trim();
  if (t) {
    if (!IRISS_PD_PHOTO_TOKEN_RE.test(t)) return -1;
    return photos.findIndex((p) => irissPdPhotoToken(p) === t);
  }
  return Number.isInteger(index) && index >= 0 && index < photos.length ? index : -1;
}

/** Bildes adreses vaicājums: `?k=<žetons>` (+ `&s=full`). */
export function irissPdPhotoQuery(token: string, size: "thumb" | "full"): string {
  const q = new URLSearchParams();
  if (token) q.set("k", token);
  if (size === "full") q.set("s", "full");
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Admina bildes adrese pēc žetona. Ceļā vienmēr `0` - adrese atkarīga tikai no bildes, ne no tās vietas,
 * tāpēc pārvietojot bilde nepārlādējas un kešs nekad nerāda citu bildi tajā vietā.
 */
export function irissPdAdminPhotoSrc(pdId: string, p: IrissPdPhoto, size: "thumb" | "full" = "thumb"): string {
  return `/api/admin/iriss-piedavajumi/${pdId}/foto/0${irissPdPhotoQuery(irissPdPhotoClientToken(p), size)}`;
}
