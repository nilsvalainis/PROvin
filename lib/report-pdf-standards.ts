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

/** PDF atskaites galvenās sadaļas — struktūra: LV avoti → portfelis → kopsavilkums → pretrunas → pārējais. */
export const CLIENT_REPORT_PDF_SECTIONS = {
  client: "1. KLIENTA PIEPRASĪJUMS",
  /** Admin „2. Avotu piezīmes”: CSDD, LTAB, Tirgus, Citi. */
  lvSources: "2. LATVIJAS DATU AVOTI",
  portfolio: "3. PIEVIENOTAIS PORTFELIS (vēstures materiāli)",
  /** Odometrs + negadījumi + salīdzinošs kopsavilkums. */
  summary: "4. SALĪDZINOŠAIS KOPSAVILKUMS",
  historyCompare: "Avotu kopskats",
  odometer: "Nobraukuma līkne un ieraksti",
  insurance: "Negadījumu / bojājumu ieraksti",
  discrepancies: "5. PRETRUNAS, RISKI UN BRĪDINĀJUMI",
  risk: "Ātrā risku pārbaude",
  vehicle: "6. IDENTIFIKĀCIJA UN ĪSS REĢISTRA KOPSAVILKUMS",
  attachments: "Pievienotie dokumenti (portfelis)",
  listing: "7. SLUDINĀJUMS (tirgus konteksts)",
  inspectionPlan: "8. APSKATES PLĀNS KLĀTIENĒ",
  expert: "9. EKSPERTA SLĒDZIENS",
  sourcesLegend: "NOBRAUKUMA AVOTU KRĀSU NOZĪME",
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
  insuranceNotes: "OCTA, atlīdzības un negadījumu konteksta piezīmes",
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
