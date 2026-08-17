/**
 * Publisko reģistru (tjekbil / mnt / lkf / car.info) faktu teksts klientam:
 * īsas latviešu rindas, bez ikonām, RED FLAG birkām un avota kājenes.
 */

const JUNK_LINE =
  /last updated|next update|transportstyrelsen|log in|become a professional|responsible publisher|car\.info logo|give feedback|search model|cookie|privacy policy|user agreement|^number of owners\b|^in traffic\b|inspections was last updated/i;

export function formatRegistryDateLv(raw: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  return raw.trim();
}

export function sanitizeVinRegistryClientText(raw: string): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/\n+/)) {
    const line = sanitizeVinRegistryClientLine(part);
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }
  return lines.join("\n");
}

export function sanitizeVinRegistryClientLine(raw: string): string {
  let s = raw.replace(/\u00a0/g, " ").trim();
  if (!s) return "";
  if (/^ielasīts:/i.test(s)) return "";
  if (JUNK_LINE.test(s)) return "";
  s = s.replace(/^[⚠⚠️]\s*/u, "");
  s = s.replace(/\bRED FLAG:\s*/gi, "");
  s = s.replace(/^[·•*]\s+/u, "");
  s = s.replace(/\s*[—–]\s*/g, " - ");
  s = s.replace(/\s*→\s*/g, ", pēc tam ");
  s = s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_m, y: string, mo: string, d: string) => `${d}.${mo}.${y}`);
  s = s.replace(/\s{2,}/g, " ").trim();
  if (!s || /^[-:.,;]+$/.test(s)) return "";
  if (/^(īpašnieka maiņa:?|,)\s*$/i.test(s)) return "";
  return s;
}
