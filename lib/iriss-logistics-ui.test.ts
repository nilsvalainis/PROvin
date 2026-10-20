import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const client = readFileSync("components/admin/iriss-logistika/IrissLogistikaClient.tsx", "utf8");
const page = readFileSync("app/admin/iriss/logistika/page.tsx", "utf8");
const sidebar = readFileSync("components/admin/AdminSidebar.tsx", "utf8");
const parseServer = readFileSync("lib/iriss-logistics-listing-parse-server.ts", "utf8");
const settings = readFileSync("app/admin/iriss/iestatijumi/page.tsx", "utf8");
const sourcesPanel = readFileSync("components/admin/iriss-logistika/IrissLogistikaAuctionSourcesPanel.tsx", "utf8");
const sourcesLib = readFileSync("lib/iriss-logistics-auction-sources.ts", "utf8");
const env = readFileSync(".env.example", "utf8");
const listApi = readFileSync("app/api/admin/iriss-logistics/route.ts", "utf8");
const orderPatch = readFileSync("app/api/admin/iriss-logistics/orders/[id]/route.ts", "utf8");
const map = readFileSync("components/admin/iriss-logistika/IrissLogistikaMap.tsx", "utf8");

describe("IRISS Loģistika UI contracts", () => {
  it("keeps header and filter chips from being sticky", () => {
    expect(client).toContain('className="iriss-log-no-print md:static"');
    expect(client).not.toMatch(/sticky top-/);
    expect(page).toContain("await requireLogisticsPage();");
    expect(page).toContain("IrissLogistikaClient");
    expect(page).toContain("canEnableTotp");
    expect(page).not.toContain("IrissLogisticsHomeClient");
  });

  it("adds Loģistika between Radars and VIN in IRISS nav", () => {
    expect(sidebar).toContain('irissLogistics: "Loģistika"');
    expect(sidebar).toContain('href: "/admin/iriss/logistika"');
    const group = sidebar.match(/items: \[I_HOME, I_LIST, I_SCAN, I_LOGISTICS, I_VIN/)?.[0] ?? "";
    expect(group).toContain("I_LOGISTICS");
  });

  it("archives with Pamodināt and default active view", () => {
    expect(client).toContain("Pamodināt");
    expect(client).toContain("LOGISTICS_DEFAULT_LIST_VIEW");
    expect(client).toContain('useState<LogisticsListView>(LOGISTICS_DEFAULT_LIST_VIEW)');
    expect(client).toContain("isLogisticsOrderActive");
    expect(client).toContain('className={`flex items-start gap-2 border-b border-[#f3f4f6] px-3 py-2.5 last:border-0 ${archived ? "opacity-55" : ""}');
    expect(client).toContain('patchOrder(o.id, "wake")');
    expect(client).toContain('patchOrder(active.id, "picked_up")');
    expect(client).toContain('patchOrder(active.id, "delivered")');
    expect(client).toContain("Nav aktīvu auto. Piegādātie ir arhīvā.");
    expect(client).toContain("Iepriekš izmantotie punkti");
    expect(client).toContain("Atvērt izsolē");
    expect(client).toContain("+ Nopirkts");
    expect(listApi).toContain("LOGISTICS_DEFAULT_LIST_VIEW");
    expect(listApi).toContain("filterLogisticsOrdersByView");
    expect(orderPatch).toContain('row.action === "wake"');
    expect(map).toContain("isLogisticsOrderArchived");
    const activeFixture = readFileSync("scripts/iriss-logistika-fixture.html", "utf8");
    const archiveFixture = readFileSync("scripts/iriss-logistika-archive-fixture.html", "utf8");
    expect(activeFixture).toContain("Visi aktīvie");
    expect(activeFixture).not.toContain("Pamodināt");
    expect(archiveFixture).toContain("Pamodināt");
    expect(archiveFixture).toContain("item archived");
  });

  it("keeps Loģistika under Vairāk, not as a fifth mobile tab", () => {
    expect(sidebar).toContain('const irissTabs: Item[] = [I_HOME, { ...I_LIST, label: "Sludinājumi" }, I_SCAN];');
    expect(sidebar).not.toMatch(/irissTabs: Item\[\] = \[[^\]]*I_LOGISTICS/);
    expect(sidebar).toContain('"/admin/iriss/logistika": "logistika"');
  });

  it("uses km only and no Apify", () => {
    expect(client).toMatch(/\bkm\b/);
    expect(client).not.toMatch(/\bmiles\b/i);
    expect(parseServer).not.toMatch(/APIFY_/);
    expect(parseServer).not.toMatch(/from ["']@\/lib\/marketplace/);
    expect(client).not.toMatch(/\u2014/);
  });

  it("exposes maps usage in Pārvaldība and documents quota keys", () => {
    expect(settings).toContain("IrissLogistikaMapsUsagePanel");
    expect(env).toContain("GOOGLE_MAPS_API_KEY");
    expect(env).toContain("GOOGLE_MAPS_SERVER_KEY");
    expect(env).toContain("HTTP referrers");
    expect(env).toContain("10 000");
  });

  it("prints the current map view after tiles idle, A4 landscape, selected points only", () => {
    const css = readFileSync("app/admin/iriss/logistika/iriss-logistika.css", "utf8");
    const printLib = readFileSync("lib/iriss-logistics-map-print.ts", "utf8");
    expect(client).toMatch(/>\s*Drukāt\s*</);
    expect(client).toContain("printCurrentMap");
    expect(client).toContain("waitForTilesIdle");
    expect(client).toContain("lockView={printing}");
    expect(client).toContain("printSelectedOnly={printing}");
    expect(client).toContain("iriss-log-print-legend");
    expect(client).toContain("iriss-log-print-root");
    expect(client).toContain("/api/admin/iriss/logistika/print");
    expect(client).not.toMatch(/sticky top-/);
    expect(client).toContain('className="iriss-log-no-print md:static"');
    expect(css).toMatch(/@page\s*\{\s*size:\s*A4 landscape/);
    expect(css).toMatch(/margin:\s*4mm/);
    expect(css).toContain("body *");
    expect(css).toContain("visibility: hidden");
    expect(css).toContain(".iriss-log-print-root");
    expect(css).toContain("iriss-log-print-legend");
    expect(printLib).toContain('bind("idle"');
    expect(printLib).toContain('bind("tilesloaded"');
    expect(printLib).toContain("logisticsPrintLegendRows");
    expect(map).toContain("lockView");
    expect(map).toContain("printSelectedOnly");
    expect(map).toContain("waitForGoogleMapTilesIdle");
    expect(map).toContain("addListenerOnce");
    expect(client).not.toMatch(/iriss-log-print p-6/);
    expect(client).not.toContain("Klients");
  });

  it("keeps an editable auction-sources list in Loģistika settings", () => {
    expect(client).toContain("IrissLogistikaAuctionSourcesPanel");
    expect(client).toContain('setPageTab("settings")');
    expect(client).toContain("Iestatījumi");
    expect(settings).toContain("IrissLogistikaAuctionSourcesPanel");
    expect(settings).toContain("Lietotāji un pieeja");
    expect(settings).toContain("/admin/iriss/iestatijumi/lietotaji");
    expect(sourcesPanel).toContain("Izsoļu avoti");
    expect(sourcesPanel).toContain("Saite (pirkumi / pasūtījumi)");
    expect(sourcesPanel).toContain("Konts");
    expect(sourcesPanel).toContain("Statuss");
    expect(sourcesPanel).toContain("Atslēgvārdi");
    expect(sourcesPanel).toContain("Jauns avots");
    expect(sourcesPanel).toContain('aria-label={`${source.name} ieslēgts`}');
    expect(sourcesPanel).not.toMatch(/APIFY_/);
    expect(sourcesLib).not.toMatch(/APIFY_/);
    expect(sourcesLib).not.toMatch(/from ["']@\/lib\/marketplace/);
    expect(sourcesLib).toContain('name: "Copart.de"');
    expect(sourcesLib).toContain("enabled: false");
  });
});
