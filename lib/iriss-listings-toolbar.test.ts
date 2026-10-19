import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const listClient = readFileSync("components/admin/IrissSludinajumiListClient.tsx", "utf8");
const notice = readFileSync("components/admin/IrissNewMatchNotice.tsx", "utf8");
const sidebar = readFileSync("components/admin/AdminSidebar.tsx", "utf8");
const irissNav = readFileSync("components/admin/IrissAdminSidebarNav.tsx", "utf8");
const search = readFileSync("lib/admin-global-search.ts", "utf8");
const moreMenu = readFileSync("components/admin/iriss-sludinajumi/IrissSludinajumiMoreMenu.tsx", "utf8");
const status = readFileSync("components/admin/iriss-sludinajumi/IrissSludinajumiSourceStatusPanel.tsx", "utf8");
const panelLib = readFileSync("lib/iriss-listings-panel.ts", "utf8");
const filters = readFileSync("components/admin/iriss-sludinajumi/IrissSludinajumiFiltersForm.tsx", "utf8");
const overlay = readFileSync("components/admin/iriss-sludinajumi/IrissSludinajumiOverlay.tsx", "utf8");
const card = readFileSync("components/admin/IrissListingVehicleCard.tsx", "utf8");
const specGrid = readFileSync("components/admin/IrissListingCardSpecGrid.tsx", "utf8");
const chips = readFileSync("components/admin/IrissListingOrderChips.tsx", "utf8");

describe("IRISS listings toolbar", () => {
  it("uses collapsing TopBar on the phone and a static toolbar on web", () => {
    expect(listClient).toContain("AdminMobileTopBar");
    const header = listClient.match(/data-iriss-listings-toolbar[\s\S]*?className="([^"]+)"/);
    expect(header?.[1]).toBeTruthy();
    const cls = header?.[1] ?? "";
    expect(cls).toContain("hidden");
    expect(cls).toContain("md:block");
    expect(cls).toContain("md:static");
    expect(cls).not.toContain("max-md:sticky");
  });

  it("keeps the match notice as a toolbar control with the same list action", () => {
    const toolsAt = listClient.indexOf('aria-label="Vairāk"');
    const noticeAt = listClient.indexOf("<IrissNewMatchNotice");
    expect(toolsAt).toBeGreaterThan(0);
    expect(noticeAt).toBeGreaterThan(0);
    expect(notice).toContain("Jaunas atbilstības");
    expect(notice).toContain("Aizvērt");
    expect(notice).toContain("rounded-full");
    expect(notice).not.toContain("w-full");
    expect(notice).toContain("absolute right-0 top-full");
    expect(notice).not.toContain("if (notices.length === 0) return null");
    expect(notice).toContain("disabled={empty}");
    expect(listClient).not.toMatch(/notices\.length > 0 \? \(/);
  });

  it("renames the view to Sludinājumi and keeps old search keywords", () => {
    expect(sidebar).toContain('irissList: "Sludinājumi"');
    expect(irissNav).toContain("Sludinājumi");
    expect(search).toContain('title: "Sludinājumi"');
    expect(search).toContain("klientu filtri");
  });

  it("drops source logos and paid-load controls from the panel", () => {
    expect(listClient).not.toContain("IrissAuctionLogo");
    expect(listClient).not.toContain("admin-source-logo-row");
    expect(filters).not.toContain("IrissAuctionLogo");
    expect(moreMenu).toContain("Nolasīt tagad");
    expect(moreMenu).toContain("bezmaksas avoti");
    expect(moreMenu).toContain("Izmaksu pieņēmumi");
    expect(panelLib).toContain("Tikai manuāli, maksas");
    expect(status).toContain("Pieslēgts servera iestatījumos");
    expect(status).not.toContain("ECARSTRADE_USER");
    expect(listClient).not.toContain("ECARSTRADE_USER");
    expect(listClient).toContain('writeListQuery({ view: "grid" })');
    expect(listClient).toContain("countActiveListingFilters");
    expect(status).toContain("Marža");
    expect(status).not.toMatch(/>Margin</);
    expect(overlay).toContain("overflow-auto");
    expect(status).toContain("min-w-[28rem]");
  });

  it("keeps grid specs, source labels and mobile order chips readable", () => {
    expect(specGrid).toContain('layout === "grid"');
    expect(specGrid).toContain("gap-x-4");
    expect(specGrid).toContain("whitespace-nowrap");
    expect(card).toContain("LISTING_PLATFORM_LABEL");
    expect(card).not.toContain('ecarstrade: "ECARSTRADE"');
    expect(card).toContain("flex-nowrap items-center justify-end");
    expect(chips).toContain("flex-col");
    expect(chips).toContain("sm:flex-row");
  });

  it("keeps listing card create actions on one nowrap row without Pievienot radaram", () => {
    expect(card).toContain("IrissListingCardActions");
    expect(card).not.toContain("Izveidot pasūtījumu");
    expect(card).not.toContain("Pievienot radaram");
    expect(listClient).toContain("onCreateRadar");
    expect(listClient).toContain("irissScanSeedFromListing");
    expect(listClient).toContain("listingClientMatchRows");
  });
});

