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
