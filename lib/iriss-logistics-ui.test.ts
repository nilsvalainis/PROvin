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
    expect(client).toContain("IrissLogistikaCabinet");
    expect(client).toContain('onPatchOrder={(id, action) => void patchOrder(id, action)}');
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

  it("prints the current map view after tiles idle, A4 landscape, selected or all active", () => {
    const css = readFileSync("app/admin/iriss/logistika/iriss-logistika.css", "utf8");
    const printLib = readFileSync("lib/iriss-logistics-map-print.ts", "utf8");
    expect(client).toMatch(/>\s*Drukāt\s*</);
    expect(client).toContain("printCurrentMap");
    expect(client).toContain("waitForTilesIdle");
    expect(client).toContain("lockView={printing}");
    expect(client).toContain("printNumbers={printing ? printNumbers : undefined}");
    expect(client).not.toContain("printSelectedOnly");
    expect(client).not.toContain("Nav atzīmētu punktu");
    expect(client).toContain("logisticsOrdersForMapPrint");
    expect(client).toContain("Pilnekrāns");
    expect(client).toContain("IrissAuctionLogo");
    expect(client).toContain("iriss-log-print-legend");
    expect(client).toContain("iriss-log-print-root");
    expect(client).toContain("/api/admin/iriss/logistika/print");
    expect(client).not.toMatch(/sticky top-/);
    expect(client).toContain('className="iriss-log-no-print md:static"');
    expect(css).toMatch(/@page\s*\{\s*size:\s*A4 landscape/);
    expect(css).toMatch(/margin:\s*10mm/);
    expect(css).toContain("277mm");
    expect(css).toContain("170mm");
    expect(css).toContain("aspect-ratio: 8 / 7");
    expect(css).toContain("body *");
    expect(css).toContain("visibility: hidden");
    expect(css).toContain(".iriss-log-print-root");
    expect(css).toContain("iriss-log-print-legend");
    expect(css).not.toMatch(/height:\s*200px/);
    expect(printLib).toContain('bind("idle"');
    expect(printLib).toContain('bind("tilesloaded"');
    expect(printLib).toContain("logisticsPrintLegendRows");
    expect(printLib).toContain("LOGISTICS_PRINT_MAP_WIDTH_MM = 277");
    expect(printLib).not.toMatch(/staticmap/i);
    expect(map).toContain("lockView");
    expect(map).toContain("printNumbers");
    expect(map).not.toContain("printSelectedOnly");
    expect(map).toContain("waitForGoogleMapTilesIdle");
    expect(map).toContain("addListenerOnce");
    expect(map).not.toMatch(/staticmap/i);
    expect(client).not.toMatch(/staticmap/i);
    expect(client).not.toMatch(/iriss-log-print p-6/);
    expect(client).not.toContain("Klients");
  });

  it("keeps map controls in a row above an edge-to-edge map, never sticky", () => {
    const css = readFileSync("app/admin/iriss/logistika/iriss-logistika.css", "utf8");
    expect(client).toContain("iriss-log-map-toolbar");
    expect(client).toContain('className="iriss-log-print-root"');
    expect(client).not.toContain("iriss-log-print-root px-2");
    expect(client).not.toContain("px-2 pb-2");
    expect(client).not.toMatch(/sticky top-/);
    expect(css).toContain(".iriss-log-map-toolbar");
    expect(css).toMatch(/\.iriss-log-map-hero \.iriss-log-map-shell \{[\s\S]*?border-radius:\s*0/);
    expect(map).toContain('fill ? "" : "rounded-[14px]"');
  });

  it("gives the fullscreen map a sized host, then resize + fitBounds without a second Maps load", () => {
    const css = readFileSync("app/admin/iriss/logistika/iriss-logistika.css", "utf8");
    expect(css).toContain(".iriss-log-map-fs-card .iriss-log-print-root");
    expect(css).toMatch(/\.iriss-log-map-fs-card \.iriss-log-print-root \{[\s\S]*?flex:\s*1 1 auto/);
    expect(css).toMatch(/\.iriss-log-map-fs-card \.iriss-log-map-hero \{[\s\S]*?height:\s*100%/);
    expect(client).toContain("scheduleWhenElementHasBox");
    expect(client).toContain("hostEl()");
    expect(client).toContain("notifyResize");
    expect(client).toContain("fitVisible");
    expect(client).not.toMatch(/sticky top-/);
    expect(map).toContain("elementHasBox");
    expect(map).toContain("ResizeObserver");
    expect(map).toContain("hostEl:");
    const mapsConfigHits = map.match(/\/api\/admin\/iriss-logistics\/maps-config/g) ?? [];
    expect(mapsConfigHits).toHaveLength(1);
    expect(map).toContain("}, []);");
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

  it("keeps the car cabinet A/B/C with parking timer and access-aware writes", () => {
    const cabinet = readFileSync("components/admin/iriss-logistika/IrissLogistikaCabinet.tsx", "utf8");
    const domain = readFileSync("lib/iriss-logistics-cabinet.ts", "utf8");
    const timer = readFileSync("lib/iriss-logistics-parking-timer.ts", "utf8");
    expect(cabinet).toContain("CABINET_SECTION_LABEL");
    expect(cabinet).toContain("CABINET_PICKUP_STAGE_LV");
    expect(cabinet).toContain("Atzīmēt kā Atvests");
    expect(domain).toContain('A: "Iegādes dokumenti"');
    expect(domain).toContain('B: "Pick up līdz atvešanai"');
    expect(domain).toContain('C: "Pēc atvešanas"');
    expect(domain).toContain('waiting: "Gaida"');
    expect(domain).toContain('planned: "Ieplānots"');
    expect(domain).toContain('in_transit: "Ceļā"');
    expect(domain).toContain('arrived: "Atvests"');
    expect(cabinet).toContain("CABINET_LOCAL_PREFS_KEY");
    expect(cabinet).toContain("/api/admin/iriss-logistics/cabinet-prefs");
    expect(cabinet).toContain("Bezmaksas stāvvieta līdz");
    expect(cabinet).toContain("Pickup kods");
    expect(cabinet).toContain("Piezīme");
    expect(cabinet).toContain("LOGISTICS_PIPELINE_STATUSES");
    expect(cabinet).toContain("saveOrderFields");
    expect(cabinet).toContain("Izņemts");
    expect(cabinet).toContain("Piegādāts");
    expect(cabinet).toContain("logisticsParkingDeadlineTimer");
    expect(cabinet).toContain("access.write");
    expect(cabinet).toContain("access.hideSums");
    expect(cabinet).toContain("Grāmatveža piekļuve");
    expect(cabinet).toContain("access.admin");
    expect(cabinet).not.toMatch(/sticky top-/);
    expect(cabinet).not.toMatch(/\u2014/);
    expect(timer).toContain("stāvvietas termiņš beidzies");
    expect(domain).toContain("cabinet.section.");
    expect(domain).toContain("preAtvests");
    expect(domain).toContain("postAtvests");
    expect(domain).toContain("Car Invoice");
  });

  it("keeps Grāmatvede read-only, logistics hide A/invoices, and Bearer upload API", () => {
    const access = readFileSync("lib/iriss-logistics-cabinet-access.ts", "utf8");
    const roles = readFileSync("lib/staff-roles.ts", "utf8");
    const upload = readFileSync("app/api/iriss/logistics/documents/route.ts", "utf8");
    const cars = readFileSync("app/api/iriss/logistics/cars/route.ts", "utf8");
    const panel = readFileSync("components/admin/IrissCabinetAccessPanel.tsx", "utf8");
    const env = readFileSync(".env.example", "utf8");
    expect(access).toContain('if (role === "logistika")');
    expect(access).toContain('if (section === "A") return false');
    expect(access).toContain('if (role === "gramatvede")');
    expect(access).toContain("cabinetActorCanWrite");
    expect(access).toContain("cabinetActorHidesSums");
    expect(access).toContain("gramatvedeCarAssigned");
    expect(access).toContain('role === "serviss"');
    expect(panel).toContain("Auto ID");
    expect(panel).toContain("carId");
    expect(roles).toContain('id: "gramatvede"');
    expect(roles).toContain('id: "serviss"');
    expect(upload).toContain("verifyIrissLogisticsUploadToken");
    expect(upload).toContain("upsertLogisticsOrderByVin");
    expect(cars).toContain("verifyIrissLogisticsUploadToken");
    expect(cars).toContain("upsertLogisticsOrderByVin");
    expect(cars).toContain("appendCabinetAudit");
    expect(upload).not.toMatch(/process\.env\.IRISS_LOGISTICS_UPLOAD_TOKEN/);
    expect(cars).not.toMatch(/process\.env\.IRISS_LOGISTICS_UPLOAD_TOKEN/);
    expect(env).toContain("# IRISS_LOGISTICS_UPLOAD_TOKEN=");
    expect(env).toContain("POST /api/iriss/logistics/cars");
  });

  it("caps Maps v4 GeocodePlace and SearchDestinations and keeps document sha256 titles", () => {
    const quota = readFileSync("lib/iriss-logistics-maps-quota.ts", "utf8");
    const v4 = readFileSync("lib/iriss-logistics-maps-v4.ts", "utf8");
    const mapsPanel = readFileSync("components/admin/IrissLogistikaMapsUsagePanel.tsx", "utf8");
    const store = readFileSync("lib/iriss-logistics-cabinet-store.ts", "utf8");
    const domain = readFileSync("lib/iriss-logistics-cabinet.ts", "utf8");
    expect(quota).toContain("geocode_place");
    expect(quota).toContain("search_destinations");
    expect(quota).toContain("LOGISTICS_GEOCODE_PLACE_URL");
    expect(quota).toContain("/v4/geocode/places");
    expect(quota).toContain("/v4/geocode/destinations");
    expect(quota).toContain("LOGISTICS_MAPS_DAILY_CAP = 320");
    expect(v4).toContain("consumeLogisticsMapsQuota");
    expect(v4).toContain("logisticsGeocodePlaceV4");
    expect(v4).toContain("logisticsSearchDestinationsV4");
    expect(mapsPanel).toContain("GeocodePlace v4");
    expect(mapsPanel).toContain("SearchDestinations v4");
    expect(store).toContain("sha256");
    expect(store).toContain("deletedAt");
    expect(store).toContain("docNumber");
    expect(store).toContain("sourceUrl");
    expect(store).toContain("doc_number");
    expect(store).toContain("source_url");
    expect(store).toContain("softDeleteCabinetDocument");
    expect(domain).toContain("logisticsDocumentTitle");
    expect(domain).toContain("deletedAt");
    const fixture = readFileSync("scripts/iriss-logistika-kabinets-fixture.html", "utf8");
    const shot = readFileSync("scripts/iriss-logistika-kabinets-screenshot.mjs", "utf8");
    expect(fixture).not.toMatch(/sticky/);
    expect(fixture).toContain("vēl 2 d. 11 h");
    expect(fixture).toContain("id=\"pec-logistika\"");
    expect(fixture).toContain("id=\"pirms\"");
    expect(shot).toContain("width: 390");
    expect(shot).toContain("width: 1440");
  });
});
