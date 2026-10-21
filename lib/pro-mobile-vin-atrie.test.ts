import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("PRO VIN pārbaude on phones", () => {
  const vin = read("components/admin/AdminVinScanPageClient.tsx");

  it("keeps the form and buttons 16 px from the screen edge", () => {
    expect(vin).toContain('<div className="mx-4 mt-3 overflow-hidden rounded-[18px] bg-[var(--am-s1)]');
    expect(vin).toContain('<div className="mt-3 space-y-2 px-4">');
  });

  it("keeps the agreed no-helper-text rule (see lib/vin-scan/ui-copy.test.ts)", () => {
    expect(vin).not.toContain("placeholder=");
    expect(vin).toContain('<p className="mx-4 mt-3 text-center');
  });

  it("uses primary button D and a clearly grey disabled state", () => {
    const chrome = read("components/admin/mobile/AdminMobileChrome.tsx");
    expect(chrome).toContain("bg-[var(--am-btn-primary-bg,var(--am-ink))]");
    expect(chrome).toContain("disabled:bg-[var(--fill-secondary)] disabled:text-[var(--label-secondary)]");
  });
});

describe("PRO Ātrie vērtējumi on phones", () => {
  const page = read("app/admin/(dashboard)/atras-vertesanas/page.tsx");

  it("says 'vēl nav datu' instead of 'Konversija - · 0 no 0'", () => {
    expect(page).toContain('"Konversija: vēl nav datu"');
  });

  it("keeps filters, list and empty state 16 px from the edge", () => {
    expect(read("components/admin/AdminListingPeekMobileFilters.tsx")).toContain('className={`px-4 md:hidden');
    expect(page).toContain("max-md:mx-4 max-md:space-y-2.5");
    expect(page).toContain("max-md:mx-4 max-md:border-[var(--am-hair)]");
  });
});
