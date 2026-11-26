import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/meta-pixel", () => ({ followStripeCheckoutUrl: () => true, trackMetaLead: () => undefined }));

import { ClientLinkForm } from "@/components/client-link/ClientLinkForm";
import { ClientLinkNeutralPage } from "@/components/client-link/ClientLinkNeutralPage";
import type { ClientLinkPublicView } from "@/lib/client-link";
import { renderHtml, renderText } from "@/lib/test-render";

const view = (lang: ClientLinkPublicView["lang"]): ClientLinkPublicView => ({
  productName: "PROVIN AUDITS",
  amountCents: 9999,
  expiresAt: "2026-11-28T10:00:00.000Z",
  require: { email: true, vin: true, listingUrl: true, phone: true },
  prefillVin: "",
  prefillListingUrl: "",
  prefillEmail: "",
  prefillPhone: "",
  lang,
});

describe("klienta saites lapa klienta valodā", () => {
  it("LV kā līdz šim", () => {
    const t = renderText(<ClientLinkForm token="k70mTokenValue______" view={view("lv")} />);
    expect(t).toContain("Iesniegt un maksāt");
    expect(t).toContain("Kopā apmaksai");
    expect(renderHtml(<ClientLinkForm token="k70mTokenValue______" view={view("lv")} />)).toContain('href="/lv/lietosanas-noteikumi"');
  });

  it.each([
    ["en", "Submit and pay", "Total to pay"],
    ["ru", "Отправить и оплатить", "Итого к оплате"],
    ["de", "Absenden und bezahlen", "Gesamtbetrag"],
  ] as const)("%s: viss teksts tulkots, juridiskās saites valodā", (lang, submit, total) => {
    const html = renderHtml(<ClientLinkForm token="k70mTokenValue______" view={view(lang)} />);
    const t = renderText(<ClientLinkForm token="k70mTokenValue______" view={view(lang)} />);
    expect(t).toContain(submit);
    expect(t).toContain(total);
    expect(t).toContain("99,99 €");
    expect(t).not.toMatch(/Iesniegt|Apmaksa|Jūsu dati|Tālrunis|Sludinājuma|Droša|derīga/);
    expect(html).toContain(`href="/${lang}/lietosanas-noteikumi"`);
    expect(html).toContain(`href="/${lang}/privatuma-politika"`);
    expect(html).toContain(`lang="${lang}"`);
  });

  it("nederīgas saites lapa saites valodā", () => {
    expect(renderText(<ClientLinkNeutralPage />)).toContain("Saite nav derīga");
    expect(renderText(<ClientLinkNeutralPage lang="en" />)).toContain("Link not valid");
    expect(renderText(<ClientLinkNeutralPage lang="de" />)).toContain("Link ungültig");
  });
});
