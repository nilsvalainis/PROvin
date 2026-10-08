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

export function countryFlagEmoji(code: string | null | undefined): string {
  const c = String(code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "";
  return String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)));
}

export function countryNameLv(code: string | null | undefined): string {
  const c = String(code ?? "").trim().toUpperCase();
  return NAMES_LV[c] || c;
}

export function countryFlagLabel(code: string | null | undefined): { flag: string; name: string; title: string } | null {
  const c = String(code ?? "").trim().toUpperCase();
  const flag = countryFlagEmoji(c);
  if (!flag) return null;
  const name = countryNameLv(c);
  return { flag, name, title: `${name} (${c})` };
}
