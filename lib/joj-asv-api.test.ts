import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyAsvBlock } from "@/lib/asv-report";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/vin-scan/joj-api", () => ({
  jojApiConfigured: vi.fn(),
  fetchJojSearchVin: vi.fn(),
  JOJ_API_SOURCE_ID: "joj_copart_iaai",
}));

const VIN = "WBSAE0C06PCL70372";

describe("fetchJojAsvMerge", () => {
  beforeEach(async () => {
    vi.resetModules();
    const joj = await import("@/lib/vin-scan/joj-api");
    vi.mocked(joj.jojApiConfigured).mockReturnValue(false);
  });

  it("bez JOJ_API_KEY atgriež skipped un nemaina tabulas", async () => {
    const { fetchJojAsvMerge } = await import("@/lib/joj-asv-api");
    const prev = emptyAsvBlock();
    prev.mileage = [{ date: "01.01.2024", odometer: "10 000 km", country: "US" }];
    const out = await fetchJojAsvMerge({ vin: VIN, prev });
    expect(out.error).toBe("missing_joj_credentials");
    expect(out.block.mileage[0]?.odometer).toBe("10 000 km");
    expect(out.jojIngest.status).toBe("skipped");
  });

  it("ar mock JoJ atbildi ieraksta joj avota slāni", async () => {
    const joj = await import("@/lib/vin-scan/joj-api");
    vi.mocked(joj.jojApiConfigured).mockReturnValue(true);
    vi.mocked(joj.fetchJojSearchVin).mockResolvedValue({
      status: "found",
      summary: "Copart",
      jojFacts: {
        vehicleLine: "",
        reportDate: "",
        sales: [
          {
            date: "25.03.2026",
            venue: "Copart",
            odometer: "1 000 km",
            price: "10 000 USD",
            status: "",
          },
        ],
        damages: [],
        titles: [],
        insurance: [],
        mileage: [],
        notes: [],
      },
    });
    const { fetchJojAsvMerge } = await import("@/lib/joj-asv-api");
    const out = await fetchJojAsvMerge({ vin: VIN, prev: emptyAsvBlock() });
    expect(out.costUsd).toBe("$0.50");
    expect(out.jojIngest.status).toBe("found");
    expect(out.block.sources?.joj?.sales.some((s) => s.venue === "Copart")).toBe(true);
  });
});
