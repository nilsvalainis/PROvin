/**
 * Dīlera automātisko komentāru tīrās funkcijas (bez server-only): Opus ieteikumu piemērošana,
 * lielo mezglu izcelšana un īsās defises likums. Kopīgas serverim un testiem.
 */
import {
  applyFlashMaxReviewFinding,
  normalizeFlashMaxReviewDashes,
  type FlashMaxReviewFinding,
} from "@/lib/flash-max-final-review";

export type DealerReviewField = { id: string; label: string; text: string };

/**
 * Piemēro Opus ieteikumus automātiski. „risks” (pievienot tekstu beigās) izlaižam: dīlera produkts
 * ir izolēts, un pievienots teksts var ienest ko jaunu. Fragmentu labojumi („pretruna”, „fakts”,
 * „nepamatots”, „valoda”) tiek piemēroti, ja fragments laukā joprojām ir.
 */
export function applyDealerCommentReviewFindings(
  fields: readonly DealerReviewField[],
  findings: readonly FlashMaxReviewFinding[],
): { texts: Record<string, string>; applied: number } {
  const texts: Record<string, string> = Object.fromEntries(fields.map((f) => [f.id, f.text]));
  let applied = 0;
  for (const finding of findings) {
    if (finding.kind === "risks" || !finding.find) continue;
    const cur = texts[finding.fieldId];
    if (cur == null) continue;
    const next = applyFlashMaxReviewFinding(cur, finding);
    if (next == null || next === cur) continue;
    texts[finding.fieldId] = next;
    applied++;
  }
  return { texts, applied };
}

/** Īsā defise visur (Nila likums): garās defises -> " - ". */
export function dealerCommentPlainCleanup(text: string): string {
  return normalizeFlashMaxReviewDashes(text).replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * Lielie mezgli, ko izceļ treknrakstā (Nils 20.11: dzinējs, kārba, sadales u.c.).
 * LV + EN/DE/RU (PRO klienta valodas un RAW oriģinālvaloda). Vārda sākums, locījumi atļauti.
 */
const MAJOR_ASSEMBLY_RE = new RegExp(
  [
    // LV
    "dzinēj\\p{L}*",
    "ātrumkārb\\p{L}*",
    "pārnesumkārb\\p{L}*",
    "automātiskās? kārb\\p{L}*",
    "sadales (?:siksn|ķēd|mehānism|vārpst)\\p{L}*",
    "zobsiksn\\p{L}*",
    "turbokompresor\\p{L}*",
    "turbīn\\p{L}*",
    "sajūg\\p{L}*",
    "divmasu spararat\\p{L}*",
    "diferenciāl\\p{L}*",
    "reduktor\\p{L}*",
    "mehatronik\\p{L}*",
    "augstsprieguma akumulator\\p{L}*",
    "augstsprieguma baterij\\p{L}*",
    // EN
    "engine",
    "gearbox",
    "transmission",
    "timing (?:belt|chain)",
    "turbocharger",
    "clutch",
    "differential",
    "high[- ]voltage battery",
    // DE
    "motor(?:s|en)?",
    "getriebe\\p{L}*",
    "zahnriemen\\p{L}*",
    "steuerkette\\p{L}*",
    "turbolader\\p{L}*",
    "kupplung\\p{L}*",
    "hochvolt(?:batterie|speicher)\\p{L}*",
    // RU
    "двигател\\p{L}*",
    "коробк\\p{L}* передач",
    "ремн\\p{L}* грм",
    "цеп\\p{L}* грм",
    "турбин\\p{L}*",
    "сцеплени\\p{L}*",
  ].join("|"),
  "giu",
);

/**
 * Rich HTML: lielo mezglu nosaukumus ietin <strong>, ja tie jau nav treknrakstā.
 * Tagu iekšpusi un esošos <strong>/<b> blokus neaiztiek.
 */
export function highlightMajorAssembliesInRichHtml(html: string): string {
  if (!html) return html;
  const parts = html.split(/(<[^>]+>)/g);
  let boldDepth = 0;
  return parts
    .map((part) => {
      if (part.startsWith("<")) {
        if (/^<\s*(strong|b)(\s|>)/i.test(part)) boldDepth++;
        else if (/^<\s*\/\s*(strong|b)\s*>/i.test(part)) boldDepth = Math.max(0, boldDepth - 1);
        return part;
      }
      if (boldDepth > 0 || !part) return part;
      return part.replace(
        new RegExp(`(?<![\\p{L}\\p{N}])(?:${MAJOR_ASSEMBLY_RE.source})(?![\\p{L}\\p{N}])`, "giu"),
        (m) => `<strong>${m}</strong>`,
      );
    })
    .join("");
}
