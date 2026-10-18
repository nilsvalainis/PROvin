import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminB2bPartnerEditForm } from "@/components/admin/AdminB2bPartnerEditForm";
import { hasLegacyB2bCredits } from "@/lib/admin-b2b-partner-form";
import type { B2bPartnerPublicProfile } from "@/lib/b2b-partner-account";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

const partner = {
  id: "ptr_0123456789abcdef",
  companyName: "Salons",
  companyReg: "40000000000",
  companyAddress: "Rīga",
  contactName: "Jānis",
  email: "salons@example.lv",
  phone: "+37120000000",
  status: "active",
  dealerEnabled: true,
  prices: null,
} as unknown as B2bPartnerPublicProfile;

function render(credits: { business: number; dealer: number }): string {
  return renderToStaticMarkup(createElement(AdminB2bPartnerEditForm, { partner, legacyCredits: credits }));
}

describe("admin legacy credit section", () => {
  it("is hidden for partners without unused legacy credits", () => {
    expect(hasLegacyB2bCredits({ business: 0, dealer: 0 })).toBe(false);
    const html = render({ business: 0, dealer: 0 });
    expect(html).not.toContain("Vecie kredītu iepakojumi");
    expect(html).not.toContain('type="checkbox"');
  });

  it("is shown with counts and the old-credits-only checkbox while credits remain", () => {
    expect(hasLegacyB2bCredits({ business: 0, dealer: 2 })).toBe(true);
    const html = render({ business: 3, dealer: 2 });
    expect(html).toContain("Vecie kredītu iepakojumi (mantotie)");
    expect(html).toContain("Audits 3, Dīlera");
    expect(html).toContain("Atļaut veco kredītu izlietošanu Dīlera datiem (tikai mantotie kredīti)");
    expect(html).not.toContain("Rādīt Dīlera datus šim partnerim");
  });
});
