import { describe, expect, it } from "vitest";
import { BLOCK_SIGN_OFF_ID } from "@/lib/messages/shared-blocks";
import { enrichVarsWithSharedBlocks } from "@/lib/messages/shared-block-vars";
import { previewMessage, resolveMessageSync } from "@/lib/messages/resolve-message";
import { buildReportReadyEmailVars } from "@/lib/messages/template-vars";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

describe("shared block propagation", () => {
  it("overrides paraksts in report-ready template even when template has its own override", () => {
    const doc: MessageTemplatesDoc = {
      version: 1,
      overrides: {
        [BLOCK_SIGN_OFF_ID]: {
          body: "Jauns paraksts no bloka\nPROVIN TEST",
          updatedAt: "2026-01-01T00:00:00.000Z",
          updatedBy: "test",
        },
        "email.report_ready.audits": {
          body: [
            "Labdien!",
            "",
            "Pielikums: {{pielikumi}}",
            "",
            "{{paraksts}}",
          ].join("\n"),
          updatedAt: "2026-01-01T00:00:00.000Z",
          updatedBy: "test",
        },
      },
    };
    const vars = buildReportReadyEmailVars({
      kind: "audits",
      vin: "",
      attachmentLines: [],
      includeGoogleReview: false,
    });
    const msg = resolveMessageSync("email.report_ready.audits", vars, { doc });
    expect(msg?.text).toContain("Jauns paraksts no bloka");
    expect(msg?.text).toContain("PROVIN TEST");
  });

  it("previewMessage uses doc overrides for shared blocks", () => {
    const doc: MessageTemplatesDoc = {
      version: 1,
      overrides: {
        [BLOCK_SIGN_OFF_ID]: {
          body: "Sveiciens,\nPROVIN",
          updatedAt: "2026-01-01T00:00:00.000Z",
          updatedBy: "test",
        },
      },
    };
    const enriched = enrichVarsWithSharedBlocks({ komentars: "x" }, doc);
    expect(enriched.paraksts).toBe("Sveiciens,\nPROVIN");
    const peek = previewMessage("email.listing_peek", { komentars: "Test" }, doc);
    expect(peek?.text).toContain("Sveiciens,\nPROVIN");
  });

  it("keeps google_atsauksme empty when caller explicitly disables it", () => {
    const doc: MessageTemplatesDoc = { version: 1, overrides: {} };
    const vars = enrichVarsWithSharedBlocks({ google_atsauksme: "" }, doc);
    expect(vars.google_atsauksme).toBe("");
  });
});
