/**
 * A/B: vecais vs v2 teksts uz 20 zelta slotiem.
 * Noklusējums: offline no docs/fixtures/tech-risk-ab-gold.json (neraksta pasūtījumos).
 * npx tsx scripts/tech-risk-ab-harness.ts
 */
import fs from "node:fs";
import path from "node:path";
import { scoreTechRiskAbHarness, type TechRiskAbSlot } from "@/lib/admin-ai-tech-risk-ab-harness";

const root = process.cwd();
const fixturePath = path.join(root, "docs/fixtures/tech-risk-ab-gold.json");

type Fixture = { orders?: TechRiskAbSlot[] };

function loadSlots(): TechRiskAbSlot[] {
  const raw = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Fixture;
  const orders = Array.isArray(raw.orders) ? raw.orders : [];
  return orders.slice(0, 20).map((o, i) => ({
    slot: Number(o.slot) || i + 1,
    id: typeof o.id === "string" ? o.id : "",
    label: typeof o.label === "string" ? o.label : `slots ${i + 1}`,
    old: o.old,
    new: o.new,
    map: o.map,
  }));
}

const slots = loadSlots();
const result = scoreTechRiskAbHarness(slots);
const outDir = path.join(root, ".data");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "tech-risk-ab-harness.json");
fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
console.log(
  JSON.stringify(
    {
      fixture: fixturePath,
      wrote: outFile,
      readOnly: true,
      summary: result.summary,
    },
    null,
    2,
  ),
);
