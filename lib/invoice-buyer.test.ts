import { describe, expect, it } from "vitest";
import { invoiceBuyerLines, invoiceBuyerMetadata, normalizeInvoiceBuyer } from "@/lib/invoice-buyer";

describe("invoice buyer requisites", () => {
  it("prints company block for a B2B buyer", () => {
    const buyer = normalizeInvoiceBuyer({
      companyName: "SIA Demo Auto",
      companyReg: "40103123456",
      companyAddress: "Brīvības iela 1, Rīga",
      contactName: "Jānis Bērziņš",
      email: "demo@provin.lv",
      phone: "+371 20000000",
    });
    expect(invoiceBuyerLines(buyer)).toEqual([
      "SIA Demo Auto",
      "Reģ. nr.: 40103123456",
      "Brīvības iela 1, Rīga",
      "Jānis Bērziņš",
      "demo@provin.lv",
      "+371 20000000",
    ]);
  });

  it("prints personal details when there is no company", () => {
    const buyer = normalizeInvoiceBuyer({
      contactName: "Anna Kalniņa",
      email: "anna@example.com",
      phone: "+371 20000001",
    });
    expect(invoiceBuyerLines(buyer)).toEqual(["Anna Kalniņa", "anna@example.com", "+371 20000001"]);
  });

  it("puts company fields into Stripe metadata", () => {
    expect(
      invoiceBuyerMetadata({
        companyName: " SIA Demo Auto ",
        companyReg: "40103123456",
        companyAddress: "Brīvības iela 1, Rīga",
      }),
    ).toEqual({
      company_name: "SIA Demo Auto",
      company_reg: "40103123456",
      company_address: "Brīvības iela 1, Rīga",
    });
  });
});
