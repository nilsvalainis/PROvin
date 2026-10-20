import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iriss settings layout", () => {
  it("keeps grouped commission, dirty dock, one Google row and read-only limits", () => {
    const page = readFileSync("app/admin/iriss/iestatijumi/page.tsx", "utf8");
    const form = readFileSync("components/admin/IrissTameCommissionSettingsForm.tsx", "utf8");
    const google = readFileSync("components/admin/IrissGoogleContactsBackfillButton.tsx", "utf8");
    const limits = readFileSync("components/admin/IrissMarketplaceLimitsCard.tsx", "utf8");
    const copy = readFileSync("lib/iriss-iestatijumi-view.ts", "utf8");

    expect(page).toContain("AdminDashboardHeaderWithMenu");
    expect(page).toContain("iriss-iestatijumi-view");
    expect(page).not.toContain("bg-[var(--bg-base)]");
    expect(page).toContain("IrissMarketplaceLimitsCard");
    expect(page).toContain("IrissLogistikaMapsUsagePanel");
    expect(page).toContain("IrissLogistikaAuctionSourcesPanel");
    expect(page).toContain("Atvērt lietotājus");
    expect(page).toContain("settingsRow");
    expect(page).toContain("info@provin.lv");
    expect(page).not.toMatch(/#F8F8F9/);
    expect(page).not.toMatch(/sticky top-0/);
    expect(page).not.toMatch(/\u2014|\u2013/);

    expect(form).toContain("Tāmes komisija");
    expect(form).toContain("Neizdevās ielādēt saglabātās likmes. Rāda noklusējumu.");
    expect(form).toContain("IRISS_SETTINGS_DIRTY");
    expect(form).toContain("IRISS_SETTINGS_CANCEL");
    expect(form).toContain("IRISS_SETTINGS_SAVE");
    expect(form).toContain("iriss-iestatijumi-dock");
    expect(form).toContain("IrissUnsavedChangesGuard");
    expect(form).not.toMatch(/sticky top-0/);
    expect(form).not.toMatch(/\u2014|\u2013/);

    expect(copy).toContain("Nesaglabātas izmaiņas");
    expect(copy).toContain("Atcelt");
    expect(copy).toContain("Saglabāt");
    expect(copy).toContain("Saglabā...");
    expect(copy).toContain("Saglabāts.");
    expect(copy).toContain("Saglabāšana neizdevās.");
    expect(copy).toContain("formatMarketplaceUsd");
    expect(copy).toContain("Ielāde izslēgta (izmaksu kontrole)");

    expect(limits).toContain("Sludinājumu ielādes limiti · tikai lasāmi");
    expect(limits).toContain("Mēneša griesti");
    expect(limits).toContain("Griesti vienai ielādei");
    expect(limits).toContain("Ielāde");
    expect(limits).not.toMatch(/<input/);
    expect(limits).not.toMatch(/\u2014|\u2013/);

    expect(google).toContain("Sinhronizēt klientus");
    expect(google).toContain("settingsRow");
    expect(google).toContain("Piesaista esošos IRISS klientus kontam info@provin.lv");
    expect(page).toContain("Piesaista IRISS pasūtījumu klientus. Esošos kontaktus nepārraksta.");
    expect(page).not.toContain("Piesaista esošos IRISS klientus kontam info@provin.lv");
  });
});
