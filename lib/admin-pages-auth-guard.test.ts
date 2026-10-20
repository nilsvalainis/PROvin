import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ADMIN_DIR = path.resolve(__dirname, "../app/admin");
const PUBLIC_PAGES = new Set(["login/page.tsx", "uzaicinajums/[token]/page.tsx"]);

function isPageAuthGuard(line: string): boolean {
  return /await require(?:Admin|Logistics)Page\(\)/.test(line);
}

function listPages(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listPages(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

/** Funkcijas ķermeņa pirmais izteikums pēc `export default async function X(...) {` vai `generateMetadata(...)`. */
function firstStatementAfter(source: string, signature: RegExp): string | null {
  const m = signature.exec(source);
  if (!m) return null;
  let i = m.index + m[0].length;
  let depth = 1;
  while (depth > 0 && i < source.length) {
    if (source[i] === "(") depth += 1;
    else if (source[i] === ")") depth -= 1;
    i += 1;
  }
  const body = source.indexOf("{", i);
  return source.slice(body + 1).trimStart().split("\n")[0]!.trim();
}

describe("admin pages check the session before loading data", () => {
  const pages = listPages(ADMIN_DIR).filter((p) => !PUBLIC_PAGES.has(path.relative(ADMIN_DIR, p)));

  it("finds the admin pages", () => {
    expect(pages.length).toBeGreaterThan(20);
  });

  it.each(pages.map((p) => [path.relative(ADMIN_DIR, p), p]))("%s", (_rel, file) => {
    const src = fs.readFileSync(file, "utf8");
    expect(src).not.toMatch(/^["']use client["']/m);
    const first = firstStatementAfter(src, /export default async function \w*\s*\(/);
    expect(isPageAuthGuard(first ?? "")).toBe(true);
    if (/export async function generateMetadata\s*\(/.test(src)) {
      const metaFirst = firstStatementAfter(src, /export async function generateMetadata\s*\(/);
      expect(isPageAuthGuard(metaFirst ?? "")).toBe(true);
    }
  });
});
