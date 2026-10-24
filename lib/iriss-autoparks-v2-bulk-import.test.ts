import { describe, expect, it } from "vitest";
import { normalizeBulkImportRow, planBulkImportRow, type BulkImportCurrentValues } from "./iriss-autoparks-v2-bulk-import";

const EMPTY: BulkImportCurrentValues = {
  mileageKm: null,
  firstRegDate: "",
  displacementCm3: null,
  powerKw: null,
  tyreSize: "",
  make: "",
  model: "",
  plate: "",
  year: "",
  color: "",
};

describe("normalizeBulkImportRow", () => {
  it("prasa objektu ar VIN virkni", () => {
    expect(normalizeBulkImportRow({ vin: "WBA2A1234A1234567", mileageKm: 1000 })).toEqual({
      vin: "WBA2A1234A1234567",
      fields: { mileageKm: 1000 },
    });
    expect(normalizeBulkImportRow({ mileageKm: 1000 })).toBeNull();
    expect(normalizeBulkImportRow({ vin: "" })).toBeNull();
    expect(normalizeBulkImportRow("WBA2A1234A1234567")).toBeNull();
    expect(normalizeBulkImportRow(null)).toBeNull();
    expect(normalizeBulkImportRow([1, 2])).toBeNull();
  });
});

describe("planBulkImportRow - tukšiem laukiem raksta vienmēr", () => {
  it("aizpilda tukšus laukus bez overwrite", () => {
    const plan = planBulkImportRow(EMPTY, { mileageKm: 148950, firstRegDate: "2019-05-02", displacementCm3: 1995, powerKw: 110, make: "BMW" }, false);
    expect(plan.updates).toEqual({ mileageKm: 148950, firstRegDate: "2019-05-02", displacementCm3: 1995, powerKw: 110, make: "BMW" });
    expect(plan.skippedExisting).toEqual([]);
    expect(plan.invalid).toEqual([]);
  });
});

describe("planBulkImportRow - nepārraksta aizpildītus laukus bez overwrite=1", () => {
  const filled: BulkImportCurrentValues = { ...EMPTY, mileageKm: 140000, make: "VW" };

  it("izlaiž jau aizpildītus laukus, ja overwrite nav dots", () => {
    const plan = planBulkImportRow(filled, { mileageKm: 148950, make: "BMW", model: "320d" }, false);
    expect(plan.updates).toEqual({ model: "320d" });
    expect(plan.skippedExisting.sort()).toEqual(["make", "mileageKm"]);
  });

  it("overwrite=true pārraksta arī aizpildītus laukus", () => {
    const plan = planBulkImportRow(filled, { mileageKm: 148950, make: "BMW" }, true);
    expect(plan.updates).toEqual({ mileageKm: 148950, make: "BMW" });
    expect(plan.skippedExisting).toEqual([]);
  });
});

describe("planBulkImportRow - validācija", () => {
  it("nederīgas vērtības tiek atzīmētas kā invalid un netiek rakstītas", () => {
    const plan = planBulkImportRow(EMPTY, { mileageKm: "nav skaitlis", firstRegDate: "2019/05/02", year: "abcd", displacementCm3: -5 }, false);
    expect(plan.updates).toEqual({});
    expect(plan.invalid.sort()).toEqual(["displacementCm3", "firstRegDate", "mileageKm", "year"]);
  });

  it("numurzīme tiek uppercase-ota, teksta lauki apgriezti līdz maksimālajam garumam", () => {
    const plan = planBulkImportRow(EMPTY, { plate: "ab1234", color: "x".repeat(50) }, false);
    expect(plan.updates.plate).toBe("AB1234");
    expect((plan.updates.color as string).length).toBe(40);
  });

  it("nezināmi lauki rindā tiek ignorēti (nav BULK_IMPORT_FIELD_KEYS)", () => {
    const plan = planBulkImportRow(EMPTY, { foo: "bar", owner: "DZA" }, false);
    expect(plan.updates).toEqual({});
    expect(plan.invalid).toEqual([]);
    expect(plan.skippedExisting).toEqual([]);
  });

  it("gads: tikai 19xx/20xx pieņem", () => {
    expect(planBulkImportRow(EMPTY, { year: "2019" }, false).updates).toEqual({ year: "2019" });
    expect(planBulkImportRow(EMPTY, { year: "99" }, false).invalid).toEqual(["year"]);
  });
});
