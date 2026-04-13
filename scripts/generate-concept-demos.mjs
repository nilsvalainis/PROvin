#!/usr/bin/env node
/**
 * One-shot generator: creates concept-01 … concept-30 under public/concept-demos/ (served by Next.js).
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
In development/production, open \`/concept-demos/concept-${num}/\` from the PROVIN site, or open \`public/concept-demos/concept-${num}/index.html\` locally. For CDN-heavy concepts, prefer the deployed or \`next dev\` origin (not \`file://\`).

\`\`\`bash
npm run dev
# then visit http://localhost:3000/concept-demos/concept-${num}/
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

const publicConceptRoot = path.join(root, "public", "concept-demos");

function writeConcept(n, spec) {
  const num = pad(n);
  const dir = path.join(publicConceptRoot, `concept-${num}`);
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
  fs.mkdirSync(publicConceptRoot, { recursive: true });
  for (const c of concepts) {
    writeConcept(c.n, c);
  }
  const manifest = concepts.map((c) => ({
    id: `concept-${pad(c.n)}`,
    n: c.n,
    title: c.title,
  }));
  fs.writeFileSync(path.join(publicConceptRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log("Wrote", concepts.length, "concept folders under public/concept-demos/");
}

const entry = process.argv[1] && path.resolve(process.argv[1]);
const self = path.resolve(fileURLToPath(import.meta.url));
if (entry === self) {
  generateAll();
}
