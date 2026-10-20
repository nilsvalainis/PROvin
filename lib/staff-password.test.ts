import { describe, expect, it } from "vitest";
import { hashStaffPassword, isUsableStaffPassword, verifyStaffPassword } from "@/lib/staff-password";

describe("staff password hashing", () => {
  it("hashes with scrypt and verifies only the original password", () => {
    const hash = hashStaffPassword("garaparole-12");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(verifyStaffPassword("garaparole-12", hash)).toBe(true);
    expect(verifyStaffPassword("cita-parole-12x", hash)).toBe(false);
    expect(verifyStaffPassword("garaparole-12", "bcrypt$not-this")).toBe(false);
  });

  it("requires at least 12 characters", () => {
    expect(isUsableStaffPassword("isit12345")).toBe(false);
    expect(isUsableStaffPassword("pietiekami12")).toBe(true);
  });
});
