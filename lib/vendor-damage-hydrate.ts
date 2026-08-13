/**
 * Bojājumu zonas no saglabātā AutoDNA / CarVertical RAW — veciem pasūtījumiem,
 * kuriem incidents ir, bet damageDetails nav aizpildīts.
 */
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
