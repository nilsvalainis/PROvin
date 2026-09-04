import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const UNICODE_DASH_RE = /[\u2012\u2013\u2014\u2015\u2212]/;
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function listJsonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listJsonFiles(path);
    return entry.name.endsWith(".json") ? [path] : [];
  });
}

const PUBLIC_COPY_FILES = [
  ...listJsonFiles(join(REPO_ROOT, "messages")),
  join(REPO_ROOT, "lib/home-feature-breakdown.ts"),
  join(REPO_ROOT, "lib/b2b-partner-copy.ts"),
  join(REPO_ROOT, "lib/azvin-hero-copy.ts"),
  join(REPO_ROOT, "lib/azvin-mobile-services.ts"),
  join(REPO_ROOT, "lib/azvin-about-copy.ts"),
  join(REPO_ROOT, "lib/google-reviews-data.ts"),
  join(REPO_ROOT, "lib/blog/posts/mobile-de-scam-48000.ts"),
  join(REPO_ROOT, "lib/email/html-templates.ts"),
];

describe("public copy has no Unicode dashes", () => {
  it("forbids em/en dashes in website and product copy files", () => {
    const hits: string[] = [];
    for (const path of PUBLIC_COPY_FILES) {
      const text = readFileSync(path, "utf8");
      if (UNICODE_DASH_RE.test(text)) hits.push(path.replace(`${REPO_ROOT}/`, ""));
    }
    expect(hits).toEqual([]);
  });
});
