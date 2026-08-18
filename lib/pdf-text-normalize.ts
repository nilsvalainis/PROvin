/** Kopīga PDF teksta normalizācija (serveris + pārlūks). */

const LV_LETTER_CLASS = "A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž";
/** pdf.js bieži izgriež š/ļ utt. kā atsevišķu glifu (`priek š ējā`, `da ļ a`). */
const LV_CONSONANT_DIA = "šļžņķģčŠĻŽŅĶĢČ";

/** Atstarpes rindas iekšienē — bez jaunas rindas, lai nesalīmētu `2016\n27000 km`. */
const HORIZONTAL_WS = "[ \\t\\u00a0\\u202f]";

/** Salīmē `priek š ējā` → `priekšējā`, neskarot `Labā puse`. */
export function reattachLatvianPdfDiacritics(raw: string): string {
  let t = raw;
  let prev = "";
  const left = new RegExp(`([${LV_LETTER_CLASS}])${HORIZONTAL_WS}+([${LV_CONSONANT_DIA}])`, "g");
  const right = new RegExp(`([${LV_CONSONANT_DIA}])${HORIZONTAL_WS}+([${LV_LETTER_CLASS}])`, "g");
  while (t !== prev) {
    prev = t;
    t = t.replace(left, "$1$2");
    t = t.replace(right, "$1$2");
  }
  return t;
}

export function normalizePdfExtractedText(raw: string): string {
  let t = raw.replace(/\u00a0/g, " ");
  let prev = "";
  while (t !== prev) {
    prev = t;
    t = t.replace(new RegExp(`(\\d)${HORIZONTAL_WS}+(?=\\d)`, "g"), "$1");
  }
  t = t.replace(new RegExp(`\\b([kK])${HORIZONTAL_WS}+([mM])\\b`, "g"), "$1$2");
  const re = new RegExp(`\\b([${LV_LETTER_CLASS}])(?:${HORIZONTAL_WS}+([${LV_LETTER_CLASS}])){2,}\\b`, "g");
  for (let i = 0; i < 12; i++) {
    t = t.replace(re, (chunk) => chunk.replace(new RegExp(`${HORIZONTAL_WS}+`, "g"), ""));
  }
  return reattachLatvianPdfDiacritics(t);
}
