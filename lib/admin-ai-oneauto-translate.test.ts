import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generate = vi.fn();
vi.mock("@/lib/admin-ai-dispatch", () => ({
  hasAnyAdminAiProviderKey: () => true,
  adminGenerateJsonText: (opts: { modelTier?: string; systemInstruction?: string }) => generate(opts),
}));

import { ensureDealerServiceWorksLatvian } from "@/lib/admin-ai-oneauto-translate";
import { shouldTranslateDealerWorksBeforePdf } from "@/lib/dealer-admin-service-rows";

describe("shouldTranslateDealerWorksBeforePdf", () => {
  it("AUDITS un BUSINESS jā, OEM un ASV nē, dīlera LV jā / EN nē", () => {
    expect(shouldTranslateDealerWorksBeforePdf({})).toBe(true);
    expect(shouldTranslateDealerWorksBeforePdf({ dealerOnly: true, lang: "lv" })).toBe(true);
    expect(shouldTranslateDealerWorksBeforePdf({ dealerOnly: true })).toBe(true);
    expect(shouldTranslateDealerWorksBeforePdf({ dealerOnly: true, lang: "en" })).toBe(false);
    expect(shouldTranslateDealerWorksBeforePdf({ oem: true })).toBe(false);
    expect(shouldTranslateDealerWorksBeforePdf({ asvOnly: true })).toBe(false);
  });
});

describe("ensureDealerServiceWorksLatvian", () => {
  beforeEach(() => {
    generate.mockReset();
  });

  it("ja rindas jau latviski, AI nesauc", async () => {
    const rows = [{ date: "01.06.2023", odometer: "1000", location: "", works: "Eļļas maiņa" }];
    const r = await ensureDealerServiceWorksLatvian({ serviceWorks: rows });
    expect(generate).not.toHaveBeenCalled();
    expect(r.translatedCount).toBe(0);
    expect(r.warning).toBeNull();
    expect(r.serviceWorks[0]!.works).toBe("Eļļas maiņa");
  });

  it("tulko no oriģināla ar noklusējuma Gemini, saglabā LV serviceWorks", async () => {
    generate.mockImplementation(async (opts: { modelTier?: string; systemInstruction?: string }) => {
      expect(opts.modelTier).toBe("gemini-flash");
      expect(["flash", "pro", "lite"]).not.toContain(opts.modelTier);
      expect(opts.systemInstruction).toMatch(/meaning in workshop context/i);
      return JSON.stringify({ works: ["Pneimatiskā atspere, aizmugurē"] });
    });
    const r = await ensureDealerServiceWorksLatvian({
      serviceWorks: [{ date: "01.06.2023", odometer: "88000", location: "Volvo", works: "Pneumatic spring, rear" }],
      originalTimeline: [
        { date: "01.06.2023", odometer: "88000", place: "Volvo", works: "Pneumatic spring, rear" },
      ],
    });
    expect(r.translatedCount).toBe(1);
    expect(r.serviceWorks[0]!.works).toBe("Pneimatiskā atspere, aizmugurē");
    expect(r.warning).toBeNull();
  });

  it("kļūme neatceļ ģenerāciju un dod admin brīdinājumu", async () => {
    generate.mockRejectedValue(new Error("upstream"));
    const rows = [{ date: "01.06.2023", odometer: "88000", location: "", works: "Pneumatic spring, rear" }];
    const r = await ensureDealerServiceWorksLatvian({ serviceWorks: rows });
    expect(r.serviceWorks[0]!.works).toBe("Pneumatic spring, rear");
    expect(r.translatedCount).toBe(0);
    expect(r.warning).toMatch(/neizdevās/i);
  });
});
