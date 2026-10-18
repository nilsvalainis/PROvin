/**
 * Admin kustības INP / interaction-cost sols.
 *   node scripts/admin-motion-inp-bench.mjs
 * Mēra viena klikšķa galvenā pavediena darbu (ne tīkla RTT).
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const motionCss = readFileSync(new URL("../app/admin/admin-motion.css", import.meta.url), "utf8");

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
${motionCss}
body{margin:0;font:15px sans-serif}
.admin-ios-theme{min-height:100vh}
nav{display:flex;height:52px;padding:4px;width:360px;position:relative;background:#fff}
nav a,nav button{flex:1;border:0;background:transparent}
.sheet-host{position:relative;height:400px}
</style></head>
<body class="admin-ios-theme">
<nav aria-label="Galvenā izvēlne" id="nav">
  <span class="admin-mp" id="pill" style="height:44px;top:4px"><i class="l"></i><i class="m"></i><i class="r"></i></span>
  <button data-i="0">A</button><button data-i="1">B</button><button data-i="2">C</button><button data-i="3">D</button>
</nav>
<button id="open-sheet">Lapa</button>
<div class="admin-sheet-root" id="sheet" data-open="false">
  <button class="admin-sheet-scrim" id="scrim"></button>
  <div class="admin-sheet-panel" id="panel" style="background:#f2f2f7;padding:16px">Saturs</div>
</div>
<button id="toggle">Bloks</button>
<div class="admin-exp" id="exp" data-open="false"><div><div class="admin-exp-in" style="height:80px">Avots</div></div></div>
<div class="admin-skel" style="height:12px;width:80px;margin-top:8px"></div>
<script>
function morph(pill,x,w,h){
  const [l,m,r]=pill.children; l.style.width=r.style.width=(h/2)+'px';
  pill.classList.add('admin-moving');
  l.style.transform='translateX('+x+'px)';
  m.style.transform='translateX('+(x+h/2-1)+'px) scaleX('+((w-h+2)/2)+')';
  r.style.transform='translateX('+(x+w-h/2)+'px)';
  setTimeout(()=>pill.classList.remove('admin-moving'),300);
}
function rel(el,base){const a=el.getBoundingClientRect(),b=base.getBoundingClientRect();return {x:a.left-b.left,w:a.width};}
const nav=document.getElementById('nav');
const pill=document.getElementById('pill');
const costs=[];
function tapTab(i){
  const t0=performance.now();
  const btn=nav.querySelectorAll('button')[i];
  const r=rel(btn,nav);
  morph(pill,r.x,r.w,44);
  costs.push(performance.now()-t0);
}
function tapSheet(){
  const t0=performance.now();
  const s=document.getElementById('sheet');
  const open=s.getAttribute('data-open')==='true';
  s.setAttribute('data-open', open?'false':'true');
  document.getElementById('panel').classList.add('admin-moving');
  costs.push(performance.now()-t0);
}
function tapExp(){
  const t0=performance.now();
  const e=document.getElementById('exp');
  e.setAttribute('data-open', e.getAttribute('data-open')==='true'?'false':'true');
  costs.push(performance.now()-t0);
}
function baseline(){
  const t0=performance.now();
  document.body.classList.toggle('x');
  costs.push(performance.now()-t0);
}
window.__tapTab=tapTab; window.__tapSheet=tapSheet; window.__tapExp=tapExp; window.__baseline=baseline;
window.__stats=()=>{
  const xs=costs.slice();
  xs.sort((a,b)=>a-b);
  const sum=xs.reduce((a,b)=>a+b,0);
  return {n:xs.length, mean:sum/xs.length, p95:xs[Math.floor(xs.length*0.95)]||0, max:xs[xs.length-1]||0};
};
window.__reset=()=>{costs.length=0};
tapTab(0);
</script></body></html>`;

function pct(n) {
  return Math.round(n * 1000) / 1000;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.setContent(html, { waitUntil: "domcontentloaded" });

  const measure = async (label, fn, n = 40) => {
    await page.evaluate(() => window.__reset());
    for (let i = 0; i < n; i++) await page.evaluate(fn);
    return { label, ...(await page.evaluate(() => window.__stats())) };
  };

  const baseline = await measure("baseline-class-toggle", () => window.__baseline());
  const tab = await measure("tab-pill", () => window.__tapTab(1 + (window.__i = ((window.__i || 0) + 1) % 3)));
  const sheet = await measure("sheet-toggle", () => window.__tapSheet());
  const exp = await measure("collapsible-toggle", () => window.__tapExp());

  await browser.close();

  const rows = [baseline, tab, sheet, exp];
  const out = {
    unit: "ms main-thread interaction handler",
    inpBudgetMs: 200,
    goodMs: 50,
    rows: rows.map((r) => ({
      label: r.label,
      mean: pct(r.mean),
      p95: pct(r.p95),
      max: pct(r.max),
      n: r.n,
    })),
  };
  console.log(JSON.stringify(out, null, 2));
  for (const r of out.rows) {
    if (r.p95 >= 50) {
      console.error("INTERACTION_P95_OVER_50", r);
      process.exit(1);
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
