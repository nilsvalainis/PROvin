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
});
