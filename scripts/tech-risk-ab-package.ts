/**
 * A/B: apvieno slotus + ģenerētos tekstus harness fikstūrā un sagatavo IRISS aklo vērtēšanas paku.
 * Viss tiek rakstīts ārpus repo (klientu dati).
 *
 * npx tsx scripts/tech-risk-ab-package.ts --slots=/abs/slots.json --generated=/abs/ab-generated.json \
 *   --out-dir=/abs/iriss-pack --private-dir=/abs/ab-private
 *
 * IRISS pakā (--out-dir) tikai vertesana.html + vertejumi.csv + LASIMANI.txt.
 * --private-dir (ne IRISS): ab-fixture.json (harness, ar zeltu) un atslega.json (kurš ir v2).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function arg(name: string): string {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : "";
}
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Slot = { slot: number; label: string; sessionId: string; vin?: string; gold?: string };
type Arm = { text?: string; map?: unknown; error?: string };

const slots = (JSON.parse(fs.readFileSync(arg("slots"), "utf8")) as { orders: Slot[] }).orders;
const gen = JSON.parse(fs.readFileSync(arg("generated"), "utf8")) as { results?: Record<string, { old?: Arm; new?: Arm }> };
const outDir = arg("out-dir");
const privDir = arg("private-dir");
if (!privDir || path.resolve(privDir) === path.resolve(outDir || "")) throw new Error("--private-dir jābūt atsevišķam no IRISS pakas");
if (!outDir || path.resolve(outDir).startsWith(process.cwd() + path.sep)) throw new Error("--out-dir jābūt ārpus repo");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(privDir, { recursive: true });

const fixture = slots.map((s) => {
  const r = gen.results?.[String(s.slot)] ?? {};
  return { slot: s.slot, id: s.sessionId, label: s.label, old: r.old?.text ?? "", new: r.new?.text ?? "", map: r.new?.map ?? null, gold: s.gold ?? "" };
});
fs.writeFileSync(path.join(privDir, "ab-fixture.json"), JSON.stringify({ orders: fixture }, null, 1));

const key: Record<string, { A: "old" | "new"; B: "old" | "new"; sessionId: string }> = {};
const order = [...fixture].filter((f) => f.old && f.new);
for (let i = order.length - 1; i > 0; i--) {
  const j = crypto.randomInt(i + 1);
  [order[i], order[j]] = [order[j]!, order[i]!];
}
const cards = order.map((f, idx) => {
  const n = idx + 1;
  const newIsA = crypto.randomInt(2) === 0;
  key[String(n)] = { A: newIsA ? "new" : "old", B: newIsA ? "old" : "new", sessionId: f.id };
  const a = newIsA ? f.new : f.old;
  const b = newIsA ? f.old : f.new;
  const vin = slots.find((s) => s.slot === f.slot)?.vin ?? "";
  return `<section><h2>Pāris ${n}: ${esc(f.label)} <small>${esc(vin)}</small></h2>
<div class="row"><div class="col"><h3>A</h3><pre>${esc(a)}</pre></div><div class="col"><h3>B</h3><pre>${esc(b)}</pre></div></div></section>`;
});
const html = `<!doctype html><meta charset="utf-8"><title>PROVIN tehnisko risku A/B (akls)</title>
<style>body{font:14px system-ui;margin:24px;max-width:1500px}.row{display:flex;gap:16px}.col{flex:1;border:1px solid #ccc;padding:8px;border-radius:6px}pre{white-space:pre-wrap;font:13px/1.45 system-ui}section{margin-bottom:40px}</style>
<h1>Tehnisko risku sadaļa: akls A/B vērtējums</h1>
<p>Katram pārim novērtē A un B atsevišķi. Nezini, kurš ir jaunais. Vērtējumus ieraksti failā <b>vertejumi.csv</b>.</p>
<ul><li><b>tehn_precizitate 1-5</b>: pareizs dzinējs/kārba/platforma; galvenās problēmas pie esošā nobraukuma un tipiskās nākamajos 100 000 km; nav izdomātu faktu, kampaņu vai EUR summu; jau veiktie darbi nav ieteikti vēlreiz.</li>
<li><b>valoda_tonis 1-5</b>: dabiska latviešu valoda, konsultatīvs (ne kategorisks) tonis, bez slavinoša ievada, kodolīgi.</li>
<li><b>publicejams jā/nē</b>: vai tekstu varētu likt klienta atskaitē bez labošanas.</li></ul>
<p>5 = izcili, 3 = pieņemami ar labojumiem, 1 = nelietojams. Ja vienam no tekstiem ir būtiska kļūda, īsi ieraksti to kolonnā "piezime".</p>
${cards.join("\n")}`;
fs.writeFileSync(path.join(outDir, "vertesana.html"), html);
const csv = ["paris,teksts,tehn_precizitate_1_5,valoda_tonis_1_5,publicejams_ja_ne,piezime"];
for (let n = 1; n <= order.length; n++) for (const t of ["A", "B"]) csv.push(`${n},${t},,,,`);
fs.writeFileSync(path.join(outDir, "vertejumi.csv"), csv.join("\n") + "\n");
fs.writeFileSync(path.join(privDir, "atslega.json"), JSON.stringify(key, null, 1));
fs.writeFileSync(
  path.join(outDir, "LASIMANI.txt"),
  "PROVIN tehnisko risku akls A/B.\n1) Atver vertesana.html.\n2) Katram pārim novērtē A un B atsevišķi: tehn_precizitate 1-5, valoda_tonis 1-5, publicejams ja/ne, piezime.\n3) Aizpildi vertejumi.csv un atsūti atpakaļ. Nemēģini uzminēt, kurš ir jaunais.\n",
);
console.log(JSON.stringify({ outDir, privDir, pairs: order.length, missing: fixture.length - order.length }));
