import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generate = vi.fn();
let anthropicKey: string | null = null;
vi.mock("@/lib/admin-ai-dispatch", () => ({
  hasAnyAdminAiProviderKey: () => true,
  adminGenerateJsonText: (opts: { modelTier?: string; userPrompt?: string }) => generate(opts),
}));
vi.mock("@/lib/admin-ai", () => ({
  getAnthropicApiKeyFromEnv: () => anthropicKey,
}));

import {
  ensureDealerServiceWorksLatvian,
  translateOneautoWorksOnIngest,
  translateOneautoWorksWithAi,
} from "@/lib/admin-ai-oneauto-translate";
import { countUntranslatedDealerWorkRows } from "@/lib/dealer-admin-service-rows";
import { oneautoWorksNeedLvTranslation } from "@/lib/oneauto-dealer";

const R = "\uFFFD";

const OPEL_ROWS = [
  { date: "14.03.2023", odometer: "41200", location: "Opel Wien", works: `SICHERHEITSPRFG ${R} 57` },
  { date: "02.11.2022", odometer: "36500", location: "Opel Wien", works: `MOTOR${R}L\n${R}LFILTER` },
  { date: "05.04.2022", odometer: "30100", location: "Opel Wien", works: `R${R}DERWECHSEL` },
  { date: "20.09.2021", odometer: "22000", location: "Opel Wien", works: `W${R}-AE` },
  { date: "20.09.2021", odometer: "22000", location: "Opel Wien", works: "REIFENDRUCK Tansmitter _ _." },
];

describe("vācu dīlera rindas ieslēdz LV tulkojumu", () => {
  it("atpazīst vācu darbus, arī ar pazaudētiem umlautiem", () => {
    for (const row of OPEL_ROWS) expect(oneautoWorksNeedLvTranslation(row.works)).toBe(true);
    expect(oneautoWorksNeedLvTranslation("Bremsflüssigkeit erneuert")).toBe(true);
    expect(oneautoWorksNeedLvTranslation("Inspektion mit Ölwechsel")).toBe(true);
    expect(countUntranslatedDealerWorkRows(OPEL_ROWS)).toBe(OPEL_ROWS.length);
  });

  it("latviskas rindas netulko atkārtoti", () => {
    for (const lv of ["Dzinēja eļļas maiņa", "Riteņu maiņa", "Tehniskā drošības pārbaude (§ 57)", "Kontrollampa"]) {
      expect(oneautoWorksNeedLvTranslation(lv)).toBe(false);
    }
  });
});

describe("tulkojuma izsaukums", () => {
  beforeEach(() => {
    generate.mockReset();
    anthropicKey = null;
  });

  it("pirms PDF pārtulko Opel rindas ar Gemini Smart un nosūta salabotu tekstu", async () => {
    generate.mockImplementation(async (opts: { modelTier?: string; userPrompt?: string }) => {
      expect(opts.modelTier).toBe("gemini-flash");
      expect(opts.userPrompt).toContain("MOTORÖL");
      expect(opts.userPrompt).toContain("§ 57");
      expect(opts.userPrompt).not.toContain("Tansmitter");
      return JSON.stringify({
        works: [
          "Periodiskā drošības pārbaude (§ 57a)",
          "Dzinēja eļļas maiņa\nEļļas filtra maiņa",
          "Riteņu maiņa",
          "Riepu spiediena devēja pārbaude",
          "Riepu spiediena devējs",
        ],
      });
    });
    const r = await ensureDealerServiceWorksLatvian({ serviceWorks: OPEL_ROWS });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(r.translatedCount).toBe(OPEL_ROWS.length);
    expect(r.serviceWorks.map((x) => x.works).join("\n")).not.toMatch(/MOTOR|DERWECHSEL|\uFFFD/);
  });

  it("ielādē (ingest) vācu laika līniju pārtulko automātiski", async () => {
    generate.mockResolvedValue(JSON.stringify({ works: ["Riteņu maiņa"] }));
    const out = await translateOneautoWorksOnIngest({
      equipment: [],
      powertrain: [],
      serviceTimeline: [{ date: "05.04.2022", odometer: "30100", place: "Opel", works: `R${R}DERWECHSEL` }],
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(out.serviceTimeline[0]!.works).toBe("Riteņu maiņa");
  });

  it("„Pārtulkot šo rindu”: Gemini kļūmes gadījumā izmanto Sonnet rezervi", async () => {
    anthropicKey = "sk-test";
    generate.mockImplementation(async (opts: { modelTier?: string }) => {
      if (opts.modelTier === "gemini-flash") throw new Error("missing_gemini_key");
      expect(opts.modelTier).toBe("flash");
      return JSON.stringify({ works: ["Dzinēja eļļas maiņa"] });
    });
    const out = await translateOneautoWorksWithAi({
      display: {
        equipment: [],
        powertrain: [],
        serviceTimeline: [{ date: "02.11.2022", odometer: "36500", place: "Opel", works: `MOTOR${R}L` }],
      },
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(out.serviceTimeline[0]!.works).toBe("Dzinēja eļļas maiņa");
  });

  it("bez Anthropic atslēgas Gemini kļūda paliek kļūda (bez klusas maiņas)", async () => {
    generate.mockRejectedValue(new Error("upstream"));
    await expect(
      translateOneautoWorksWithAi({
        display: {
          equipment: [],
          powertrain: [],
          serviceTimeline: [{ date: "02.11.2022", odometer: "36500", place: "Opel", works: `MOTOR${R}L` }],
        },
      }),
    ).rejects.toThrow("upstream");
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
