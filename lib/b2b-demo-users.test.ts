import { describe, expect, it } from "vitest";
import {
  canManageB2bDemoUsers,
  canWriteB2bDemoSettings,
  createB2bDemoUser,
  generateB2bDemoPassword,
  parseB2bDemoUser,
  resolveB2bDemoCreatePassword,
  verifyB2bDemoPassword,
} from "./b2b-demo-users";

describe("b2b demo users", () => {
  it("hashē paroli un nelaiž svešu tenant_id", () => {
    const user = createB2bDemoUser({
      tenantId: "tnt_user01",
      email: "Owner@Salon.lv",
      name: "Anna",
      role: "owner",
      password: "salon-pass-1",
    });
    expect(user.email).toBe("owner@salon.lv");
    expect(user.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(verifyB2bDemoPassword("salon-pass-1", user.passwordHash)).toBe(true);
    expect(parseB2bDemoUser({ ...user, tenantId: "tnt_other1" }, "tnt_user01")).toBeNull();
    expect(parseB2bDemoUser(user, "tnt_user01")?.userId).toBe(user.userId);
  });

  it("tikai īpašnieks pārvalda lietotājus un iestatījumus", () => {
    expect(canManageB2bDemoUsers("owner")).toBe(true);
    expect(canManageB2bDemoUsers("employee")).toBe(false);
    expect(canWriteB2bDemoSettings("owner")).toBe(true);
    expect(canWriteB2bDemoSettings("employee")).toBe(false);
  });

  it("ģenerē paroli un hashē ar scrypt", () => {
    const generated = generateB2bDemoPassword();
    expect(generated.length).toBeGreaterThanOrEqual(8);
    const resolvedEmpty = resolveB2bDemoCreatePassword("");
    expect(resolvedEmpty.generated).toBe(true);
    expect(resolvedEmpty.password.length).toBeGreaterThanOrEqual(8);
    const given = resolveB2bDemoCreatePassword("explicit-pass-9");
    expect(given).toEqual({ password: "explicit-pass-9", generated: false });
    expect(() => resolveB2bDemoCreatePassword("short")).toThrow(/Parolei/);
    const user = createB2bDemoUser({
      tenantId: "tnt_user02",
      email: "gen@demo.lv",
      name: "G",
      role: "owner",
      password: generated,
    });
    expect(user.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(verifyB2bDemoPassword(generated, user.passwordHash)).toBe(true);
  });
});
