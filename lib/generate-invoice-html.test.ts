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
    expect(html).toContain("SIA Demo Auto");
    expect(html).toContain("Reģ. nr.: 40103123456");
    expect(html).toContain("Brīvības iela 1, Rīga");
    expect(html).toContain("Jānis Bērziņš");
    expect(html).toContain("demo@provin.lv");
    expect(html).not.toContain("—");
  });
});
