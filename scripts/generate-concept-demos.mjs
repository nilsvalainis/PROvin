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
Each page loads **Tailwind CSS** from the official CDN plus a small companion \`styles.css\` for bespoke visuals. Asset URLs are **root-relative** (\`/concept-demos/concept-${num}/…\`) so CSS/JS load even without a trailing slash on the folder URL.

In development/production, open \`/concept-demos/concept-${num}/\` from the PROVIN site. For CDN-heavy concepts (maps, charts, video), prefer the deployed or \`next dev\` origin (not \`file://\`).

\`\`\`bash
npm run dev
# then visit http://localhost:3000/concept-demos/concept-${num}/
\`\`\`
`;
}

function escapeHtmlAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Drop redundant universal box-sizing; Tailwind preflight already sets border-box. */
function compactCss(css) {
  let s = String(css).trim();
  s = s.replace(/\*\s*\{\s*box-sizing:\s*border-box;\s*\}\s*/g, "");
  s = s.replace(/\*\{\s*box-sizing:\s*border-box;\s*\}\s*/g, "");
  s = s.replace(/\*\{\s*box-sizing:\s*border-box\s*\}\s*/g, "");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Tailwind CDN + root-relative asset URLs so CSS/JS load even when the URL has no trailing slash.
 * Optional `shellTw` wraps body HTML (default: full-width shell). Set `shellTw: null` on a spec to omit.
 */
function wrapHtmlFixed({ n, title, body, extraHead = "", shellTw, bodyClass = "" }) {
  const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const num = pad(n);
  const assetBase = `/concept-demos/concept-${num}`;
  const useShell = shellTw !== null && shellTw !== false;
  const shellClasses = escapeHtmlAttr(
    shellTw === undefined || shellTw === "" ? "min-h-screen w-full" : String(shellTw),
  );
  const inner = useShell
    ? `  <div id="demo-shell" class="${shellClasses}">\n${body}\n  </div>`
    : body;
  const bodyClasses = ["min-h-screen", "antialiased", `concept-${num}`, bodyClass].filter(Boolean).join(" ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Concept ${num} — ${safeTitle}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="${assetBase}/styles.css" />
  ${extraHead}
</head>
<body class="${escapeHtmlAttr(bodyClasses)}">
  <a href="#main" class="absolute -left-[9999px] top-0 z-50 overflow-hidden whitespace-nowrap focus:left-4 focus:top-4 focus:h-auto focus:w-auto focus:overflow-visible focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-black">Skip to content</a>
  <main id="main" class="relative isolate min-h-screen w-full">
${inner}
  </main>
  <script src="${assetBase}/script.js" defer></script>
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
    wrapHtmlFixed({
      n,
      title: spec.title,
      body: spec.html,
      extraHead: spec.extraHead || "",
      shellTw: "shellTw" in spec ? spec.shellTw : "min-h-screen w-full",
      bodyClass: spec.bodyClass || "",
    }),
  );
  fs.writeFileSync(path.join(dir, "styles.css"), compactCss(spec.css) + "\n");
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
