import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractDealerFacts, buildDealerFactsBrief } from "@/lib/admin-ai-dealer-facts";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { sourceBlockPlainTextForAi } from "@/lib/admin-source-comment-blocks";

/**
 * Etalons (README klase B, 5. punkts): BMW 320d WBA3K31080F656545 OneAuto oriģinālā ir 20.11.2012 90 000 km
 * (detaļu pasūtījums 6 dienas pēc reģistrācijas). Agrāk dīlera komentārs no tā uzrakstīja "kritums par 87 046 km".
 * Neapstrādātais rādījums nedrīkst nonākt AI kontekstā.
 */
const fixture = JSON.parse(
  readFileSync(path.join(__dirname, "__fixtures__/mileage-etalons/WBA3K31080F656545.json"), "utf8"),
) as { sourceBlocks: WorkspaceSourceBlocks };

const RAW_2012 = /20\.11\.2012[^\n]{0,80}90[\s .,]?000|90[\s .,]?000[^\n]{0,80}20\.11\.2012/;

describe("dīlera komentārs: OneAuto oriģinālā kļūdainais nobraukums", () => {
  const blocks = mergeSourceBlocksWithDefaults(fixture.sourceBlocks);

  it("dīlera avota teksts AI nesatur 20.11.2012 90 000 km", () => {
    const text = sourceBlockPlainTextForAi("auto_records", blocks);
    expect(text).toContain("20.11.2012");
    expect(text).not.toMatch(RAW_2012);
  });

  it("dīlera faktu saraksts AI nesatur 90 000 km 2012. gadā", () => {
    const brief = buildDealerFactsBrief(
      extractDealerFacts({ oneauto: blocks.oneauto, autoRecords: blocks.auto_records }),
    );
    expect(brief).toContain("20.11.2012");
    expect(brief).not.toMatch(RAW_2012);
  });
});
