/**
 * Ģenerē `data/vin-model-learned.json` no TSV ar "VIN<TAB>marka modelis ..." rindām.
 * Avots: mūsu pašu pasūtījumi, izsoļu un sludinājumu dati ar īstu VIN. Datus skriptā neglabājam.
 *
 *   npx --yes tsx scripts/vin-model-learn.ts /ceļš/pāri.tsv
 */
import { readFileSync, writeFileSync } from "node:fs";
import { learnVinModelCodes, type LearnPair } from "../lib/vin-model-learn";

const src = process.argv[2];
if (!src) {
  console.error("Lietošana: tsx scripts/vin-model-learn.ts pāri.tsv");
  process.exit(1);
}
const pairs: LearnPair[] = readFileSync(src, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    const [vin, label] = l.split("\t");
    return { vin: vin ?? "", label: label ?? "" };
  });
const table = learnVinModelCodes(pairs);
const out = "data/vin-model-learned.json";
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), pairs: pairs.length, table }, null, 2) + "\n");
const codes = Object.values(table).reduce((n, t) => n + Object.keys(t).length, 0);
console.log(`pāri: ${pairs.length}, iemācīti kodi: ${codes} -> ${out}`);
