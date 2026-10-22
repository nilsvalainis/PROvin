import { afterEach, describe, expect, it } from "vitest";
import { migrateIrissCriteria } from "@/lib/iriss-criteria-migrate";
import { filterToSearchFilter } from "@/lib/iriss-criteria-shared/to-search-filter";
import { buildListingPlatformChips } from "@/lib/iriss-listing-links";
import {
  DEFAULT_LISTING_COSTS,
  listingExtrasI,
  listingMaxBid,
  listingSearchPriceBounds,
  LV_VAT_RATE,
  resolveListingCosts,
} from "@/lib/iriss-listings-cost";
import { applyEcarstradeOrderCriteria, filterFromOrderFields, parseListingSearchUrl } from "@/lib/iriss-listings-ecarstrade-search";
import { listingUrlWithSearchPriceBounds } from "@/lib/iriss-listings-fresh-price";
import { currentListingSearchCosts, parseListingSearchCosts, setListingSearchCosts } from "@/lib/iriss-listings-search-costs";
import { buildIrissListingSources } from "@/lib/iriss-listings-sources";
import { marketplaceQueryFromOrder, orderSearchPriceBounds } from "@/lib/marketplace/query-from-order";

const bound = (budget: number, extras: number) => Math.round(budget - extras * (1 + LV_VAT_RATE));
const DEFAULT_I = listingExtrasI(DEFAULT_LISTING_COSTS);
const PANEL = { fee: 400, transport: 1200, commission: 1190, unplanned: 500 };
const PANEL_I = 400 + 1200 + 1190 + 500;

afterEach(() => setListingSearchCosts(null));

describe("LIST izmaksu iestatījumi meklēšanas robežām", () => {
  it("bez iestatījumiem ņem noklusējumus; daļēji iestatījumi aizpilda tikai trūkstošos laukus", () => {
    expect(currentListingSearchCosts()).toEqual(DEFAULT_LISTING_COSTS);
    expect(resolveListingCosts({ transport: 1500 })).toEqual({ ...DEFAULT_LISTING_COSTS, transport: 1500 });
    expect(parseListingSearchCosts({ fee: -5, transport: "x" })).toBeNull();
  });

  it("griesti sakrīt ar listingMaxBid (lielākais no NETO un Margin)", () => {
    const expected = Math.round(Math.max(listingMaxBid("net", 0, 20000, PANEL_I), listingMaxBid("margin", 0, 20000, PANEL_I)));
    expect(listingSearchPriceBounds({ from: null, to: 20000 }, PANEL).to).toBe(expected);
  });

  it("paneļa iestatījumi pārraksta noklusējumus visās trīs izsaukuma vietās (viens skaitlis)", () => {
    setListingSearchCosts(PANEL);
    expect(marketplaceQueryFromOrder({ brandModel: "Volvo XC60", totalBudget: "25000" }).priceTo).toBe(bound(25000, PANEL_I));
    expect(filterFromOrderFields({ brandModel: "Volvo XC60", totalBudget: "25000" }).priceTo).toBe(bound(25000, PANEL_I));
    const filter = migrateIrissCriteria({ brandModel: "Volvo XC60", totalBudget: "25000" }).filters[0]!;
    expect(filterToSearchFilter(filter).priceTo).toBe(bound(25000, PANEL_I));
    expect(bound(25000, PANEL_I)).not.toBe(bound(25000, DEFAULT_I));
  });

  it("iestatījuma maiņa maina robežas (diapazons)", () => {
    setListingSearchCosts(PANEL);
    const before = orderSearchPriceBounds({ totalBudget: "35000-40000" });
    expect(before).toEqual({ from: bound(35000, PANEL_I), to: bound(40000, PANEL_I) });
    setListingSearchCosts({ ...PANEL, transport: 2200 });
    const after = orderSearchPriceBounds({ totalBudget: "35000-40000" });
    expect(after).toEqual({ from: bound(35000, PANEL_I + 1000), to: bound(40000, PANEL_I + 1000) });
    setListingSearchCosts(null);
    expect(orderSearchPriceBounds({ totalBudget: "35000-40000" })).toEqual({ from: bound(35000, DEFAULT_I), to: bound(40000, DEFAULT_I) });
  });
});

describe("saglabātās saites ar vecām cenas robežām saņem svaigas robežas", () => {
  it("mobile.de p=20000:30000 -> budžets mīnus izmaksas", () => {
    const url = "https://suchen.mobile.de/fahrzeuge/search.html?ms=25100&p=20000%3A30000&fr=2018%3A";
    const fresh = new URL(listingUrlWithSearchPriceBounds(url, orderSearchPriceBounds({ totalBudget: "20000-30000" })));
    expect(fresh.searchParams.get("p")).toBe(bound(20000, DEFAULT_I) + ":" + bound(30000, DEFAULT_I));
    expect(fresh.searchParams.get("fr")).toBe("2018:");
  });

  it("eCarsTrade price_from=15000&price_to=22500 -> svaigas robežas, citi parametri paliek", () => {
    const url = "https://ecarstrade.com/search?mark[]=68&price_from=15000&price_to=22500&fuel[]=Diesel";
    const fresh = new URL(listingUrlWithSearchPriceBounds(url, orderSearchPriceBounds({ totalBudget: "15000-22500" })));
    expect(fresh.searchParams.get("price_from")).toBe(String(bound(15000, DEFAULT_I)));
    expect(fresh.searchParams.get("price_to")).toBe(String(bound(22500, DEFAULT_I)));
    expect(fresh.searchParams.getAll("fuel[]")).toEqual(["Diesel"]);
  });

  it("bez budžeta saite paliek kā ir; ja grīda ≤ 0, vecā grīda tiek noņemta", () => {
    const url = "https://ecarstrade.com/search?mark[]=68&price_from=15000&price_to=22500";
    expect(listingUrlWithSearchPriceBounds(url, { from: null, to: null })).toBe(url);
    const fresh = new URL(listingUrlWithSearchPriceBounds(url, orderSearchPriceBounds({ totalBudget: "4000-22500" })));
    expect(fresh.searchParams.get("price_from")).toBeNull();
    expect(fresh.searchParams.get("price_to")).toBe(String(bound(22500, DEFAULT_I)));
  });

  it("LIST sinhronizācijas avoti lieto svaigas robežas, glabātais ieraksts netiek mainīts", () => {
    const stored = "https://ecarstrade.com/search?mark[]=68&model[]=1866&price_from=15000&price_to=22500";
    const row = {
      id: "p-04dc",
      brandModel: "Volvo XC60",
      listStatus: "active" as const,
      totalBudget: "15000-22500",
      listingLinkEcarstrade: [stored],
    };
    const snapshot = JSON.stringify(row);
    setListingSearchCosts(PANEL);
    const [src] = buildIrissListingSources([row]);
    const parsed = parseListingSearchUrl(src!.sourceUrl);
    expect(parsed.priceFrom).toBe(bound(15000, PANEL_I));
    expect(parsed.priceTo).toBe(bound(22500, PANEL_I));
    expect(JSON.stringify(row)).toBe(snapshot);
  });

  it("platformu čipu saite atverot ar svaigām robežām, ievade netiek mainīta", () => {
    const links = {
      listingLinkMobile: ["https://suchen.mobile.de/fahrzeuge/search.html?ms=25100&p=20000%3A30000"],
      listingLinkAutobid: null,
      listingLinkOpenline: null,
      listingLinkAuto1: null,
      listingLinkEcarstrade: null,
      listingLinksOther: null,
      totalBudget: "20000-30000",
    };
    const snapshot = JSON.stringify(links);
    const [chip] = buildListingPlatformChips(links);
    expect(new URL(chip!.href).searchParams.get("p")).toBe(bound(20000, DEFAULT_I) + ":" + bound(30000, DEFAULT_I));
    expect(JSON.stringify(links)).toBe(snapshot);
  });

  it("ET plānošana: pasūtījuma cena aizstāj saites cenu, nevis krusto (vecā grīda nepaliek)", () => {
    const link = parseListingSearchUrl("https://ecarstrade.com/search?mark[]=68&price_from=20000&price_to=30000");
    const order = filterFromOrderFields({ brandModel: "Volvo XC60", totalBudget: "20000-30000" });
    const applied = applyEcarstradeOrderCriteria(link, order);
    expect(applied.priceFrom).toBe(bound(20000, DEFAULT_I));
    expect(applied.priceTo).toBe(bound(30000, DEFAULT_I));
    const noBudget = applyEcarstradeOrderCriteria(link, filterFromOrderFields({ brandModel: "Volvo XC60" }));
    expect(noBudget.priceFrom).toBe(20000);
    expect(noBudget.priceTo).toBe(30000);
  });
});
