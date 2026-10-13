/**
 * Jauno VIN SCAN avotu tīrie parseri. Bez tīkla.
 */
import type { VinScanParse, VinScanVehicle } from "@/lib/vin-scan/types";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function kmLv(raw: string): string {
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return raw.trim();
  return `${Math.round(n).toLocaleString("lv-LV")} km`;
}

export type OemRecallBrand = "vw" | "bmw" | "mercedes" | "volvo" | "toyota";

const OEM_WMI: Record<OemRecallBrand, readonly string[]> = {
  vw: ["WVW", "WVG", "WV1", "WV2", "WAU", "WUA", "TRU", "TMB", "VSS", "AAV", "3VW", "1VW", "WUA"],
  bmw: ["WBA", "WBS", "WBY", "WBX", "3MW", "5UX", "5YM", "WMW"],
  mercedes: ["WDD", "WDC", "WDF", "W1K", "W1N", "W1V", "4JG", "WD4", "8AC"],
  volvo: ["YV1", "YV4", "LYV", "YV2", "YV3"],
  toyota: ["JTD", "JT2", "JT3", "JT4", "JT6", "JT8", "JTE", "JTH", "JTJ", "2T1", "4T1", "5TD", "5TF", "7MU", "58A"],
};

export function oemBrandForVin(vin: string): OemRecallBrand | null {
  const wmi = vin.trim().toUpperCase().slice(0, 3);
  for (const brand of Object.keys(OEM_WMI) as OemRecallBrand[]) {
    if (OEM_WMI[brand].includes(wmi)) return brand;
  }
  return null;
}

export function parseVpicMakeModelYear(status: number, text: string): { make: string; model: string; year: string } | null {
  if (status !== 200) return null;
  try {
    const rec = asRecord(JSON.parse(text) as unknown);
    const row = asRecord(asArray(rec.Results)[0] ?? asArray(rec.results)[0]);
    const make = str(row.Make);
    const model = str(row.Model);
    const year = str(row.ModelYear);
    if (!make) return null;
    return { make, model, year };
  } catch {
    return null;
  }
}

export function parseNhtsaRecalls(status: number, text: string): VinScanParse {
  if (status === 404) return { status: "none", summary: "NHTSA atsaukumu nav", flags: { recallCount: 0 } };
  /** NHTSA 400 + tukšs results ir derīgs „atsaukumu nav”, ne kļūda. */
  if (status !== 200 && status !== 400) return { status: "unknown", summary: `NHTSA atsaukumi: HTTP ${status}` };
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { status: "unknown", summary: "NHTSA atsaukumu atbilde nav JSON" };
  }
  const rec = asRecord(data);
  const results = asArray(rec.results).length ? asArray(rec.results) : asArray(rec.Results);
  const count = results.length;
  if (count === 0) {
    const msg = str(rec.Message) || str(rec.message);
    if (/not found|no results|0 results/i.test(msg)) {
      return { status: "none", summary: "NHTSA atsaukumu nav", flags: { recallCount: 0 } };
    }
    return { status: "none", summary: "NHTSA atsaukumu nav", flags: { recallCount: 0 } };
  }
  const recalls = results.map((row) => {
    const r = asRecord(row);
    return {
      title: str(r.Component) || str(r.component) || str(r.NHTSACampaignNumber) || "Atsaukums",
      date: str(r.RecallDate) || str(r.ReportReceivedDate),
    };
  });
  const lines = recalls.slice(0, 8).map((row) => [row.title, row.date].filter(Boolean).join(" · "));
  return {
    status: "found",
    summary: `${count} NHTSA atsaukumi`,
    detail: lines.join("\n"),
    flags: { recallCount: count },
    recalls,
  };
}

export function parseRdwOpenData(parts: {
  vehicle: unknown;
  keuring: unknown;
  recalls: unknown;
}): VinScanParse {
  const rows = asArray(parts.vehicle).map(asRecord);
  if (rows.length === 0) return { status: "none", summary: "RDW reģistrā nav" };
  const v = rows[0]!;
  const make = str(v.merk);
  const model = str(v.handelsbenaming) || str(v.voertuigsoort);
  const year = str(v.datum_eerste_toelating).slice(0, 4);
  const plate = str(v.kenteken);
  const apk = str(v.vervaldatum_apk);
  const nap = str(v.tellerstandoordeel) || str(v.nap_aanduiding);
  const mileageRaw = str(v.tellerstand);
  const keuring = asArray(parts.keuring).map(asRecord);
  const recalls = asArray(parts.recalls).map(asRecord);
  const bits = [
    [make, model].filter(Boolean).join(" "),
    year,
    plate,
    apk ? `APK līdz ${apk}` : "",
    nap ? `NAP: ${nap}` : "",
    mileageRaw ? kmLv(mileageRaw) : "",
  ].filter(Boolean);
  const mileage =
    mileageRaw && apk
      ? [{ date: apk.length === 8 ? `${apk.slice(0, 4)}-${apk.slice(4, 6)}-${apk.slice(6, 8)}` : apk, odometer: kmLv(mileageRaw) }]
      : [];
  const keuringLines = keuring.slice(0, 6).map((row) => {
    const d = str(row.vervaldatum_keuring) || str(row.datum_keuring);
    const kms = str(row.tellerstand);
    return [d, kms ? kmLv(kms) : ""].filter(Boolean).join(" · ");
  });
  for (const row of keuring) {
    const d = str(row.vervaldatum_keuring) || str(row.datum_keuring);
    const kms = str(row.tellerstand);
    if (d && kms) mileage.push({ date: d, odometer: kmLv(kms) });
  }
  return {
    status: "found",
    summary: bits.join(", ") || "Ir RDW reģistrā",
    detail: [keuringLines.join("\n"), recalls.length ? `${recalls.length} RDW atsaukumi` : ""].filter(Boolean).join("\n"),
    vehicle: make || model || year ? { make, model, year } : undefined,
    mileage,
    inspections: keuring.map((row) => {
      const d = str(row.vervaldatum_keuring) || str(row.datum_keuring);
      const kms = str(row.tellerstand);
      return { date: d, odometer: kms ? kmLv(kms) : "" };
    }).filter((row) => row.date || row.odometer),
    recalls: recalls
      .map((row) => ({ title: str(row.referentiecode) || str(row.referentie) || "Atsaukums", date: str(row.datum) }))
      .filter((row) => row.title),
    flags: {
      registrationCountry: "NL",
      napJudgement: nap || undefined,
      recallCount: recalls.length || undefined,
    },
  };
}

export function parseVegvesen(status: number, text: string): VinScanParse {
  if (status === 404) return { status: "none", summary: "VIN nav vegvesen.no reģistrā" };
  if (status === 401 || status === 403) return { status: "unknown", summary: `vegvesen.no atbildēja ar HTTP ${status}` };
  if (status !== 200) return { status: "unknown", summary: `vegvesen.no atbildēja ar HTTP ${status}` };
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    if (/ikke funnet|not found|ingen treff/i.test(text)) return { status: "none", summary: "VIN nav vegvesen.no reģistrā" };
    return { status: "unknown", summary: "vegvesen.no atbilde nav JSON" };
  }
  const rec = asRecord(data);
  const kjoretoy = asRecord(rec.kjoretoydataListe ? asArray(rec.kjoretoydataListe)[0] : rec);
  const god = asRecord(kjoretoy.godkjenning);
  const tech = asRecord(asRecord(god.tekniskGodkjenning).tekniskeData);
  const ident = asRecord(kjoretoy.kjoretoyId);
  const make = str(asRecord(tech.generelt).merke) || str(asRecord(asArray(asRecord(tech.generelt).merke)[0]).merke);
  const handels = asArray(asRecord(tech.generelt).handelsbetegnelse);
  const model = str(handels[0]) || str(asRecord(tech.generelt).handelsbetegnelse);
  const period = asRecord(kjoretoy.forstegangsregistrering);
  const year = str(period.registrertForstegangNorgeDato).slice(0, 4) || str(ident.understellsnummer).slice(9, 11);
  const plate = str(ident.kjennemerke);
  if (!make && !model && !plate && !str(ident.understellsnummer)) {
    return { status: "none", summary: "VIN nav vegvesen.no reģistrā" };
  }
  const statusRec = asRecord(kjoretoy.registrering);
  const st = str(asRecord(statusRec.registreringsstatus).kodeNavn) || str(statusRec.registrertKjoretoy);
  return {
    status: "found",
    summary: [make, model, year, plate, st].filter(Boolean).join(", ") || "Ir vegvesen.no reģistrā",
    vehicle: make || model || year ? { make, model, year } : undefined,
    flags: { registrationCountry: "NO" },
  };
}

export function parseNicbHtml(html: string, vin: string): VinScanParse {
  const text = html.replace(/<[^>]+>/g, " ");
  if (/stolen/i.test(text) && text.toUpperCase().includes(vin.toUpperCase())) {
    return { status: "found", summary: "NICB: iespējams zagts", flags: { stolen: true } };
  }
  if (/total loss|salvage/i.test(text) && text.toUpperCase().includes(vin.toUpperCase())) {
    return { status: "found", summary: "NICB: total loss / salvage ieraksts" };
  }
  if (/no records|not found|clean record|no match|is not listed/i.test(text)) {
    return { status: "none", summary: "NICB sarakstā nav" };
  }
  if (/recaptcha|i['’]m not a robot|hcaptcha/i.test(text) && !text.toUpperCase().includes(vin.toUpperCase())) {
    return { status: "unknown", summary: "NICB captcha netika apieta" };
  }
  return { status: "unknown", summary: "NICB lapa nav atpazīta" };
}

export function parseBiluppgifter(status: number, html: string, vin: string): VinScanParse {
  if (status === 404) return { status: "none", summary: "biluppgifter.se šo VIN neatpazina" };
  if (status !== 200) return { status: "unknown", summary: `biluppgifter.se HTTP ${status}` };
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (/hittades inte|not found|ingen träff|404/i.test(text) && !text.toUpperCase().includes(vin.toUpperCase())) {
    return { status: "none", summary: "biluppgifter.se šo VIN neatpazina" };
  }
  const make = /Märke[^A-Za-z]{0,12}([A-Za-z0-9 -]{2,30})/i.exec(text)?.[1]?.trim() || "";
  const model = /Modell[^A-Za-z]{0,12}([A-Za-z0-9 -]{2,40})/i.exec(text)?.[1]?.trim() || "";
  const year = /Modellår[^0-9]{0,8}(19|20)\d{2}/i.exec(text)?.[0]?.replace(/\D/g, "").slice(-4) || "";
  const km = /Mätarställning[^0-9]{0,12}([\d\s]{3,9})/i.exec(text)?.[1]?.replace(/\s/g, "") || "";
  if (!make && !model && !text.toUpperCase().includes(vin.toUpperCase())) {
    return { status: "none", summary: "biluppgifter.se šo VIN neatpazina" };
  }
  return {
    status: "found",
    summary: [make, model, year, km ? kmLv(km) : ""].filter(Boolean).join(", ") || "Ir biluppgifter.se",
    vehicle: make || model || year ? { make, model, year } : undefined,
    mileage: km ? [{ date: "", odometer: kmLv(km) }] : undefined,
    flags: { registrationCountry: "SE" },
  };
}

export function parseRegitra(status: number, html: string): VinScanParse {
  if (status !== 200) return { status: "unknown", summary: `Regitra HTTP ${status}` };
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (/duomenų nėra|nerasta|not found/i.test(text)) return { status: "none", summary: "Regitra šo numuru neatpazina" };
  if (/captcha|recaptcha|cloudflare|just a moment/i.test(text) && !/markė|make|vin/i.test(text)) {
    return { status: "unknown", summary: "Regitra captcha netika apieta" };
  }
  const make = /Markė[:\s]+([A-Za-z0-9 -]{2,30})/i.exec(text)?.[1]?.trim() || "";
  const model = /Modelis[:\s]+([A-Za-z0-9 -]{2,40})/i.exec(text)?.[1]?.trim() || "";
  const year = /Pirmosios registracijos data[:\s]+.*?((?:19|20)\d{2})/i.exec(text)?.[1] || "";
  if (!make && !model) return { status: "unknown", summary: "Regitra lapa nav atpazīta" };
  return {
    status: "found",
    summary: [make, model, year].filter(Boolean).join(", ") || "Ir Regitra reģistrā",
    vehicle: make || model || year ? { make, model, year } : undefined,
    flags: { registrationCountry: "LT" },
  };
}

export function parseTraficom(status: number, html: string): VinScanParse {
  if (status !== 200) return { status: "unknown", summary: `Traficom HTTP ${status}` };
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const make =
    /(?:Make|Merkki)[:\s]+([A-Za-z0-9][A-Za-z0-9 -]{0,28}?)(?=\s+(?:Model|Malli|Year|Vuosimalli|First|Vin)\b|$)/i
      .exec(text)?.[1]
      ?.trim() || "";
  const model =
    /(?:Model|Malli)(?!\s*year)[:\s]+([A-Za-z0-9][A-Za-z0-9 -]{0,38}?)(?=\s+(?:Year|Vuosimalli|Make|Merkki|First|Vin)\b|$)/i
      .exec(text)?.[1]
      ?.trim() || "";
  const year =
    /(?:Model year|Vuosimalli|(?<!\w)Year)[:\s]+((?:19|20)\d{2})/i.exec(text)?.[1] ||
    /(?:First registration|Ensimmäinen käyttöönotto)[:\s]+.*?((?:19|20)\d{2})/i.exec(text)?.[1] ||
    "";
  if (
    /ei löytynyt|ajoneuvoa ei löytynyt|no vehicle (was )?found|vehicle was not found/i.test(text) &&
    !make &&
    !model
  ) {
    return { status: "none", summary: "Traficom šo VIN neatpazina" };
  }
  if (
    (/suomi\.fi|identify yourself|kirjaudu|e-identif|strong authentication|pankkitunnus|mobile certificate|certificate card|my e-services/i.test(
      text,
    ) ||
      /captcha|recaptcha|just a moment/i.test(text)) &&
    !make &&
    !model
  ) {
    return { status: "unknown", summary: "Traficom captcha netika apieta" };
  }
  if (!make && !model) return { status: "unknown", summary: "Traficom lapa nav atpazīta" };
  return {
    status: "found",
    summary: [make, model, year].filter(Boolean).join(" ") || "Ir Traficom reģistrā",
    vehicle: make || model || year ? { make, model, year } : undefined,
    flags: { registrationCountry: "FI" },
  };
}

/** Redzamais lapas teksts: bez <script>/<style>/<noscript> un atribūtiem (tur bieži atkārtojas meklētais VIN/URL). */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Izsoļu arhīvi (AucHistory, BidFax, Poctra). Trāpījums TIKAI tad, ja meklētais VIN ir redzamajā tekstā
 * kopā ar lota datiem. Agrāk VIN no skripta (`current_url`) + „Featured cars” bloks + <img> skaits
 * deva viltus „ir izsole, N foto” (piem. AucHistory WAUZZZF50NA041246).
 */
export function parseAuctionArchive(status: number, html: string, vin: string, label: string): VinScanParse {
  if (status === 404) return { status: "none", summary: `${label}: nav izsoles ieraksta` };
  if (status >= 400) return { status: "unknown", summary: `${label} HTTP ${status}` };
  const text = visibleText(html);
  const upperVin = vin.trim().toUpperCase();
  const vinVisible = Boolean(upperVin) && text.toUpperCase().includes(upperVin);
  if (/just a moment|cf-browser|verify you are human/i.test(text) && !vinVisible) {
    return { status: "unknown", summary: `${label}: Cloudflare netika apieta` };
  }
  if (!vinVisible) return { status: "none", summary: `${label}: nav izsoles ieraksta` };
  if (/\blot\b|auction|sold|\bbid\b|copart|iaai|damage/i.test(text)) {
    const photos = /(\d+)\s*(photos?|images?|pictures?|foto)/i.exec(text);
    const n = photos ? Number(photos[1]) : NaN;
    const photoCount = Number.isFinite(n) && n > 0 ? n : 0;
    return {
      status: "found",
      summary: photoCount > 0 ? `${label}: ir izsole, ${photoCount} foto` : `${label}: ir izsoles ieraksts`,
      media: photoCount > 0 ? { photoCount } : undefined,
      flags: { photoCount: photoCount || undefined },
      auctions: [{ title: label, photoCount: photoCount || undefined }],
    };
  }
  return { status: "none", summary: `${label}: nav izsoles ieraksta` };
}

export function parseOemRecallHtml(status: number, html: string, vin: string, brand: string): VinScanParse {
  if (status >= 400) return { status: "unknown", summary: `${brand} atsaukumi HTTP ${status}` };
  const text = html.replace(/<[^>]+>/g, " ");
  if (/no recall|0 recall|recalls?:?\s*none|nav atsauk/i.test(text)) {
    return { status: "none", summary: `${brand}: atsaukumu nav`, flags: { recallCount: 0 } };
  }
  const count = /(\d+)\s*recalls?/i.exec(text);
  const n = count ? Number(count[1]) : NaN;
  if (Number.isFinite(n) && n > 0) {
    return { status: "found", summary: `${brand}: ${n} atsaukumi`, flags: { recallCount: n } };
  }
  if (/open recall|safety recall|campaign/i.test(text) && text.toUpperCase().includes(vin.toUpperCase())) {
    return { status: "found", summary: `${brand}: ir atsaukuma ieraksts`, flags: { recallCount: 1 } };
  }
  if (text.toUpperCase().includes(vin.toUpperCase()) && /no open recalls|this vehicle is not affected/i.test(text)) {
    return { status: "none", summary: `${brand}: atsaukumu nav`, flags: { recallCount: 0 } };
  }
  return { status: "unknown", summary: `${brand}: atsaukumu lapa nav atpazīta` };
}

export function vehicleFromParts(make: string, model: string, year: string): VinScanVehicle | undefined {
  if (!make && !model && !year) return undefined;
  return { make, model, year };
}
