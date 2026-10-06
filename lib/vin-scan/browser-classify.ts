/**
 * Redzamā lapas teksta klasifikācija pārlūka zondēm.
 * Tas pats lēmums ir iebūvēts `public/userscripts/provin-vin-autofill.user.js` (`classifyBrowserProbe`).
 */
import type { VinScanBrowserId } from "@/lib/vin-scan/catalog";
import type { VinScanStatus } from "@/lib/vin-scan/types";

export type BrowserProbeRead = {
  status: Exclude<VinScanStatus, "skipped">;
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
export function classifyBrowserProbe(id: VinScanBrowserId, text: string, vin: string): BrowserProbeRead | null {
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
    case "vininspect":
      if (/no records|couldn.t find|didn.t find|0 records/i.test(text)) {
        return { status: "none", summary: "Nav vēstures ieraksta" };
      }
      return hasVin(text, vin) && /records found|vehicle history|we found \d+|full history/i.test(text)
        ? { status: "found", summary: "Ir vēstures priekšskatījums" }
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
    case "cebia":
      return hasVin(text, vin) && /basic verification|z[aá]kladn[ií] ov[eě][rř]en[ií]|smart code/i.test(text)
        ? { status: "found", summary: "Cebia priekšskatījums ir atvērts" }
        : null;
    case "autodna_preview":
      return classifyPaidPreview(text, "AutoDNA");
    case "carvertical_preview":
      if (/inform[aā]cija nav atrasta|no information found|couldn.t find any/i.test(text)) {
        return { status: "none", summary: "CarVertical priekšskatījumā datu nav" };
      }
      return hasVin(text, vin) && /m[eē]s atrad[aā]m|we found|found information|atrad[aā]m datus/i.test(text)
        ? { status: "found", summary: "CarVertical rāda priekšskatījumu. Pirkums paliek operatoram" }
        : null;
    case "auto_vin":
      if (/we correctly identified your vehicle/i.test(text)) {
        const name = /identified your vehicle\s+([^\n.]{3,80})/i.exec(text);
        const vehicle = name?.[1]?.trim() ?? "";
        return {
          status: "manual",
          summary: vehicle
            ? `Auto atpazīts: ${vehicle}. Servisa ieraksti redzami pēc pirkuma`
            : "Auto atpazīts. Servisa ieraksti redzami pēc pirkuma",
        };
      }
      if (/couldn.t identify|unable to identify|invalid vin/i.test(text)) {
        return { status: "none", summary: "auto.vin šo VIN neatpazina" };
      }
      return null;
    case "checkcar_vin":
      return null;
    default:
      return null;
  }
}

function classifyAuction(text: string, vin: string, noneSummary: string, foundSummary: string): BrowserProbeRead | null {
  if (!hasVin(text, vin)) {
    if (/not found|page not found|no vehicle|nothing found/i.test(text)) return { status: "none", summary: noneSummary };
    return null;
  }
  if (/auction|sold|sale date|odometer|mileage|lot|bid/i.test(text)) return { status: "found", summary: foundSummary };
  return null;
}

function classifyPaidPreview(text: string, brand: string): BrowserProbeRead | null {
  if (/nav atrast|dati nav pieejami|no data found|no records found|brak danych|nie znaleziono/i.test(text)) {
    return { status: "none", summary: `${brand} priekšskatījumā datu nav` };
  }
  const count = /(\d+)\s*(ierakst|rekord|records?)/i.exec(text);
  if (count) return { status: "found", summary: `${count[1]} ieraksti ${brand} priekšskatījumā. Pirkums paliek operatoram` };
  if (/pieejam[aā] inform[aā]cija|available data/i.test(text)) {
    return { status: "found", summary: `${brand} rāda priekšskatījumu. Pirkums paliek operatoram` };
  }
  return null;
}

export function classifyCheckcarPhotos(photoCount: number, settled: boolean): BrowserProbeRead | null {
  if (photoCount > 0) return { status: "found", summary: `${photoCount} foto` };
  if (settled) return { status: "none", summary: "Atskaitē nav foto" };
  return null;
}
