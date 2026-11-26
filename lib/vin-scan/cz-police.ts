/**
 * Policie ČR «Pátrání po vozidlech» (policie.gov.cz/patrani-vozidla): vai auto ir Čehijas policijas
 * zagto transportlīdzekļu meklēšanā. Tikai VIN, bez maksas, bez captcha (26.11 pārbaudīts:
 * meklēšana ir servera renderēts GET `?Vin=`; lapā nav automatizācijas aizlieguma, «visi vaicājumi
 * tiek reģistrēti», dati informatīvi). Tīrs parsētājs bez tīkla.
 */
import type { VinScanParse } from "@/lib/vin-scan/types";

export const CZ_POLICE_BASE_URL = "https://policie.gov.cz/patrani-vozidla";

export function czPoliceSearchUrl(vin: string): string {
  return `${CZ_POLICE_BASE_URL}?Vin=${encodeURIComponent(vin.trim().toUpperCase())}`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}

/** Redzamais teksts: bez skriptiem, stiliem un tagiem (input `value` ar VIN tekstā nenonāk). */
export function czPoliceVisibleText(html: string): string {
  const noScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  return decodeEntities(noScripts.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function cellTexts(rowHtml: string): string[] {
  const cells: string[] = [];
  const re = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowHtml))) cells.push(czPoliceVisibleText(m[1] ?? ""));
  return cells;
}

export type CzPoliceHit = {
  druh: string;
  vyrobce: string;
  typ: string;
  rz: string;
  mpz: string;
  vin: string;
  detailUrl: string;
};

/** Rezultātu tabulas rinda ar meklēto VIN (kolonnas: Druh, Výrobce, TYP, RZ, MPZ, VIN, Otevřít detail). */
export function parseCzPoliceHits(html: string, vin: string): CzPoliceHit[] {
  const wanted = vin.trim().toUpperCase();
  const out: CzPoliceHit[] = [];
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const cells = cellTexts(row);
    if (cells.length < 6) continue;
    const vinCell = cells.find((c) => c.toUpperCase().replace(/\s+/g, "") === wanted) ?? "";
    if (!vinCell) continue;
    const href = /href="([^"]*[?&]id=[^"]*)"/i.exec(row)?.[1] ?? "";
    const detailUrl = href ? new URL(decodeEntities(href), `${CZ_POLICE_BASE_URL}/`).toString() : "";
    out.push({
      druh: cells[0] ?? "",
      vyrobce: cells[1] ?? "",
      typ: cells[2] ?? "",
      rz: cells[3] ?? "",
      mpz: cells[4] ?? "",
      vin: wanted,
      detailUrl,
    });
  }
  return out;
}

export type CzPoliceDetail = {
  barva: string;
  rokVyroby: string;
  datumVyhlaseni: string;
};

const DETAIL_LABELS = ["Druh", "Výrobce", "Typ", "RZ", "MPZ", "Číslo VIN", "Číslo motoru", "Rok výroby", "Barva", "Datum vyhlášení"];

function detailValue(text: string, label: string): string {
  const others = DETAIL_LABELS.filter((l) => l !== label)
    .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const re = new RegExp(`${label}:\\s*(.*?)\\s*(?=(?:${others}):|Databáze obsahuje|$)`, "i");
  return (re.exec(text)?.[1] ?? "").trim().slice(0, 60);
}

/** «Detail odcizeného vozidla» lapa: krāsa, izlaiduma gads, meklēšanas izsludināšanas datums. */
export function parseCzPoliceDetail(html: string): CzPoliceDetail {
  const text = czPoliceVisibleText(html);
  return {
    barva: detailValue(text, "Barva"),
    rokVyroby: detailValue(text, "Rok výroby"),
    datumVyhlaseni: detailValue(text, "Datum vyhlášení"),
  };
}

const NO_RESULTS_RE = /Nebyly nalezeny žádné výsledky/i;

/**
 * found: tabulā ir rinda ar tieši šo VIN. none: lapa skaidri saka «Nebyly nalezeny žádné výsledky».
 * Viss cits (HTTP kļūda, cita lapa, VIN tikai formā) ir unknown - nekad «nav meklēšanā» bez skaidras atbildes.
 */
export function parseCzPoliceSearch(status: number, html: string, vin: string, detail?: CzPoliceDetail | null): VinScanParse {
  const openUrl = czPoliceSearchUrl(vin);
  if (status !== 200) return { status: "unknown", summary: `CZ policija: HTTP ${status}`, openUrl };
  const hits = parseCzPoliceHits(html, vin);
  if (hits.length > 0) {
    const hit = hits[0]!;
    const car = [hit.vyrobce, hit.typ].filter(Boolean).join(" ");
    const bits = [
      car,
      hit.rz ? `RZ ${hit.rz}${hit.mpz ? ` (${hit.mpz})` : ""}` : "",
      detail?.barva ?? "",
      detail?.rokVyroby ? `${detail.rokVyroby}. g.` : "",
      detail?.datumVyhlaseni ? `meklēšanā kopš ${detail.datumVyhlaseni}` : "",
    ].filter(Boolean);
    return {
      status: "found",
      summary: bits.length ? `Meklēšanā (Čehijas policija). ${bits.join(", ")}` : "Meklēšanā (Čehijas policija)",
      detail: hit.druh ? `Druh: ${hit.druh}` : undefined,
      flags: { wanted: true, stolen: true },
      openUrl: hit.detailUrl || openUrl,
    };
  }
  const text = czPoliceVisibleText(html);
  if (NO_RESULTS_RE.test(text)) return { status: "none", summary: "Nav meklēšanā", openUrl };
  return { status: "unknown", summary: "CZ policija: lapa nav atpazīta", openUrl };
}
