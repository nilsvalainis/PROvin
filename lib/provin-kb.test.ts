import { describe, expect, it } from "vitest";
import {
  extractKbSourceCode,
  findProvinKbEntry,
  formatMatchingProvinKbForPrompt,
  isVerifiedFileKbCostBand,
  loadProvinKbCatalog,
  parseProvinKbYaml,
} from "@/lib/provin-kb";
import { AI_TECH_RISK_V2_FEW_SHOTS } from "@/lib/admin-ai-tech-risk-v2-prompts";

describe("provin draft KB", () => {
  it("loads every yaml as draft and parses N57 šāles as a typical fault", () => {
    const catalog = loadProvinKbCatalog();
    expect(catalog).toHaveLength(10);
    expect(catalog.every((e) => e.status === "draft")).toBe(true);
    const n57 = findProvinKbEntry("N57D30O0", catalog);
    expect(n57?.code).toBe("N57D30");
    expect(n57?.faults.some((f) => /šāl/i.test(f.component))).toBe(true);
    expect(n57?.not_typical.some((t) => /šāl/i.test(t))).toBe(false);
  });

  it("parses inline maps, aliases and nested generations", () => {
    const n47 = parseProvinKbYaml(`code: N47D20
aliases: [N47D20A, "N47T (neoficiāls)"]
timing: {type: chain, position: rear}
status: draft
faults:
  - component: sadales ķēde
    km_band: {apskatīt: 120000, paaugstināts: 180000}
    probability: high
`);
    expect(n47.code).toBe("N47D20");
    expect(n47.aliases).toEqual(["N47D20A", "N47T (neoficiāls)"]);
    expect(n47.timing).toEqual({ type: "chain", position: "rear" });
    const faults = n47.faults as Array<Record<string, unknown>>;
    expect(faults[0]?.component).toBe("sadales ķēde");
    expect(faults[0]?.km_band).toEqual({ apskatīt: 120000, paaugstināts: 180000 });

    const audi = findProvinKbEntry("CRCA");
    expect(audi?.code).toBe("3.0 TDI V6");
    const volvo = findProvinKbEntry("D5244T11");
    expect(volvo?.code).toBe("D5244");
  });

  it("does not authorize EUR from draft KB even with KB: + dated", () => {
    expect(extractKbSourceCode("KB:N47D20")).toBe("N47D20");
    expect(isVerifiedFileKbCostBand({ source: "KB:N47D20", dated: "2026-09" })).toBe(false);
    expect(isVerifiedFileKbCostBand({ source: "KB:UNKNOWN", dated: "2026-09" })).toBe(false);
    expect(
      isVerifiedFileKbCostBand(
        { source: "KB:N47D20", dated: "2026-09" },
        [
          {
            code: "N47D20",
            aliases: [],
            status: "verified",
            faults: [],
            not_typical: [],
            sourceFile: "x.yaml",
            raw: { code: "N47D20", status: "verified" },
          },
        ],
      ),
    ).toBe(true);
    expect(formatMatchingProvinKbForPrompt(["N57D30"])).toMatch(/draft/);
    expect(formatMatchingProvinKbForPrompt(["N57D30"])).toMatch(/šāl/);
  });

  it("Gemini writer few-shots include cleaned 04 examples without banned tone", () => {
    expect(AI_TECH_RISK_V2_FEW_SHOTS).toMatch(/04-few-shot-paraugi/);
    expect(AI_TECH_RISK_V2_FEW_SHOTS).toMatch(/M57 ķēde ir dzinēja priekšā/);
    expect(AI_TECH_RISK_V2_FEW_SHOTS).toMatch(/H5H eļļas intervāli/);
    expect(AI_TECH_RISK_V2_FEW_SHOTS).not.toMatch(/\bobligāti\b|\bkritiski\b|netiek rekomendēts|ekspert/i);
  });
});
