import { describe, expect, it } from "vitest";
import { bearerMatchesAnySecret } from "./cron-bearer";

describe("bearerMatchesAnySecret", () => {
  it("matches any configured secret", () => {
    expect(bearerMatchesAnySecret("Bearer s3cret-value", ["other", "s3cret-value"])).toBe(true);
  });
  it("rejects wrong, missing and empty secrets", () => {
    expect(bearerMatchesAnySecret("Bearer nope", ["s3cret-value"])).toBe(false);
    expect(bearerMatchesAnySecret(null, ["s3cret-value"])).toBe(false);
    expect(bearerMatchesAnySecret("Bearer ", ["", undefined])).toBe(false);
    expect(bearerMatchesAnySecret("Bearer", [""])).toBe(false);
    expect(bearerMatchesAnySecret("s3cret-value", ["s3cret-value"])).toBe(false);
  });
});
