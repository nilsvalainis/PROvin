import { describe, expect, it, vi } from "vitest";
import { isUsableB2bDemoPassword } from "./b2b-demo-users";
import { b2bDemoDevLoginPrefill, readB2bDemoSeedCredentials } from "./b2b-demo-seed-config";

describe("b2b demo seed", () => {
  it("produkcijā bez env nesēj", () => {
    expect(
      readB2bDemoSeedCredentials({ NODE_ENV: "production", VERCEL_ENV: "production" }),
    ).toBeNull();
    expect(b2bDemoDevLoginPrefill({ NODE_ENV: "production" })).toBeNull();
    expect(
      readB2bDemoSeedCredentials({ NODE_ENV: "development", VERCEL_ENV: "production" }),
    ).toBeNull();
    expect(b2bDemoDevLoginPrefill({ NODE_ENV: "development", VERCEL_ENV: "production" })).toBeNull();
  });

  it("lokāli ģenerē nejaušu dev-only paroli un to nelogā", () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
    const seed = readB2bDemoSeedCredentials({ NODE_ENV: "development" });
    const prefill = b2bDemoDevLoginPrefill({ NODE_ENV: "development" });
    spy.mockRestore();
    expect(seed?.email).toBe("demo@provin.lv");
    expect(seed?.password).toBeTruthy();
    expect(seed?.password).not.toBe("iriss-b2b-demo");
    expect(isUsableB2bDemoPassword(seed?.password ?? "")).toBe(true);
    expect(prefill?.password).toBe(seed?.password);
    expect(
      readB2bDemoSeedCredentials({ NODE_ENV: "development" })?.password,
    ).toBe(seed?.password);
    expect(lines.some((line) => line.includes("dev-only"))).toBe(true);
    expect(lines.join("\n")).not.toContain(seed?.password ?? "MISSING");
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
