/**
 * Atsauce klienta PDF / gala atskaitei (juridisks un zīmola noformējums).
 * Izmantot, veidojot ģenerētāju — nav vēl integrēts automātiskā eksportā.
 *
 * Galvenie principi:
 * - Nav trešo pušu zīmolu logotipu; tikai PROVIN identitāte.
 * - Pirmajā lapā izteiksmīgs bloks „EKSPERTA SLĒDZIENS” (pakalpojums = analīze).
 * - Datu avotu formulējumi vispārināti, piem.: „Saskaņā ar starptautisko datubāzu ierakstiem…”
 * - Krāsas / fonti saskaņā ar provin.lv (ne trešo pušu UI krāsas kā „oficiālas”).
 */
export const REPORT_PDF_STANDARDS = {
  firstPageExpertBlockTitle: "EKSPERTA SLĒDZIENS",
  /** Paraugs teikumam, ja atspoguļo starptautisko DB saturu bez zīmola nosaukumiem */
  sampleInternationalDbWording: "Saskaņā ar starptautisko datubāzu ierakstiem…",
} as const;
