import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("public site header position", () => {
  it("is in-flow (not sticky or fixed) on phone and desktop", () => {
    const src = readFileSync(join(ROOT, "components/HeaderClient.tsx"), "utf8");
    expect(src).not.toMatch(/\bfixed\b/);
    expect(src).not.toMatch(/\bsticky\b/);
    expect(src).toMatch(/<header className=\{`relative z-\[60\] isolate w-full \$\{headerSurface\}`\}>/);
  });
});
