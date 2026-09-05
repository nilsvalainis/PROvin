/**
 * Klienta gala PDF / atskaite — juridisks un zīmola noformējums (provin.lv).
 *
 * Galvenie principi:
 * - Nav trešo pušu zīmolu logotipu; tikai PROVIN identitāte.
 * - Galvenais kopsavilkuma bloks „APPROVED BY IRISS” (apakšsadaļas: Tehnisko risku analīze, Ieteikumi klātienes apskatei, Kopsavilkums).
 * - Datu avotu virsraksti PDF klientam — vispārināti, bez oficiālo institūciju precīziem nosaukumiem.
 * - Tekstā nelietot trešo pušu komerciālu pakalpojumu nosaukumus, kamēr nav līgumiskas tiesības tos piesaistīt.
 * - Krāsas / fonti saskaņā ar provin.lv (ne trešo pušu UI krāsas kā „oficiālas”).
 */

import { OFFICIAL_DEALER_SECTION_TITLE } from "@/lib/oneauto-dealer";

export const REPORT_PDF_STANDARDS = {
  firstPageExpertBlockTitle: "Ieteikumi klātienes apskatei · Kopsavilkums",
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
  expertBlock: "VI. Kopsavilkums, ieteikumi un cenas atbilstība",
  sourcesLegend: "Datu avotu krāsu nozīme",
  /** @deprecated Izmantot quickPanel */
  client: "I. Pieteikums un ātrās kontroles panelis",
  vehicle: "Identifikācija",
  attachments: "Pievienotie dokumenti (portfelis)",
  inspectionPlan: "Apskates plāns (integrēts kopsavilkumā)",
  expert: "Kopsavilkums",
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

/** Vienota juridiskā atruna — PDF kolofons un e-pasta kājene. */
export const CLIENT_REPORT_FOOTER_DISCLAIMER =
  "PROVIN.LV sniedz konsultatīvu pakalpojumu: transportlīdzekļa pieejamās informācijas izvērtējumu un ieteikumus. Šis ir digitāls datu apkopojums, nevis automašīnas tehniskā diagnostika, un tas nekādā veidā nevar aizvietot pilnvērtīgu transportlīdzekļa pārbaudi un apskati klātienē. Atskaite nav valsts institūcijas izraksts, neatkarīga tehniskā ekspertīze vai juridisks spriedums. Gala lēmumu par transportlīdzekļa iegādi pieņem klients.";

/** Konfidencialitāte un aizliegums nodot trešajām personām — treknrakstā PDF kājenē. */
export const PDF_SITE_FOOTER_CONFIDENTIALITY_NOTICE =
  "Šī atskaite ir sagatavota ekskluzīvi tās pasūtītājam un ir izmantojama tikai personīgām vajadzībām. Atskaiti un tajā ietverto informāciju ir kategoriski aizliegts pavairot, publiski reproducēt, nodot vai jebkādā citā veidā darīt pieejamu trešajām personām (tostarp transportlīdzekļa pārdevējam) bez saskaņošanas ar PROVIN.LV.";

/** E-pasta kājene — virsraksts juridiskajam blokam. */
export const PDF_SITE_FOOTER_IMPORTANT_TITLE = "SVARĪGA INFORMĀCIJA";

/** PDF dokumentu kolofons — atrunas virsraksts. */
export const PDF_DOC_FOOTER_DISCLAIMER_TITLE = "Atruna";

/** PDF dokumentu kolofons — konfidencialitātes virsraksts. */
export const PDF_DOC_FOOTER_CONFIDENTIALITY_TITLE = "Konfidencialitāte";

/**
 * E-pasta kājene — kopsavilkums (saskan ar `messages/lv/footer.json` „body”).
 * PDF kolofonā nelietot: tas ir vietnes vēstījums, ne dokumenta saturs.
 */
export const PDF_SITE_FOOTER_VALUE_BODY =
  "Standarta vēstures atskaites sniedz tikai sausus faktus. Mēs veicam padziļinātu izpēti — izvērtējam sludinājumu, analizējam konkrētā modeļa vājās vietas un tirgus vērtību, sniedzot pilnvērtīgu un pārdomātu slēdzienu.";

/** PDF apakšjosla — tikai nosaukumi, bez hipersaitēm (drukai). */
export const PDF_SITE_FOOTER_LEGAL_LABELS_STATIC = "Lietošanas noteikumi · Privātuma politika";

/** Mazais GDPR / apstrādes teikums zem autortiesībām. */
export const PDF_SITE_FOOTER_GDPR_LINE =
  "Personas datu apstrāde notiek saskaņā ar piemērojamiem tiesību aktiem (GDPR).";

/** Vienots juridiskās kājenes saturs — e-pasts un citi klienta paziņojumi. */
export type ClientReportLegalFooterBlocks = {
  importantTitle: string;
  disclaimer: string;
  confidentiality: string;
  valueBody: string;
  legalLabels: string;
  gdprLine: string;
};

export function formatPdfDocFooterProductLabel(
  brand: "PROVIN_AUDITS" | "PROVIN_MINI" | "PROVIN_DILERIS",
): string {
  if (brand === "PROVIN_MINI") return "PROVIN MINI";
  if (brand === "PROVIN_DILERIS") return OFFICIAL_DEALER_SECTION_TITLE;
  return "PROVIN AUDITS";
}

/** PDF kolofona meta: produkts · VIN · ģenerēšanas datums. Bez izdevēja personas datiem. */
export function buildPdfDocFooterIdentityLine(args: {
  productLabel: string;
  vin?: string | null;
  generatedLabel: string;
}): string {
  const parts = [args.productLabel.trim()].filter(Boolean);
  const meta = buildPdfDocFooterMetaLine(args);
  if (meta) parts.push(meta);
  return parts.join("  ·  ");
}

/** VIN un ģenerēšanas datums — blakus logo, bez produkta nosaukuma. */
export function buildPdfDocFooterMetaLine(args: {
  vin?: string | null;
  generatedLabel: string;
}): string {
  const parts: string[] = [];
  const vin = (args.vin ?? "").trim();
  if (vin) parts.push(`VIN ${vin}`);
  const generated = args.generatedLabel.trim();
  if (generated) parts.push(generated);
  return parts.join("  ·  ");
}

export function getClientReportLegalFooterBlocks(): ClientReportLegalFooterBlocks {
  return {
    importantTitle: PDF_SITE_FOOTER_IMPORTANT_TITLE,
    disclaimer: CLIENT_REPORT_FOOTER_DISCLAIMER,
    confidentiality: PDF_SITE_FOOTER_CONFIDENTIALITY_NOTICE,
    valueBody: PDF_SITE_FOOTER_VALUE_BODY,
    legalLabels: PDF_SITE_FOOTER_LEGAL_LABELS_STATIC,
    gdprLine: PDF_SITE_FOOTER_GDPR_LINE,
  };
}

/** Plain-text kājene audita e-pastam un citiem paziņojumiem. */
export function buildClientReportLegalFooterPlainText(): string {
  const b = getClientReportLegalFooterBlocks();
  return [
    "",
    b.importantTitle,
    "",
    b.disclaimer,
    "",
    b.confidentiality,
    "",
    b.valueBody,
    "",
    b.legalLabels,
    b.gdprLine,
  ].join("\n");
}

/** Noņem / aizstāj biežus trešo pušu komerciālos nosaukumus failu nosaukumos PDF sarakstā. */
export function sanitizeAttachmentFileNameForReport(fileName: string): string {
  let s = fileName.replace(
    /\b(carvertical|carVertical|auto[\s-]*dna|autodna|autoDNA|auto-records|auto\s*records)\b/gi,
    "vēstures atskaite",
  );
  s = s.replace(/\s{2,}/g, " ").trim();
  return s || fileName;
}
