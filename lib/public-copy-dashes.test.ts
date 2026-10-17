import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const UNICODE_DASH_RE = /[\u2012\u2013\u2014\u2015\u2212]/;
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function listFiles(dir: string, ext: string[]): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(path, ext);
    return ext.some((e) => entry.name.endsWith(e)) ? [path] : [];
  });
}

function listJsonFiles(dir: string): string[] {
  return listFiles(dir, [".json"]);
}

/** Copy / template / label modules shown to clients or admin operators. */
const USER_FACING_STRING_FILES = [
  ...listJsonFiles(join(REPO_ROOT, "messages")),
  join(REPO_ROOT, "lib/home-feature-breakdown.ts"),
  join(REPO_ROOT, "lib/b2b-partner-copy.ts"),
  join(REPO_ROOT, "lib/azvin-hero-copy.ts"),
  join(REPO_ROOT, "lib/azvin-mobile-services.ts"),
  join(REPO_ROOT, "lib/azvin-about-copy.ts"),
  join(REPO_ROOT, "lib/azvin-ui-copy.ts"),
  join(REPO_ROOT, "lib/google-reviews-data.ts"),
  join(REPO_ROOT, "lib/blog/posts/mobile-de-scam-48000.ts"),
  join(REPO_ROOT, "lib/email/html-templates.ts"),
  join(REPO_ROOT, "lib/email/report-ready-copy.ts"),
  join(REPO_ROOT, "lib/client-link.ts"),
  join(REPO_ROOT, "lib/dzintarzeme-pasutijums-terms-content.ts"),
  join(REPO_ROOT, "lib/admin-workspace-field-labels.ts"),
  join(REPO_ROOT, "lib/format-order-datetime.ts"),
  join(REPO_ROOT, "lib/format-money.ts"),
  join(REPO_ROOT, "lib/notify.ts"),
  join(REPO_ROOT, "lib/generate-invoice-html.ts"),
  join(REPO_ROOT, "lib/select-consultation-report-html.ts"),
  join(REPO_ROOT, "lib/carvertical-report-html.ts"),
  join(REPO_ROOT, "lib/provin-style-canon.ts"),
];

const USER_FACING_UI_DIRS = [
  join(REPO_ROOT, "components/admin"),
  join(REPO_ROOT, "app/admin"),
  join(REPO_ROOT, "components/iriss-offer-public"),
  join(REPO_ROOT, "components/home"),
  join(REPO_ROOT, "components/b2b"),
];

/**
 * Collect Unicode dashes that appear in string literals or JSX text.
 * Comments and the DASHES prohibition rule (codepoint names only) are ignored.
 */
function unicodeDashesInUserFacingSource(src: string): string[] {
  const hits: string[] = [];
  let i = 0;
  const n = src.length;
  let state: "code" | "s" | "d" | "t" = "code";
  let tmplExprDepth = 0;
  let line = 1;
  let col = 1;

  const peek = (k = 0) => (i + k < n ? src[i + k] : "");
  const bump = () => {
    if (src[i] === "\n") {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
    i += 1;
  };

  const mark = (ch: string) => {
    hits.push(`${line}:${col}:${ch}`);
  };

  while (i < n) {
    const c = src[i];
    const nxt = peek(1);

    if (state === "code") {
      if (c === "/" && nxt === "/") {
        while (i < n && src[i] !== "\n") bump();
        continue;
      }
      if (c === "/" && nxt === "*") {
        i += 2;
        col += 2;
        while (i < n && !(src[i] === "*" && peek(1) === "/")) bump();
        if (i < n) {
          bump();
          bump();
        }
        continue;
      }
      if (c === "'") {
        state = "s";
        bump();
        continue;
      }
      if (c === '"') {
        state = "d";
        bump();
        continue;
      }
      if (c === "`") {
        state = "t";
        bump();
        continue;
      }
      if (tmplExprDepth) {
        if (c === "{") tmplExprDepth += 1;
        else if (c === "}") {
          tmplExprDepth -= 1;
          if (tmplExprDepth === 0) state = "t";
        }
        bump();
        continue;
      }
      if (UNICODE_DASH_RE.test(c)) mark(c);
      bump();
      continue;
    }

    if (c === "\\" && i + 1 < n) {
      bump();
      bump();
      continue;
    }
    if (state === "t" && c === "$" && nxt === "{") {
      bump();
      bump();
      state = "code";
      tmplExprDepth = 1;
      continue;
    }
    if ((state === "s" && c === "'") || (state === "d" && c === '"') || (state === "t" && c === "`")) {
      state = "code";
      bump();
      continue;
    }
    if (UNICODE_DASH_RE.test(c)) mark(c);
    bump();
  }

  return hits;
}

describe("public copy has no Unicode dashes", () => {
  it("forbids em/en dashes in website, email, PDF and label copy files", () => {
    const hits: string[] = [];
    for (const path of USER_FACING_STRING_FILES) {
      const text = readFileSync(path, "utf8");
      const rel = relative(REPO_ROOT, path);
      if (path.endsWith(".json")) {
        if (UNICODE_DASH_RE.test(text)) hits.push(rel);
        continue;
      }
      const found = unicodeDashesInUserFacingSource(text);
      if (found.length) hits.push(`${rel} (${found.slice(0, 3).join(", ")})`);
    }
    expect(hits).toEqual([]);
  });

  it("forbids em/en dashes in admin and public UI string literals", () => {
    const hits: string[] = [];
    for (const dir of USER_FACING_UI_DIRS) {
      for (const path of listFiles(dir, [".ts", ".tsx"])) {
        const found = unicodeDashesInUserFacingSource(readFileSync(path, "utf8"));
        if (found.length) hits.push(`${relative(REPO_ROOT, path)} (${found.slice(0, 3).join(", ")})`);
      }
    }
    expect(hits).toEqual([]);
  });
});
