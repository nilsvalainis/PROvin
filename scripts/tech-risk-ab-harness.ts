/**
 * A/B: vecais vs v2 teksts uz 20 zelta slotiem.
 * Noklusējums: offline no docs/fixtures/tech-risk-ab-gold.json (neraksta pasūtījumos).
 * npx tsx scripts/tech-risk-ab-harness.ts
 */
import fs from "node:fs";
import path from "node:path";
import { scoreTechRiskAbHarness, type TechRiskAbSlot } from "@/lib/admin-ai-tech-risk-ab-harness";

const root = process.cwd();
/** `--fixture=/abs/ab-fixture.json` (ārpus repo, ar zeltu) vai repo paraugs. */
const fixtureArg = process.argv.find((a) => a.startsWith("--fixture="))?.slice("--fixture=".length);
const fixturePath = fixtureArg || path.join(root, "docs/fixtures/tech-risk-ab-gold.json");
const outArg = process.argv.find((a) => a.startsWith("--out="))?.slice("--out=".length);

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
    dealerFacts: o.dealerFacts ?? null,
    gold: typeof o.gold === "string" ? o.gold : undefined,
  }));
}

const slots = loadSlots();
const result = scoreTechRiskAbHarness(slots);
const outFile = outArg || path.join(root, ".data", "tech-risk-ab-harness.json");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
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
