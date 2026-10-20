import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  extractBearerToken,
  IRISS_LOGISTICS_UPLOAD_TOKEN_ENV,
  verifyIrissLogisticsUploadToken,
} from "@/lib/iriss-logistics-upload-token";

describe("Loģistika upload Bearer token", () => {
  afterEach(() => {
    delete process.env[IRISS_LOGISTICS_UPLOAD_TOKEN_ENV];
  });

  it("documents the env name and never embeds a secret", () => {
    expect(IRISS_LOGISTICS_UPLOAD_TOKEN_ENV).toBe("IRISS_LOGISTICS_UPLOAD_TOKEN");
    const env = readFileSync(".env.example", "utf8");
    expect(env).toContain("IRISS_LOGISTICS_UPLOAD_TOKEN");
    expect(env).not.toMatch(/IRISS_LOGISTICS_UPLOAD_TOKEN=.+/);
    const docs = readFileSync("docs/iriss-logistics-upload-api.md", "utf8");
    expect(docs).toContain("Authorization: Bearer");
    expect(docs).toContain("IRISS_LOGISTICS_UPLOAD_TOKEN");
    expect(docs).not.toMatch(/Bearer [A-Za-z0-9_-]{16,}/);
  });

  it("rejects short or mismatched tokens", () => {
    expect(verifyIrissLogisticsUploadToken("Bearer abc")).toBe(false);
    process.env[IRISS_LOGISTICS_UPLOAD_TOKEN_ENV] = "logistics-upload-16";
    expect(verifyIrissLogisticsUploadToken("Bearer logistics-upload-16")).toBe(true);
    expect(verifyIrissLogisticsUploadToken("Bearer wrong-token-value1")).toBe(false);
    expect(extractBearerToken("Bearer abc")).toBe("abc");
  });
});
