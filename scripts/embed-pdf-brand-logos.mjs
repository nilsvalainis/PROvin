#!/usr/bin/env node
/**
 * Regenerates PDF_DEALER_LOGO_DATA_URI (+ wide variants) in lib/pdf-source-brand-logo-data.ts
 * from public/brand-logos/*.svg. Preserves PDF_SOURCE_LOGO_DATA_URI (CSDD, portals, etc.).
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const LOGO_DIR = join(ROOT, "public", "brand-logos");
const OUT = join(ROOT, "lib", "pdf-source-brand-logo-data.ts");

function svgDataUri(filePath) {
  const svg = readFileSync(filePath, "utf8").trim();
  const b64 = Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${b64}`;
}

function primarySlugs() {
  return readdirSync(LOGO_DIR)
    .filter((f) => f.endsWith(".svg") && !f.includes("-wide"))
    .map((f) => f.replace(/\.svg$/, ""))
    .sort();
}

function wideSlugs() {
  return readdirSync(LOGO_DIR)
    .filter((f) => f.endsWith("-wide.svg"))
    .map((f) => f.replace(/-wide\.svg$/, ""))
    .sort();
}

const existing = readFileSync(OUT, "utf8");
const sourceMatch = existing.match(
  /export const PDF_SOURCE_LOGO_DATA_URI = \{[\s\S]*?\} as const;/,
);
if (!sourceMatch) {
  console.error("Could not find PDF_SOURCE_LOGO_DATA_URI in", OUT);
  process.exit(1);
}

const dealerEntries = primarySlugs().map((slug) => {
  const uri = svgDataUri(join(LOGO_DIR, `${slug}.svg`));
  return `  "${slug}": "${uri}",`;
});

const wideEntries = wideSlugs().map((slug) => {
  const uri = svgDataUri(join(LOGO_DIR, `${slug}-wide.svg`));
  return `  "${slug}": "${uri}",`;
});

const out = `/**
 * PDF source-section brand marks (print opens about:blank).
 * PNGs: public/brand/*-logo.png. Dealer SVGs: public/brand-logos/*.svg.
 * Regenerate dealer URIs: node scripts/embed-pdf-brand-logos.mjs
 */
${sourceMatch[0]}

export const PDF_DEALER_LOGO_DATA_URI: Record<string, string> = {
${dealerEntries.join("\n")}
};

/** Horizontal 512×128 marks for OEM PDF header and wide slots. */
export const PDF_DEALER_LOGO_WIDE_DATA_URI: Record<string, string> = {
${wideEntries.join("\n")}
};
`;

writeFileSync(OUT, out, "utf8");
console.log(`Wrote ${OUT} (${primarySlugs().length} primary, ${wideSlugs().length} wide)`);
