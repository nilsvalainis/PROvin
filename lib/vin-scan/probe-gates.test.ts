import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import {
  probeBidCars,
  probeBidfax,
  probeBiluppgifter,
  probeCarfaxEu,
  probeCheckcarVin,
  probeLtPolice,
  probeNicb,
  probePlcAuction,
  probePoctra,
  probeRegitra,
  probeRdw,
  probeTraficom,
  probeVegvesen,
} from "@/lib/vin-scan/probes-extra";

const ctx = {
  vin: "WBA5R1C0XLFH42873",
  plates: emptyVinScanPlates(),
  listingUrl: "",
};

describe("VIN SCAN avotu vārti bez tīkla", () => {
  afterEach(() => {
    delete process.env.VEGVESEN_API_KEY;
  });

  it("RDW bez NL numura ir needs_input un neprasa VIN $where", async () => {
    const row = await probeRdw(ctx);
    expect(row.status).toBe("needs_input");
    expect(row.summary).toMatch(/NL/);
    expect(row.openUrl).toBe("https://ovi.rdw.nl/");
  });

  it("Regitra un Traficom ir browser_only formas", async () => {
    const regitra = await probeRegitra(ctx);
    const traficom = await probeTraficom(ctx);
    expect(regitra.status).toBe("browser_only");
    expect(traficom.status).toBe("browser_only");
    expect(regitra.openUrl).toContain("pasitikrinkite-ar-transporto-priemone-neturi-apribojimu");
    expect(traficom.openUrl).toContain("tarkista-ajoneuvon-tiedot");
    expect(traficom.openUrl).not.toContain("vin=");
  });

  it("Cloudflare avoti ir from browser, bez servera 403", async () => {
    delete process.env.BILUPPGIFTER_API_KEY;
    const probes = [
      probeBidCars,
      probeBidfax,
      probeBiluppgifter,
      probeCarfaxEu,
      probeCheckcarVin,
      probeLtPolice,
      probeNicb,
      probePlcAuction,
      probePoctra,
    ];
    for (const probe of probes) {
      const row = await probe(ctx);
      expect(row.status).toBe("browser_only");
      expect(row.summary).toMatch(/from browser/);
      expect(row.summary).not.toMatch(/403|cloudflare/i);
      expect(row.openUrl).toMatch(/^https:\/\//);
    }
  });

  it("vegvesen bez VEGVESEN_API_KEY ir config_missing", async () => {
    delete process.env.VEGVESEN_API_KEY;
    const row = await probeVegvesen(ctx);
    expect(row.status).toBe("config_missing");
    expect(row.summary).toBe("vegvesen.no: nav VEGVESEN_API_KEY");
  });
});
