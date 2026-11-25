import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FLASH_MAX_JOBS,
  defaultFlashMaxSelection,
  flashMaxSelectionWithData,
  flashMaxUnavailableMenuJobs,
  expandFlashMaxMenuJobs,
  type FlashMaxSourceJob,
} from "@/lib/admin-flash-max";
import {
  AI_SOURCE_COMMENT_BLOCK_KEYS,
  type AiSourceCommentBlockKey,
  type AiSourceCommentTargetField,
} from "@/lib/admin-source-comment-blocks";
import { LISTING_ANALYSIS_SUBSECTIONS, createDefaultSourceBlocks } from "@/lib/admin-source-blocks";

/**
 * 25.11: katram ✨ AI laukam / blokam jābūt FLASH MAX darbam (lai jauns avots nākotnē neaizmirstas - kā CARFAX #1204).
 * Ja pievieno jaunu ✨ lauku, kuram apzināti nav FLASH MAX darba - ieraksti to izņēmumos ar iemeslu.
 */

/** Bloki ar ✨ komentāru, kuriem apzināti nav atsevišķa FLASH MAX darba. */
const SOURCE_BLOCK_EXCEPTIONS: Partial<Record<AiSourceCommentBlockKey, string>> = {
  oneauto: "UI ir dīlera blokā (auto_records); atsevišķais oneauto bloks ir vēsturisks",
};

/** ✨ lauki dīlera blokā (auto_records) - katram savs FLASH MAX darbs. */
const AUTO_RECORDS_AI_FIELDS: readonly AiSourceCommentTargetField[] = [
  "comments",
  "serviceHistoryNotes",
  "oilChangeIntervalNotes",
];

/** /api/admin/ai/* maršruti, kas neraksta atskaites lauku vai nav FLASH MAX daļa. */
const AI_ROUTE_EXCEPTIONS: Record<string, string> = {
  "source-comment": "avotu darbi (kind: source) - pārbauda atsevišķi pēc bloka",
  "fact-check": "determinēta pārbaude pēc katra lauka",
  "fact-check-fix": "faktu pārbaudes labojums (poga)",
  "flashmax-final-review": "FLASH MAX noslēguma pārbaude",
  "listing-peek-comment": "Ātrā sludinājuma vērtējuma e-pasts, nav pasūtījuma lauks",
  "oneauto-translate": "tulkošana, nav komentārs",
  "price-analysis": "cenas analīze (nav PDF lauks)",
  "tirgus-market": "tirgus datu ielase blokā, komentārs - darbs tirgus",
};

const sourceJobs = FLASH_MAX_JOBS.filter((j): j is FlashMaxSourceJob => j.kind === "source");

describe("FLASH MAX pārklājums: katram ✨ laukam ir darbs", () => {
  it("katram avotu blokam ar ✨ komentāru ir FLASH MAX darbs (vai izņēmums ar iemeslu)", () => {
    const missing = AI_SOURCE_COMMENT_BLOCK_KEYS.filter(
      (key) => !SOURCE_BLOCK_EXCEPTIONS[key] && !sourceJobs.some((j) => j.blockKey === key && j.targetField === "comments"),
    );
    expect(missing).toEqual([]);
  });

  it("CARFAX un dīlera «Servisa vēsture» ir FLASH MAX", () => {
    expect(sourceJobs.some((j) => j.blockKey === "carfax")).toBe(true);
    for (const field of AUTO_RECORDS_AI_FIELDS) {
      expect(sourceJobs.some((j) => j.blockKey === "auto_records" && j.targetField === field)).toBe(true);
    }
  });

  it("katram sludinājuma analīzes laukam ir darbs", () => {
    const fields = FLASH_MAX_JOBS.flatMap((j) =>
      j.kind === "listing" ? [j.listingField ?? (j.id === "seller" ? "sellerPortrait" : j.id)] : [],
    );
    for (const field of Object.keys(LISTING_ANALYSIS_SUBSECTIONS)) {
      expect(fields).toContain(field);
    }
  });

  it("katram /api/admin/ai/* lauka maršrutam ir FLASH MAX darbs (vai izņēmums ar iemeslu)", () => {
    const dir = path.join(process.cwd(), "app/api/admin/ai");
    const routes = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const endpoints = new Set(
      FLASH_MAX_JOBS.flatMap((j) => ("endpoint" in j ? [j.endpoint.replace("/api/admin/ai/", "")] : [])),
    );
    const missing = routes.filter((r) => !AI_ROUTE_EXCEPTIONS[r] && !endpoints.has(r));
    expect(missing).toEqual([]);
  });

  it("darbu id ir unikāli", () => {
    const ids = FLASH_MAX_JOBS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("noklusējumā ģenerē visus darbus, kuriem ir dati (arī LTAB, valstu reģistrus, CARFAX)", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.ltab = { ...blocks.ltab, aiContextRaw: "LTAB: 2 negadījumi" };
    blocks.tjekbil = { ...blocks.tjekbil, aiContextRaw: "DK: 2019 reģistrēts" };
    blocks.carfax = { ...blocks.carfax, aiContextRaw: "CARFAX: 8 ieraksti" };
    const unavailable = flashMaxUnavailableMenuJobs(expandFlashMaxMenuJobs(FLASH_MAX_JOBS, blocks), blocks);
    const picked = flashMaxSelectionWithData(defaultFlashMaxSelection(), unavailable).selectedIds;
    expect(picked).toEqual(expect.arrayContaining(["ltab", "tjekbil", "carfax"]));
    expect(picked).not.toContain("autodna");
    expect(picked).not.toContain("sources_comparison");
  });
});
