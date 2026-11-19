import { describe, expect, it } from "vitest";
import { normalizeAutoparksCar, type AutoparksCar } from "@/lib/iriss-autoparks";
import { autoparksV2Basics, emptyCarV2, normalizeCarV2, normalizeInspectionUntil, v2CountInput } from "@/lib/iriss-autoparks-v2";
import { v2HistoryText } from "@/lib/iriss-autoparks-v2-history-text";

function v1Car(): AutoparksCar {
  return normalizeAutoparksCar({ id: "ap-1", make: "Volvo", model: "XC60", year: "2013", vin: "YV1DZ8256E2549564", status: "in_transit" })!;
}

describe("Autoparks v2 - atslēgas, īpašnieki, otrs disku komplekts, TA/HU (IRISS 18.11)", () => {
  it("jauns auto - visi tukši", () => {
    const b = autoparksV2Basics(v1Car(), emptyCarV2());
    expect(b.extras).toEqual({ keysCount: null, ownersCount: null, secondWheels: "", inspectionUntil: "" });
  });

  it("saglabātie lauki nonāk pamatdatos; nederīgi skaitļi izmesti", () => {
    const v2 = normalizeCarV2({ tech: { keysCount: 2, ownersCount: 3, secondWheels: "Ziemas 17\" uz diskiem", inspectionUntil: "04.2028" } });
    expect(autoparksV2Basics(v1Car(), v2).extras).toEqual({ keysCount: 2, ownersCount: 3, secondWheels: "Ziemas 17\" uz diskiem", inspectionUntil: "04.2028" });
    const bad = normalizeCarV2({ tech: { keysCount: -1, ownersCount: 500, secondWheels: 7 } });
    expect(bad.tech.keysCount).toBeNull();
    expect(bad.tech.ownersCount).toBeNull();
    expect(bad.tech.secondWheels).toBe("");
  });

  it("skaita ievade: 0..max, tukšs = notīrīt, citādi kļūda", () => {
    expect(v2CountInput("2", 20)).toBe(2);
    expect(v2CountInput(0, 20)).toBe(0);
    expect(v2CountInput("", 20)).toBeNull();
    expect(v2CountInput(null, 20)).toBeNull();
    expect(v2CountInput("21", 20)).toBe("invalid");
    expect(v2CountInput("2,5", 20)).toBe("invalid");
    expect(v2CountInput("divas", 20)).toBe("invalid");
  });

  it("TA/HU: mēnesis.gads vai pilns datums, vienots formāts", () => {
    expect(normalizeInspectionUntil("04.2028")).toBe("04.2028");
    expect(normalizeInspectionUntil("4/2028")).toBe("04.2028");
    expect(normalizeInspectionUntil("2028-04")).toBe("04.2028");
    expect(normalizeInspectionUntil("15.4.2028")).toBe("15.04.2028");
    expect(normalizeInspectionUntil("2028-04-15")).toBe("15.04.2028");
    expect(normalizeInspectionUntil("")).toBe("");
    expect(normalizeInspectionUntil("13.2028")).toBe("invalid");
    expect(normalizeInspectionUntil("drīz")).toBe("invalid");
  });

  it("vēsturē latviski", () => {
    const row = { id: "h1", carId: "ap-1", at: "2026-11-19T10:00:00.000Z", actorId: "a", actorName: "Nils", field: "tech.keysCount", from: "", to: "2" };
    expect(v2HistoryText(row)).toEqual({ field: "Atslēgas", change: "- -> 2" });
    expect(v2HistoryText({ ...row, field: "tech.inspectionUntil", to: "04.2028" }).field).toBe("TA/HU līdz");
  });
});
