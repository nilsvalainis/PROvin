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
    chipClass: "bg-red-600 text-white ring-1 ring-red-700/30",
  },
  autobid: {
    letter: "AB",
    title: "Autobid",
    chipClass: "bg-sky-200 text-slate-800 ring-1 ring-sky-400/40",
  },
  openline: {
    letter: "OP",
    title: "Openline",
    chipClass: "bg-blue-900 text-white ring-1 ring-blue-950/40",
  },
  auto1: {
    letter: "A1",
    title: "Auto1",
    chipClass: "bg-[#ff6600] text-white ring-1 ring-orange-700/35",
  },
  citi: {
    letter: "C",
    title: "Citi",
    chipClass: "bg-emerald-500 text-white ring-1 ring-emerald-700/35",
  },
};

/** Lauki, pēc kuriem veidojas līdz `max` platformu čipu saitēm (kārtība: M, AB, OP, A1, tad Citi). */
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
