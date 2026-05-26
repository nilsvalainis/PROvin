/** Kopīga PDF teksta normalizācija (serveris + pārlūks). */

const LV_LETTER_CLASS = "A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž";

export function normalizePdfExtractedText(raw: string): string {
  let t = raw.replace(/\u00a0/g, " ");
  let prev = "";
  while (t !== prev) {
    prev = t;
    t = t.replace(/(\d)\s+(?=\d)/g, "$1");
  }
  t = t.replace(/\b([kK])\s+([mM])\b/g, "$1$2");
  const re = new RegExp(`\\b([${LV_LETTER_CLASS}])(?:\\s+([${LV_LETTER_CLASS}])){2,}\\b`, "g");
  for (let i = 0; i < 12; i++) {
    t = t.replace(re, (chunk) => chunk.replace(/\s+/g, ""));
  }
  return t;
}
