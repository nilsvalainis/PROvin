/**
 * j26: Copart / IAAI bojājumu kodi latviski. Nezināms kods paliek oriģinālā ar atzīmi
 * „(oriģināls)”, lai admins redz, ka tulkojuma nav. Saglabātos datus nemaina - lieto
 * jauniem importiem un AI kontekstā.
 */
const DAMAGE_LV: Array<[RegExp, string]> = [
  [/^front(?:\s*end)?$/i, "priekšpuse"],
  [/^rear(?:\s*end)?$/i, "aizmugure"],
  [/^(?:left|right)?\s*side$/i, "sāns"],
  [/^left\s*front$/i, "priekšpuse kreisajā pusē"],
  [/^right\s*front$/i, "priekšpuse labajā pusē"],
  [/^left\s*rear$/i, "aizmugure kreisajā pusē"],
  [/^right\s*rear$/i, "aizmugure labajā pusē"],
  [/^hail$/i, "krusa"],
  [/^(?:water|flood)(?:\s*\/\s*flood)?$/i, "applūdis"],
  [/^all\s*over$/i, "visa virsbūve"],
  [/^mechanical$/i, "mehānisks bojājums"],
  [/^minor\s*dent\s*\/?\s*scratch(?:es)?$/i, "nelieli ieliekumi / skrāpējumi"],
  [/^minor\s*dents?$/i, "nelieli ieliekumi"],
  [/^scratch(?:es)?$/i, "skrāpējumi"],
  [/^undercarriage$/i, "apakšdaļa"],
  [/^roof$/i, "jumts"],
  [/^top\s*\/?\s*roof$/i, "jumts"],
  [/^burn(?:\s*-\s*\w+)?$/i, "degšana"],
  [/^fire$/i, "degšana"],
  [/^vandalism$/i, "vandalisms"],
  [/^normal\s*wear(?:\s*&?\s*tear)?$/i, "normāls nolietojums"],
  [/^biohazard\s*\/?\s*chemical$/i, "bīstamas vielas"],
  [/^stripped$/i, "izjaukts"],
  [/^theft$/i, "zādzība"],
  [/^rollover$/i, "apgāšanās"],
  [/^frame\s*damage$/i, "rāmja bojājums"],
  [/^electrical$/i, "elektrība"],
  [/^engine\s*damage$/i, "dzinēja bojājums"],
  [/^transmission\s*damage$/i, "kārbas bojājums"],
  [/^suspension$/i, "piekare"],
  [/^unknown$/i, "nezināms"],
  [/^none$/i, "nav"],
];

export const DAMAGE_LABEL_UNTRANSLATED_SUFFIX = "(oriģināls)";

function partLv(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  for (const [re, lv] of DAMAGE_LV) if (re.test(t)) return lv;
  return null;
}

/** Vai teksts izskatās pēc angļu izsoles bojājuma koda (ne jau latvisks apraksts). */
function looksLikeEnglishCode(raw: string): boolean {
  return /^[A-Za-z][A-Za-z\s&/+,-]*$/.test(raw.trim());
}

/** „Front End + Side” -> „priekšpuse, sāns”. Latvisks / brīvs teksts paliek kā ir. */
export function auctionDamageLv(raw: string): string {
  const t = (raw ?? "").trim();
  if (!t || !looksLikeEnglishCode(t)) return t;
  const parts = t.split(/\s*(?:\+|,|\/(?!\s*(?:flood|scratch|roof|chemical))|;|\band\b)\s*/i).filter(Boolean);
  const lv = parts.map(partLv);
  if (lv.every((x) => x != null)) return [...new Set(lv as string[])].join(", ");
  return `${t} ${DAMAGE_LABEL_UNTRANSLATED_SUFFIX}`;
}
