/**
 * j68 (Fable F9): IRISS un Loģistikas kontrasts 2,2-3,6:1 un pieskāriena mērķi <44 px telefonā.
 * Pārbauda tēmas tokenu faktisko kontrastu pret IRISS virsmām un mobilo hit-area noteikumu esamību.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast-on-black";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

function tokenBlock(css: string, selectorStart: string): Record<string, string> {
  const start = css.indexOf(selectorStart);
  expect(start).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+):\s*#([0-9a-f]{6}|[0-9a-f]{3})\s*;/gi)) {
    const h = m[2].length === 3 ? [...m[2]].map((c) => c + c).join("") : m[2];
    out[m[1]] = `#${h}`;
  }
  return out;
}

function mobileBlocks(css: string): string {
  return css
    .split("@media (max-width: 767px)")
    .slice(1)
    .join("\n");
}

describe("j68 IRISS kontrasts", () => {
  const theme = read("app/admin/admin-iriss-theme.css");

  it("gaišajā tēmā --ink3 ir >= 4,5:1 uz fona, --s1 un --s2", () => {
    const t = tokenBlock(theme, '.admin-m[data-section="iriss"] {');
    for (const bg of [t["--bg-base"], t["--s1"], t["--s2"]]) {
      expect(contrastRatio(t["--ink3"], bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("tumšajā tēmā --ink3 ir >= 4,5:1 uz --s1 un --s2", () => {
    const t = tokenBlock(theme, '.admin-m[data-section="iriss"][data-theme="dark"]');
    for (const bg of [t["--s1"], t["--s2"]]) {
      expect(contrastRatio(t["--ink3"], bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("Loģistikas sekundārais teksts (#6e6e73) ir >= 4,5:1 uz baltā un čipa fona", () => {
    const log = tokenBlock(read("app/admin/iriss/logistika/iriss-logistika.css"), ".iriss-log-screen {");
    expect(contrastRatio("#6e6e73", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#6e6e73", log["--iriss-log-status-chip-bg"])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("j68 pieskāriena mērķi telefonā", () => {
  it("Loģistika: mazām vadīklām 44 px hit area, krāsu punkti 44x44", () => {
    const m = mobileBlocks(read("app/admin/iriss/logistika/iriss-logistika.css"));
    expect(m).toMatch(/\.iriss-log-switch[^{]*::before \{[^}]*calc\(\(100% - 44px\) \/ 2\)/);
    expect(m).toMatch(/\.iriss-log-bucket-dots button \{\s*width: 44px;\s*height: 44px;/);
  });

  it("pasūtījuma istaba: pogām, select un cilnēm min. 44 px, slēdži izņemti", () => {
    const m = mobileBlocks(read("app/admin/iriss/iriss-admin.css"));
    expect(m).toMatch(/\[data-iriss-order-room="1"\] :is\(button, select, \[role="tab"\]\):not\(\[role="switch"\]\) \{\s*min-height: 44px;/);
    expect(m).not.toMatch(/min-height: 36px !important/);
  });
});
