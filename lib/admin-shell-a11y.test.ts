import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

describe("admin a11y (FABLE F9 Lighthouse)", () => {
  it("PRO/IRISS pārslēgs ar saitēm nav role=tablist; neaktīvais teksts ar kontrastu >= 4.5:1", () => {
    const src = read("components/admin/AdminSidebar.tsx");
    expect(src).not.toMatch(/role="tablist" aria-label="Darba zona"/);
    expect(src).not.toContain("text-[#8e8e93] hover:text-[var(--color-apple-text)]");
  });
  it("VIN kopēšanas pogas nosaukums satur redzamo VIN", () => {
    expect(read("components/admin/iriss-autoparks-v2/ui.tsx")).toContain("aria-label={`${vin} - kopēt VIN`}");
  });
});
