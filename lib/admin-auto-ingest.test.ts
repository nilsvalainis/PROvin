import { describe, expect, it } from "vitest";
import {
  autoIngestChipForPart,
  autoIngestChipsByBlock,
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
