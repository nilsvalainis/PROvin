import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adminAuthConfigured,
  adminUsesLocalDevDefaults,
  getDevLoginPrefill,
  verifyAdminCredentials,
} from "./admin-auth";

describe("admin-auth DEV_FALLBACK_PASSWORD", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("NODE_ENV=production: fallback parole neder", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("ADMIN_SECRET", "");
    vi.stubEnv("ADMIN_USERNAME", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(adminUsesLocalDevDefaults()).toBe(false);
    expect(getDevLoginPrefill()).toBeNull();
    expect(verifyAdminCredentials("admin", "provin-local-dev")).toBe(false);
    expect(adminAuthConfigured()).toBe(false);
  });

  it("VERCEL_ENV=production: fallback parole neder arī tad, ja NODE_ENV nav production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("ADMIN_SECRET", "");
    vi.stubEnv("ADMIN_USERNAME", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(adminUsesLocalDevDefaults()).toBe(false);
    expect(getDevLoginPrefill()).toBeNull();
    expect(verifyAdminCredentials("admin", "provin-local-dev")).toBe(false);
    expect(adminAuthConfigured()).toBe(false);
  });

  it("lokāli bez env pieņem fallback", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("ADMIN_SECRET", "");
    vi.stubEnv("ADMIN_USERNAME", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(adminUsesLocalDevDefaults()).toBe(true);
    expect(getDevLoginPrefill()).toEqual({ username: "admin", password: "provin-local-dev" });
    expect(verifyAdminCredentials("admin", "provin-local-dev")).toBe(true);
  });
});
