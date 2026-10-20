import { describe, expect, it } from "vitest";
import { buildInvoiceHtml, toInvoiceOrderPayload } from "@/lib/generate-invoice-html";

describe("invoice HTML buyer requisites", () => {
  it("prints company requisites in the client block", () => {
    const html = buildInvoiceHtml(
      toInvoiceOrderPayload(
        {
          id: "cs_test_1",
          created: 1_700_000_000,
          amountTotal: 6999,
          currency: "EUR",
          customerEmail: "demo@provin.lv",
          customerDetailsEmail: "demo@provin.lv",
          vin: "WVWZZZ3CZWE123456",
          customerName: "Jānis Bērziņš",
          phone: "+371 20000000",
          companyName: "SIA Demo Auto",
          companyReg: "40103123456",
          companyAddress: "Brīvības iela 1, Rīga",
        },
        "PRV-2026-0001",
      ),
    );
    expect(html).toContain("PROVIN.LV");
    expect(html).toContain("SIA Demo Auto");
    expect(html).toContain("Reģ. nr.: 40103123456");
    expect(html).toContain("Brīvības iela 1, Rīga");
    expect(html).toContain("Jānis Bērziņš");
    expect(html).toContain("demo@provin.lv");
    expect(html).toContain("139.²");
    expect(html).toContain("netiek piemērots");
    expect(html).not.toContain("nav reģistrēta PVN");
    expect(html).not.toContain("—");
    expect(html).toContain("Starpsumma");
    expect(html).toContain(">Kopā<");
    expect(html).not.toContain("Sub Total");
    expect(html).not.toContain(">Total<");
    expect(html).toContain('lang="lv"');
    expect(html).toContain("charset=\"utf-8\"");
    expect(html).toContain("Rēķins");
    expect(html).toContain("ā");
  });

  it("escapes buyer fields so markup cannot execute", () => {
    const html = buildInvoiceHtml(
      toInvoiceOrderPayload(
        {
          id: "cs_test_xss",
          created: 1_700_000_000,
          amountTotal: 6999,
          currency: "EUR",
          customerEmail: `a@b.lv"><img src=x onerror=alert(1)>`,
          customerDetailsEmail: null,
          vin: `WVW"><script>alert(1)</script>`,
          customerName: `<img src=x onerror=alert(1)>`,
          phone: "+37120000000",
          companyName: `SIA "Demo" & <b>Co</b>`,
          companyReg: "40103123456",
          companyAddress: "Rīga",
        },
        "PRV-2026-0002",
      ),
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("onerror=alert");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;b&gt;Co&lt;/b&gt;");
    expect(html).toContain("&amp;");
  });
});

