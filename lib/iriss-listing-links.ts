import type { CSSProperties } from "react";
import { coerceIrissListingLinkList } from "@/lib/iriss-listing-link-lists";

/** Droša saite — atvērt tikai http(s). */
export function isHttpUrlForOpen(s: string): boolean {
  const t = s.trim();
  return /^https?:\/\//i.test(t);
}

export type ListingPlatformChipKey = "mobile" | "autobid" | "openline" | "auto1" | "citi";

export const LISTING_PLATFORM_CHIPS: Record<ListingPlatformChipKey, { letter: string; title: string }> = {
  mobile: { letter: "M", title: "Mobile" },
  autobid: { letter: "AB", title: "Autobid" },
  openline: { letter: "OL", title: "Openline" },
  auto1: { letter: "A1", title: "Auto1" },
  citi: { letter: "C", title: "Citi" },
};

/** Inline — admin-ios-theme `a { color }` un Tailwind nevar pārrakstīt. */
export const IR_LISTING_PLATFORM_CHIP_STYLE: Record<ListingPlatformChipKey, CSSProperties> = {
  mobile: { backgroundColor: "#FF3B30", color: "#ffffff", border: "none" },
  autobid: { backgroundColor: "#5AC8FA", color: "#000000", border: "none" },
  openline: { backgroundColor: "#007AFF", color: "#ffffff", border: "none" },
  auto1: { backgroundColor: "#FF9500", color: "#ffffff", border: "none" },
  citi: {
    backgroundColor: "#E5E5EA",
    color: "#3a3a3c",
    border: "1px solid #D1D1D6",
  },
};

export const IR_LISTING_ALL_CHIP_STYLE: CSSProperties = {
  backgroundColor: "#F2F2F7",
  color: "#3a3a3c",
  border: "1px solid #D1D1D6",
};

/** Lauki, pēc kuriem veidojas platformu čipu saites (kārtība: M, AB, OL, A1, tad Citi). Vecais formāts: virkne. */
export type IrissListingLinkField = string | readonly string[] | null | undefined;

export type IrissListingLinksInput = {
  listingLinkMobile: IrissListingLinkField;
  listingLinkAutobid: IrissListingLinkField;
  listingLinkOpenline: IrissListingLinkField;
  listingLinkAuto1: IrissListingLinkField;
  listingLinksOther: IrissListingLinkField;
};

/** Pietiek visām rindām vienā avotā (skat. `IRISS_LISTING_LINKS_PER_SOURCE_MAX`). */
export const IRISS_LISTING_PLATFORM_CHIPS_MAX = 40;

export type ListingPlatformChipDisplay = {
  href: string;
  letter: string;
  title: string;
  chipStyle: CSSProperties;
};

export function buildListingPlatformChips(
  src: IrissListingLinksInput,
  max = IRISS_LISTING_PLATFORM_CHIPS_MAX,
): ListingPlatformChipDisplay[] {
  const out: ListingPlatformChipDisplay[] = [];
  const push = (href: string, key: ListingPlatformChipKey) => {
    if (out.length >= max) return;
    const t = href.trim();
    if (!t || !isHttpUrlForOpen(t)) return;
    const c = LISTING_PLATFORM_CHIPS[key];
    out.push({
      href: t,
      letter: c.letter,
      title: c.title,
      chipStyle: IR_LISTING_PLATFORM_CHIP_STYLE[key],
    });
  };
  const pushAll = (raw: IrissListingLinkField, key: ListingPlatformChipKey) => {
    for (const href of coerceIrissListingLinkList(raw)) {
      if (out.length >= max) return;
      push(href, key);
    }
  };
  pushAll(src.listingLinkMobile, "mobile");
  pushAll(src.listingLinkAutobid, "autobid");
  pushAll(src.listingLinkOpenline, "openline");
  pushAll(src.listingLinkAuto1, "auto1");
  pushAll(src.listingLinksOther, "citi");
  return out;
}

/** Horizontālā ritināšana — `px`/`py`, lai `rounded-md` čipu stūri netiek sagriezti (īpaši iOS). */
export const LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS =
  "flex min-w-0 flex-nowrap items-center gap-2.5 overflow-x-auto overscroll-x-contain px-1 py-1.5 [-webkit-overflow-scrolling:touch]";

export const LISTING_PLATFORM_CHIPS_SCROLL_ROW_COMPACT_CLASS =
  "flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]";

/** Kompakts noapaļots taisnstūris ar burtu; krāsas — `style={chipStyle}` no `buildListingPlatformChips`. */
export const LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS =
  "iriss-listing-platform-chip inline-flex h-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-xl px-2.5 text-[11px] font-semibold leading-none tracking-tight shadow-sm transition-transform active:scale-[0.96] sm:h-10 sm:min-w-[2.6rem] sm:px-2.5";

export const LISTING_PLATFORM_CHIP_ANCHOR_COMPACT_CLASS =
  "iriss-listing-platform-chip inline-flex h-6 min-w-[1.35rem] shrink-0 items-center justify-center rounded-md px-1.5 text-[9px] font-semibold leading-none tracking-tight transition-transform active:scale-[0.96]";
