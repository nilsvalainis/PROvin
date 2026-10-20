import { describe, expect, it } from "vitest";
import {
  ADMIN_HTML_DOCUMENT_CSP,
  SITE_CSP_ENFORCED,
  SITE_CSP_REPORT_ONLY,
  adminHtmlDocumentHeaders,
  summarizeCspReport,
} from "@/lib/csp";

describe("CSP policies", () => {
  it("locks admin HTML documents: no scripts, fonts stay allowed", () => {
    expect(ADMIN_HTML_DOCUMENT_CSP).toContain("script-src 'none'");
    expect(ADMIN_HTML_DOCUMENT_CSP).toContain("https://fonts.googleapis.com");
    expect(ADMIN_HTML_DOCUMENT_CSP).toContain("https://fonts.gstatic.com");
    expect(ADMIN_HTML_DOCUMENT_CSP).not.toContain("unsafe-eval");
    const headers = adminHtmlDocumentHeaders({ "X-Robots-Tag": "noindex, nofollow" });
    expect(headers["Content-Security-Policy"]).toBe(ADMIN_HTML_DOCUMENT_CSP);
    expect(headers["Content-Type"]).toContain("text/html");
    expect(headers["X-Robots-Tag"]).toBe("noindex, nofollow");
  });

  it("Report-Only allows Stripe, GA, Meta pixel, TikTok, Vercel and Google Fonts", () => {
    const csp = SITE_CSP_REPORT_ONLY;
    expect(csp).toContain("https://js.stripe.com");
    expect(csp).toContain("https://checkout.stripe.com");
    expect(csp).toContain("https://www.googletagmanager.com");
    expect(csp).toContain("https://maps.googleapis.com");
    expect(csp).toContain("https://maps.gstatic.com");
    expect(csp).toContain("https://connect.facebook.net");
    expect(csp).toContain("https://va.vercel-scripts.com");
    expect(csp).toContain("https://vercel.live");
    expect(csp).toContain("https://fonts.googleapis.com");
    expect(csp).toContain("https://fonts.gstatic.com");
    expect(csp).toContain("report-uri /api/csp-report");
  });

  it("enforced site policy only restricts framing, base and plugins", () => {
    expect(SITE_CSP_ENFORCED).toBe("frame-ancestors 'self'; base-uri 'self'; object-src 'none'");
    expect(SITE_CSP_ENFORCED).not.toContain("script-src");
    expect(SITE_CSP_REPORT_ONLY).not.toContain("upgrade-insecure-requests");
  });

  it("summarizes CSP reports without path/query", () => {
    const summary = summarizeCspReport({
      "csp-report": {
        "violated-directive": "script-src",
        "blocked-uri": "https://evil.example/x.js?token=secret",
        "document-uri": "https://www.provin.lv/lv?sid=abc",
      },
    });
    expect(summary).toEqual({
      violatedDirective: "script-src",
      blockedUri: "evil.example",
      documentHost: "www.provin.lv",
    });
    expect(summarizeCspReport(null)).toBeNull();
  });
});
