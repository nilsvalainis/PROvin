/** Izsoļu logotipi no `public/brand/auction/`. Ja faila nav, paliek teksta birka. */

export type LogisticsAuctionLogo = {
  src: string | null;
  label: string;
  alt: string;
};

const FILES: Record<string, string> = {
  auto1: "/brand/auction/auto1.svg",
  autobid: "/brand/auction/autobid.svg",
  openlane: "/brand/auction/openlane.svg",
  ecarstrade: "/brand/auction/ecarstrade.svg",
  mobile: "/brand/auction/mobile.svg",
  "mobile.de": "/brand/auction/mobile.svg",
};

function keyOf(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[-_]/g, "")
    .replace(/\.(com|de|eu|net|org)$/i, "");
}

export function logisticsAuctionLogo(name: string): LogisticsAuctionLogo {
  const raw = name.trim() || "cits";
  const key = keyOf(raw);
  const src = FILES[key] ?? null;
  return { src, label: raw, alt: raw };
}
