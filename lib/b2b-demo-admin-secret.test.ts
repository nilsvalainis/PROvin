import { afterEach, describe, expect, it } from "vitest";
import {
  b2bDemoAdminSecretConfigured,
  resolveB2bDemoAdminSecret,
  verifyB2bDemoAdminSecret,
} from "./b2b-demo-admin-secret";

describe("b2b demo admin secret", () => {
  const prevDedicated = process.env.B2B_DEMO_ADMIN_SECRET;
  const prevAdmin = process.env.ADMIN_SECRET;

  afterEach(() => {
    if (prevDedicated === undefined) delete process.env.B2B_DEMO_ADMIN_SECRET;
    else process.env.B2B_DEMO_ADMIN_SECRET = prevDedicated;
    if (prevAdmin === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = prevAdmin;
  });

  it("noraida īsu vai tukšu noslēpumu", () => {
    delete process.env.B2B_DEMO_ADMIN_SECRET;
    delete process.env.ADMIN_SECRET;
    expect(b2bDemoAdminSecretConfigured()).toBe(false);
    expect(verifyB2bDemoAdminSecret("anything-long-enough")).toBe(false);

    process.env.ADMIN_SECRET = "short";
    expect(b2bDemoAdminSecretConfigured()).toBe(false);
    expect(verifyB2bDemoAdminSecret("short")).toBe(false);
  });

  it("ņem B2B_DEMO_ADMIN_SECRET pirms ADMIN_SECRET", () => {
    const env = {
      B2B_DEMO_ADMIN_SECRET: "dedicated-secret-16",
      ADMIN_SECRET: "fallback-admin-secret",
    };
    expect(resolveB2bDemoAdminSecret(env)).toBe("dedicated-secret-16");
    expect(verifyB2bDemoAdminSecret("dedicated-secret-16", env)).toBe(true);
    expect(verifyB2bDemoAdminSecret("fallback-admin-secret", env)).toBe(false);
  });

  it("krīt uz ADMIN_SECRET, ja dedicated nav", () => {
    const env = { ADMIN_SECRET: "fallback-admin-secret" };
    expect(b2bDemoAdminSecretConfigured(env)).toBe(true);
    expect(verifyB2bDemoAdminSecret("fallback-admin-secret", env)).toBe(true);
    expect(verifyB2bDemoAdminSecret("wrong-secret-value-x", env)).toBe(false);
    expect(verifyB2bDemoAdminSecret("", env)).toBe(false);
    expect(verifyB2bDemoAdminSecret(null, env)).toBe(false);
  });
});
