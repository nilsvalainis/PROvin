/**
 * Copilot darbības no iekopēta car.info (un citu VIN reģistru) lapas teksta.
 */
import type { CopilotAction } from "@/lib/admin-copilot-types";
import { ADMIN_RAW_UNPROCESSED_MAX_LEN } from "@/lib/admin-raw-field-limits";
import { looksLikeCarinfoDump, parseCarinfoPastedText } from "@/lib/vin-sources/carinfo-parse";

export { looksLikeCarinfoDump };

export function buildCarinfoCopilotActions(raw: string): CopilotAction[] {
  const parsed = parseCarinfoPastedText(raw);
  if (!parsed.found) return [];
  const actions: CopilotAction[] = [];
  for (const row of parsed.mileage) {
    actions.push({
      type: "upsert_mileage",
      source: "carinfo",
      date: row.date,
      odometer: row.odometer,
      country: row.country,
      confidence: "high",
      ...(row.origin ? { note: row.origin } : {}),
    });
  }
  for (const row of parsed.incidents) {
    actions.push({
      type: "upsert_incident",
      source: "carinfo",
      date: row.date,
      lossAmount: row.amount,
      country: row.country,
      confidence: "high",
      ...(row.note ? { note: row.note } : {}),
    });
  }
  if (parsed.ownersSummary || parsed.statusRecords || parsed.notes.length > 0) {
    actions.push({
      type: "set_registry_fields",
      source: "carinfo",
      ownersSummary: parsed.ownersSummary,
      statusRecords: parsed.statusRecords,
      autoNotes: parsed.notes.join("\n"),
      confidence: "high",
    });
  }
  const clipped = raw.trim().slice(0, ADMIN_RAW_UNPROCESSED_MAX_LEN);
  if (clipped.length > 40) {
    actions.push({
      type: "append_raw",
      source: "carinfo",
      text: clipped,
      confidence: "high",
      note: "car.info lapas teksts",
    });
  }
  return actions;
}
