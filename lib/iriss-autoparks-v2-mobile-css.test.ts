import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../app/admin/iriss/autoparks-v2/autoparks-v2.css", import.meta.url), "utf8");

describe("Autoparks v2 mobile CSS (j63)", () => {
  it("Iegāde .ap2-kvc poga ir vismaz 44px", () => {
    expect(css).toMatch(/\.ap2-kvc button \{[\s\S]*?min-height:\s*44px/);
  });

  it("VIN zem bildes ar atdalītāju mobilajā, datorā carhead-main paliek contents", () => {
    expect(css).toMatch(/\.ap2-carhead-main \{\s*display:\s*contents;/);
    expect(css).toMatch(/\.ap2-carhead \.ap2-mvin \{[\s\S]*?border-top:\s*0\.5px solid/);
  });

  it("mobilās cilnes ir ritināmas pills, nesaspiež CSDD reģistrs", () => {
    expect(css).toMatch(/\.ap2-tabs \{\s*display:\s*flex;/);
    expect(css).toMatch(/\.ap2-tabs \{[\s\S]*?overflow-x:\s*auto;/);
    expect(css).toMatch(/\.ap2-tab \{\s*flex:\s*0 0 auto;/);
    expect(css).toMatch(/@media \(min-width: 900px\)[\s\S]*?\.ap2-tabs \{\s*display:\s*grid;/);
  });

  it("CSDD badge pie nosaukuma: 17px mobile / 20px desktop, noapaļoti stūri", () => {
    expect(css).toMatch(/\.ap2-csdd-badge \{\s*height:\s*17px;/);
    expect(css).toMatch(/\.ap2-csdd-badge \{[\s\S]*?border-radius:\s*4px;/);
    expect(css).toMatch(
      /\.ap2-files \{\s*grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\);\s*\}\s*\.ap2(?:\.ap2){2} \.ap2-csdd-badge \{\s*height:\s*20px;/,
    );
  });
});
