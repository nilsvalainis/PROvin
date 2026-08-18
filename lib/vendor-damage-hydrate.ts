/**
 * Bojājumu zonas no saglabātā AutoDNA / CarVertical RAW un portfeļa PDF teksta.
 */
import type { ClientManualVendorBlockPdf } from "@/lib/admin-source-blocks";
import { parseAutodnaDamageDetails } from "@/lib/autodna-damage-parse";
import {
  parseCarverticalDamagesFromText,
  type CarVerticalDamageDetailRow,
} from "@/lib/carvertical-pdf-parse";

export function damageDetailRowHasZones(
  d: Pick<CarVerticalDamageDetailRow, "damagedSides" | "damageGroups">,
): boolean {
  return Boolean(d.damagedSides.trim() || d.damageGroups.trim());
}

export function parseDamageDetailsFromVendorRaw(raw: string): CarVerticalDamageDetailRow[] {
  const text = raw.replace(/<[^>]+>/g, " ").trim();
  if (!text) return [];
  const autodna = parseAutodnaDamageDetails(text).filter(damageDetailRowHasZones);
  if (autodna.length > 0) return autodna;
  return parseCarverticalDamagesFromText(text).damageDetails.filter(damageDetailRowHasZones);
}

export function parseDamageDetailsForVendorTitle(title: string, raw: string): CarVerticalDamageDetailRow[] {
  const text = raw.replace(/<[^>]+>/g, " ").trim();
  if (!text) return [];
  if (/autodna/i.test(title)) return parseAutodnaDamageDetails(text).filter(damageDetailRowHasZones);
  if (/carvertical/i.test(title)) {
    return parseCarverticalDamagesFromText(text).damageDetails.filter(damageDetailRowHasZones);
  }
  return parseDamageDetailsFromVendorRaw(text);
}

function damageMonthKey(date: string): string {
  const t = date.trim();
  const dmy = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}`;
  const my = t.match(/^(\d{1,2})\.(\d{4})$/);
  if (my) return `${my[2]}-${my[1]!.padStart(2, "0")}`;
  return t.toLowerCase();
}

function sameDamageEvent(a: CarVerticalDamageDetailRow, b: CarVerticalDamageDetailRow): boolean {
  const ay = damageMonthKey(a.date);
  const by = damageMonthKey(b.date);
  if (!ay || !by || ay !== by) return false;
  const ac = a.country.trim().toLowerCase();
  const bc = b.country.trim().toLowerCase();
  if (!ac || !bc) return true;
  return ac === bc || ac.includes(bc) || bc.includes(ac);
}

export function mergeDamageDetailRows(
  existing: CarVerticalDamageDetailRow[],
  extra: CarVerticalDamageDetailRow[],
): CarVerticalDamageDetailRow[] {
  const out = [...existing];
  for (const row of extra) {
    const i = out.findIndex((x) => sameDamageEvent(x, row));
    if (i < 0) {
      out.push(row);
      continue;
    }
    const cur = out[i]!;
    const sides = [cur.damagedSides, row.damagedSides].map((s) => s.trim()).filter(Boolean);
    const groups = [cur.damageGroups, row.damageGroups].map((s) => s.trim()).filter(Boolean);
    out[i] = {
      date: cur.date.trim() || row.date,
      country: cur.country.trim() || row.country,
      lossAmount: cur.lossAmount.trim() || row.lossAmount,
      damagedSides: [...new Set(sides)].join(" "),
      damageGroups: [...new Set(groups)].join(" "),
    };
  }
  return out;
}

export function attachPdfTextsToVendorBlocks(
  blocks: ClientManualVendorBlockPdf[],
  texts: { fileName: string; text: string }[],
): ClientManualVendorBlockPdf[] {
  if (texts.length === 0) return blocks;
  return blocks.map((b) => {
    const parsed = texts.flatMap((t) => parseDamageDetailsForVendorTitle(b.title, t.text));
    if (parsed.length === 0) return b;
    return {
      ...b,
      damageDetails: mergeDamageDetailRows(b.damageDetails ?? [], parsed),
    };
  });
}
