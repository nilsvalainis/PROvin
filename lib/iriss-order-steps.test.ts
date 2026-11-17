import { describe, expect, it } from "vitest";
import { IRISS_ORDER_STEPS, equipmentHas, seatsRange, seatsValue, toggleEquipment } from "@/lib/iriss-order-steps";

describe("Pasūtījums pa soļiem (Nils 28.10)", () => {
  it("6 soļi: meklēšanas filtri pirmie, klienta kontakti pēdējie (Nils 30.10)", () => {
    expect(IRISS_ORDER_STEPS).toHaveLength(6);
    expect(IRISS_ORDER_STEPS[0]?.title).toBe("Meklēšanas filtri");
    expect(IRISS_ORDER_STEPS.at(-1)?.title).toBe("Klienta kontakti");
  });

  it("prasību pogas pievieno/noņem, esošais teksts paliek", () => {
    expect(toggleEquipment("", "Āķis")).toBe("Āķis");
    expect(toggleEquipment("Melna āda, jumta reliņi", "Āķis")).toBe("Melna āda, jumta reliņi, Āķis");
    expect(toggleEquipment("Melna āda, āķis, jumta reliņi", "Āķis")).toBe("Melna āda, jumta reliņi");
    expect(equipmentHas("navigācija; ACC", "Navigācija")).toBe(true);
  });

  it("sēdvietas no-līdz; vecs «5» paliek «5»", () => {
    expect(seatsRange("5")).toEqual({ from: "5", to: "" });
    expect(seatsRange("5-7")).toEqual({ from: "5", to: "7" });
    expect(seatsRange("vismaz 7")).toEqual({ from: "vismaz 7", to: "" });
    expect(seatsValue("5", "")).toBe("5");
    expect(seatsValue("5", "7")).toBe("5-7");
    expect(seatsValue("", "7")).toBe("-7");
  });
});
