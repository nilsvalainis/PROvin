import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * IRISS dizaina pamats v0.3 (audits 26.10): kodā tieši ierakstīto krāsu skaits IRISS komponentēs
 * drīkst tikai samazināties. Jaunām krāsām - tokeni --iriss-* (app/admin/iriss-tokens.css).
 * Pārejot sadaļu uz tokeniem, samazini IRISS_HEX_CEILING līdz jaunajam skaitam.
 */
const IRISS_HEX_CEILING = 122;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx") && !p.includes(".test.")) out.push(p);
  }
  return out;
}

function irissComponentFiles(): string[] {
  const admin = path.join(process.cwd(), "components/admin");
  const top = fs
    .readdirSync(admin)
    .filter((n) => n.startsWith("Iriss") && n.endsWith(".tsx") && !n.includes(".test."))
    .map((n) => path.join(admin, n));
  const dirs = fs
    .readdirSync(admin)
    .filter((n) => n.startsWith("iriss-") && fs.statSync(path.join(admin, n)).isDirectory())
    .flatMap((n) => walk(path.join(admin, n)));
  return [...top, ...dirs, ...walk(path.join(process.cwd(), "components/iriss-piedavajumi"))];
}

describe("IRISS krāsas tikai caur tokeniem", () => {
  it("tieši ierakstīto hex krāsu skaits nepalielinās", () => {
    const hexes = new Set<string>();
    for (const f of irissComponentFiles()) {
      for (const m of fs.readFileSync(f, "utf8").matchAll(/#[0-9A-Fa-f]{6}\b/g)) hexes.add(m[0].toLowerCase());
    }
    expect(hexes.size).toBeLessThanOrEqual(IRISS_HEX_CEILING);
  });

  it("tokenu fails definē v0.3 pamata krāsas un ir ielādēts admin izkārtojumā", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "app/admin/iriss-tokens.css"), "utf8");
    expect(css).toMatch(/--iriss-brand:\s*#f26522/);
    expect(css).toMatch(/--iriss-bg:\s*#f2f2f7/);
    const layout = fs.readFileSync(path.join(process.cwd(), "app/admin/layout.tsx"), "utf8");
    expect(layout).toContain('import "./iriss-tokens.css";');
  });
});
