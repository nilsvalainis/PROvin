import { describe, expect, it } from "vitest";
import {
  autoIngestChipForPart,
  autoIngestChipsByBlock,
  autoIngestChipsWithCsddCountry,
  autoIngestCsddCountryMismatchChips,
  csddForeignCountryIsos,
  isAutoIngestFailure,
  parseAutoIngestStatus,
} from "@/lib/admin-auto-ingest";

describe("auto-ingest failure chips", () => {
  it("treats fetch errors and missing captcha as failures", () => {
    expect(isAutoIngestFailure("error")).toBe(true);
    expect(isAutoIngestFailure("no_solver")).toBe(true);
    expect(isAutoIngestFailure("timeout")).toBe(true);
    expect(autoIngestChipForPart("error")).toEqual({ label: "kļūda", tone: "failed" });
    expect(autoIngestChipForPart("no_solver")).toEqual({ label: "nav captcha", tone: "no_data" });
  });

  it("does not chip skip / empty / not-found outcomes", () => {
    expect(isAutoIngestFailure("filled")).toBe(false);
    expect(isAutoIngestFailure("skip")).toBe(false);
    expect(isAutoIngestFailure("not_found")).toBe(false);
    expect(isAutoIngestFailure("no_listing_url")).toBe(false);
    expect(isAutoIngestFailure(undefined)).toBe(false);
    expect(autoIngestChipForPart("filled")).toBeNull();
  });

  it("maps failed parts onto the matching source blocks", () => {
    const chips = autoIngestChipsByBlock({
      at: "2026-10-13T00:00:00.000Z",
      parts: {
        listing: "error",
        csdd: "error",
        tjekbil: "filled",
        mnt_ee: "no_solver",
        lkf_ee: "skip",
        carinfo: "not_found",
      },
    });
    expect(chips.csdd).toEqual({ label: "kļūda", tone: "failed" });
    expect(chips.listing_analysis).toEqual({ label: "kļūda", tone: "failed" });
    expect(chips.tirgus).toEqual({ label: "kļūda", tone: "failed" });
    expect(chips.mnt_ee).toEqual({ label: "nav captcha", tone: "no_data" });
    expect(chips.tjekbil).toBeUndefined();
    expect(chips.lkf_ee).toBeUndefined();
    expect(chips.carinfo).toBeUndefined();
  });

  it("parses stored ingest JSON and rejects junk", () => {
    expect(parseAutoIngestStatus(null)).toBeNull();
    expect(parseAutoIngestStatus({ at: "2026-10-13T12:00:00.000Z", parts: { csdd: "error" } })).toEqual({
      at: "2026-10-13T12:00:00.000Z",
      parts: { csdd: "error" },
    });
    expect(parseAutoIngestStatus({ parts: { csdd: "error" } })).toBeNull();
  });
});

describe("CSDD foreign-country vs registry mismatch chips", () => {
  const notFoundAll = {
    at: "2026-11-27T10:47:00.290Z",
    parts: { csdd: "filled", tjekbil: "not_found", mnt_ee: "not_found", lkf_ee: "not_found", carinfo: "not_found" },
  };

  it("flags mnt.ee when CSDD has an Estonian mileage record but mnt.ee found nothing", () => {
    const csdd = {
      mileageHistory: [
        { country: "Latvija" },
        { country: "Igaunija" },
      ],
      previousRegistrationCountry: "",
    };
    expect(csddForeignCountryIsos(csdd)).toEqual(["EE"]);
    const chips = autoIngestChipsWithCsddCountry(notFoundAll, csdd);
    expect(chips.mnt_ee).toEqual({ label: "CSDD rāda EE", tone: "no_data" });
    expect(chips.lkf_ee).toBeUndefined();
    expect(chips.tjekbil).toBeUndefined();
    expect(chips.carinfo).toBeUndefined();
  });

  it("covers DK and SE (also via previous registration country and raw CSDD capitals)", () => {
    const chips = autoIngestCsddCountryMismatchChips(notFoundAll, {
      mileageHistory: [{ country: "ZVIEDRIJA" }],
      previousRegistrationCountry: "DĀNIJA",
    });
    expect(chips.carinfo?.label).toBe("CSDD rāda SE");
    expect(chips.tjekbil?.label).toBe("CSDD rāda DK");
  });

  it("does not chip when the registry found the car, the block is filled, or the country has no VIN source", () => {
    const filled = { ...notFoundAll, parts: { ...notFoundAll.parts, mnt_ee: "filled" } };
    expect(autoIngestCsddCountryMismatchChips(filled, { mileageHistory: [{ country: "Igaunija" }] })).toEqual({});
    expect(
      autoIngestCsddCountryMismatchChips(notFoundAll, { mileageHistory: [{ country: "Igaunija" }] }, (k) => k === "mnt_ee"),
    ).toEqual({});
    expect(
      autoIngestCsddCountryMismatchChips(notFoundAll, { mileageHistory: [{ country: "Vācija" }, { country: "Beļģija" }] }),
    ).toEqual({});
    expect(autoIngestCsddCountryMismatchChips(null, { mileageHistory: [{ country: "Igaunija" }] })).toEqual({});
  });

  it("keeps the failure chip when the part actually failed", () => {
    const failed = { ...notFoundAll, parts: { ...notFoundAll.parts, mnt_ee: "error" } };
    const chips = autoIngestChipsWithCsddCountry(failed, { mileageHistory: [{ country: "Igaunija" }] });
    expect(chips.mnt_ee).toEqual({ label: "kļūda", tone: "failed" });
  });
});
