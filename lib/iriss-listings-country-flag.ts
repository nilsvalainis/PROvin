const NAMES_LV: Record<string, string> = {
  DE: "Vācija",
  BE: "Beļģija",
  NL: "Nīderlande",
  FR: "Francija",
  IT: "Itālija",
  AT: "Austrija",
  ES: "Spānija",
  PL: "Polija",
  CZ: "Čehija",
  DK: "Dānija",
  SE: "Zviedrija",
  LU: "Luksemburga",
  PT: "Portugāle",
  LT: "Lietuva",
  LV: "Latvija",
  EE: "Igaunija",
  GB: "Lielbritānija",
  IE: "Īrija",
  HU: "Ungārija",
  RO: "Rumānija",
  SK: "Slovākija",
  SI: "Slovēnija",
  HR: "Horvātija",
  FI: "Somija",
  CH: "Šveice",
};

export function countryFlagEmoji(code: string): string {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "";
  return String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)));
}

export function countryNameLv(code: string): string {
  const c = code.trim().toUpperCase();
  return NAMES_LV[c] || c;
}

export function countryFlagLabel(code: string): { flag: string; name: string; title: string } | null {
  const c = code.trim().toUpperCase();
  const flag = countryFlagEmoji(c);
  if (!flag) return null;
  const name = countryNameLv(c);
  return { flag, name, title: `${name} (${c})` };
}
