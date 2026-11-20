import { describe, expect, it } from "vitest";
import { ADMIN_GOOGLE_STATE_BLOB_PATH } from "@/lib/admin-google-session-live";
import { adminApiGateIsProduction } from "@/lib/admin-google-state-edge";
import { testEnv } from "@/lib/test-process-env";

describe("admin Google state for the API gate", () => {
  it("reads the same Blob path as the Node store", () => {
    expect(ADMIN_GOOGLE_STATE_BLOB_PATH).toBe("admin-google/state.json");
  });

  it("treats Vercel production as production even if NODE_ENV is not set that way", () => {
    expect(adminApiGateIsProduction(testEnv({ NODE_ENV: "production" }))).toBe(true);
    expect(adminApiGateIsProduction(testEnv({ VERCEL_ENV: "production" }))).toBe(true);
    expect(adminApiGateIsProduction(testEnv({ NODE_ENV: "test" }))).toBe(false);
  });
});
