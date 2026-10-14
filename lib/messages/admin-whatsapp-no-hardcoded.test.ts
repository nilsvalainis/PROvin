import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

describe("admin WhatsApp buttons", () => {
  it("neimportē WHATSAPP_PREFILL_* konstantes", () => {
    const roots = ["components/admin", "app/admin"];
    const hits: string[] = [];
    for (const root of roots) {
      const dir = join(process.cwd(), root);
      for (const file of walk(dir)) {
        if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
        const rel = file.replace(process.cwd() + "/", "");
        const src = readFileSync(file, "utf8");
        if (src.includes("WHATSAPP_PREFILL_")) hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
