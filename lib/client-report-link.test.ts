import { describe, expect, it } from "vitest";
import {
  activeClientReportLink,
  appendClientReportLink,
  CLIENT_REPORT_LINK_HEADERS,
  clientReportLinkAbsoluteUrl,
  clientReportLinkPdfPath,
  clientReportLinkRewritePath,
  clientReportLinkState,
  clientReportLinkTtlDays,
  clientReportPdfBlobPath,
  isClientReportLinkPath,
  isClientReportLinkToken,
  isSafeClientReportArchiveBlobPath,
  parseClientReportLinkDoc,
  revokeActiveLinks,
  safeClientReportPdfFilename,
  type ClientReportLinkRecord,
} from "@/lib/client-report-link";
import { isPublicSiteAnalyticsPath } from "@/lib/analytics-public-scope";
import robots from "@/app/robots";

const TOKEN = "A".repeat(20) + "b_-" + "9".repeat(20); // 43 zīmes
const H1 = "a".repeat(64);
const H2 = "b".repeat(64);
const NOW = Date.parse("2026-11-22T10:00:00Z");

function rec(hash: string, over: Partial<ClientReportLinkRecord> = {}): ClientReportLinkRecord {
  return {
    tokenHash: hash,
    createdAt: new Date(NOW - 1000).toISOString(),
    expiresAt: new Date(NOW + 30 * 86400_000).toISOString(),
    locale: "lv",
    ...over,
  };
}

describe("klienta atskaites saite: tokens un ceļi", () => {
  it("tokena formāts: tieši 43 base64url zīmes (256 biti)", () => {
    expect(TOKEN).toHaveLength(43);
    expect(isClientReportLinkToken(TOKEN)).toBe(true);
    expect(isClientReportLinkToken(TOKEN.slice(1))).toBe(false);
    expect(isClientReportLinkToken(`${TOKEN.slice(1)}/`)).toBe(false);
    expect(isClientReportLinkToken(`${TOKEN.slice(1)}.`)).toBe(false);
    expect(isClientReportLinkToken("../" + TOKEN.slice(3))).toBe(false);
  });

  it("derīgums: noklusējums 30 dienas, konfigurējams 1-365", () => {
    expect(clientReportLinkTtlDays({})).toBe(30);
    expect(clientReportLinkTtlDays({ CLIENT_REPORT_LINK_TTL_DAYS: "7" })).toBe(7);
    expect(clientReportLinkTtlDays({ CLIENT_REPORT_LINK_TTL_DAYS: "0" })).toBe(30);
    expect(clientReportLinkTtlDays({ CLIENT_REPORT_LINK_TTL_DAYS: "abc" })).toBe(30);
    expect(clientReportLinkTtlDays({ CLIENT_REPORT_LINK_TTL_DAYS: "9999" })).toBe(30);
  });

  it("publiskā saite un PDF ceļš", () => {
    expect(clientReportLinkAbsoluteUrl("https://www.provin.lv/", "lv", TOKEN)).toBe(`https://www.provin.lv/lv/atskaite/${TOKEN}`);
    expect(clientReportLinkPdfPath(TOKEN)).toBe(`/api/atskaite/${TOKEN}`);
    expect(clientReportLinkPdfPath(TOKEN, true)).toBe(`/api/atskaite/${TOKEN}?dl=1`);
  });

  it("middleware pārraksta /{locale}/atskaite/<token> uz iekšējo maršrutu; nederīgs tokens → neitrāls", () => {
    expect(clientReportLinkRewritePath(`/lv/atskaite/${TOKEN}`)).toBe(`/klienta-atskaite/lv/${TOKEN}`);
    expect(clientReportLinkRewritePath(`/en/atskaite/${TOKEN}/`)).toBe(`/klienta-atskaite/en/${TOKEN}`);
    expect(clientReportLinkRewritePath(`/ru/atskaite/${TOKEN}`)).toBe(`/klienta-atskaite/ru/${TOKEN}`);
    expect(clientReportLinkRewritePath("/lv/atskaite/..%2F..%2Fetc")).toBe("/klienta-atskaite/lv/x");
    expect(clientReportLinkRewritePath("/lv/atskaite")).toBe("/klienta-atskaite/lv/x");
    expect(clientReportLinkRewritePath(`/lv/atskaite/${TOKEN}/extra`)).toBeNull();
    expect(clientReportLinkRewritePath(`/fr/atskaite/${TOKEN}`)).toBeNull();
    expect(clientReportLinkRewritePath("/lv/pakalpojumi")).toBeNull();
  });

  it("analītika izslēgta saites lapām un PDF (tokens URL nenonāk GA)", () => {
    expect(isClientReportLinkPath(`/lv/atskaite/${TOKEN}`)).toBe(true);
    expect(isClientReportLinkPath(`/klienta-atskaite/lv/${TOKEN}`)).toBe(true);
    expect(isClientReportLinkPath(`/api/atskaite/${TOKEN}`)).toBe(true);
    expect(isPublicSiteAnalyticsPath(`/lv/atskaite/${TOKEN}`)).toBe(false);
    expect(isPublicSiteAnalyticsPath(`/de/atskaite/${TOKEN}`)).toBe(false);
    expect(isPublicSiteAnalyticsPath("/lv/pakalpojumi")).toBe(true);
  });

  it("noindex galvenes, bez kešošanas, bez referrer; robots.txt izslēdz /*/atskaite/", () => {
    expect(CLIENT_REPORT_LINK_HEADERS["X-Robots-Tag"]).toContain("noindex");
    expect(CLIENT_REPORT_LINK_HEADERS["X-Robots-Tag"]).toContain("nofollow");
    expect(CLIENT_REPORT_LINK_HEADERS["Cache-Control"]).toContain("private");
    expect(CLIENT_REPORT_LINK_HEADERS["Cache-Control"]).toContain("no-store");
    expect(CLIENT_REPORT_LINK_HEADERS["Referrer-Policy"]).toBe("no-referrer");
    const disallow = robots().rules;
    const list = (Array.isArray(disallow) ? disallow : [disallow]).flatMap((r) =>
      Array.isArray(r.disallow) ? r.disallow : [r.disallow ?? ""],
    );
    expect(list).toContain("/*/atskaite/");
    expect(list).toContain("/api/atskaite/");
  });
});

describe("klienta atskaites saite: derīgums un atsaukšana", () => {
  it("aktīva / beigusies / atsaukta", () => {
    expect(clientReportLinkState(rec(H1), NOW)).toBe("active");
    expect(clientReportLinkState(rec(H1, { expiresAt: new Date(NOW - 1).toISOString() }), NOW)).toBe("expired");
    expect(clientReportLinkState(rec(H1, { expiresAt: "nav-datums" }), NOW)).toBe("expired");
    expect(clientReportLinkState(rec(H1, { revokedAt: new Date(NOW).toISOString() }), NOW)).toBe("revoked");
  });

  it("jauna saite atsauc veco - vienlaikus aktīva tikai viena", () => {
    const d1 = appendClientReportLink({ sessionId: "cs_1", links: [] }, rec(H1), NOW);
    const d2 = appendClientReportLink(d1, rec(H2), NOW + 1000);
    expect(d2.links).toHaveLength(2);
    expect(d2.links[0]!.revokedAt).toBeTruthy();
    expect(activeClientReportLink(d2, NOW + 2000)?.tokenHash).toBe(H2);
  });

  it("atsaukšana", () => {
    const d = revokeActiveLinks({ sessionId: "cs_1", links: [rec(H1)] }, NOW);
    expect(activeClientReportLink(d, NOW)).toBeNull();
  });

  it("parsētājs atmet svešu sessionId un bojātus ierakstus", () => {
    const raw = { sessionId: "cs_1", links: [rec(H1), { tokenHash: "zz", createdAt: "x", expiresAt: "y" }] };
    expect(parseClientReportLinkDoc(raw, "cs_1").links).toHaveLength(1);
    expect(parseClientReportLinkDoc(raw, "cs_2").links).toHaveLength(0);
    expect(parseClientReportLinkDoc(null, "cs_1").links).toHaveLength(0);
  });
});

describe("klienta atskaites saite: PDF ceļa aizsardzība", () => {
  it("vienīgais galvenais ceļš no sessionId", () => {
    expect(clientReportPdfBlobPath("provin/", "cs_1")).toBe("provin/client-reports/cs_1.pdf");
    expect(clientReportPdfBlobPath("provin", "cs_1")).toBe("provin/client-reports/cs_1.pdf");
  });

  it("arhīva ceļš tikai šī pasūtījuma mapē", () => {
    const ok = "provin/client-reports/cs_1/v2-PROVIN_AUDITS_WBA.pdf";
    expect(isSafeClientReportArchiveBlobPath(ok, "provin/", "cs_1")).toBe(true);
    expect(isSafeClientReportArchiveBlobPath(ok, "provin/", "cs_2")).toBe(false);
    expect(isSafeClientReportArchiveBlobPath("provin/client-reports/cs_1/../cs_2/v1-a.pdf", "provin/", "cs_1")).toBe(false);
    expect(isSafeClientReportArchiveBlobPath("provin/invoices/cs_1/v1-a.pdf", "provin/", "cs_1")).toBe(false);
    expect(isSafeClientReportArchiveBlobPath("provin/client-reports/cs_1/v1-a.json", "provin/", "cs_1")).toBe(false);
    expect(isSafeClientReportArchiveBlobPath("other/client-reports/cs_1/v1-a.pdf", "provin/", "cs_1")).toBe(false);
  });

  it("drošs faila nosaukums (Content-Disposition)", () => {
    expect(safeClientReportPdfFilename("v3-PROVIN_AUDITS_WBA.pdf")).toBe("PROVIN_AUDITS_WBA.pdf");
    expect(safeClientReportPdfFilename('a"b\r\nc.pdf')).toBe("a_b_c.pdf");
    expect(safeClientReportPdfFilename("")).toBe("PROVIN_atskaite.pdf");
    expect(safeClientReportPdfFilename("atskaite")).toBe("atskaite.pdf");
  });
});
