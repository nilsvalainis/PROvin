/**
 * e.csdd.lv TCPDF teksta slānis salīmē etiķetes ar vērtībām, defektu kodus ar
 * novērtējumu un nobraukuma pārus vienā rindā. Šis solis atjauno parserim
 * lasāmu atstarpi — gan PDF importam, gan raw ielīmei.
 */

const GLUED_LABELS = [
  "Iepriekšējās reģistrācijas valsts",
  "Reģistrācijas numurs",
  "Marka Modelis",
  "Pilna masa (kg)",
  "Pašmasa (kg)",
  "Transportlīdzekļa veids",
  "Sēdvietu skaits",
  "Izlaiduma gads",
  "Odometra rādījums",
  "Apskates datums",
  "Apskates tips",
  "TA datums",
  "Nākošā TA",
  "Novērtējums",
  "Piezīmes",
  "Degviela",
  "Statuss",
  "Polise",
  "Spēkā stāšanās datums",
  "Beigu datums",
  "VIN",
] as const;

const LV_LETTER = "A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unstickLabels(text: string): string {
  let out = text;
  const labels = [...GLUED_LABELS].sort((a, b) => b.length - a.length);
  for (const label of labels) {
    const re = new RegExp(`(${escapeRegExp(label)})(?=[${LV_LETTER}0-9])`, "gi");
    out = out.replace(re, "$1 ");
  }
  return out;
}

function joinSuperscriptUnits(text: string): string {
  return text
    .replace(/\(\s*cm\s*\n\s*-3\s*\n\s*\)\s*:?\s*/gi, "(cm-3): ")
    .replace(/\(\s*m\s*\n\s*-1\s*\n\s*\)\s*:?\s*/gi, "(m-1): ")
    .replace(/\(cm\s*-3\)\s*:?\s*/gi, "(cm-3): ")
    .replace(/\(m\s*-1\)\s*:?\s*/gi, "(m-1): ");
}

function unstickDefectCodes(text: string): string {
  const dotted = new RegExp(`(\\d+(?:\\.\\d+)+\\.)([123])(?=[${LV_LETTER}]|\\.[${LV_LETTER}])`, "g");
  const oldCode = new RegExp(`(^|\\n)(\\d{3})([123])(?=[${LV_LETTER}])`, "g");
  return text.replace(dotted, "$1 $2 ").replace(oldCode, "$1$2 $3 ");
}

function splitGluedMileageAndFooters(text: string): string {
  return text
    .replace(/(\d{2}\.\d{2}\.\d{4})(?=\d{4,7}\s*[-–—])/g, "$1\n")
    .replace(/(\d{2}\.\d{2}\.\d{4})(\d{1,2}\s*\/\s*\d+)/g, "$1\n$2")
    .replace(/(\d{2}\/\d{2}\/\d{4})(\d+\s+(?:ī|i)pa[sš]niek)/gi, "$1 $2");
}

function tidyHtmlEntities(text: string): string {
  return text.replace(/\bun\s+gt\s*;/gi, ">").replace(/&gt;/gi, ">");
}

function spaceAfterColonDigits(text: string): string {
  return text.replace(/:(?=\d)/g, ": ");
}

/** Idempotents — jau atstarpi saturošs paste paliek neskarts. */
export function normalizeEcsddPdfText(raw: string): string {
  let t = raw.replace(/\r/g, "");
  t = joinSuperscriptUnits(t);
  t = splitGluedMileageAndFooters(t);
  t = unstickLabels(t);
  t = unstickDefectCodes(t);
  t = spaceAfterColonDigits(t);
  t = tidyHtmlEntities(t);
  return t;
}
