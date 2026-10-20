import { afterEach, describe, expect, it } from "vitest";
import {
  adminAuthConfigured,
  adminUsesLocalDevDefaults,
  getDevLoginPrefill,
  verifyAdminCredentials,
} from "./admin-auth";

const ENV_KEYS = ["NODE_ENV", "VERCEL_ENV", "ADMIN_SECRET", "ADMIN_USERNAME", "ADMIN_PASSWORD"] as const;

describe("admin-auth DEV_FALLBACK_PASSWORD", () => {
  const previous: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  function snapshotEnv() {
    for (const key of ENV_KEYS) previous[key] = process.env[key];
  }

  function restoreEnv() {
    for (const key of ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  function clearAdminEnv() {
    delete process.env.ADMIN_SECRET;
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
  }

  snapshotEnv();
  afterEach(restoreEnv);

  it("NODE_ENV=production: fallback parole neder", () => {
    process.env.NODE_ENV = "production";
    delete process.env.VERCEL_ENV;
    clearAdminEnv();
    expect(adminUsesLocalDevDefaults()).toBe(false);
    expect(getDevLoginPrefill()).toBeNull();
    expect(verifyAdminCredentials("admin", "provin-local-dev")).toBe(false);
    expect(adminAuthConfigured()).toBe(false);
  });

  it("VERCEL_ENV=production: fallback parole neder arī tad, ja NODE_ENV nav production", () => {
    process.env.NODE_ENV = "development";
    process.env.VERCEL_ENV = "production";
    clearAdminEnv();
    expect(adminUsesLocalDevDefaults()).toBe(false);
    expect(getDevLoginPrefill()).toBeNull();
    expect(verifyAdminCredentials("admin", "provin-local-dev")).toBe(false);
    expect(adminAuthConfigured()).toBe(false);
  });

  it("lokāli bez env pieņem fallback", () => {
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL_ENV;
    clearAdminEnv();
    expect(adminUsesLocalDevDefaults()).toBe(true);
    expect(getDevLoginPrefill()).toEqual({ username: "admin", password: "provin-local-dev" });
    expect(verifyAdminCredentials("admin", "provin-local-dev")).toBe(true);
  });
});
