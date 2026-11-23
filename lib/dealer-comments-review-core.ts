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

/**
 * Opus pārbaudes papildu likumi dīlera produktam (Nils 22.11.2026: „komentāru ģenerēšana dubulto
 * tekstu par apkopēm”). Abi lauki nedrīkst atkārtot viens otru vai PDF tabulas.
 */
export const DEALER_REVIEW_DEDUP_RULES = `DEALER PRODUCT - DUPLICATION CHECK (extra finding kind "atkartojums"):
- Field "oilChangeIntervalNotes" owns engine-oil / service-interval analysis. Field "comments" owns everything else (non-routine repairs and major assemblies, recalls / campaigns / warranty, km inconsistencies, what to check).
- The client PDF already prints a vehicle-info table (model, year, VIN, engine, gearbox, colour, interior), a list of EVERY service visit (date, km, works) and a table of EVERY oil change with steps vs OEM.
- Report kind "atkartojums" for: (a) any sentence in "comments" about oil changes or service intervals; (b) an identification sentence/paragraph in "comments" that only repeats the vehicle-info table; (c) a visit-by-visit or routine-maintenance enumeration in either field; (d) the same fact stated in both fields (keep it in its owner field); (e) a paragraph in "oilChangeIntervalNotes" about major assemblies, gearbox oil or repairs.
- NO RECOMMENDATIONS (Nils 22.11.2026): both dealer fields state facts only; advice belongs to the full audit report. Report kind "atkartojums" with "replace": "" for every recommendation / advice sentence („jāpārbauda”, „ieteicams”, „iesakām”, „pārdevējam jālūdz”, „jāprasa dokumenti / rēķini”, „pārbaudīt apskatē”, city-driving oil advice) and for evaluative stories or guesses about reasons. Also report kind "fakts" when a position-only row is described as an action („pārbaudīts / nomainīts”), replacing it with „ierakstā ir pozīcija: … (darbība nav norādīta)”.
- DRIVETRAIN (Nils 23.11.2026): if the dealer data / vehicle-info table says the drive is 4x2 / RWD / FWD / rear-wheel / front-wheel (one driven axle), any „4MATIC”, „xDrive”, „quattro”, „4Motion”, „AWD”, „4x4” or „pilnpiedziņa” in either field is a factual error. Report kind "fakts" with "find" = that exact phrase or sentence and "replace" = the same text without the all-wheel-drive claim (if nothing else would remain, use kind "atkartojums" with "replace": ""). The same for a model name or engine that contradicts the vehicle-info table.
- For "atkartojums": "find" is the exact duplicated sentence or paragraph (including its heading line if the whole role goes), "replace" is "" to delete it, or a much shorter conclusion sentence if a conclusion would otherwise be lost. Never delete the first line „Ražotāja intervāls: …”.`;

/**
 * Deterministisks drošības tīkls pēc Opus: izmet no „Komentāri” teikumus, kas runā par eļļas maiņu /
 * intervāliem vai gandrīz vārds vārdā atkārto eļļas lauka teikumu. Virsraksta rindas un pārējais paliek.
 */
const DEALER_OIL_TOPIC_RE =
  /(?:motor|dzinēja\s+)?eļļ\p{L}*\s+(?:un\s+\p{L}+\s+)?(?:maiņ|nomaiņ)\p{L}*|eļļas\s+maiņas\s+intervāl\p{L}*|apkopju\s+intervāl\p{L}*|servisa\s+intervāl\p{L}*/iu;

/** Kārbas / diferenciāļa / stūres eļļa ir lielā mezgla darbs - tas pieder „Komentāriem”, ne eļļas laukam. */
const DEALER_NON_ENGINE_OIL_RE =
  /kārb\p{L}*|transmisij\p{L}*|\bATF\b|diferenciāl\p{L}*|reduktor\p{L}*|sadales\s+kārb\p{L}*|stūres|hidraulik\p{L}*|haldex/iu;

function sentenceTokens(s: string): Set<string> {
  return new Set(
    s
      .toLocaleLowerCase("lv")
      .replace(/(\d)\s+(\d{3})/g, "$1$2")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3 || /\d/.test(w)),
  );
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0) return 0;
  let hit = 0;
  for (const w of a) if (b.has(w)) hit++;
  return hit / a.size;
}

function splitSentencesKeep(line: string): string[] {
  return line.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map((x) => x.trim()).filter(Boolean) ?? [line];
}

/** Atgriež „Komentāri” tekstu bez eļļas tēmas teikumiem un bez atkārtojumiem no eļļas lauka. */
export function dropDealerCommentsDuplicatingOil(comments: string, oil: string): string {
  if (!comments.trim()) return comments;
  const oilSentences = oil
    .split(/\n+/)
    .flatMap(splitSentencesKeep)
    .map(sentenceTokens)
    .filter((t) => t.size >= 5);
  const paragraphs = comments.split(/\n{2,}/);
  const kept = paragraphs
    .map((para) => {
      const lines = para.split("\n");
      const outLines = lines
        .map((line) => {
          const sentences = splitSentencesKeep(line);
          // Virsraksta rinda (bez teikuma beigu pieturzīmes, īsa) paliek - tukšu lomu izmet zemāk.
          if (sentences.length === 1 && !/[.!?]$/.test(line.trim()) && line.trim().split(/\s+/).length <= 7) return line;
          const keep = sentences.filter((sent) => {
            if (DEALER_OIL_TOPIC_RE.test(sent) && !DEALER_NON_ENGINE_OIL_RE.test(sent)) return false;
            const tok = sentenceTokens(sent);
            if (tok.size >= 5 && oilSentences.some((o) => overlapRatio(tok, o) >= 0.7)) return false;
            return true;
          });
          return keep.join(" ");
        })
        .filter((l) => l.trim());
      // Ja palikusi tikai virsraksta rinda - izmet visu lomu.
      const hasBody = outLines.some((l) => /[.!?]$/.test(l.trim()) || l.trim().split(/\s+/).length > 7);
      return hasBody ? outLines.join("\n") : "";
    })
    .filter((p) => p.trim());
  return kept.join("\n\n");
}

/** Ieteikuma / padoma teikums (Nils 22.11: dīlera produktā tikai fakti). */
const DEALER_RECOMMENDATION_RE =
  /jāpārbauda|jāpārbauda\p{L}*|ieteicam\p{L}*|iesakām|ieteikum\p{L}*|pārdevējam\s+jā\p{L}*|jālūdz\p{L}*|jāprasa\p{L}*|lūdziet|pārbaudīt\s+apskat\p{L}*|apskatē\s+(?:jā)?pārbaud\p{L}*|vajadzētu|nepieciešams\s+(?:pārbaudīt|pieprasīt|lūgt)|pieprasīt\p{L}*\s+(?:dokument|rēķin|servisa\s+grāmatiņ)\p{L}*/iu;

/**
 * Deterministisks drošības tīkls abiem dīlera laukiem: izmet ieteikumu teikumus.
 * Virsraksta rindas paliek; loma, kurā palikis tikai virsraksts, tiek izmesta.
 * Eļļas lauka pirmā rinda „Ražotāja intervāls: …” nekad netiek aiztikta.
 */
export function dropDealerRecommendationSentences(text: string): string {
  if (!text.trim()) return text;
  const paragraphs = text.split(/\n{2,}/);
  const kept = paragraphs
    .map((para) => {
      const lines = para.split("\n");
      const outLines = lines
        .map((line) => {
          if (/^\s*Ražotāja intervāls:/i.test(line)) return line;
          if (!/[.!?]$/.test(line.trim()) && line.trim().split(/\s+/).length <= 7) return line;
          // Teikumu robeža: pieturzīme + atstarpe + lielais burts (datumi „09.06.2020” nedala).
          return line
            .split(/(?<=[.!?])\s+(?=\p{Lu})/u)
            .filter((sent) => !DEALER_RECOMMENDATION_RE.test(sent))
            .join(" ");
        })
        .filter((l) => l.trim());
      const hasBody = outLines.some(
        (l) => /^\s*Ražotāja intervāls:/i.test(l) || /[.!?]$/.test(l.trim()) || l.trim().split(/\s+/).length > 7,
      );
      return hasBody ? outLines.join("\n") : "";
    })
    .filter((p) => p.trim());
  return kept.join("\n\n");
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
