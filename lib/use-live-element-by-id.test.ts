import { describe, expect, it } from "vitest";
import { nextLiveElement } from "@/lib/use-live-element-by-id";

const node = (isConnected: boolean) => ({ isConnected });

describe("portāla mērķis seko līdzi lapai", () => {
  it("pirmajā reizē ņem atrasto mezglu", () => {
    const a = node(true);
    expect(nextLiveElement(null, () => a)).toBe(a);
  });
  it("ja mērķis izveidots no jauna (vecais atvienots) - pāriet uz jauno", () => {
    const old = node(false);
    const fresh = node(true);
    expect(nextLiveElement(old, () => fresh)).toBe(fresh);
  });
  it("ja mērķa uz brīdi nav (sakļauts bloks) - null, lai saturs rādās iekļauts lapā, nevis pazūd", () => {
    expect(nextLiveElement(node(false), () => null)).toBeNull();
  });
  it("nemainīgs mērķis paliek tas pats (nav liekas pārzīmēšanas)", () => {
    const a = node(true);
    expect(nextLiveElement(a, () => a)).toBe(a);
  });
});
