import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const fetchVinSource = vi.fn();
vi.mock("@/lib/vin-sources", () => ({ fetchVinSource: (...args: unknown[]) => fetchVinSource(...args) }));

import { probeMntEe } from "@/lib/vin-scan/probes";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";

describe("mnt.ee zonde", () => {
  beforeEach(() => fetchVinSource.mockReset());

  it("LV numuru nesūta kā Igaunijas regMark", async () => {
    fetchVinSource.mockResolvedValue({
      source: "mnt_ee",
      vin: "U5YH6G17GNL050102",
      found: false,
      message: "VIN nav Igaunijas transportlīdzekļu reģistrā",
      mileage: [],
      incidents: [],
      timeline: [],
      ownersSummary: "",
      statusRecords: "",
      notes: [],
      raw: "",
      fetchedAt: "",
    });
    const row = await probeMntEe({
      vin: "U5YH6G17GNL050102",
      plates: { ...emptyVinScanPlates(), lv: "AB1234" },
      listingUrl: "",
    });
    expect(fetchVinSource).toHaveBeenCalledTimes(1);
    const [, , regMark] = fetchVinSource.mock.calls[0]!;
    expect(regMark ?? "").toBe("");
    expect(row.status).toBe("none");
  });
});
