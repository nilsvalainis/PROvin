import { dealerServiceWorksFromSources } from "@/lib/admin-ai-dealer-facts";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { buildOilIntervalSeriesForBlock } from "@/lib/oil-change-interval-chart";
import { collectEngineOilChangeRows, formatOilStepRangeFactLine } from "@/lib/oil-change-intervals";
/**
 * Iespējamās (nepierādītās) eļļas maiņas - eļļas filtra korpuss bez eļļas maiņas (Nils 27.11, S8).
 * AI tās NESKAITA maiņās un nesauc par «pēdējo eļļas maiņu».
 */
export function possibleOilPromptLines(possible: readonly { date: string; odometer: string }[]): string {
  if (possible.length === 0) return "";
  const lines = possible.map((p, i) => {
    const km = p.odometer.replace(/\D/g, "");
    const kmText = km ? `${km.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km` : "km nav";
    return `I${i + 1}: ${p.date.trim() || "datums nav"}, ${kmText} - eļļas filtra korpuss`;
  });
  return `
Iespējamas eļļas maiņas (NAV pierādītas, NEskaiti tās maiņās, intervālos un «pēdējā eļļas maiņa»):
${lines.join("\n")}
Ja min - raksti tikai: «eļļas filtra korpusa maiņa - iespējams, veikta arī eļļas maiņa, bet tas nav pierādīts». Nekad «eļļa nomainīta».`;
}

/**
 * j26: deterministisks dzinēja eļļas maiņu saraksts - TĀ PATI sērija, ko zīmē PDF tabula
 * (`buildOilIntervalSeriesForBlock`, ar operatora saglabātajām rindām), lai AI teksts un tabula
 * nekad nerāda divus dažādus skaitļus (audits 22.11: 13 tekstā pret 6 tabulā).
 * Ja auto_records rindu nav (vecs OneAuto bloks), paliek iepriekšējais ceļš.
 */
export function buildEngineOilChangeListForPrompt(sourceBlocks: WorkspaceSourceBlocks): string {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const tableSeries = buildOilIntervalSeriesForBlock(blocks.auto_records);
  const tableRows = tableSeries.points.map((p) => ({
    date: p.date,
    odometer: p.odometer,
  }));
  const rows =
    tableRows.length > 0
      ? tableRows
      : collectEngineOilChangeRows(
          dealerServiceWorksFromSources({ oneauto: blocks.oneauto, autoRecords: blocks.auto_records }),
        );
  if (rows.length === 0) {
    return "=== Dzinēja eļļas maiņas no koda ===\nKods dīlera datos dzinēja eļļas maiņas neatrada. Neizdomā maiņas.";
  }
  const steps = tableRows.length > 0 ? formatOilStepRangeFactLine(tableSeries) : "";
  const lines = rows.map((r, i) => {
    const km = r.odometer.replace(/\D/g, "");
    const kmText = km ? `${km.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km` : "km nav";
    return `E${i + 1}: ${r.date.trim() || "datums nav"}, ${kmText}`;
  });
  return `=== Dzinēja eļļas maiņas no koda (deterministisks saraksts, tas pats, ko PDF tabula) ===
Skaits: ${rows.length}. Cits skaits AIZLIEGTS (arī laukā „Komentāri”); intervālus rēķini tikai starp šīm rindām.
${lines.join("\n")}${steps ? `\n${steps}` : ""}${possibleOilPromptLines(tableSeries.possiblePoints ?? [])}`;
}
