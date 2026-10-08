import { describe, expect, it } from "vitest";
import { countryFlagEmoji, countryFlagLabel, countryNameLv } from "@/lib/iriss-listings-country-flag";

describe("countryFlag", () => {
  it("turns DE into a flag and Latvian name, not the letters DE", () => {
    expect(countryFlagEmoji("DE")).toBe("🇩🇪");
    expect(countryNameLv("be")).toBe("Beļģija");
    expect(countryFlagLabel("nl")?.title).toBe("Nīderlande (NL)");
    expect(countryFlagLabel("DE")?.flag).not.toBe("DE");
    expect(countryFlagLabel("")).toBeNull();
    expect(countryFlagLabel("DEU")).toBeNull();
  });
});
