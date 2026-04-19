/** Saite no admin iekopētā teksta — pievieno https, ja nav shēmas. */
export function hrefFromPastedUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[a-z][-a-z0-9+.]*:/i.test(t)) return t;
  return `https://${t}`;
}

export type AuctionLinksPayload = {
  mobile: string;
  autobid: string;
  openline: string;
  auto1: string;
  citi: string[];
};

export type AuctionLinkIconItem = {
  key: string;
  href: string;
  abbr: string;
  title: string;
  pillClass: string;
};

const PILL_MOBILE = "bg-red-600 text-white shadow-sm ring-1 ring-red-700/25";
const PILL_AUTOBID = "bg-[#b8d4f0] text-[#0f2940] shadow-sm ring-1 ring-sky-800/15";
const PILL_OPENLINE = "bg-blue-800 text-white shadow-sm ring-1 ring-blue-950/30";
const PILL_AUTO1 = "bg-orange-500 text-white shadow-sm ring-1 ring-orange-700/25";
const PILL_CITI = "bg-emerald-500 text-white shadow-sm ring-1 ring-emerald-800/25";

/** Līdz 5 ikonām: M, AB, OP, A1, tad aizpildītās „Citi” rindas secībā. */
export function buildAuctionLinkIconRow(al: AuctionLinksPayload, max = 5): AuctionLinkIconItem[] {
  const out: AuctionLinkIconItem[] = [];
  const add = (key: string, raw: string, abbr: string, title: string, pillClass: string) => {
    if (out.length >= max) return;
    const href = hrefFromPastedUrl(raw);
    if (!href) return;
    out.push({ key, href, abbr, title, pillClass });
  };
  add("m", al.mobile, "M", "Mobile", PILL_MOBILE);
  add("ab", al.autobid, "AB", "Autobid", PILL_AUTOBID);
  add("op", al.openline, "OP", "Openline", PILL_OPENLINE);
  add("a1", al.auto1, "A1", "Auto1", PILL_AUTO1);
  let ci = 0;
  for (const row of al.citi) {
    if (out.length >= max) break;
    add(`c${ci}`, row, "C", `Citi${ci > 0 ? ` (${ci + 1})` : ""}`, PILL_CITI);
    ci += 1;
  }
  return out;
}
