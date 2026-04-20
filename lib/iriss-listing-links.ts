import type { CSSProperties } from "react";

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

/** Lauki, pēc kuriem veidojas līdz `max` platformu čipu saitēm (kārtība: M, AB, OL, A1, tad Citi). */
export type IrissListingLinksInput = {
  listingLinkMobile: string;
  listingLinkAutobid: string;
  listingLinkOpenline: string;
  listingLinkAuto1: string;
  listingLinksOther: readonly string[];
};

export type ListingPlatformChipDisplay = {
  href: string;
  letter: string;
  title: string;
  chipStyle: CSSProperties;
};

export function buildListingPlatformChips(src: IrissListingLinksInput, max = 5): ListingPlatformChipDisplay[] {
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
  push(src.listingLinkMobile, "mobile");
  push(src.listingLinkAutobid, "autobid");
  push(src.listingLinkOpenline, "openline");
  push(src.listingLinkAuto1, "auto1");
  for (const line of src.listingLinksOther) {
    if (out.length >= max) break;
    const t = line.trim();
    if (!t || !isHttpUrlForOpen(t)) continue;
    const c = LISTING_PLATFORM_CHIPS.citi;
    out.push({
      href: t,
      letter: c.letter,
      title: c.title,
      chipStyle: IR_LISTING_PLATFORM_CHIP_STYLE.citi,
    });
  }
  return out;
}

/** Horizontālā ritināšana — `px`/`py`, lai `rounded-md` čipu stūri netiek sagriezti (īpaši iOS). */
export const LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS =
  "flex min-w-0 flex-nowrap items-center gap-2.5 overflow-x-auto overscroll-x-contain px-1 py-1.5 [-webkit-overflow-scrolling:touch]";

/** Kompakts noapaļots taisnstūris ar burtu; krāsas — `style={chipStyle}` no `buildListingPlatformChips`. */
export const LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS =
  "iriss-listing-platform-chip inline-flex h-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-xl px-2.5 text-[11px] font-semibold leading-none tracking-tight shadow-sm transition-transform active:scale-[0.96] sm:h-10 sm:min-w-[2.6rem] sm:px-2.5";
