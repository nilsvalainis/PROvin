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

/** Klientam redzami PDF sadaļu virsraksti — neinstitūciju oficiālie nosaukumi. */
export const CLIENT_REPORT_SECTION_LABELS = {
  mainTitle: "Transportlīdzekļa izvērtējuma atskaite",
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
