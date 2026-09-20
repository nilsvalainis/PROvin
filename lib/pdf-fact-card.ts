/**
 * PDF faktu karte - tas pats vizuālais kods kā dīlera „Transportlīdzekļa informācija”.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FACT_LINE_RE = /^([^:]{2,60}):\s+(.+)$/;

export function parsePdfFactCardRows(text: string, unlabeledKey: string): { k: string; v: string }[] {
  const rows: { k: string; v: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const m = FACT_LINE_RE.exec(line);
    if (m) {
      rows.push({ k: m[1]!.trim(), v: m[2]!.trim().replace(/\.+$/, "") });
      continue;
    }
    rows.push({ k: unlabeledKey, v: line.replace(/\.+$/, "") });
  }
  return rows;
}

/** Īpašnieki + statusi + karogi vienā kv tabulā, bez komentāru kastēm. */
export function collectRegistryFactCardRows(input: {
  ownersSummary?: string;
  statusRecords?: string;
  autoNotes?: string;
}): { k: string; v: string }[] {
  return [
    ...parsePdfFactCardRows(input.ownersSummary ?? "", "Īpašnieku skaits"),
    ...parsePdfFactCardRows(input.statusRecords ?? "", "Statuss"),
    ...parsePdfFactCardRows(input.autoNotes ?? "", "Piezīmes"),
  ];
}

export function buildPdfFactCardHtml(
  rows: { k: string; v: string }[],
  title = "Transportlīdzekļa informācija",
): string {
  if (rows.length === 0) return "";
  const body = rows
    .map((r) => `<tr><td>${escapeHtml(r.k)}</td><td>${escapeHtml(r.v)}</td></tr>`)
    .join("");
  const head = title.trim()
    ? `<p class="pdf-subhead">${escapeHtml(title.trim())}</p>`
    : "";
  return `${head}<table class="pdf-v1-kv"><tbody>${body}</tbody></table>`;
}
