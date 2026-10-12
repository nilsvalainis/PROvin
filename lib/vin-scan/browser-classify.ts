/**
 * Redzamā lapas teksta klasifikācija pārlūka zondēm un servera HTML ielasei.
 * Tas pats lēmums ir iebūvēts `public/userscripts/provin-vin-autofill.user.js` (`classifyBrowserProbe`).
 */
import type { VinScanBrowserId } from "@/lib/vin-scan/catalog";
import { classifyCheckcarVinText, classifyPlcAuction } from "@/lib/vin-scan/parse";
import { classifyPoliceWanted } from "@/lib/vin-scan/wanted";
import type { VinScanStatus } from "@/lib/vin-scan/types";

export type BrowserProbeRead = {
  status: Exclude<VinScanStatus, "skipped" | "needs_input">;
  summary: string;
};

export function isBrowserChallenge(text: string): boolean {
  return /just a moment|security verification|checking your browser|verify you are human|attention required|cf-browser-verification/i.test(
    text,
  );
}

export function browserProbeBlocker(text: string): "" | "captcha" | "cloudflare" {
  if (isBrowserChallenge(text)) return "cloudflare";
  if (/recaptcha|hcaptcha|i['’]m not a robot|\bcaptcha\b/i.test(text)) return "captcha";
  return "";
}

function hasVin(text: string, vin: string): boolean {
  return text.toUpperCase().includes(vin.trim().toUpperCase());
}

/** null: lapa vēl nav gatava, zonde turpina gaidīt. */
export function classifyBrowserProbe(id: VinScanBrowserId | string, text: string, vin: string): BrowserProbeRead | null {
  if (isBrowserChallenge(text)) return null;
  switch (id) {
    case "stat_vin":
      return classifyAuction(text, vin, "Nav izsoles ieraksta", "Ir izsoles ieraksts");
    case "bid_cars":
      if (/no results|0 vehicles|nothing found|no cars found/i.test(text)) {
        return { status: "none", summary: "Nav izsoles arhīvā" };
      }
      return hasVin(text, vin) && /lot|bid|sold|auction|mileage/i.test(text)
        ? { status: "found", summary: "Ir izsoles ieraksts" }
        : null;
    case "auchistory":
      if (/no (auction )?records|vehicle not found|nothing found/i.test(text)) {
        return { status: "none", summary: "Nav izsoles vēstures" };
      }
      return hasVin(text, vin) && /damage|auction|sold for|\bbid\b/i.test(text)
        ? { status: "found", summary: "Ir izsoles vēsture" }
        : null;
    case "carfax_eu": {
      const found = /we found\s+(\d+)\s+record/i.exec(text);
      if (found) return { status: "found", summary: `${found[1]} ieraksti CARFAX priekšskatījumā` };
      if (/no records found|couldn.t find any records|we didn.t find any/i.test(text)) {
        return { status: "none", summary: "CARFAX priekšskatījumā ierakstu nav" };
      }
      return null;
    }
    case "checkcar_vin": {
      const parsed = classifyCheckcarVinText(text, vin);
      return parsed ? { status: parsed.status as Exclude<VinScanStatus, "skipped" | "needs_input">, summary: parsed.summary } : null;
    }
    case "plc_auction": {
      const parsed = classifyPlcAuction(text);
      return parsed ? { status: parsed.status as Exclude<VinScanStatus, "skipped" | "needs_input">, summary: parsed.summary } : null;
    }
    case "lt_itpr": {
      const parsed = classifyPoliceWanted(id, text, vin);
      return parsed ? { status: parsed.status as Exclude<VinScanStatus, "skipped" | "needs_input">, summary: parsed.summary } : null;
    }
    case "bidfax":
      return classifyAuction(text, vin, "BidFax: nav izsoles ieraksta", "BidFax: ir izsoles ieraksts");
    case "poctra":
      return classifyAuction(text, vin, "Poctra: nav izsoles ieraksta", "Poctra: ir izsoles ieraksts");
    case "nicb":
      if (/stolen/i.test(text) && hasVin(text, vin)) return { status: "found", summary: "NICB: iespējams zagts" };
      if (/no records|not found|clean record|is not listed/i.test(text)) return { status: "none", summary: "NICB sarakstā nav" };
      return null;
    default:
      return null;
  }
}

function classifyAuction(text: string, vin: string, noneSummary: string, foundSummary: string): BrowserProbeRead | null {
  if (!hasVin(text, vin)) {
    if (/not found|page not found|no vehicle|nothing found|no results|no similar cars|were not found/i.test(text)) {
      return { status: "none", summary: noneSummary };
    }
    return null;
  }
  if (/auction|sold|sale date|odometer|mileage|lot|bid/i.test(text)) return { status: "found", summary: foundSummary };
  return null;
}

export function classifyCheckcarPhotos(photoCount: number, settled: boolean): BrowserProbeRead | null {
  if (photoCount > 0) return { status: "found", summary: `${photoCount} foto` };
  if (settled) return { status: "none", summary: "Atskaitē nav foto" };
  return null;
}
