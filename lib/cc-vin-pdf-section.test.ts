import { describe, expect, it } from "vitest";

import { buildCcVinPdfInnerHtml } from "@/lib/cc-vin-pdf-html";
import { applyCcVinParsedReport } from "@/lib/cc-vin-report-apply";
import { emptyCcVinBlock, type CcVinBlockState } from "@/lib/cc-vin-report";
import { parseCcVinReportText } from "@/lib/cc-vin-report-parse";
import { collectUnifiedIncidentRows } from "@/lib/unified-incidents";
import { collectUnifiedMileageRows } from "@/lib/unified-mileage";

const REPORT = [
  "Vehicle history report",
  "BMW 3-Series, 2020",
  "VIN:",
  "WBA5R1C0XLFH42873",
  "Report Date:",
  "13/07/2026",
  "General Information",
  "8/12 attention marks",
  "Odometer records",
  "49,890 km",
  "Vehicle damages",
  "2 damage(s)",
  "Theft records",
  "No problems found",
  "Number of owners",
  "4 owner(s)",
  "Mileages",
  "2 record(s)",
  "19/09/2019",
  "16 km",
  "11/08/2020",
  "49890 km",
  "Junk / salvage / insurance records",
  "3 registra\u099eon(s)",
  "18/03/2020",
  " IAA",
  "DETAILS",
  "Loca\u099eonWESTCHESTER",
  "Disposi\u099eonSOLD",
  "Title records",
  "1 record(s)",
  "Record #1",
  " 19/09/2019 California 16 km",
  "Auc\u099eon sale history",
  "1 record(s)",
  "SOLD #2",
  "49,890 kmIAAI11/08/2020",
].join("\n");

function blockFromReport(): CcVinBlockState {
  return applyCcVinParsedReport(emptyCcVinBlock(), parseCcVinReportText(REPORT));
}

describe("starptautiskās vēstures PDF sadaļa", () => {
  it("rāda sarkanos karogus un vēsturi, bet nedublē specifikācijas", () => {
    const html = buildCcVinPdfInnerHtml(blockFromReport());
    expect(html).toContain("Sarkanie karogi");
    expect(html).toContain("Odometra ieraksti");
    expect(html).toContain("Īpašumtiesību (title) ieraksti");
    expect(html).toContain("Pārdošanas un izsoļu vēsture");
    expect(html).toContain("Reģistros ar atzīmēm");
    expect(html).toContain("Īpašnieki ārvalstīs");
    // Nedrukā „tīros” reģistrus un specifikācijas.
    expect(html).not.toContain("Zādzību ieraksti");
    expect(html).not.toContain("Vehicle Specifications");
    // Avota īstais nosaukums nekur nav redzams.
    expect(html.toLowerCase()).not.toContain("checkcar");
    expect(html.toLowerCase()).not.toContain("cc.vin");
  });

  it("tukšs bloks nedod sadaļas saturu", () => {
    expect(buildCcVinPdfInnerHtml(emptyCcVinBlock())).toBe("");
    expect(buildCcVinPdfInnerHtml(null)).toBe("");
  });

  it("odometra ieraksti nonāk vienotajā nobraukuma tabulā ar savu avota nosaukumu", () => {
    const rows = collectUnifiedMileageRows({ ccVinBlock: blockFromReport() });
    expect(rows.map((r) => r.odometer)).toEqual(["49890", "16"]);
    expect(new Set(rows.map((r) => r.sourceLabel))).toEqual(new Set(["Starptautiskā vēsture"]));
  });

  it("bojājumi bez summas nerada rindas vienotajā negadījumu tabulā", () => {
    const rows = collectUnifiedIncidentRows({ ccVinBlock: blockFromReport() });
    expect(rows).toHaveLength(0);
  });

  it("bojājums ar summu nonāk vienotajā negadījumu tabulā", () => {
    const b = blockFromReport();
    b.damages = [{ date: "11.08.2020", region: "ASV", amount: "4 200 €", description: "Priekšpuses bojājums" }];
    const rows = collectUnifiedIncidentRows({ ccVinBlock: b });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.sourceLabel).toBe("Starptautiskā vēsture");
  });
});
