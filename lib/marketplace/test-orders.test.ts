import { describe, expect, it } from "vitest";
import { marketplaceOrderIsTest } from "@/lib/marketplace/test-orders";

describe("Nils 31.10: mobile.de tikai klientu pasūtījumiem", () => {
  it("testa / demo pasūtījumi tiek atpazīti", () => {
    expect(marketplaceOrderIsTest({ brandModel: "Toyota RAV4", clientFirstName: "FABLEDEMO" })).toBe(true);
    expect(marketplaceOrderIsTest({ brandModel: "FABLE v3 Skoda Octavia", clientFirstName: "FABLE v3 DEMO nav klients" })).toBe(true);
    expect(marketplaceOrderIsTest({ brandModel: "TESTS Škoda Octavia", clientFirstName: "TESTS Gustavs" })).toBe(true);
    expect(marketplaceOrderIsTest({ brandModel: "", clientFirstName: "FABLETESTF3" })).toBe(true);
  });

  it("īsti klienti netiek izslēgti", () => {
    expect(marketplaceOrderIsTest({ brandModel: "Volvo XC60", clientFirstName: "Ineta", clientLastName: "Bieza" })).toBe(false);
    expect(marketplaceOrderIsTest({ brandModel: "Hyundai IONIQ 28 kwh", clientFirstName: "Emīls", clientLastName: "Kivlenieks" })).toBe(false);
    expect(marketplaceOrderIsTest({ brandModel: "Audi A6 Avant Testarossa" })).toBe(false);
    expect(marketplaceOrderIsTest(null)).toBe(false);
  });
});
