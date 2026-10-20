import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  extractBearerToken,
  IRISS_AIVARS_API_TOKEN_ENV,
  irissAivarsApiTokenConfigured,
  verifyIrissAivarsApiToken,
} from "@/lib/iriss-aivars-api-token";

describe("Aivars API token", () => {
  afterEach(() => {
    delete process.env[IRISS_AIVARS_API_TOKEN_ENV];
  });

  it("documents the env name and rejects a missing/short secret", () => {
    expect(IRISS_AIVARS_API_TOKEN_ENV).toBe("IRISS_AIVARS_API_TOKEN");
    expect(irissAivarsApiTokenConfigured()).toBe(false);
    expect(verifyIrissAivarsApiToken("Bearer abc")).toBe(false);
  });

  it("accepts a Bearer token of at least 16 characters", () => {
    process.env[IRISS_AIVARS_API_TOKEN_ENV] = "aivars-test-token16";
    expect(irissAivarsApiTokenConfigured()).toBe(true);
    expect(verifyIrissAivarsApiToken("Bearer aivars-test-token16")).toBe(true);
    expect(verifyIrissAivarsApiToken("Bearer wrong-token-value1")).toBe(false);
    expect(extractBearerToken("Bearer abc")).toBe("abc");
  });

  it("locks Aivars HTTP to Bearer token and create_waybill", () => {
    const root = path.join("app", "api", "iriss", "aivars");
    const files = [
      path.join(root, "waybill-requests", "route.ts"),
      path.join(root, "waybill-requests", "[id]", "claim", "route.ts"),
      path.join(root, "waybill-requests", "[id]", "events", "route.ts"),
      path.join(root, "waybill-requests", "[id]", "result", "route.ts"),
    ];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      expect(src).toMatch(/verifyIrissAivarsApiToken/);
      expect(src).not.toMatch(/getAdminSession|requireIrissSectionApi|freeText/);
    }
    const list = fs.readFileSync(files[0]!, "utf8");
    expect(list).toMatch(/AIVARS_ACTION_CREATE_WAYBILL|create_waybill/);
    expect(list).toMatch(/toAivarsCreateWaybillAction/);
  });
});
