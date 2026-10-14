import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyAutoRecordsBlock } from "@/lib/admin-source-blocks";

import {
  PDF_TIGHT_GAP_BLOCK,
  PDF_TIGHT_GAP_CSS_ROOT,
  PDF_TIGHT_RICH_BODY_RULES_CSS,
  PDF_TIGHT_SELECT_EXTRA_CSS,
} from "@/lib/pdf-tight-comment-spacing";
import { buildOemDealerDocumentHtml } from "@/lib/pdf-dealer-oem";
import { CC_VIN_PDF_CSS } from "@/lib/cc-vin-pdf-html";
import { getClientReportPrintCss } from "@/lib/client-report-html";

const ROOT = join(process.cwd());

describe("pdf-tight-comment-spacing", () => {
  it("exports 1em gap tokens", () => {
    expect(PDF_TIGHT_GAP_BLOCK).toBe("1em");
    expect(PDF_TIGHT_GAP_CSS_ROOT).toContain("--pdf-gap-block:1em");
  });

  it("client report print CSS uses tight gaps", () => {
    const css = getClientReportPrintCss();
    expect(css).toContain("--pdf-gap-section:1em");
    expect(css).toContain("--pdf-gap-block:1em");
    expect(css).toMatch(/br \+ strong[\s\S]*margin-top:0/);
    expect(css).toContain("line-height:1.45");
  });

  it("dealer OEM HTML embeds tight comment rules", () => {
    const block = emptyAutoRecordsBlock();
    block.oneautoIngest = {
      ...block.oneautoIngest,
      lastFetchedVin: "TESTVIN123",
      results: {
        oe_service_history: {
          ok: true,
          payload: {
            success: true,
            result: {
              service_events: [
                {
                  date_of_service_event: "2022-10-13",
                  mileage_observed: 128438,
                  service_actions: ["Engine oil change\nOil filter"],
                },
              ],
            },
          },
        },
      },
    };
    const html = buildOemDealerDocumentHtml({
      vin: "TESTVIN123",
      makeModel: "Test",
      autoRecords: block,
    });
    expect(html).toContain(".oem-extra{margin-top:0;");
    expect(PDF_TIGHT_RICH_BODY_RULES_CSS).toContain(".oem-work");
  });

  it("consultation and iriss sources use tight stack gaps", () => {
    expect(PDF_TIGHT_SELECT_EXTRA_CSS).toContain("gap:1em");
    const selectSrc = readFileSync(join(ROOT, "lib/select-consultation-report-html.ts"), "utf8");
    expect(selectSrc).toContain("PDF_TIGHT_SELECT_EXTRA_CSS");
    const iriss = readFileSync(join(ROOT, "lib/iriss-pasutijums-pdf-html.ts"), "utf8");
    expect(iriss).toContain("PDF_TIGHT_RICH_BODY_RULES_CSS");
    expect(CC_VIN_PDF_CSS).toContain("margin:0 0 1em");
  });
});
