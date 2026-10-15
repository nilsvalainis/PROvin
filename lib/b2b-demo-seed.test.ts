import { describe, expect, it } from "vitest";
import { b2bDemoDevLoginPrefill, readB2bDemoSeedCredentials } from "./b2b-demo-seed-config";

describe("b2b demo seed", () => {
  it("produkcijā bez env nesēj", () => {
    expect(
      readB2bDemoSeedCredentials({ NODE_ENV: "production", VERCEL_ENV: "production" }),
    ).toBeNull();
    expect(b2bDemoDevLoginPrefill({ NODE_ENV: "production" })).toBeNull();
  });

  it("lokāli dod demo kontu", () => {
    const seed = readB2bDemoSeedCredentials({ NODE_ENV: "development" });
    expect(seed?.email).toBe("demo@provin.lv");
    expect(b2bDemoDevLoginPrefill({ NODE_ENV: "development" })?.password).toBe("iriss-b2b-demo");
  });

  it("ņem explicit env", () => {
    const seed = readB2bDemoSeedCredentials({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      B2B_DEMO_SEED_EMAIL: "Nils@Salon.lv",
      B2B_DEMO_SEED_PASSWORD: "long-pass-9",
      B2B_DEMO_SEED_COMPANY: "SIA Tests",
    });
    expect(seed).toEqual({ email: "nils@salon.lv", password: "long-pass-9", companyName: "SIA Tests" });
  });
});
