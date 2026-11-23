import { describe, expect, it } from "vitest";
import {
  adminPhoneCarFromVin,
  adminPhoneDeadlineTone,
  adminPhoneProductKind,
  adminPhoneSentTone,
} from "@/lib/admin-phone-colors";
import { adminPhoneProductLabel } from "@/lib/admin-mobile-ds";
import { paidProductLabel } from "@/lib/admin-customer-identity";

const kind = (checkoutLine: string | null, amountTotalCents: number) =>
  adminPhoneProductKind(adminPhoneProductLabel(paidProductLabel({ checkoutLine, amountTotalCents })));

describe("Telefona krāsas - produkta veids", () => {
  it("katram produktam sava krāsa", () => {
    expect(kind("audit", 9999)).toBe("audits");
    expect(kind("premium", 9999)).toBe("audits");
    expect(kind("dealer", 2499)).toBe("dealer");
    expect(kind("mini", 3999)).toBe("mini");
    expect(kind("business", 6999)).toBe("business");
    expect(kind("provin_select", 4999)).toBe("select");
    expect(kind(null, 999)).toBe("other");
    expect(adminPhoneProductKind("")).toBe("other");
  });
});

describe("Telefona krāsas - termiņš un nosūtīšana", () => {
  const now = Date.UTC(2026, 10, 23, 12);
  const created = (hoursLeft: number) => Math.round(now / 1000) - 48 * 3600 + hoursLeft * 3600;

  it("Kavē - sarkans, <12 h - oranžs, citādi neitrāls, Gatavs - zaļš", () => {
    expect(adminPhoneDeadlineTone({ label: "Kavē 4 h", tone: "overdue" }, created(-4), now)).toBe("err");
    expect(adminPhoneDeadlineTone({ label: "Atlikušas 8 h", tone: "ok" }, created(8), now)).toBe("warn");
    expect(adminPhoneDeadlineTone({ label: "Atlikušas 2 h", tone: "urgent" }, created(2), now)).toBe("warn");
    expect(adminPhoneDeadlineTone({ label: "Atlikušas 30 h", tone: "ok" }, created(30), now)).toBe("neutral");
    expect(adminPhoneDeadlineTone({ label: "Gatavs", tone: "done" }, created(30), now)).toBe("ok");
  });

  it("Nosūtīts - zaļš, Nav nosūtīts - oranžs", () => {
    expect(adminPhoneSentTone("Nosūtīts")).toBe("ok");
    expect(adminPhoneSentTone("Nav nosūtīts")).toBe("warn");
  });
});

describe("Telefona krāsas - auto no VIN", () => {
  it("marka (un modelis, ja zināms) no VIN; nederīgs VIN - null", () => {
    expect(adminPhoneCarFromVin("WBA5R1C0XLFH42873")).toMatch(/^BMW/);
    expect(adminPhoneCarFromVin("WBA123")).toBeNull();
    expect(adminPhoneCarFromVin("")).toBeNull();
  });
});
