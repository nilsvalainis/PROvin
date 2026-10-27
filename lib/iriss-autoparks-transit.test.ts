import { describe, expect, it } from "vitest";
import { buildAutoparksTransit, planAutoparksLinks } from "@/lib/iriss-autoparks-transit";
import { allowedTabs } from "@/lib/iriss-autoparks-v2-cabinet-tabs";
import { autoparksV2PermsFor } from "@/lib/iriss-autoparks-v2-perms";

const order = {
  id: "lo-1",
  auction: "Auto1" as const,
  pickupAddress: "Rödgener Str. 12, Zörbig",
  pickupRef: "",
  stockNo: "KR57312",
  pickupDate: "2026-10-30",
  freeParkingUntil: "2026-11-02",
  status: "organize_pickup" as const,
};

describe("Loģistika = Autoparka posms «Ceļā» (Nils 27.10)", () => {
  it("cilnes dati: pickup posms, krava ar vietu, bez summām", () => {
    const t = buildAutoparksTransit(order, { stage: "planned", pickupCode: "", pickupDate: "" }, {
      cars: [
        { carId: "lo-9", bucket: "next", sort: 0, showOnMap: true },
        { carId: "lo-1", bucket: "next", sort: 1, showOnMap: true },
      ],
    });
    expect(t.stageLabel).toBe("Ieplānots");
    expect(t.cargoLabel).toBe("Nākošā krava");
    expect(t.cargoPlace).toBe(2);
    expect(t.pickupRef).toBe("KR57312");
    expect(JSON.stringify(t)).not.toMatch(/priceEur|transportCost/);
  });

  it("bez pickup un kravas - «Gaida», «Nav kravā»", () => {
    const t = buildAutoparksTransit(order, null, null);
    expect(t.stage).toBe("waiting");
    expect(t.cargo).toBe("none");
    expect(t.cargoPlace).toBeNull();
  });

  it("cilne «Ceļā» tikai ar Loģistikas datiem, otrajā vietā aiz Pamatdatiem", () => {
    const admin = autoparksV2PermsFor({ kind: "admin" }, true);
    expect(allowedTabs(admin, {}, { transit: true })).toEqual(["pamatdati", "cela"]);
    expect(allowedTabs(admin, {})).not.toContain("cela");
  });

  it("migrācijas plāns: sasaistīts / pēc VIN / izveidot; svešs ieraksts netiek pārņemts", () => {
    const plan = planAutoparksLinks(
      [
        { id: "lo-1", vin: "YV1CZ7146B1568808", title: "Volvo XC90", make: "", model: "" },
        { id: "lo-2", vin: "WAUZZZ8K9EA036715", title: "Audi A4", make: "", model: "" },
        { id: "lo-3", vin: "TMBJJ9NP0H7045709", title: "", make: "Škoda", model: "Superb" },
        { id: "lo-4", vin: "W1V44770113867588", title: "Vito", make: "", model: "" },
      ],
      [
        { id: "ap-1", orderId: "lo-1", vin: "YV1CZ7146B1568808" },
        { id: "ap-2", orderId: "", vin: "wauzzz8k9ea036715" },
        { id: "ap-4", orderId: "lo-99", vin: "W1V44770113867588" },
      ],
    );
    expect(plan.map((p) => p.kind)).toEqual(["linked", "link_vin", "create", "create"]);
    expect(plan[2]!.title).toBe("Škoda Superb");
  });
});
