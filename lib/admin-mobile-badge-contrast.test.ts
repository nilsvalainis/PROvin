/**
 * FABLE 25.10: apakšējās joslas žetons ("10" uz "Vairāk") bija nelasāms - tēmas teksta pārkrāsošana
 * (`:is(span, ...) { color: inherit / #000 }`) pārspēja `.am-badge` krāsu: IRISS gaišajā pelēks uz pelēka
 * (~1,6:1), PRO gaišajā melns uz #1c1c1e (~1,2:1); IRISS tumšajā --onink #0b0c10 uz #3a3b42 (~1,7:1).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("apakšējās joslas žetona kontrasts", () => {
  it("tēmas teksta pārkrāsošana izslēdz .am-badge (bez specifiskuma maiņas)", () => {
    expect(read("app/admin/admin-mobile.css")).toMatch(
      /\.admin-ios-theme \.admin-m :is\(p, span[^)]*\):not\(:where\(\.am-badge\)\) \{\s*color: inherit;/,
    );
    expect(read("app/admin/admin-ios-theme.css")).toMatch(
      /:is\(p, span[^)]*\):not\(:where\(\.am-badge\)\) \{\s*color: #000000;/,
    );
  });

  it("IRISS tumšajā tēmā žetona teksts ir gaišs (--ink), ne --onink", () => {
    const css = read("app/admin/admin-iriss-theme.css");
    const dark = css.slice(css.indexOf('[data-admin-theme="dark"] {'));
    expect(dark.slice(0, dark.indexOf("}"))).toContain("--badge-fg: var(--ink);");
  });
});
