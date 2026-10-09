import { dropOrResetRow } from "@/lib/admin-drop-or-reset-row";
import { isValidHttpUrl } from "@/lib/order-field-validation";

/** Maks. saišu skaits vienā avotā (Auto1, Openlane, Autobid, Mobile, Citi). */
export const IRISS_LISTING_LINKS_PER_SOURCE_MAX = 20;

export type IrissPasutijumsListingLinkFields = {
  listingLinkMobile: string[];
  listingLinkAutobid: string[];
  listingLinkOpenline: string[];
  listingLinkAuto1: string[];
  listingLinksOther: string[];
};

export function emptyIrissListingLinkList(): string[] {
  return [""];
}

/**
 * Vecais formāts: viena virkne. Jaunais: masīvs. Tukšs / nezināms → viena tukša rinda formai.
 * Kārtība saglabājas.
 */
export function coerceIrissListingLinkList(raw: unknown): string[] {
  let items: string[];
  if (typeof raw === "string") {
    items = [raw];
  } else if (Array.isArray(raw)) {
    items = raw.map((x) => (typeof x === "string" ? x : "")).slice(0, IRISS_LISTING_LINKS_PER_SOURCE_MAX);
  } else {
    items = [""];
  }
  return items.length > 0 ? items : emptyIrissListingLinkList();
}

export function normalizeIrissListingLinkList(raw: unknown, sanitize?: (s: string) => string): string[] {
  const mapped = coerceIrissListingLinkList(raw).map((s) => (sanitize ? sanitize(s) : s));
  return mapped.length > 0 ? mapped.slice(0, IRISS_LISTING_LINKS_PER_SOURCE_MAX) : emptyIrissListingLinkList();
}

export function addIrissListingLinkRow(links: readonly string[]): string[] {
  if (links.length >= IRISS_LISTING_LINKS_PER_SOURCE_MAX) return [...links];
  return [...links, ""];
}

export function removeIrissListingLinkRow(links: readonly string[], idx: number): string[] {
  return dropOrResetRow([...links], idx, () => "");
}

export function setIrissListingLinkRow(links: readonly string[], idx: number, value: string): string[] {
  const next = [...links];
  if (idx < 0 || idx >= next.length) return next;
  next[idx] = value;
  return next;
}

/** Aizpildītās rindas (trim), kārtība saglabāta. */
export function filledIrissListingLinks(raw: unknown): string[] {
  return coerceIrissListingLinkList(raw)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isValidIrissListingLinkUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  return isValidHttpUrl(t);
}

export function irissListingLinkUrlError(raw: string): string | null {
  if (isValidIrissListingLinkUrl(raw)) return null;
  return "Nederīga saite. Izmantojiet http:// vai https://.";
}

export function labelIrissListingLinkRows(
  groups: ReadonlyArray<{ label: string; hrefs: readonly string[] }>,
): Array<{ label: string; href: string }> {
  const out: Array<{ label: string; href: string }> = [];
  for (const g of groups) {
    const filled = filledIrissListingLinks(g.hrefs);
    for (let i = 0; i < filled.length; i++) {
      out.push({
        label: filled.length > 1 ? `${g.label} ${i + 1}` : g.label,
        href: filled[i]!,
      });
    }
  }
  return out;
}

function fieldFromRaw(o: Record<string, unknown>, key: string, alias?: string): unknown {
  if (key in o) return o[key];
  if (alias && alias in o) return o[alias];
  return undefined;
}

/** Pasūtījuma JSON (vecs vienas virknes formāts vai masīvi) → piecu avotu masīvi. */
export function parseIrissPasutijumsListingLinks(
  raw: unknown,
  sanitize?: (s: string) => string,
): IrissPasutijumsListingLinkFields {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    listingLinkMobile: normalizeIrissListingLinkList(fieldFromRaw(o, "listingLinkMobile", "listingLinksMobile"), sanitize),
    listingLinkAutobid: normalizeIrissListingLinkList(fieldFromRaw(o, "listingLinkAutobid", "listingLinksAutobid"), sanitize),
    listingLinkOpenline: normalizeIrissListingLinkList(fieldFromRaw(o, "listingLinkOpenline", "listingLinksOpenline"), sanitize),
    listingLinkAuto1: normalizeIrissListingLinkList(fieldFromRaw(o, "listingLinkAuto1", "listingLinksAuto1"), sanitize),
    listingLinksOther: normalizeIrissListingLinkList(o.listingLinksOther, sanitize),
  };
}
