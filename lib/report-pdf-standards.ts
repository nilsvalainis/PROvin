/**
 * Klienta gala PDF / atskaite — juridisks un zīmola noformējums (provin.lv).
 *
 * Galvenie principi:
 * - Nav trešo pušu zīmolu logotipu; tikai PROVIN identitāte.
 * - Pirmajā lapā izteiksmīgs bloks „EKSPERTA SLĒDZIENS” (pakalpojums = analīze).
 * - Datu avotu virsraksti PDF klientam — vispārināti, bez oficiālo institūciju precīziem nosaukumiem.
 * - Tekstā nelietot trešo pušu komerciālu pakalpojumu nosaukumus, kamēr nav līgumiskas tiesības tos piesaistīt.
 * - Krāsas / fonti saskaņā ar provin.lv (ne trešo pušu UI krāsas kā „oficiālas”).
 */

export const REPORT_PDF_STANDARDS = {
  firstPageExpertBlockTitle: "EKSPERTA SLĒDZIENS",
  /** Paraugs teikumam, ja atspoguļo starptautisko DB saturu bez zīmola nosaukumiem */
  sampleInternationalDbWording: "Saskaņā ar starptautisko datubāzu ierakstiem…",
} as const;

/** PDF atskaites galvenās sadaļas — „Ultra” izkārtojums (numurētas sadaļas). */
export const CLIENT_REPORT_PDF_SECTIONS = {
  client: "1. KLIENTA PIEPRASĪJUMS",
  risk: "2. ĀTRĀ RISKU PĀRBAUDE",
  vehicle: "3. AUTOMAŠĪNAS DATI",
  attachments: "Pievienotie dokumenti (portfelis)",
  /** Pirms §4 odometra — kopsavilkums no portfeļa PDF analīzes (bez trešo pušu zīmolu nosaukumiem). */
  historyCompare: "Starptautisko vēstures pārskatu kopsavilkums",
  odometer: "4. ODOMETRA ANALĪZE UN PROGNOZE",
  /** Virsraksta pamats; pie skaita → „(N fiksēti gadījumi)” */
  insurance: "5. APDROŠINĀŠANAS KONTEKSTS",
  listing: "6. SLUDINĀJUMS UN TIRGUS KONTEKSTS",
  inspectionPlan: "7. PERSONALIZĒTS APSKATES PLĀNS (pircējam klātienē)",
  expert: "8. EKSPERTA SLĒDZIENS",
  sourcesLegend: "DATU AVOTI",
  /** @deprecated Lietot client */
  application: "1. KLIENTA PIEPRASĪJUMS",
  otherContext: "Papildu konteksts",
} as const;

/** Nobraukuma punktu avotu apzīmējumi PDF tabulā (emoji + teksts). */
export const REPORT_ODOMETER_SOURCE_LEGEND = [
  { emoji: "🟢", label: "Latvijas reģistri", key: "lv" as const },
  { emoji: "🔵", label: "Vēstures atskaite", key: "hist" as const },
  { emoji: "🟡", label: "Vēstures atskaite (papildu)", key: "hist2" as const },
  { emoji: "🟠", label: "Oficiālā dīlera dati", key: "dealer" as const },
  { emoji: "🔴", label: "Citi avoti", key: "other" as const },
];

/** Klientam redzami PDF sadaļu virsraksti — neinstitūciju oficiālie nosaukumi. */
export const CLIENT_REPORT_SECTION_LABELS = {
  /** Galvenā rindiņa zem PROVIN.LV */
  mainTitle: "Transportlīdzekļa izvērtējums",
  registryNotes: "Valsts reģistra un publisko datu piezīmes",
  insuranceNotes: "OCTA un apdrošināšanas konteksta piezīmes",
  marketNotes: "Tirgus un sludinājuma piezīmes",
  otherNotes: "Papildu piezīmes",
  attachments: "Pievienotie dokumenti",
  dataAppendix: "Datu apkopojums",
  supplementary: "Papildu konteksts",
  identification: "Identifikācija",
  contacts: "Kontakti",
} as const;

/** Kājenes teksts — saskaņots ar mājas lapas kājenes disclaimer (Footer). */
export const CLIENT_REPORT_FOOTER_DISCLAIMER =
  "Datu avotu informācija ir informatīva; eksperta kopsavilkums ir profesionāls viedoklis, nevis juridisks spriedums vai oficiāla tehniskā ekspertīze.";

export const CLIENT_REPORT_SERVICE_NOTICE =
  "PROVIN sniedz konsultatīvu pakalpojumu: transportlīdzekļa pieejamās informācijas izvērtējumu un ieteikumus. Tas nav valsts institūcijas izraksts, neatkarīga tehniskā ekspertīze vai juridisks spriedums. Gala lēmumu par transportlīdzekļa iegādi pieņem klients.";

/** Noņem / aizstāj biežus trešo pušu komerciālos nosaukumus failu nosaukumos PDF sarakstā. */
export function sanitizeAttachmentFileNameForReport(fileName: string): string {
  let s = fileName.replace(
    /\b(carvertical|carVertical|auto[\s-]*dna|autodna|autoDNA|auto-records|auto\s*records)\b/gi,
    "vēstures atskaite",
  );
  s = s.replace(/\s{2,}/g, " ").trim();
  return s || fileName;
}
