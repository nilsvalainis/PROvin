import { dealerServiceWorksFromSources } from "@/lib/admin-ai-dealer-facts";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { collectEngineOilChangeRows } from "@/lib/oil-change-intervals";
/**
 * j26: deterministisks dzinēja eļļas maiņu saraksts (tas pats, ko zīmē PDF grafiks).
 * Modelis skaitu neskaita pats - cits skaits aizliegts.
 */
export function buildEngineOilChangeListForPrompt(sourceBlocks: WorkspaceSourceBlocks): string {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const rows = collectEngineOilChangeRows(
    dealerServiceWorksFromSources({ oneauto: blocks.oneauto, autoRecords: blocks.auto_records }),
  );
  if (rows.length === 0) {
    return "=== Dzinēja eļļas maiņas no koda ===\nKods dīlera datos dzinēja eļļas maiņas neatrada. Neizdomā maiņas.";
  }
  const lines = rows.map((r, i) => {
    const km = r.odometer.replace(/\D/g, "");
    const kmText = km ? `${km.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km` : "km nav";
    return `E${i + 1}: ${r.date.trim() || "datums nav"}, ${kmText}`;
  });
  return `=== Dzinēja eļļas maiņas no koda (deterministisks saraksts) ===
Skaits: ${rows.length}. Cits skaits AIZLIEGTS; intervālus rēķini tikai starp šīm rindām.
${lines.join("\n")}`;
}
