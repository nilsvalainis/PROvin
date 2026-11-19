/**
 * Grandland W0VZCYHZXN6843259 - negadījuma summas un "Pilnīgs zaudējums" kļūda (18.10.2026).
 * Nav vidējo (3 950 / ~2 850), nav izdomātas 01. dienas, Izsoļu portālu arhīva šablons nav total loss.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyCsddFields, SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import {
  ccVinAuctionCheckCommentHtml,
  seedCcVinDefaultComment,
} from "@/lib/admin-cc-vin-comment-presets";
import { extractAutodnaReport } from "@/lib/autodna-report-extract";
import { extractCarverticalReport } from "@/lib/carvertical-report-extract";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import {
  buildClientReportDocumentHtml,
  buildUnifiedIncidentsTableHtml,
  type ClientReportPayload,
} from "@/lib/client-report-html";
import { buildPdfReportSummaryTiles } from "@/lib/pdf-report-summary";
import { checkPrePdfContradictions } from "@/lib/pre-pdf-contradiction-check";
import { detectTotalLossFromPdfInput } from "@/lib/total-loss-detect";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
import {
  aggregateUnifiedIncidents,
  collectUnifiedIncidentRows,
} from "@/lib/unified-incidents";

const FIXTURE_DIR = join(process.cwd(), "lib/__fixtures__/grandland-W0VZCYHZXN6843259");
const AUTODNA_TEXT = readFileSync(join(FIXTURE_DIR, "autodna.txt"), "utf8");
const CARVERTICAL_TEXT = readFileSync(join(FIXTURE_DIR, "carvertical.txt"), "utf8");

const BANNED = ["~", "3 950", "3950", "2 850", "2850", "Pilnīgs zaudējums"];

function grandlandVendorBlocks() {
  const autodna = extractAutodnaReport(AUTODNA_TEXT);
  const carvertical = extractCarverticalReport(CARVERTICAL_TEXT);
  return [
    {
      title: SOURCE_BLOCK_LABELS.autodna,
      mileageRows: autodna.mileage,
      incidentRows: autodna.incidents,
      comments: "",
    },
    {
      title: SOURCE_BLOCK_LABELS.carvertical,
      mileageRows: carvertical.mileage,
      incidentRows: carvertical.incidents,
      comments: "",
      vehicleHistoryTimeline: carvertical.vehicleHistoryTimeline ?? [],
    },
  ];
}

function grandlandPayload(overrides: Partial<ClientReportPayload> = {}): ClientReportPayload {
  return {
    sessionId: "cs_grandland",
    isDemo: false,
    vin: "W0VZCYHZXN6843259",
    created: Date.parse("2026-10-18T12:00:00+03:00") / 1000,
    amountTotal: 7999,
    currency: "eur",
    paymentStatus: "paid",
    listingUrl: null,
    customerEmail: null,
    customerPhone: null,
    customerName: null,
    contactMethod: null,
    notes: null,
    csdd: "",
    ltab: "",
    tirgus: "",
    citi: "",
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    manualVendorBlocks: grandlandVendorBlocks(),
    ccVinBlock: seedCcVinDefaultComment(emptyCcVinBlock()),
    ...overrides,
  } as ClientReportPayload;
}

describe("Grandland W0VZCYHZXN6843259 incident amounts and total loss", () => {
  it("extractAutodnaReport keeps two July 2026 Germany ranges", () => {
    const extract = extractAutodnaReport(AUTODNA_TEXT);
    expect(extract.incidents).toHaveLength(2);
    expect(extract.incidents.map((r) => r.csngDate)).toEqual(["07.2026", "07.2026"]);
    expect(extract.incidents.map((r) => r.incidentNo)).toEqual(["Vācija", "Vācija"]);
    expect(extract.incidents.map((r) => r.lossAmount)).toEqual(["1 600 - 1 700 €", "6 000 - 6 500 €"]);
  });

  it("extractCarverticalReport keeps one July 2026 1 501 - 2 000 € row", () => {
    const extract = extractCarverticalReport(CARVERTICAL_TEXT);
    expect(extract.incidents).toHaveLength(1);
    expect(extract.incidents[0]?.csngDate).toBe("07.2026");
    expect(extract.incidents[0]?.lossAmount).toBe("1 501 - 2 000 €");
    expect(extract.incidents[0]?.incidentNo).toMatch(/Vācij/i);
  });

  it("aggregateUnifiedIncidents does not average; AutoDNA two July rows are two incidents (19.11 rule)", () => {
    const rows = collectUnifiedIncidentRows({
      manualVendorBlocks: grandlandVendorBlocks(),
    });
    const agg = aggregateUnifiedIncidents(rows);
    // AutoDNA 1 600 - 1 700 € un CarVertical 1 501 - 2 000 € ir viens notikums (summas pārklājas),
    // AutoDNA 6 000 - 6 500 € ir otrs negadījums tajā pašā mēnesī.
    expect(agg.uniqueCount).toBe(2);
    expect(agg.clusters).toHaveLength(2);
    for (const c of agg.clusters) {
      expect(c.averaged).toBe(false);
      expect(c.averageEur).toBeNull();
      expect(c.date).toBe("07.2026");
      expect(c.kindLabel).toBe("Bojājumu ieraksts");
    }
    const small = agg.clusters.find((c) => c.displayAmount === "1 501 - 2 000 €");
    const big = agg.clusters.find((c) => c.displayAmount === "6 000 - 6 500 €");
    expect(small).toBeDefined();
    expect(big).toBeDefined();
    expect(small?.sourceValuations.map((s) => [s.sourceLabel, s.displayAmount])).toEqual(
      expect.arrayContaining([
        [SOURCE_BLOCK_LABELS.autodna, "1 600 - 1 700 €"],
        [SOURCE_BLOCK_LABELS.carvertical, "1 501 - 2 000 €"],
      ]),
    );
    expect(big?.sourceValuations.map((s) => [s.sourceLabel, s.displayAmount])).toEqual([
      [SOURCE_BLOCK_LABELS.autodna, "6 000 - 6 500 €"],
    ]);
    const blob = JSON.stringify(agg.clusters);
    expect(blob).not.toMatch(/3\s*950/);
    expect(blob).not.toMatch(/2\s*850/);
  });

  it("rendered incidents section and timeline omit ~, 3 950, 2 850 and Pilnīgs zaudējums", () => {
    const payload = grandlandPayload();
    const vis = mergePdfVisibility({ unifiedIncidents: true, cc_vin: true });
    const incidentsHtml = buildUnifiedIncidentsTableHtml(payload, vis);
    const doc = buildClientReportDocumentHtml({
      payload,
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    for (const html of [incidentsHtml, doc]) {
      for (const needle of BANNED) {
        expect(html, needle).not.toContain(needle);
      }
    }
    expect(incidentsHtml).toContain("1 501 - 2 000 €");
    expect(incidentsHtml).toContain("6 000 - 6 500 €");
    expect(incidentsHtml).not.toContain("1 501 - 6 500 €");
    expect(incidentsHtml).toContain("Bojājumu ieraksts");
    expect(incidentsHtml).toContain("07.2026");
    expect(incidentsHtml).not.toContain("01.07.2026");
    expect(doc).toContain("Bojājumu ieraksts");
    expect(doc).toContain("07.2026");
    expect(doc).not.toContain("01.07.2026");
  });

  it("detectTotalLossFromPdfInput ignores presets, negation and explanations", () => {
    expect(
      detectTotalLossFromPdfInput({
        ccVinBlock: { comments: ccVinAuctionCheckCommentHtml() },
      }).found,
    ).toBe(false);
    expect(detectTotalLossFromPdfInput({ manualVendorBlocks: [{ comments: "Nav pilnīgu zaudējumu" }] }).found).toBe(
      false,
    );
    expect(
      detectTotalLossFromPdfInput({
        manualVendorBlocks: [{ comments: "Kopējie zaudējumi Ieraksti netika atrasti" }],
      }).found,
    ).toBe(false);
    expect(
      detectTotalLossFromPdfInput({
        manualVendorBlocks: [
          {
            comments:
              "Kad remonta izmaksas tuvojas vai pārsniedz lielu daļu no transportlīdzekļa vērtības, tas var norādīt uz potenciālu pilnīgu zaudējumu.",
          },
        ],
      }).found,
    ).toBe(false);
    // Komentāri (operatora / AI) kartīti vairs neieslēdz; tikai strukturētie lauki.
    expect(
      detectTotalLossFromPdfInput({
        manualVendorBlocks: [{ comments: "Ziņots par pilnīgu zaudējumu" }],
      }).found,
    ).toBe(false);
    expect(
      detectTotalLossFromPdfInput({
        manualVendorBlocks: [
          { vehicleHistoryTimeline: [{ date: "2019", description: "Ziņots par pilnīgu zaudējumu" }] },
        ],
      }).found,
    ).toBe(true);
    expect(
      detectTotalLossFromPdfInput({
        ccVinBlock: { titles: [{ date: "2018", note: "Record of totaled vehicle, salvage title", region: "US" }] },
      }).found,
    ).toBe(true);
    expect(
      detectTotalLossFromPdfInput({
        ccVinBlock: { brands: [{ date: "2018", label: "Apdrošināšanas total loss", detail: "" }] },
      }).found,
    ).toBe(true);
  });

  it("buildPdfReportSummaryTiles shows 2 incidents without Pilnīgs zaudējums", () => {
    const thisCase = buildPdfReportSummaryTiles({
      csddForm: emptyCsddFields(),
      manualVendorBlocks: grandlandVendorBlocks(),
      ccVinBlock: seedCcVinDefaultComment(emptyCcVinBlock()),
    });
    const incidents = thisCase.find((t) => t.id === "incidents");
    expect(incidents?.value).toBe("2 bojājumu ieraksti");
    expect(incidents?.note).not.toMatch(/Pilnīgs zaudējums/i);
    // 19.11: divi atsevišķi negadījumi -> „alert” (count > 1), nevis pilnīga zaudējuma dēļ.
    expect(incidents?.tone).toBe("alert");

    const empty = buildPdfReportSummaryTiles({
      csddForm: emptyCsddFields(),
      ccVinBlock: seedCcVinDefaultComment(emptyCcVinBlock()),
    });
    const emptyIncidents = empty.find((t) => t.id === "incidents");
    expect(emptyIncidents?.value).toBe("Nav ierakstu");
    expect(emptyIncidents?.tone).toBe("ok");
    expect(emptyIncidents?.note).not.toMatch(/Pilnīgs zaudējums/i);
  });

  it("pre-pdf contradiction check does not raise c8_total_loss for this case", () => {
    const flags = checkPrePdfContradictions({
      summaryInput: {
        csddForm: emptyCsddFields(),
        manualVendorBlocks: grandlandVendorBlocks(),
        ccVinBlock: seedCcVinDefaultComment(emptyCcVinBlock()),
      },
    });
    expect(flags.some((f) => f.id === "c8_total_loss")).toBe(false);
    expect(flags.some((f) => f.id === "c8_total_loss_comment")).toBe(false);
  });
});
