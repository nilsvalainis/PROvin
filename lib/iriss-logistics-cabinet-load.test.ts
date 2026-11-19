import { describe, expect, it } from "vitest";
import { cabinetPickupCodeValue, logisticsUrlCarStep, parseCabinetLoad } from "@/lib/iriss-logistics-cabinet-load";

describe("Loģistikas kabineta ielāde (IRISS 18.11 - pickup kods bloķēts)", () => {
  it("veiksmīga atbilde - tiesības, dokumenti un pickup", () => {
    const r = parseCabinetLoad(true, {
      ok: true,
      documents: [{ id: "d1" }],
      pickup: { carId: "lo-1", stage: "waiting", pickupCode: "A1B2" },
      access: { write: true, hideSums: false, admin: true, sections: ["A", "B", "X"] },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.access).toEqual({ write: true, hideSums: false, admin: true, sections: ["A", "B"] });
    expect(r.documents).toHaveLength(1);
    expect(r.pickup?.pickupCode).toBe("A1B2");
  });

  it("servera kļūda, 403 vai ne-JSON - neizdevās (rāda kļūdu, nevis klusi bloķē)", () => {
    expect(parseCabinetLoad(false, { error: "internal" }).ok).toBe(false);
    expect(parseCabinetLoad(true, null).ok).toBe(false);
    expect(parseCabinetLoad(true, { error: "forbidden" }).ok).toBe(false);
  });

  it("nepilnīgas tiesības - drošais noklusējums (nav rakstīšanas, summas slēptas)", () => {
    const r = parseCabinetLoad(true, { access: {} });
    expect(r.ok && r.access).toEqual({ write: false, hideSums: true, admin: false, sections: [] });
  });

  it("pickup kods: pasūtījuma kods, citādi kabineta ieraksta kods", () => {
    expect(cabinetPickupCodeValue("KOD1", { pickupCode: "KOD2" })).toBe("KOD1");
    expect(cabinetPickupCodeValue("", { pickupCode: " d4d2e " })).toBe("d4d2e");
    expect(cabinetPickupCodeValue(undefined, null)).toBe("");
  });
});

describe("?car= saite atver kabinetu vienu reizi", () => {
  const ids = ["lo-1", "lo-2"];

  it("pirmo reizi atver kabinetu, nākamās sarakstu izmaiņas to vairs neatver", () => {
    const first = logisticsUrlCarStep("lo-1", null, "", ids);
    expect(first.open).toBe("cabinet");
    // Pēc citas mašīnas pickup koda saglabāšanas `orders` mainās - kabinets nepārlec atpakaļ.
    const again = logisticsUrlCarStep("lo-1", null, first.handled, ids);
    expect(again.open).toBeNull();
  });

  it("view=map - tikai kartē", () => {
    expect(logisticsUrlCarStep("lo-2", "map", "", ids).open).toBe("map");
  });

  it("auto vēl nav sarakstā - gaida, atver, kad parādās", () => {
    const wait = logisticsUrlCarStep("lo-9", null, "", ids);
    expect(wait.open).toBeNull();
    expect(logisticsUrlCarStep("lo-9", null, wait.handled, [...ids, "lo-9"]).open).toBe("cabinet");
  });

  it("jauna saite uz citu auto - atver to", () => {
    const first = logisticsUrlCarStep("lo-1", null, "", ids);
    expect(logisticsUrlCarStep("lo-2", null, first.handled, ids).open).toBe("cabinet");
  });

  it("bez ?car - nekas", () => {
    expect(logisticsUrlCarStep("", null, "lo-1|", ids)).toEqual({ open: null, handled: "" });
  });
});
