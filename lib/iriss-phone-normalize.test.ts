import { describe, expect, it } from "vitest";
import { inspectIrissPhone, normalizePhoneForLv } from "@/lib/iriss-phone-normalize";

describe("inspectIrissPhone", () => {
  it("keeps an explicit international prefix", () => {
    expect(inspectIrissPhone("+491761234567").value).toBe("+491761234567");
    expect(inspectIrissPhone("+491761234567").warning).toBeNull();
    expect(inspectIrissPhone("+37120000000").value).toBe("+37120000000");
  });

  it("maps LV 8-digit mobiles and 371 prefixes", () => {
    expect(normalizePhoneForLv("20000000")).toBe("+37120000000");
    expect(inspectIrissPhone("20000000").appliedLvPrefix).toBe(true);
    expect(normalizePhoneForLv("37120000000")).toBe("+37120000000");
    expect(normalizePhoneForLv("0037120000000")).toBe("+37120000000");
  });

  it("does not force +371 on a foreign number without +", () => {
    const de = inspectIrissPhone("017612345678");
    expect(de.value).toBe("017612345678");
    expect(de.appliedLvPrefix).toBe(false);
    expect(de.warning).toContain("valsts kodu");
    expect(normalizePhoneForLv("017612345678")).not.toMatch(/^\+371/);
  });

  it("leaves empty input empty", () => {
    expect(inspectIrissPhone("").hrefValue).toBe("");
    expect(inspectIrissPhone("").warning).toBeNull();
  });
});
