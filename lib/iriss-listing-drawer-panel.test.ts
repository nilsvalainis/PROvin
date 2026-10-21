import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatIrissEurCents, formatIrissEurWhole } from "@/lib/iriss-price-format";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("IRISS euro formatting", () => {
  it("always groups thousands, also for 4-digit sums", () => {
    expect(formatIrissEurWhole(5500)).toBe("5 500 €");
    expect(formatIrissEurWhole(8806.6)).toBe("8 807 €");
    expect(formatIrissEurWhole(-4001)).toBe("-4 001 €");
    expect(formatIrissEurWhole(950)).toBe("950 €");
    expect(formatIrissEurWhole(1234567)).toBe("1 234 567 €");
    expect(formatIrissEurWhole(null)).toBe("-");
    expect(formatIrissEurCents(5500)).toBe("5 500,00 €");
  });
});

describe("IRISS listing side panel", () => {
  const drawer = read("components/admin/IrissListDrawer.tsx");

  it("is opaque and sits above the list toolbar with a dimmed backdrop", () => {
    expect(drawer).toContain('style={{ backgroundColor: "var(--s1, #fff)" }}');
    expect(drawer).toContain("fixed inset-0 z-[60]");
    expect(read("components/admin/IrissSludinajumiListClient.tsx")).toContain("fixed inset-0 z-[55] hidden bg-slate-900/30");
  });

  it("shows the platform label (OPENLANE, not openline) and one close X", () => {
    expect(drawer).toContain("IRISS_LISTING_PLATFORM_LABEL[v.platform]");
    expect(drawer).not.toContain('"✕"');
    expect(drawer.match(/<X className/g)?.length).toBe(1);
    expect(drawer).toContain("<EyeOff");
  });
});
