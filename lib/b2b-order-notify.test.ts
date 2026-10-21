import { describe, expect, it } from "vitest";
import {
  b2bCreditOrderEmailSubject,
  b2bCreditOrderLines,
  b2bCreditOrderPushMessage,
  b2bServiceLabel,
} from "@/lib/b2b-order-notify-shared";

const base = { partnerId: "p1", companyName: "Auto SIA", contactName: "Jānis", serviceLabel: b2bServiceLabel("dealer_raw") };

describe("B2B pasūtījums no konta: paziņojums", () => {
  it("viens VIN: atver pasūtījumu, bez klienta kontaktiem", () => {
    const m = b2bCreditOrderPushMessage({ ...base, orders: [{ orderId: "man_1", vin: "WBA3A5C50CF256551" }] });
    expect(m.title).toBe("Jauns B2B pasūtījums · Auto SIA");
    expect(m.body).toBe("Dīlera dati (RAW) · VIN …256551 · no konta");
    expect(m.url).toBe("/admin/orders/man_1");
    expect(m.audience).toBe("pro");
  });

  it("vairāki VIN: viens kopsavilkums, nevis 10 paziņojumi", () => {
    const n = { ...base, orders: [{ orderId: "a", vin: "V1" }, { orderId: "b", vin: "V2" }] };
    expect(b2bCreditOrderPushMessage(n).title).toBe("2 jauni B2B pasūtījumi · Auto SIA");
    expect(b2bCreditOrderPushMessage(n).url).toBe("/admin/dashboard");
    expect(b2bCreditOrderEmailSubject(n)).toBe("PROVIN B2B: Auto SIA · 2 pasūtījumi (no konta)");
    expect(b2bCreditOrderLines(n, "https://provin.lv")).toEqual([
      "V1 · https://provin.lv/admin/orders/a",
      "V2 · https://provin.lv/admin/orders/b",
    ]);
  });

  it("bez uzņēmuma nosaukuma izmanto kontaktpersonu", () => {
    expect(b2bCreditOrderPushMessage({ ...base, companyName: "", orders: [{ orderId: "x", vin: "V" }] }).title).toContain("Jānis");
  });
});
