import { describe, expect, it } from "vitest";
import { buildReportReadySubject } from "@/lib/email/report-ready-copy";
import { resolveMessageSync, validateMessageOverride } from "@/lib/messages/resolve-message";
import {
  renderTemplateSubject,
  normalizeVinParenthesesInSubject,
  stripEmptySubjectParentheses,
} from "@/lib/messages/render-template";
import { buildReportReadyEmailVars } from "@/lib/messages/template-vars";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

const DEALER_VIN = "WDC1660571A448921";
const STALE_DEALER_SUBJECT = "PROVIN servisa vēstures atskaite ({{vin}})";

function dealerOverrideDoc(subject: string): MessageTemplatesDoc {
  return {
    version: 1,
    overrides: {
      "email.report_ready.dealer": {
        subject,
        body: "Labdien!\n\nJūsu pasūtītie oficiālā dīlera dati ir gatavi.\n\n{{paraksts}}",
        updatedAt: "2026-10-14T00:00:00.000Z",
        updatedBy: "test",
      },
    },
  };
}

describe("report-ready VIN subject", () => {
  it("injects a valid VIN into report-ready email vars", () => {
    expect(
      buildReportReadyEmailVars({
        kind: "dealer",
        vin: DEALER_VIN,
        attachmentLines: ["OFICIALA_DILERA_DATI_WDC1660571A448921.pdf"],
      }).vin,
    ).toBe(DEALER_VIN);
  });

  it("leaves vin empty when the value is missing or invalid", () => {
    expect(buildReportReadyEmailVars({ kind: "dealer", vin: "", attachmentLines: [] }).vin).toBe("");
    expect(buildReportReadyEmailVars({ kind: "mini", vin: "ABC", attachmentLines: [] }).vin).toBe("");
  });

  it("renders a stale Blob dealer subject with VIN in parentheses", () => {
    const vars = buildReportReadyEmailVars({
      kind: "dealer",
      vin: DEALER_VIN,
      attachmentLines: ["OFICIALA_DILERA_DATI_WDC1660571A448921.pdf"],
    });
    const msg = resolveMessageSync("email.report_ready.dealer", vars, {
      doc: dealerOverrideDoc(STALE_DEALER_SUBJECT),
    });
    expect(msg?.subject).toBe(`PROVIN servisa vēstures atskaite (${DEALER_VIN})`);
    expect(msg?.subject).not.toContain("()");
  });

  it("omits empty parentheses from a stale Blob dealer subject when VIN is missing", () => {
    const vars = buildReportReadyEmailVars({
      kind: "dealer",
      vin: "",
      attachmentLines: [],
    });
    const msg = resolveMessageSync("email.report_ready.dealer", vars, {
      doc: dealerOverrideDoc(STALE_DEALER_SUBJECT),
    });
    expect(msg?.subject).toBe("PROVIN servisa vēstures atskaite");
    expect(msg?.subject).not.toContain("()");
  });

  it("keeps default dealer / mini / audits subjects aligned with the fallback builder", () => {
    const vin = "WAUZZZF44LA062962";
    for (const kind of ["dealer", "mini", "audits"] as const) {
      const vars = buildReportReadyEmailVars({ kind, vin, attachmentLines: [] });
      expect(resolveMessageSync(`email.report_ready.${kind}`, vars)?.subject).toBe(
        buildReportReadySubject(kind, vin),
      );
    }
  });

  it("allows {{vin}} in report-ready subject overrides", () => {
    const result = validateMessageOverride("email.report_ready.dealer", {
      subject: STALE_DEALER_SUBJECT,
      body: "Labdien!\n\nJūsu pasūtītie oficiālā dīlera dati ir gatavi.\n\n{{paraksts}}",
    });
    expect(result).toEqual({ ok: true });
  });
});

describe("renderTemplateSubject VIN parentheses", () => {
  it("rewrites Tema ({{vin}}) to a conditional block", () => {
    expect(normalizeVinParenthesesInSubject(STALE_DEALER_SUBJECT)).toBe(
      "PROVIN servisa vēstures atskaite{{#vin}} ({{vin}}){{/vin}}",
    );
  });

  it("strips leftover empty parentheses", () => {
    expect(stripEmptySubjectParentheses("PROVIN servisa vēstures atskaite ()")).toBe(
      "PROVIN servisa vēstures atskaite",
    );
    expect(stripEmptySubjectParentheses("PROVIN AUDITS atskaite ir gatava ( )")).toBe(
      "PROVIN AUDITS atskaite ir gatava",
    );
  });

  it("renders VIN or drops empty parentheses", () => {
    expect(renderTemplateSubject(STALE_DEALER_SUBJECT, { vin: DEALER_VIN })).toBe(
      `PROVIN servisa vēstures atskaite (${DEALER_VIN})`,
    );
    expect(renderTemplateSubject(STALE_DEALER_SUBJECT, { vin: "" })).toBe(
      "PROVIN servisa vēstures atskaite",
    );
    expect(renderTemplateSubject(STALE_DEALER_SUBJECT, {})).toBe("PROVIN servisa vēstures atskaite");
  });
});
