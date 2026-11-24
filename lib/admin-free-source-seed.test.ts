import { beforeEach, describe, expect, it, vi } from "vitest";

const priceHistory = vi.fn();
const aiSnapshot = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/listing-price-history", () => ({ fetchListingPriceHistory: (...a: unknown[]) => priceHistory(...a) }));
vi.mock("@/lib/listing-scrape-server", () => ({ fetchListingAiSnapshot: (...a: unknown[]) => aiSnapshot(...a) }));
vi.mock("@/lib/csdd-tech-data-counted", () => ({ fetchCsddTechDataCounted: vi.fn() }));
vi.mock("@/lib/vin-sources", () => ({ fetchVinSource: vi.fn() }));
vi.mock("@/lib/captcha-solver", () => ({ hasCaptchaSolverKey: () => false }));

import { computeFreeSourceSeed } from "@/lib/admin-free-source-seed";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import type { ListingAiSnapshot } from "@/lib/listing-scrape";

const SS = "https://www.ss.com/msg/lv/transport/cars/audi/a4/xxxxx.html";

function snapshot(url: string, description: string | null): ListingAiSnapshot {
  return {
    ok: true,
    url,
    host: "ss.com",
    fetchedAt: "2026-11-24T10:00:00.000Z",
    daysListed: null,
    postedDateRaw: null,
    currentKm: null,
    currentPriceEur: null,
    priceChanges: [],
    pageTitle: "Audi A4",
    description,
    options: [{ label: "Krāsa", value: "Melna" }],
    photoCount: null,
  };
}

const noHistory = { found: false, message: "nav", rows: [], durationDays: 0, oldestDate: "", newestDate: "", priceChangeEur: 0, listingUrl: null };

describe("computeFreeSourceSeed - sludinājuma apraksts", () => {
  beforeEach(() => {
    priceHistory.mockReset();
    aiSnapshot.mockReset();
    priceHistory.mockResolvedValue(noHistory);
  });

  it("tukšā laukā ieliek pārdevēja aprakstu ar rindiņām", async () => {
    aiSnapshot.mockResolvedValue(snapshot(SS, "Pārdodu Audi.\nNav sists."));
    const out = await computeFreeSourceSeed(createDefaultSourceBlocks(), { listingUrl: SS });
    expect(out.blocks.listing_analysis.listingPasteRaw).toBe("Audi A4\n\nPārdodu Audi.\nNav sists.\n\nKrāsa: Melna");
    expect(out.parts.listing).toBe("paste");
  });

  it("ar roku ievadītu tekstu nepārraksta", async () => {
    aiSnapshot.mockResolvedValue(snapshot(SS, "Cits teksts"));
    const base = createDefaultSourceBlocks();
    base.listing_analysis = { ...base.listing_analysis, listingPasteRaw: "Operatora teksts" };
    const out = await computeFreeSourceSeed(base, { listingUrl: SS });
    expect(out.blocks.listing_analysis.listingPasteRaw).toBe("Operatora teksts");
  });

  it("mobile.de lapu NEKAD neprasa (tikai vēsture)", async () => {
    const md = "https://suchen.mobile.de/fahrzeuge/details.html?id=1";
    const out = await computeFreeSourceSeed(createDefaultSourceBlocks(), { listingUrl: md });
    expect(aiSnapshot).not.toHaveBeenCalled();
    expect(out.blocks.listing_analysis.listingPasteRaw).toBe("");
  });

  it("adify.lv vēstures saiti atver līdz īstajam sludinājumam", async () => {
    aiSnapshot.mockResolvedValue(snapshot(SS, "Apraksts no ss.com"));
    await computeFreeSourceSeed(createDefaultSourceBlocks(), {
      listingUrl: `https://adify.lv/history?url=${encodeURIComponent(SS)}`,
    });
    expect(aiSnapshot).toHaveBeenCalledWith(SS);
  });

  it("klienta saitei nav apraksta - ņem jaunāko saiti no vēstures (ne mobile.de)", async () => {
    const newer = "https://www.ss.com/msg/lv/transport/cars/audi/a4/yyyyy.html";
    priceHistory.mockResolvedValue({ ...noHistory, found: true, rows: [], listingUrl: newer });
    aiSnapshot.mockImplementation(async (u: string) => snapshot(u, u === newer ? "Jaunākais apraksts" : null));
    const out = await computeFreeSourceSeed(createDefaultSourceBlocks(), { listingUrl: SS });
    expect(aiSnapshot).toHaveBeenCalledWith(newer);
    expect(out.blocks.listing_analysis.listingPasteRaw).toContain("Jaunākais apraksts");
  });
});
