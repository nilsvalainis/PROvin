import { describe, expect, it } from "vitest";

/** Tas pats `replace(/^W\//i, "")`, ko `readOrderDraftJsonFromBlob` un `readFromBlob`. */
function stripWeakEtag(etag: string): string {
  return etag.replace(/^W\//i, "");
}

describe("weak Blob ETag for ifMatch", () => {
  it("strips W/ so put ifMatch gets the strong tag Blob get() returned", () => {
    expect(stripWeakEtag('W/"abc123"')).toBe('"abc123"');
    expect(stripWeakEtag('w/"abc123"')).toBe('"abc123"');
    expect(stripWeakEtag('"abc123"')).toBe('"abc123"');
    expect(stripWeakEtag("")).toBe("");
  });
});
