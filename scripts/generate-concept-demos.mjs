#!/usr/bin/env node
/**
 * One-shot generator: creates concept-01 … concept-30 static demo folders at repo root.
 * Run: node scripts/generate-concept-demos.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { conceptSpecs } from "./concept-specs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const pad = (n) => String(n).padStart(2, "0");

function readme({ n, title, goal, tech, features }) {
  const num = pad(n);
  return `# Concept ${num}

## Goal
${goal}

## Tech
${tech.map((t) => `- ${t}`).join("\n")}

## Features
${features.map((f) => `- ${f}`).join("\n")}

## How to run
Open \`index.html\` in a browser (double-click or via a static server). For concepts that load CDN assets (maps, charts, GSAP), use a simple static server so subresources load reliably:

\`\`\`bash
npx serve .
\`\`\`
`;
}

function wrapHtmlFixed({ n, title, body, extraHead = "" }) {
  const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const num = pad(n);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Concept ${num} — ${safeTitle}</title>
  <link rel="stylesheet" href="styles.css" />
  ${extraHead}
</head>
<body class="concept-${num}">
  <a class="skip" href="#main">Skip to content</a>
  <main id="main">
${body}
  </main>
  <script src="script.js" defer></script>
</body>
</html>`;
}

function writeConcept(n, spec) {
  const num = pad(n);
  const dir = path.join(root, `concept-${num}`);
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(dir, "assets", ".gitkeep"), "");
  fs.writeFileSync(path.join(dir, "README.md"), readme(spec));
  fs.writeFileSync(
    path.join(dir, "index.html"),
    wrapHtmlFixed({ n, title: spec.title, body: spec.html, extraHead: spec.extraHead || "" }),
  );
  fs.writeFileSync(path.join(dir, "styles.css"), spec.css.trim() + "\n");
  fs.writeFileSync(path.join(dir, "script.js"), spec.js.trim() + "\n");
}

const concepts = conceptSpecs;

export function generateAll() {
  for (const c of concepts) {
    writeConcept(c.n, c);
  }
  console.log("Wrote", concepts.length, "concept folders.");
}

const entry = process.argv[1] && path.resolve(process.argv[1]);
const self = path.resolve(fileURLToPath(import.meta.url));
if (entry === self) {
  generateAll();
}
