import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_LOCALES } from "@/i18n/locales";
import {
  buildInvoiceUnauthorizedHtml,
  invoiceDownloadWantsHtml,
  invoiceUnauthorizedCopy,
  resolveInvoiceUnauthorizedLocale,
} from "@/lib/invoice-download-unauthorized";

describe("invoice download unauthorized page", () => {
  it("keeps copy in all public locales and shows the Latvian title", () => {
    expect(invoiceUnauthorizedCopy("lv").title).toBe("Rēķins ir pielikumā e-pastā");
    for (const locale of APP_LOCALES) {
      const copy = invoiceUnauthorizedCopy(locale);
      expect(copy.title.trim().length, locale).toBeGreaterThan(2);
      expect(copy.body.trim().length, locale).toBeGreaterThan(8);
      expect(copy.home.trim().length, locale).toBeGreaterThan(2);
      expect(copy.title).not.toMatch(/\u2014|\u2013/);
      expect(copy.body).not.toMatch(/\u2014|\u2013/);
    }
  });

  it("picks locale from cookie, then Accept-Language, then Latvian", () => {
    expect(resolveInvoiceUnauthorizedLocale({ cookieLocale: "de" })).toBe("de");
    expect(resolveInvoiceUnauthorizedLocale({ acceptLanguage: "en-GB,en;q=0.9" })).toBe("en");
    expect(resolveInvoiceUnauthorizedLocale({ acceptLanguage: "ru-RU,ru;q=0.8" })).toBe("ru");
    expect(resolveInvoiceUnauthorizedLocale({})).toBe("lv");
  });

  it("serves HTML to browsers and JSON to API clients", () => {
    expect(invoiceDownloadWantsHtml("text/html,application/xhtml+xml")).toBe(true);
    expect(invoiceDownloadWantsHtml("application/json")).toBe(false);
    expect(invoiceDownloadWantsHtml("*/*")).toBe(true);
    expect(invoiceDownloadWantsHtml(null)).toBe(true);
  });

  it("renders a 401 HTML page without session ids or secrets", () => {
    const html = buildInvoiceUnauthorizedHtml("lv");
    expect(html).toContain("Rēķins ir pielikumā e-pastā");
    expect(html).toContain('lang="lv"');
    expect(html).not.toContain("cs_");
    expect(html).not.toContain("session_id");
    expect(html).not.toContain("ADMIN_SECRET");
  });

  it("keeps the download route at 401 without loosening auth", () => {
    const src = readFileSync(join(process.cwd(), "app/api/invoice/download/route.ts"), "utf8");
    expect(src).toContain("authorizeInvoiceDownload");
    expect(src).toContain("buildInvoiceUnauthorizedHtml");
    expect(src).toContain("if (auth.status === 401 && invoiceDownloadWantsHtml");
    expect(src).toContain("status: 401");
  });
});
