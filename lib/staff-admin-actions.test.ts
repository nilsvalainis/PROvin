import { describe, expect, it } from "vitest";
import {
  staffDeleteUserConfirm,
  staffResetPasswordConfirm,
  staffResetPasswordLabel,
  staffUserAdminActions,
} from "@/lib/staff-admin-actions";

describe("staff admin actions", () => {
  it("offers reset and delete for an active user, not restore", () => {
    expect(staffUserAdminActions("active")).toEqual([
      "revoke_sessions",
      "reset_password",
      "revoke",
      "delete",
    ]);
    expect(staffResetPasswordLabel("active")).toBe("Atiestatīt paroli");
  });

  it("offers a resend link for an invited user", () => {
    expect(staffUserAdminActions("invited")).toContain("reset_password");
    expect(staffResetPasswordLabel("invited")).toBe("Nosūtīt saiti vēlreiz");
  });

  it("does not offer reset for a revoked user, only restore and delete", () => {
    expect(staffUserAdminActions("revoked")).toEqual(["restore", "delete"]);
  });

  it("writes confirm copy with ASCII hyphen only", () => {
    const reset = staffResetPasswordConfirm("Toms Gudovskis", "tomsgudovskis@gmail.com", "active");
    const invited = staffResetPasswordConfirm("Toms Gudovskis", "tomsgudovskis@gmail.com", "invited");
    const del = staffDeleteUserConfirm("Toms Gudovskis", "tomsgudovskis@gmail.com");
    expect(reset).toContain("tomsgudovskis@gmail.com");
    expect(reset).toContain("24 h");
    expect(invited).toContain("Iepriekšējā saite");
    expect(del).toContain("uzaicināt no jauna");
    for (const text of [reset, invited, del]) {
      expect(text).not.toContain("\u2014");
      expect(text).not.toContain("\u2013");
    }
  });
});
