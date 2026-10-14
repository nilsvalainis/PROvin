import type { CSSProperties } from "react";
import type { IrissAuctionLogoKey } from "@/lib/iriss-auction-logos";
import { coerceIrissListingLinkList } from "@/lib/iriss-listing-link-lists";

/** Droša saite — atvērt tikai http(s). */
export function isHttpUrlForOpen(s: string): boolean {
  const t = s.trim();
  return /^https?:\/\//i.test(t);
}

export type ListingPlatformChipKey = "mobile" | "autobid" | "openline" | "auto1" | "ecarstrade" | "citi";

export const LISTING_PLATFORM_CHIPS: Record<ListingPlatformChipKey, { letter: string; title: string }> = {
  mobile: { letter: "M", title: "Mobile" },
  autobid: { letter: "AB", title: "Autobid" },
  openline: { letter: "OL", title: "Openline" },
  auto1: { letter: "A1", title: "Auto1" },
  ecarstrade: { letter: "ET", title: "eCarsTrade" },
  citi: { letter: "C", title: "Citi" },
};

/** Official logos: no pill fill. Citi paliek teksta etiķete. */
export const IR_LISTING_PLATFORM_CHIP_STYLE: Record<ListingPlatformChipKey, CSSProperties> = {
  mobile: { backgroundColor: "transparent", color: "inherit", border: "none", boxShadow: "none" },
  autobid: { backgroundColor: "transparent", color: "inherit", border: "none", boxShadow: "none" },
  openline: { backgroundColor: "transparent", color: "inherit", border: "none", boxShadow: "none" },
  auto1: { backgroundColor: "transparent", color: "inherit", border: "none", boxShadow: "none" },
  ecarstrade: { backgroundColor: "transparent", color: "inherit", border: "none", boxShadow: "none" },
  citi: {
    backgroundColor: "transparent",
    color: "#3a3a3c",
    border: "none",
    boxShadow: "none",
  },
};

export const IR_LISTING_ALL_CHIP_STYLE: CSSProperties = {
  backgroundColor: "#F2F2F7",
  color: "#3a3a3c",
  border: "1px solid #D1D1D6",
};

/** Lauki, pēc kuriem veidojas platformu čipu saites (kārtība: M, AB, OL, A1, ET, tad Citi). Vecais formāts: virkne. */
export type IrissListingLinkField = string | readonly string[] | null | undefined;

export type IrissListingLinksInput = {
  listingLinkMobile: IrissListingLinkField;
  listingLinkAutobid: IrissListingLinkField;
  listingLinkOpenline: IrissListingLinkField;
  listingLinkAuto1: IrissListingLinkField;
  listingLinkEcarstrade: IrissListingLinkField;
  listingLinksOther: IrissListingLinkField;
};

/** Pietiek visām rindām vienā avotā (skat. `IRISS_LISTING_LINKS_PER_SOURCE_MAX`). */
export const IRISS_LISTING_PLATFORM_CHIPS_MAX = 40;

export type ListingPlatformChipDisplay = {
  href: string;
  letter: string;
  title: string;
  chipStyle: CSSProperties;
  logoKey: IrissAuctionLogoKey;
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
      logoKey: key,
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
  pushAll(src.listingLinkEcarstrade, "ecarstrade");
  pushAll(src.listingLinksOther, "citi");
  return out;
}

/** Horizontālā ritināšana — `px`/`py`, lai `rounded-md` čipu stūri netiek sagriezti (īpaši iOS). */
export const LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS =
  "flex min-w-0 flex-nowrap items-center gap-2.5 overflow-x-auto overscroll-x-contain px-1 py-1.5 [-webkit-overflow-scrolling:touch]";

export const LISTING_PLATFORM_CHIPS_SCROLL_ROW_COMPACT_CLASS =
  "flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]";

/** Logo saite bez čipa fona / robežas. */
export const LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS =
  "iriss-listing-platform-chip inline-flex h-8 shrink-0 items-center justify-center bg-transparent px-0.5 text-[11px] font-semibold leading-none tracking-tight shadow-none transition-opacity hover:opacity-80 active:scale-[0.98]";

export const LISTING_PLATFORM_CHIP_ANCHOR_COMPACT_CLASS =
  "iriss-listing-platform-chip inline-flex h-6 shrink-0 items-center justify-center bg-transparent px-0.5 text-[9px] font-semibold leading-none tracking-tight shadow-none transition-opacity hover:opacity-80 active:scale-[0.98]";
