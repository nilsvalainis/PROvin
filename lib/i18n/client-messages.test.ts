import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLIENT_MESSAGE_NAMESPACES,
  PARTNER_CLIENT_MESSAGE_NAMESPACES,
  pickClientMessages,
} from "./client-messages";

const ROOT = path.resolve(__dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

function clientNamespaces(): Map<string, string[]> {
  const byFile = new Map<string, string[]>();
  for (const dir of ["app", "components", "hooks", "lib"]) {
    for (const file of walk(path.join(ROOT, dir))) {
      const src = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/.test(src)) continue;
      const found = [...src.matchAll(/useTranslations\(\s*(?:["'`]([^"'`]*)["'`])?\s*\)/g)].map((m) => m[1] ?? "");
      if (found.length) byFile.set(path.relative(ROOT, file), found);
    }
  }
  return byFile;
}

describe("client i18n namespaces", () => {
  it("every client useTranslations namespace is shipped to the client", () => {
    const partnerOnly = new Set<string>(PARTNER_CLIENT_MESSAGE_NAMESPACES);
    const everywhere = new Set<string>(CLIENT_MESSAGE_NAMESPACES);
    for (const [file, namespaces] of clientNamespaces()) {
      for (const ns of namespaces) {
        expect(ns, `${file}: useTranslations() bez namespace`).not.toBe("");
        const top = ns.split(".")[0]!;
        const allowed = file.startsWith("components/b2b/") || file.includes("partneriem") || file.includes("/dev/")
          ? partnerOnly
          : everywhere;
        expect(allowed.has(top), `${file}: "${top}" nav CLIENT_MESSAGE_NAMESPACES`).toBe(true);
      }
    }
  });

  it("picks only requested namespaces", () => {
    expect(pickClientMessages({ A: { x: "1" }, B: { y: "2" } }, ["B", "C"])).toEqual({ B: { y: "2" } });
  });
});
