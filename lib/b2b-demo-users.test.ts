import { describe, expect, it } from "vitest";
import { canManageB2bDemoUsers, canWriteB2bDemoSettings, createB2bDemoUser, parseB2bDemoUser, verifyB2bDemoPassword } from "./b2b-demo-users";

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
});
