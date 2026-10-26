import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(process.cwd(), "app/admin/iriss/autoparks-v2/autoparks-v2.css"), "utf8");

describe("cenu lapas druka (FABLE F4: A4 PDF nobīdīts un nogriezts)", () => {
  it("drukas lapa piesaistīta drukas lapai, ne admin kolonnai; fons balts", () => {
    const blocks = css.split("@media print").slice(1).join("\n");
    const sheet = blocks.match(/\.ap2\.ap2\.ap2\.ap2-print\s*\{[^}]*position:\s*(\w+)/g) ?? [];
    expect(sheet.some((b) => /position:\s*fixed/.test(b))).toBe(true);
    expect(sheet.some((b) => /position:\s*absolute/.test(b))).toBe(false);
    expect(blocks).toMatch(/html,\s*body\s*\{\s*background:\s*#fff !important;/);
  });
});
