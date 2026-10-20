import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iriss order search and offers layout", () => {
  it("keeps load confirm, search segments, hit actions and closed listing-link accordion", () => {
    const room = readFileSync("components/admin/IrissOrderRoom.tsx", "utf8");
    const panel = readFileSync("components/admin/IrissMarketplaceLoadPanel.tsx", "utf8");
    const css = readFileSync("app/admin/iriss/iriss-admin.css", "utf8");

    expect(room).toContain("iriss-mekletajs-view");
    expect(room).toContain("Cenas visām");
    expect(room).toContain("Cenas filtrs");
    expect(room).toContain("Sagatavot piedāvājumu");
    expect(room).toContain("Atvērt izsolē");
    expect(room).toContain("auctionUrl={auctionUrl}");
    expect(room).toContain("Nosūtīt klientam");
    expect(room).toContain("Jauns piedāvājums");
    expect(room).toContain("Jauns piedāvājums bez klienta datiem");
    expect(room).toContain("Sludinājumu saites");
    expect(room).toContain("PDF bez attēliem");
    expect(room).toContain("onFixCriteria");
    expect(room).toContain("<details");
    expect(room).not.toMatch(/<details[^>]*\sopen/);
    expect(room).not.toMatch(/sticky top-0/);
    expect(room).not.toMatch(/\u2014|\u2013/);
    expect(panel).toContain("Tirgus ielāde");
    expect(panel).toContain("IRISS_LOAD_BUSY");
    expect(panel).toContain("Ielādēt");
    expect(panel).toContain("Ielāde izslēgta (izmaksu kontrole)");
    expect(panel).toContain("Labot kritērijus");
    expect(panel).toContain("Apstiprināt ielādi");
    expect(css).toContain(".iriss-mekletajs-view");
    expect(css).toMatch(/:is\(button, a\)\[class\*="bg-\[#111827\]"\]/);
    expect(css).toContain(".iriss-ov-menu-portal");
    expect(css).toContain(".iriss-pas-hits");
    expect(css).toContain("--news-fg");
  });

  it("opens hit cards on the auction URL and portals the overflow menu", () => {
    const card = readFileSync("components/admin/IrissOrderRoomHitCard.tsx", "utf8");
    const menu = readFileSync("components/admin/IrissOverflowMenu.tsx", "utf8");
    expect(card).toContain("target=\"_blank\"");
    expect(card).toContain("rel=\"noopener\"");
    expect(card).toContain("window.open(auctionUrl, \"_blank\", \"noopener\")");
    expect(card).toContain("stopPropagation");
    expect(card).toContain("data-iriss-no-card-nav");
    expect(card).not.toMatch(/sticky top-0/);
    expect(menu).toContain("createPortal");
    expect(menu).toContain("iriss-ov-menu-portal");
    expect(menu).toContain("document.body");
    expect(menu).not.toMatch(/\u2014|\u2013/);
  });
});
