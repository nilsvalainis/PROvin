import { describe, expect, it } from "vitest";

import { LTAB_COMMENT_NO_OCTA_CLAIM } from "@/lib/admin-ltab-comment-presets";
import { createDefaultSourceBlocks, ltabNotPossibleNoLvPlate, toPdfLtabManualBlock } from "@/lib/admin-source-blocks";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { ltabAutoCanApply, ltabBlockHasOnlyNoClaimTemplate, ltabNoClaimsConfirmed } from "@/lib/ltab-auto-logic";
import {
  buildLtabNoClaimsCertificate,
  emptyLtabCertificate,
  ltabCertificateIsNoClaims,
  LTAB_NO_CLAIMS_STATUS_LV,
  LTAB_NOT_POSSIBLE_NO_LV_PLATE_LV,
  type LtabCertificate,
} from "@/lib/ltab-report-extract";
import { buildPdfReportSummaryTiles } from "@/lib/pdf-report-summary";
import { mergePdfVisibility } from "@/lib/pdf-visibility";

/** Izdomāti dati (nav īsti auto / numuri). */
const NO_CLAIMS: LtabCertificate = {
  ...emptyLtabCertificate(),
  issuedAt: "25.11.2026 11:29:16",
  makeModel: "TESTA AUTO X1",
  year: "2015",
  plate: "AB1234",
  vehicleLine: "Transportlīdzeklis TESTA AUTO X1, izlaiduma gads 2015. Valsts numura zīme AB1234.",
  accidentCount: "0",
  insuredFrom: "01.03.2016",
  insuredTo: "25.11.2026",
  insuredDays: "3920",
  footerNote: "Izziņa ir sagatavota automātiski no OCTA informācijas sistēmas.",
};

const WITH_CLAIMS: LtabCertificate = {
  ...NO_CLAIMS,
  accidentCount: "1",
  claims: [{ date: "12.03.2021", time: "10:15", status: "Cietušais", amount: "1200.00" }],
};

function html(manualLtabBlock: ClientReportPayload["manualLtabBlock"]): string {
  return buildClientReportDocumentHtml({
    payload: {
      sessionId: "cs_test_ltab",
      vin: "WAUZZZ4G5GN000001",
      created: Date.now(),
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
      manualLtabBlock,
      pdfVisibility: mergePdfVisibility({ ltab: true, unifiedIncidents: false }),
    } as ClientReportPayload,
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    formatBytes: () => "0 B",
  });
}

describe("LTAB bez negadījumiem: izziņa", () => {
  it("recognises a zero-claims certificate", () => {
    expect(ltabCertificateIsNoClaims(NO_CLAIMS)).toBe(true);
    expect(ltabCertificateIsNoClaims(WITH_CLAIMS)).toBe(false);
    expect(ltabCertificateIsNoClaims({ ...NO_CLAIMS, accidentCount: "" })).toBe(false);
  });

  it("fallback certificate keeps only what LTAB confirmed (plate, Riga time, 0)", () => {
    const c = buildLtabNoClaimsCertificate("ab1234", "2026-11-25T09:29:16.000Z");
    expect(c).toMatchObject({ plate: "AB1234", accidentCount: "0", issuedAt: "25.11.2026 11:29:16", makeModel: "", year: "" });
    expect(ltabCertificateIsNoClaims(c)).toBe(true);
  });
});

describe("LTAB bez negadījumiem: klienta PDF", () => {
  it("no claims with policy period: neutral status + period, no red loss table", () => {
    const out = html({ rows: [], comments: "", certificate: NO_CLAIMS });
    expect(out).toContain(LTAB_NO_CLAIMS_STATUS_LV);
    expect(out).toContain("pdf-ltab-izzi-status");
    expect(out).toContain("Laikā no 01.03.2016 līdz 25.11.2026");
    expect(out).toContain("3920 dienas");
    expect(out).toContain("Transportlīdzekļa zaudējumu dati uz 25.11.2026 11:29:16");
    expect(out).not.toContain('class="pdf-listing-price-history pdf-ltab-loss-history"');
  });

  it("with claims: loss table, no «nav reģistrēti» status", () => {
    const out = html({ rows: [], comments: "", certificate: WITH_CLAIMS });
    expect(out).toContain('class="pdf-listing-price-history pdf-ltab-loss-history"');
    expect(out).not.toContain(LTAB_NO_CLAIMS_STATUS_LV);
  });

  it("no LV plate: block says LTAB check is not possible (grey), not empty", () => {
    const blocks = createDefaultSourceBlocks();
    const foreign = { ...blocks.csdd, vin: "WAUZZZ4G5GN000001", registrationNumber: "", registrationStatus: "" };
    expect(ltabNotPossibleNoLvPlate(foreign)).toBe(true);
    const b = toPdfLtabManualBlock(blocks.ltab, { csdd: foreign });
    expect(b?.statusNote).toBe(LTAB_NOT_POSSIBLE_NO_LV_PLATE_LV);
    const out = html(b);
    expect(out).toContain(LTAB_NOT_POSSIBLE_NO_LV_PLATE_LV);
    expect(out).toContain("pdf-ltab-izzi--muted");
  });

  it("no CSDD data yet or a valid LV plate: no «not possible» note", () => {
    const blocks = createDefaultSourceBlocks();
    expect(ltabNotPossibleNoLvPlate(blocks.csdd)).toBe(false);
    expect(toPdfLtabManualBlock(blocks.ltab, { csdd: blocks.csdd })).toBeNull();
    const lv = { ...blocks.csdd, vin: "WAUZZZ4G5GN000001", registrationNumber: "AB1234", registrationStatus: "Reģistrēts" };
    expect(ltabNotPossibleNoLvPlate(lv)).toBe(false);
    expect(toPdfLtabManualBlock(blocks.ltab)).toBeNull();
  });
});

describe("LTAB bez negadījumiem: ievietošana un kopsavilkums", () => {
  const empty = createDefaultSourceBlocks().ltab;
  const templateOnly = { ...empty, comments: `<p>${LTAB_COMMENT_NO_OCTA_CLAIM}&nbsp;</p>` };

  it("a block with only the old auto template can be filled with the certificate", () => {
    expect(ltabBlockHasOnlyNoClaimTemplate(templateOnly)).toBe(true);
    expect(ltabBlockHasOnlyNoClaimTemplate({ ...templateOnly, comments: "Nils rakstīja pats" })).toBe(false);
    const status = { state: "no_claims" as const, updatedAt: "2026-11-25T09:30:00.000Z", certificate: NO_CLAIMS };
    expect(ltabAutoCanApply(status, templateOnly)).toBe(true);
    expect(ltabAutoCanApply(status, { ...templateOnly, comments: "Nils rakstīja pats" })).toBe(false);
    expect(ltabAutoCanApply({ ...status, certificate: undefined }, templateOnly)).toBe(false);
    expect(ltabAutoCanApply({ ...status, mismatch: "cits auto" }, empty)).toBe(false);
  });

  it("«LTAB: nav negadījumu» is a confirmed fact (certificate or template), not with claims", () => {
    expect(ltabNoClaimsConfirmed({ rows: [], comments: "", certificate: NO_CLAIMS })).toBe(true);
    expect(ltabNoClaimsConfirmed(templateOnly)).toBe(true);
    expect(ltabNoClaimsConfirmed({ rows: [], comments: "", certificate: WITH_CLAIMS })).toBe(false);
    expect(ltabNoClaimsConfirmed(empty)).toBe(false);
  });

  it("summary card «Negadījumi un bojājumi» names LTAB as a positive check", () => {
    const tiles = buildPdfReportSummaryTiles({ manualLtabBlock: { rows: [], comments: "", certificate: NO_CLAIMS } });
    const t = tiles.find((x) => x.id === "incidents");
    expect(t?.tone).toBe("ok");
    expect(t?.note).toContain("LTAB: negadījumi nav reģistrēti");
    const none = buildPdfReportSummaryTiles({ manualLtabBlock: null }).find((x) => x.id === "incidents");
    expect(none?.note).not.toContain("LTAB");
  });
});
