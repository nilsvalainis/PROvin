import { describe, expect, it } from "vitest";
import { dropboxContentHash } from "@/lib/dropbox-content-hash";

describe("dropboxContentHash", () => {
  it("tukšs fails = sha256 no tukšas virknes", () => {
    expect(dropboxContentHash(new Uint8Array())).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  it("vairāku bloku fails atšķiras no viena sha256", () => {
    const big = new Uint8Array(4 * 1024 * 1024 + 5).fill(7);
    expect(dropboxContentHash(big)).toMatch(/^[0-9a-f]{64}$/);
    expect(dropboxContentHash(big)).not.toBe(dropboxContentHash(big.subarray(0, 4 * 1024 * 1024)));
  });
});
