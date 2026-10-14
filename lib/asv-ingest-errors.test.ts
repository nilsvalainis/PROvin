import { describe, expect, it } from "vitest";
import { asvFetchErrorLv } from "@/lib/asv-ingest-errors";

describe("asvFetchErrorLv", () => {
  it("no_data → Nav ASV datu", () => {
    expect(asvFetchErrorLv("no_data")).toBe("Nav ASV datu");
  });

  it("upstream_error saglabā tehnisko ziņu", () => {
    expect(asvFetchErrorLv("upstream_error")).toBe("One Auto API neatbildēja. Mēģini vēlreiz.");
  });
});
