import { describe, expect, it } from "vitest";
import { StaffUserAdminActions } from "@/components/admin/IrissStaffUsersClient";
import { renderText } from "@/lib/test-render";

describe("StaffUserAdminActions", () => {
  it("shows reset and hard-delete for an active staff user", () => {
    const text = renderText(<StaffUserAdminActions status="active" busy={false} onAct={() => undefined} />);
    expect(text).toContain("Atiestatīt paroli");
    expect(text).toContain("Dzēst lietotāju");
    expect(text).toContain("Atsaukt pieeju");
    expect(text).toContain("Beigt sesijas");
    expect(text).not.toContain("Atjaunot pieeju");
  });

  it("offers a resend link while invited", () => {
    const text = renderText(<StaffUserAdminActions status="invited" busy={false} onAct={() => undefined} />);
    expect(text).toContain("Nosūtīt saiti vēlreiz");
    expect(text).toContain("Dzēst lietotāju");
    expect(text).not.toContain("Atiestatīt paroli");
  });

  it("hides reset for a revoked user and keeps hard-delete", () => {
    const text = renderText(<StaffUserAdminActions status="revoked" busy={false} onAct={() => undefined} />);
    expect(text).toContain("Atjaunot pieeju");
    expect(text).toContain("Dzēst lietotāju");
    expect(text).not.toContain("Atiestatīt paroli");
    expect(text).not.toContain("Nosūtīt saiti vēlreiz");
    expect(text).not.toContain("Atsaukt pieeju");
  });
});
