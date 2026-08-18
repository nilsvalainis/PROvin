import { describe, expect, it } from "vitest";

import { looksLikeBlobReadWriteToken } from "@/lib/vercel-blob-rw-token";

describe("looksLikeBlobReadWriteToken", () => {
  it("accepts the vercel_blob_rw store token shape", () => {
    expect(looksLikeBlobReadWriteToken("vercel_blob_rw_storeId_secretpart")).toBe(true);
    expect(looksLikeBlobReadWriteToken(" vercel_blob_rw_abc_def_ghi ")).toBe(true);
  });

  it("rejects empty, placeholders and truncated tokens", () => {
    expect(looksLikeBlobReadWriteToken("")).toBe(false);
    expect(looksLikeBlobReadWriteToken("BLOB_READ_WRITE_TOKEN")).toBe(false);
    expect(looksLikeBlobReadWriteToken("vercel_blob_rw_")).toBe(false);
    expect(looksLikeBlobReadWriteToken("vercel_blob_rw_onlystore")).toBe(false);
  });
});
