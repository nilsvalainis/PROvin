/**
 * j70: izsoles/portāla saite -> avots + auto atslēga. Adapteru saraksts nosaka, ko katram avotam var nolasīt.
 * Auto1 - pilnībā (releja detaļu lapa + 5 bloki). Openlane - releja detaļu lapa (bez Auto1 blokiem).
 * Autobid un mobile.de - tikai atpazīšana (stub): piedāvājums izveidojas ar saiti, lauki jāaizpilda ar roku,
 * kamēr nav piekļuves (API vai releja lasītāja). Jaunu adapteri pievieno šeit un `from-link` maršrutā.
 */

import { parseIrissAuctionLink } from "@/lib/iriss-auction-link";
import type { IrissPdSource } from "@/lib/iriss-piedavajumi-types";

export type IrissPdLinkSource = Exclude<IrissPdSource, "autoparks" | "manual">;

export type IrissPdDetectedLink = { source: IrissPdLinkSource; key: string; url: string };

export type IrissPdAdapterMode = "relay_auto1" | "relay_basic" | "stub";

export type IrissPdAdapter = {
  source: IrissPdLinkSource;
  mode: IrissPdAdapterMode;
  /** Ko UI saka, ja datu nolasīšana nav pieejama. */
  stubNote: string;
};

export const IRISS_PD_ADAPTERS: Record<IrissPdLinkSource, IrissPdAdapter> = {
  auto1: { source: "auto1", mode: "relay_auto1", stubNote: "" },
  openlane: { source: "openlane", mode: "relay_basic", stubNote: "" },
  autobid: { source: "autobid", mode: "stub", stubNote: "Autobid datu nolasīšana vēl nav pieslēgta - saite saglabāta, lauki jāaizpilda ar roku." },
  mobilede: { source: "mobilede", mode: "stub", stubNote: "mobile.de datu nolasīšana vēl nav pieslēgta - saite saglabāta, lauki jāaizpilda ar roku." },
};

function toUrl(raw: string): URL | null {
  const t = raw.trim();
  if (!t || t.length > 2000) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.protocol = "https:";
    u.hash = "";
    return u;
  } catch {
    return null;
  }
}

/** mobile.de: `?id=123456789` (suchen.mobile.de) vai `/.../123456789.html`. */
function parseMobileDe(u: URL): string {
  if (!/(^|\.)mobile\.de$/i.test(u.hostname)) return "";
  const q = (u.searchParams.get("id") ?? "").trim();
  if (/^\d{6,}$/.test(q)) return q;
  const m = u.pathname.match(/(\d{6,})(?:\.html)?\/?$/);
  return m ? m[1]! : "";
}

/** Tikai platformas nosaukums (UI zīmei rakstīšanas laikā). */
export function irissPdLinkSourceHint(raw: string): IrissPdLinkSource | null {
  const u = toUrl(raw);
  if (!u) return null;
  const h = u.hostname.toLowerCase();
  if (/(^|\.)auto1\.(com|eu)$/.test(h)) return "auto1";
  if (/(^|\.)(openlane|openline)\.(eu|com)$/.test(h)) return "openlane";
  if (/(^|\.)autobid\.(de|eu)$/.test(h)) return "autobid";
  if (/(^|\.)mobile\.de$/.test(h)) return "mobilede";
  return null;
}

/** Autobid: `/item/<slug>-3215456/...` vai `/lot/48213-ford-transit` (pirmais garais skaitlis ceļā). */
function parseAutobid(u: URL): string {
  if (!/(^|\.)autobid\.(de|eu)$/i.test(u.hostname)) return "";
  const m = u.pathname.match(/\/(?:item|lot|car|auction)\/(?:[^/]*?-)?(\d{4,})(?=[-/?]|$)/i);
  return m ? m[1]! : "";
}

export function detectIrissPdLink(raw: string): IrissPdDetectedLink | null {
  const u = toUrl(raw);
  if (!u) return null;
  const mobile = parseMobileDe(u);
  if (mobile) return { source: "mobilede", key: mobile, url: u.toString() };
  const autobid = parseAutobid(u);
  if (autobid) return { source: "autobid", key: autobid, url: u.toString() };
  const link = parseIrissAuctionLink(u.toString());
  if (!link) return null;
  const source: IrissPdLinkSource = link.platform === "openline" ? "openlane" : link.platform;
  return { source, key: link.key, url: link.url };
}

/** «Atpazīts: Auto1» kļūdu teksti (bez tehniskiem kodiem). */
export function irissPdLinkErrorLv(error: string, note?: string): string {
  if (error === "not_auction_link") return "Saite nav atpazīta - der Auto1, Autobid, Openlane vai mobile.de auto lapa.";
  if (note?.trim()) return note.trim();
  return "Neizdevās nolasīt saiti - pārbaudi URL vai aizpildi manuāli.";
}
