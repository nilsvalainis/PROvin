/** Latvian day count: 1 diena, 21 diena, 11 dienas, 18 dienas. Nekad „diena(s)”. */
export function formatLvDayCount(n: number): string {
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(Math.trunc(n));
  const isOne = abs % 10 === 1 && abs % 100 !== 11;
  return `${n} ${isOne ? "diena" : "dienas"}`;
}

export function replaceDienaSPlaceholder(text: string): string {
  return text.replace(/(\d+)\s*diena\(s\)/gi, (_, raw: string) => formatLvDayCount(Number(raw)));
}
