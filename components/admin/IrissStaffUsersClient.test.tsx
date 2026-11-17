import { describe, expect, it } from "vitest";
import { IrissStaffUsersClient, StaffListPlaceholder, StaffUserAdminActions } from "@/components/admin/IrissStaffUsersClient";
import { renderHtml, renderText } from "@/lib/test-render";

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

describe("Personu saraksta ielāde", () => {
  it("pirms datu ielādes rāda ielādes rindas, nevis tukšu sarakstu", () => {
    const html = renderHtml(<IrissStaffUsersClient />);
    expect(html).toContain('data-testid="staff-list-loading"');
    expect(html).toContain('aria-busy="true"');
  });

  it("kļūdas gadījumā rāda paziņojumu un «Mēģināt vēlreiz»", () => {
    const text = renderText(<StaffListPlaceholder state="error" onRetry={() => undefined} />);
    expect(text).toContain("Neizdevās ielādēt personu sarakstu.");
    expect(text).toContain("Mēģināt vēlreiz");
  });

  it("pēc ielādes neko nerāda", () => {
    expect(renderText(<StaffListPlaceholder state="ready" onRetry={() => undefined} />)).toBe("");
  });
});
