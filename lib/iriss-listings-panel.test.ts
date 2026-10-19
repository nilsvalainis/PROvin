import { describe, expect, it } from "vitest";

import type { IrissListingPlatformIngestStat } from "@/lib/iriss-listings-ingest-stats";
import {
  listingConnectionStatusLabel,
  listingIngestRowStatus,
  listingSourceStatusProse,
  listingSyncProgressLabel,
  listingVatNeedsCheck,
} from "@/lib/iriss-listings-panel";
import type { ListingVatHealth } from "@/lib/iriss-listings-vat";

function stat(partial: Partial<IrissListingPlatformIngestStat> & Pick<IrissListingPlatformIngestStat, "platform">): IrissListingPlatformIngestStat {
  return {
    sourceCount: 0,
    okCount: 0,
    vehicleCount: 0,
    status: "none",
    ...partial,
  };
}

describe("listing source status copy", () => {
  it("marks marketplace rows as manual paid and auction errors as partial", () => {
    expect(listingIngestRowStatus(stat({ platform: "mobilede", vehicleCount: 3 })).label).toBe("Tikai manuāli, maksas");
    expect(listingIngestRowStatus(stat({ platform: "autoscout24" })).okText).toBe("-");
    expect(listingIngestRowStatus(stat({ platform: "auto1", sourceCount: 33, okCount: 33, vehicleCount: 68, status: "ok" })).label).toBe("Strādā");
    expect(
      listingIngestRowStatus(stat({ platform: "ecarstrade", sourceCount: 97, okCount: 82, vehicleCount: 86, status: "fetch_failed" })),
    ).toEqual({
      label: "Daļēji, 15 kļūdas",
      okText: "82 / 97",
      autoText: "86",
    });
  });

  it("builds the diagnostics paragraph without env names", () => {
    const text = listingSourceStatusProse({
      ingest: [
        stat({ platform: "auto1", sourceCount: 33, okCount: 33, vehicleCount: 68, status: "ok" }),
        stat({ platform: "openline", sourceCount: 34, okCount: 34, vehicleCount: 48, status: "ok" }),
        stat({ platform: "autobid", sourceCount: 34, okCount: 34, vehicleCount: 13, status: "ok" }),
        stat({ platform: "ecarstrade", sourceCount: 97, okCount: 82, vehicleCount: 86, status: "fetch_failed" }),
        stat({ platform: "mobilede" }),
        stat({ platform: "autoscout24" }),
      ],
      vehicleCount: 215,
      freshCount: 66,
      priceCount: 60,
      okSources: 183,
      totalSources: 198,
    });
    expect(text).toContain("3 avoti strādā, 1 ar problēmām.");
    expect(text).toContain("eCarsTrade nolasīja 82 no 97 saitēm.");
    expect(text).toContain("Kopā 215 auto, no tiem 66 jauni un 60 ar cenu izmaiņām.");
    expect(text).toContain("183 no 198 saitēm nolasītas bez kļūdām.");
    expect(text).toContain("PVN režīms ikdienā redzams katrā kartītē.");
    expect(text).not.toContain("ECARSTRADE_USER");
    expect(text).not.toContain("env");
  });

  it("keeps connection labels monochrome and extracts sync 12/40", () => {
    expect(listingConnectionStatusLabel("ok")).toBe("Pieslēgts");
    expect(listingConnectionStatusLabel("login_required")).toBe("jāielogojas no jauna");
    expect(listingSyncProgressLabel(true, "12/40 meklējumi nolasīti")).toBe("12/40");
    expect(listingSyncProgressLabel(false, "12/40 meklējumi nolasīti")).toBeNull();
    const h = {
      stale: 1,
      missingFields: 2,
      rateMissing: 0,
      conflict: 1,
      defaultUnrecognised: 1,
    } as ListingVatHealth;
    expect(listingVatNeedsCheck(h)).toBe(5);
  });
});
