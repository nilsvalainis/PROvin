import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LISTING_COSTS } from "@/lib/iriss-listings-cost";
import { LISTING_SORT_STORAGE_KEY } from "@/lib/iriss-listings-list-view";
import {
  defaultIrissListPrefs,
  IRISS_LIST_PREFS_KEY,
  IRISS_LIST_PREFS_MAX_BYTES,
  isLegacyOrBloatedIrissListPrefs,
  listingCostsFor,
  migrateIrissListPrefs,
  parseIrissListPrefs,
  persistIrissListPrefs,
  serializeIrissListPrefs,
  type IrissListStorage,
} from "@/lib/iriss-listings-operator-prefs";

function memoryStorage(initial: Record<string, string> = {}): IrissListStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe("iriss list prefs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to default I parts and per-car overrides", () => {
    expect(defaultIrissListPrefs().costs).toEqual(DEFAULT_LISTING_COSTS);
    const parsed = parseIrissListPrefs(JSON.stringify({ budget: 18000, costOv: { a: { transport: 900 } } }));
    expect(parsed.budget).toBe(18000);
    expect(listingCostsFor(parsed, "a").transport).toBe(900);
    expect(listingCostsFor(parsed, "a").fee).toBe(600);
    expect(parseIrissListPrefs("nope").budget).toBeNull();
  });

  it("keeps filters and sort, drops vehicles/photos/raw/history", () => {
    const parsed = parseIrissListPrefs(
      JSON.stringify({
        budget: 12000,
        fav: ["car-1"],
        hidden: ["car-2"],
        notes: { "car-1": "skatīties eļļu" },
        sort: "price-asc",
        sources: ["auto1"],
        priceMin: 4000,
        priceMax: 15000,
        hideTech: true,
        tab: "new",
        listScope: "fav",
        vehicles: [{ id: "car-1", imageUrls: ["https://example/a.jpg"], raw: { huge: true } }],
        photos: ["https://example/a.jpg"],
        history: [{ at: "2026-01-01" }],
        raw: "<html>lot</html>",
      }),
    );
    expect(parsed.fav).toEqual(["car-1"]);
    expect(parsed.sort).toBe("price-asc");
    expect(parsed.sources).toEqual(["auto1"]);
    expect(parsed.hideTech).toBe(true);
    const slim = JSON.parse(serializeIrissListPrefs(parsed)) as Record<string, unknown>;
    expect(slim.vehicles).toBeUndefined();
    expect(slim.photos).toBeUndefined();
    expect(slim.history).toBeUndefined();
    expect(slim.raw).toBeUndefined();
    expect(slim.notes).toEqual({ "car-1": "skatīties eļļu" });
  });

  it("flags old format and payloads over ~100 KB as bloated", () => {
    expect(isLegacyOrBloatedIrissListPrefs(JSON.stringify({ budget: 1, vehicles: [] }))).toBe(true);
    expect(isLegacyOrBloatedIrissListPrefs(JSON.stringify({ generatedAt: "x", summary: {} }))).toBe(true);
    expect(isLegacyOrBloatedIrissListPrefs(JSON.stringify({ sources: [{ id: "s1", sourceUrl: "https://x" }] }))).toBe(true);
    expect(isLegacyOrBloatedIrissListPrefs(JSON.stringify({ budget: 1, fav: ["a"] }))).toBe(false);
    const huge = JSON.stringify({ budget: 1, notes: { x: "n".repeat(IRISS_LIST_PREFS_MAX_BYTES + 10) } });
    expect(isLegacyOrBloatedIrissListPrefs(huge)).toBe(true);
  });

  it("migrates bloated v4 by deleting it and writing only settings", () => {
    const raw = JSON.stringify({
      budget: 19000,
      fav: ["keep-me"],
      notes: { "keep-me": "ok" },
      vehicles: [{ id: "keep-me", imageUrl: "https://cdn/x.jpg", priceHistory: [{ at: "2026-01-01", from: 1, to: 2 }] }],
      raw: "blob".repeat(200),
    });
    const storage = memoryStorage({ [IRISS_LIST_PREFS_KEY]: raw });
    const prefs = migrateIrissListPrefs(storage);
    expect(prefs.budget).toBe(19000);
    expect(prefs.fav).toEqual(["keep-me"]);
    const written = storage.map.get(IRISS_LIST_PREFS_KEY);
    expect(written).toBeTruthy();
    expect(written && written.length < raw.length).toBe(true);
    expect(written).not.toContain("vehicles");
    expect(written).not.toContain("https://cdn/x.jpg");
    expect(isLegacyOrBloatedIrissListPrefs(written)).toBe(false);
  });

  it("moves legacy sort key into v4 and removes it", () => {
    const storage = memoryStorage({
      [IRISS_LIST_PREFS_KEY]: JSON.stringify({ budget: 8000 }),
      [LISTING_SORT_STORAGE_KEY]: "km-desc",
    });
    const prefs = migrateIrissListPrefs(storage);
    expect(prefs.sort).toBe("km-desc");
    expect(storage.map.has(LISTING_SORT_STORAGE_KEY)).toBe(false);
    expect(storage.map.get(IRISS_LIST_PREFS_KEY)).toContain("km-desc");
  });

  it("recovers from QuotaExceededError without throwing", () => {
    const map = new Map<string, string>([[IRISS_LIST_PREFS_KEY, JSON.stringify({ vehicles: [{ id: "old" }] })]]);
    const quota = new DOMException("quota", "QuotaExceededError");
    let failOnce = true;
    const storage: IrissListStorage = {
      getItem: (key) => map.get(key) ?? null,
      removeItem: (key) => {
        map.delete(key);
      },
      setItem: (key, value) => {
        if (failOnce) {
          failOnce = false;
          throw quota;
        }
        map.set(key, value);
      },
    };
    expect(() => persistIrissListPrefs(storage, { ...defaultIrissListPrefs(), budget: 5000, fav: ["a"] })).not.toThrow();
    expect(map.get(IRISS_LIST_PREFS_KEY)).toContain("5000");
    expect(map.get(IRISS_LIST_PREFS_KEY)).not.toContain("vehicles");
  });

  it("caps serialized prefs at ~100 KB by dropping damage then notes", () => {
    const prefs = defaultIrissListPrefs();
    prefs.budget = 9000;
    prefs.fav = ["keep"];
    for (let i = 0; i < 80; i++) {
      prefs.notes[`id-${i}`] = "n".repeat(2000);
      prefs.damageLv[`id-${i}`] = "d".repeat(4000);
    }
    const json = serializeIrissListPrefs(prefs);
    expect(Buffer.byteLength(json, "utf8")).toBeLessThanOrEqual(IRISS_LIST_PREFS_MAX_BYTES);
    const parsed = parseIrissListPrefs(json);
    expect(parsed.budget).toBe(9000);
    expect(parsed.fav).toEqual(["keep"]);
    expect(Object.keys(parsed.damageLv)).toHaveLength(0);
  });

  it("continues without crash if retry after QuotaExceeded still fails", () => {
    const quota = new DOMException("quota", "QuotaExceededError");
    const storage: IrissListStorage = {
      getItem: () => JSON.stringify({ vehicles: [1] }),
      removeItem: () => undefined,
      setItem: () => {
        throw quota;
      },
    };
    expect(() => persistIrissListPrefs(storage, defaultIrissListPrefs())).not.toThrow();
  });
});
