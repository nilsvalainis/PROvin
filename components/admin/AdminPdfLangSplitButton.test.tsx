import { describe, expect, it } from "vitest";

import {
  AdminPdfClientLangContext,
  AdminPdfLangSplitButton,
  resolveSplitPrimaryLang,
} from "@/components/admin/AdminPdfLangSplitButton";
import { toAdminOrderDetailClientModel } from "@/lib/admin-order-detail-client-model";
import { resolveOrderClientLang } from "@/lib/email/client-lang-email-copy";
import { renderHtml } from "@/lib/test-render";

const noop = () => undefined;

function button(clientLang: "lv" | "en" | "ru" | "de" | null, lockLang: "lv" | "en" | "ru" | "de" | null = null) {
  return renderHtml(
    <AdminPdfClientLangContext.Provider value={clientLang}>
      <AdminPdfLangSplitButton label="Ģenerēt PDF" toneClass="" lockLang={lockLang} onPrimary={noop} onLang={noop} />
    </AdminPdfClientLangContext.Provider>,
  );
}

describe("Klienta valoda pasūtījumā (Nils 27.11)", () => {
  it("pasūtījuma modelis nodod Stripe session.locale", () => {
    expect(toAdminOrderDetailClientModel({ id: "cs_1", locale: "EN" }).locale).toBe("en");
    expect(toAdminOrderDetailClientModel({ id: "cs_1" }).locale).toBeUndefined();
  });

  it("valoda: partnera izvēle > vietnes valoda > LV", () => {
    expect(resolveOrderClientLang({ notes: null, locale: "en" })).toBe("en");
    expect(resolveOrderClientLang({ notes: null, locale: "auto" })).toBe("lv");
    expect(resolveOrderClientLang({ notes: null, locale: null })).toBe("lv");
  });

  it("primārā PDF poga: partnera fiksācija > klienta valoda > LV", () => {
    expect(resolveSplitPrimaryLang(null, "en")).toBe("en");
    expect(resolveSplitPrimaryLang("de", "en")).toBe("de");
    expect(resolveSplitPrimaryLang(null, null)).toBe("lv");
    expect(resolveSplitPrimaryLang(null, "lv")).toBe("lv");
  });

  it("EN klientam primārā poga rāda klienta valodu; LV klientam - kā līdz šim", () => {
    expect(button("en")).toContain("Klienta valoda: EN");
    expect(button("en")).toContain("LV, EN, RU, DE");
    expect(button("lv")).not.toContain("Klienta valoda");
    expect(button(null)).toContain("EN, RU, DE");
    expect(button(null)).not.toContain("LV, EN, RU, DE");
  });

  it("partnera fiksētā valoda paliek noteicošā", () => {
    const html = button("en", "de");
    expect(html).toContain("Pasūtījumā izvēlēta DE");
    expect(html).not.toContain("Klienta valoda");
  });
});
