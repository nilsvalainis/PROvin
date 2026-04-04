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

/** PDF atskaites galvenās sadaļas — romiešu bloki pēc konsultatīvā layout. */
export const CLIENT_REPORT_PDF_SECTIONS = {
  quickPanel: "I. Pieteikums un ātrās kontroles panelis",
  /** Admin „Avotu piezīmes”: strukturēti apakšbloki + pilns teksts. */
  lvSources: "II. Latvijas datu avoti",
  lvRegistry: "2.1. Reģistra pamatdati",
  lvTa: "2.2. Tehniskās apskates vēsture",
  lvOcta: "2.3. OCTA un negadījumi LV",
  portfolio: "III. Ārvalstu un pievienoto atskaišu dati",
  summary: "IV. Apvienotais datu kopsavilkums",
  historyCompare: "Īss kopskats importētajiem PDF",
  odometer: "4.1. Odometra rādījumu līkne un laika līnija",
  insurance: "4.2. Apvienotā negadījumu vēsture",
  discrepancies: "Pretrunas un papildu riski",
  risk: "Ātrā risku pārbaude",
  listing: "V. Tirgus dati un sludinājums",
  expertBlock: "VI. Eksperta slēdziens un apskates plāns",
  sourcesLegend: "Datu avotu krāsu nozīme",
  /** @deprecated Izmantot quickPanel */
  client: "I. Pieteikums un ātrās kontroles panelis",
  vehicle: "Identifikācija",
  attachments: "Pievienotie dokumenti (portfelis)",
  inspectionPlan: "Apskates plāns klātiene",
  expert: "Eksperta slēdziens",
  application: "I. Pieteikums un ātrās kontroles panelis",
  otherContext: "Papildu konteksts",
} as const;

/** Nobraukuma punktu avotu apzīmējumi PDF tabulā (emoji + teksts). */
export const REPORT_ODOMETER_SOURCE_LEGEND = [
  { emoji: "🟢", label: "Latvijas reģistri", key: "lv" as const },
  { emoji: "🔵", label: "Vēstures atskaite", key: "hist" as const },
  { emoji: "🟡", label: "Vēstures atskaite (papildu)", key: "hist2" as const },
  { emoji: "🟠", label: "Dīlera / ražotāja dati", key: "dealer" as const },
  { emoji: "🔴", label: "Sludinājums / citi", key: "other" as const },
];

/** Klientam redzami PDF sadaļu virsraksti — neinstitūciju oficiālie nosaukumi. */
export const CLIENT_REPORT_SECTION_LABELS = {
  /** Galvenā rindiņa zem PROVIN.LV */
  mainTitle: "Transportlīdzekļa izvērtējums",
  registryNotes: "Reģistra un publiskie dati (pilns teksts)",
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
