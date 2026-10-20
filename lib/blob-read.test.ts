import { describe, expect, it } from "vitest";

import { BlobReadFailedError, isBlobMissingError, isNodeNotFoundError } from "@/lib/blob-read";

describe("blob read error classification", () => {
  it("treats ENOENT as missing, not as a failed read", () => {
    const err = Object.assign(new Error("no such file"), { code: "ENOENT" });
    expect(isNodeNotFoundError(err)).toBe(true);
    expect(isNodeNotFoundError(new Error("EIO"))).toBe(false);
  });

  it("treats BlobNotFound / 404 as missing", () => {
    const named = Object.assign(new Error("The requested blob does not exist"), { name: "BlobNotFoundError" });
    expect(isBlobMissingError(named)).toBe(true);
    expect(isBlobMissingError(Object.assign(new Error("missing"), { statusCode: 404 }))).toBe(true);
  });

  it("does not treat network or etag errors as missing", () => {
    expect(isBlobMissingError(new Error("fetch failed"))).toBe(false);
    expect(isBlobMissingError(new BlobReadFailedError("blob_get_status_500"))).toBe(false);
    const etag = Object.assign(new Error("Precondition failed: ETag mismatch."), {
      name: "BlobPreconditionFailedError",
    });
    expect(isBlobMissingError(etag)).toBe(false);
  });
});
