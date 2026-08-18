/** Kopīga PDF teksta normalizācija (serveris + pārlūks). */

const LV_LETTER_CLASS = "A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž";

/** Atstarpes rindas iekšienē — bez jaunas rindas, lai nesalīmētu `2016\n27000 km`. */
const HORIZONTAL_WS = "[ \\t\\u00a0\\u202f]";

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
  return t;
}
