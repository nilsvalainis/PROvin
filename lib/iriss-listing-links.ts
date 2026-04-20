/** Droša saite — atvērt tikai http(s). */
export function isHttpUrlForOpen(s: string): boolean {
  const t = s.trim();
  return /^https?:\/\//i.test(t);
}

export type ListingPlatformChipKey = "mobile" | "autobid" | "openline" | "auto1" | "citi";

export const LISTING_PLATFORM_CHIPS: Record<
  ListingPlatformChipKey,
  { letter: string; title: string; chipClass: string }
> = {
  mobile: {
    letter: "M",
    title: "Mobile",
    chipClass: "border-0 bg-[#FF3B30] !text-white shadow-sm",
  },
  autobid: {
    letter: "AB",
    title: "Autobid",
    chipClass: "border-0 bg-[#5AC8FA] !text-[#0a1628] shadow-sm",
  },
  openline: {
    letter: "OL",
    title: "Openline",
    chipClass: "border-0 bg-[#007AFF] !text-white shadow-sm",
  },
  auto1: {
    letter: "A1",
    title: "Auto1",
    chipClass: "border-0 bg-[#FF9500] !text-white shadow-sm",
  },
  citi: {
    letter: "C",
    title: "Citi",
    chipClass: "border border-[#D1D1D6] bg-[#E5E5EA] !text-[#3a3a3c] shadow-sm",
  },
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
  chipClass: string;
};

export function buildListingPlatformChips(src: IrissListingLinksInput, max = 5): ListingPlatformChipDisplay[] {
  const out: ListingPlatformChipDisplay[] = [];
  const push = (href: string, key: ListingPlatformChipKey) => {
    if (out.length >= max) return;
    const t = href.trim();
    if (!t || !isHttpUrlForOpen(t)) return;
    const c = LISTING_PLATFORM_CHIPS[key];
    out.push({ href: t, letter: c.letter, title: c.title, chipClass: c.chipClass });
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
    out.push({ href: t, letter: c.letter, title: c.title, chipClass: c.chipClass });
  }
  return out;
}

/** Horizontālā ritināšana — `px`/`py`, lai `rounded-md` čipu stūri netiek sagriezti (īpaši iOS). */
export const LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS =
  "flex min-w-0 flex-nowrap items-center gap-2.5 overflow-x-auto overscroll-x-contain px-1 py-1.5 [-webkit-overflow-scrolling:touch]";

/** Kompakts noapaļots taisnstūris ar burtu; pielikt `LISTING_PLATFORM_CHIPS[*].chipClass` (krāsas). */
export const LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS =
  "iriss-listing-platform-chip inline-flex h-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-xl px-2.5 text-[11px] font-semibold leading-none tracking-tight transition-transform active:scale-[0.96] sm:h-10 sm:min-w-[2.6rem] sm:px-2.5";

/** „Atvērt visas” — neitrāls iOS pelēks, lai nesaplūst ar platformu krāsām. */
export const LISTING_PLATFORM_CHIP_ALL_BUTTON_CLASS =
  "border border-[#D1D1D6] bg-[#F2F2F7] !text-[#3a3a3c] shadow-sm";
