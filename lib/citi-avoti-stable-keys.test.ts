import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks, emptyCitiAvotiSection, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";

describe("K4 Citi avoti stabilas atslēgas", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "components/admin/AdminCitiAvotiSourceBlock.tsx"), "utf8");
  it("sekcijas vairs neizmanto key={index}", () => {
    expect(src).not.toMatch(/key=\{index\}/);
    expect(src).toMatch(/key=\{keysRef\.current\[index\]/);
  });
  it("atslēgas ir tikai UI — sekciju dati (PDF/raw) nemainās", () => {
    const blocks = createDefaultSourceBlocks();
    const s1 = { ...emptyCitiAvotiSection(), label: "A", rawUnprocessedData: "RAW A" };
    const merged = mergeSourceBlocksWithDefaults({ ...blocks, citi_avoti: { sections: [s1] } });
    const sec = merged.citi_avoti.sections[0] as Record<string, unknown>;
    expect(sec.rawUnprocessedData).toBe("RAW A");
    expect(Object.keys(sec).some((k) => /key/i.test(k))).toBe(false);
  });
});
