/** Static landing specs — concepts 21–30 */
export const specs21_30 = [
  {
    n: 21,
    title: "Motion-heavy UI",
    goal: "GSAP-powered micro-interactions on a dense control strip.",
    tech: ["HTML", "CSS", "Vanilla JS", "GSAP (CDN)"],
    features: ["Staggered chip press", "Elastic hero nudge", "Reduced-motion guard"],
    extraHead: `<script defer src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>`,
    html: `
    <div class="wrap mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 id="h">Motion stress test</h1>
      <p id="p">Tap chips — demo only.</p>
      <div class="chips" id="chips">
        <button type="button" class="chip">Regs</button>
        <button type="button" class="chip">Dealers</button>
        <button type="button" class="chip">Ads</button>
        <button type="button" class="chip">Photos</button>
      </div>
    </div>`,
    css: `
    body{margin:0;background:#05060a;color:#e9edf5;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .wrap{max-width:900px;margin:0 auto;padding:clamp(2.5rem,7vw,5rem) 1.25rem}
    h1{margin:0 0 .5rem;font-size:clamp(2rem,4vw,3rem);line-height:1.05}
    p{margin:0 0 1.5rem;opacity:.75;max-width:52ch;line-height:1.5}
    .chips{display:flex;flex-wrap:wrap;gap:.6rem}
    .chip{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:inherit;padding:.55rem .85rem;border-radius:999px;cursor:pointer;font-weight:650}`,
    js: `
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function boot() {
      if (!window.gsap) { document.getElementById("p").textContent += " (GSAP blocked — use HTTPS + static server.)"; return; }
      if (reduce) return;
      gsap.from("#h", { y: 18, opacity: 0, duration: 0.9, ease: "power3.out" });
      gsap.from("#p", { y: 10, opacity: 0, duration: 0.8, delay: 0.1, ease: "power3.out" });
      gsap.from(".chip", { y: 10, opacity: 0, stagger: 0.06, duration: 0.55, delay: 0.25, ease: "back.out(1.6)" });
      document.querySelectorAll(".chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          gsap.fromTo(btn, { scale: 1 }, { scale: 1.08, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.inOut" });
        });
      });
    }
    addEventListener("DOMContentLoaded", boot);`,
  },
  {
    n: 22,
    title: "Mobile-first app style",
    goal: "Phone chrome with swipeable story cards (touch + mouse drag).",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["Device frame", "Pointer swipe", "Snapping index"],
    html: `
    <div class="stage grid min-h-screen w-full place-items-center px-4 py-8 text-white">
      <div class="phone" aria-label="Phone mockup">
        <div class="notch"></div>
        <div class="screen">
          <header><strong>PROVIN</strong><span>demo</span></header>
          <div id="track" class="track">
            <section class="card"><h2>VIN</h2><p>Swipe ← →</p><input maxlength="17" /></section>
            <section class="card"><h2>Risk</h2><p>Synthetic low.</p></section>
            <section class="card"><h2>Export</h2><p>PDF placeholder.</p></section>
          </div>
          <div class="dots" id="dots"></div>
        </div>
      </div>
    </div>`,
    css: `
    body{margin:0;background:radial-gradient(circle at 50% 20%,#1a2444,#05060a);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;color:#e9edf5}
    .stage{min-height:100vh;display:grid;place-items:center;padding:2rem 1rem}
    .phone{width:min(360px,92vw);aspect-ratio:9/19;border-radius:34px;padding:12px;background:linear-gradient(145deg,#2a3142,#121722);box-shadow:0 40px 120px rgba(0,0,0,.55)}
    .notch{height:10px;margin:6px auto 10px;width:120px;border-radius:999px;background:rgba(0,0,0,.55)}
    .screen{border-radius:26px;overflow:hidden;border:1px solid rgba(255,255,255,.10);background:#07080d;display:flex;flex-direction:column}
    header{display:flex;justify-content:space-between;align-items:center;padding:.65rem .9rem;border-bottom:1px solid rgba(255,255,255,.08);font-size:.85rem}
    .track{display:flex;overflow:hidden;touch-action:pan-y}
    .card{flex:0 0 100%;padding:1rem 1rem 1.25rem}
    h2{margin:0 0 .35rem} p{margin:0 0 .75rem;opacity:.75;line-height:1.45}
    input{width:100%;padding:.65rem .75rem;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.35);color:#fff;font:inherit;outline:none}
    .dots{display:flex;gap:.35rem;justify-content:center;padding:.55rem 0 .85rem}
    .dot{width:7px;height:7px;border-radius:999px;background:rgba(255,255,255,.18)}
    .dot.on{background:#7eb6ff}`,
    js: `
    const track = document.getElementById("track");
    const dots = document.getElementById("dots");
    const pages = track.children.length;
    for (let i = 0; i < pages; i++) { const d = document.createElement("div"); d.className = "dot" + (i===0?" on":""); dots.appendChild(d); }
    let i = 0, startX = 0, dragging = false, dx = 0;
    function paint() {
      track.style.transform = "translateX(" + (-i * 100 + (dx / track.clientWidth) * 100) + "%)";
      [...dots.children].forEach((d, j) => d.classList.toggle("on", j === i));
    }
    function go(dir) { i = Math.max(0, Math.min(pages - 1, i + dir)); dx = 0; paint(); }
    track.addEventListener("pointerdown", (e) => { dragging = true; startX = e.clientX; track.setPointerCapture(e.pointerId); });
    track.addEventListener("pointermove", (e) => { if (!dragging) return; dx = e.clientX - startX; paint(); });
    track.addEventListener("pointerup", () => {
      if (!dragging) return; dragging = false;
      if (dx < -60) go(1); else if (dx > 60) go(-1); dx = 0; paint();
    });
    paint();`,
  },
  {
    n: 23,
    title: "AI Risk Score Visualizer",
    goal: "Circular progress dial animating a synthetic risk score.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["SVG ring", "Animated score", "Replay control"],
    html: `
    <div class="wrap mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div class="dial" role="img" aria-label="Demo risk score dial">
        <svg viewBox="0 0 120 120" width="220" height="220" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="10" />
          <circle id="arc" cx="60" cy="60" r="52" fill="none" stroke="url(#g)" stroke-width="10" stroke-linecap="round" transform="rotate(-90 60 60)" stroke-dasharray="0 999" />
          <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#00e5ff"/><stop offset="1" stop-color="#7c4dff"/></linearGradient></defs>
        </svg>
        <div class="score"><span id="n">0</span><small>/100</small></div>
      </div>
      <p class="cap">Synthetic “AI risk” — not a model.</p>
      <button id="replay" type="button" class="btn">Replay</button>
    </div>`,
    css: `
    body{margin:0;background:#020308;color:#e9edf5;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .wrap{min-height:100vh;display:grid;place-items:center;padding:2rem 1rem;text-align:center;gap:.75rem}
    .dial{position:relative;display:grid;place-items:center}
    .score{position:absolute;font-weight:800;font-size:2.4rem;letter-spacing:-.03em}
    .score small{font-size:.95rem;opacity:.55;margin-left:.15rem}
    .cap{margin:0;max-width:46ch;opacity:.75;line-height:1.45}
    .btn{border:0;border-radius:999px;padding:.65rem 1.1rem;font-weight:700;cursor:pointer;background:#e8f0ff;color:#05060a}`,
    js: `
    const arc = document.getElementById("arc");
    const n = document.getElementById("n");
    const C = 2 * Math.PI * 52;
    function run() {
      const target = Math.round(42 + Math.random() * 40);
      let cur = 0;
      const t0 = performance.now();
      function frame(t) {
        const p = Math.min(1, (t - t0) / 1200);
        cur = Math.round(target * (0.5 - Math.cos(Math.PI * p) / 2));
        n.textContent = String(cur);
        const dash = (cur / 100) * C;
        arc.setAttribute("stroke-dasharray", dash + " " + C);
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    document.getElementById("replay").addEventListener("click", run);
    run();`,
  },
  {
    n: 24,
    title: "3D Card Interaction",
    goal: "Perspective card tilt following pointer for tactile depth.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["CSS perspective", "Pointer tilt mapping", "Specular sheen"],
    html: `
    <div class="stage grid min-h-screen w-full place-items-center px-4 py-8 text-white">
      <div id="card" class="card" tabindex="0">
        <p class="eyebrow">PROVIN</p>
        <h2>VIN dossier</h2>
        <p>Move the pointer across the card.</p>
        <span class="shine" aria-hidden="true"></span>
      </div>
    </div>`,
    css: `
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,#13204a,#020308);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;color:#e9edf5}
    .stage{perspective:900px;padding:2rem 1rem}
    .card{position:relative;width:min(420px,92vw);padding:1.5rem;border-radius:18px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);transform-style:preserve-3d;transition:box-shadow .2s ease;outline:none}
    .card:focus-visible{box-shadow:0 0 0 3px rgba(0,102,255,.45)}
    .eyebrow{letter-spacing:.22em;text-transform:uppercase;font-size:.68rem;opacity:.55;margin:0}
    h2{margin:.35rem 0 .5rem;font-size:1.35rem}
    p{margin:0;opacity:.75;line-height:1.45}
    .shine{position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(600px circle at var(--sx,30%) var(--sy,20%),rgba(255,255,255,.22),transparent 45%);mix-blend-mode:screen;opacity:.55}`,
    js: `
    const card = document.getElementById("card");
    function on(e) {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = "rotateY(" + (x * 18) + "deg) rotateX(" + (-y * 14) + "deg)";
      card.style.setProperty("--sx", (x + .5) * 100 + "%");
      card.style.setProperty("--sy", (y + .5) * 100 + "%");
    }
    card.addEventListener("pointermove", on);
    card.addEventListener("pointerleave", () => { card.style.transform = "rotateY(0deg) rotateX(0deg)"; });`,
  },
  {
    n: 25,
    title: "Marketplace comparison view",
    goal: "Side-by-side comparison of two synthetic listings.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["Two-column spec table", "Highlight deltas", "Swap button"],
    html: `
    <div class="wrap mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header><h1>Compare listings</h1><button id="swap" type="button">Swap highlights</button></header>
      <div class="grid" id="g">
        <article class="car a"><h2>Listing A</h2><table><tbody>
          <tr><th>Price</th><td>€18,400</td></tr>
          <tr><th>Mileage</th><td class="mile" data-side="a">198k km</td></tr>
          <tr><th>Title</th><td>2014 · Comfort</td></tr>
        </tbody></table></article>
        <article class="car b"><h2>Listing B</h2><table><tbody>
          <tr><th>Price</th><td>€17,900</td></tr>
          <tr><th>Mileage</th><td class="mile" data-side="b">121k km</td></tr>
          <tr><th>Title</th><td>2014 · Comfort</td></tr>
        </tbody></table></article>
      </div>
    </div>`,
    css: `
    body{margin:0;background:#f6f7fb;color:#0b1020;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .wrap{max-width:1100px;margin:0 auto;padding:2rem 1.25rem 3rem}
    header{display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap}
    h1{margin:0;font-size:clamp(1.5rem,3vw,2rem)}
    button{border:0;border-radius:12px;padding:.65rem 1rem;font-weight:700;cursor:pointer;background:#0b1020;color:#fff}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.25rem}
    .car{border:1px solid rgba(0,0,0,.10);border-radius:16px;padding:1rem;background:#fff}
    h2{margin:0 0 .75rem;font-size:1.05rem}
    table{width:100%;border-collapse:collapse;font-size:.95rem}
    th{text-align:left;padding:.45rem .25rem;color:#5c6470;font-weight:650;width:38%}
    td{padding:.45rem .25rem}
    .mile[data-side="a"]{background:#fff3bf}
    .swap .mile[data-side="a"]{background:transparent}
    .swap .mile[data-side="b"]{background:#fff3bf}`,
    js: `
    document.getElementById("swap").addEventListener("click", () => {
      document.getElementById("g").classList.toggle("swap");
    });`,
  },
  {
    n: 26,
    title: "Map-based concept",
    goal: "Leaflet map with a fake origin marker — swap tiles in production.",
    tech: ["HTML", "CSS", "Vanilla JS", "Leaflet (CDN)"],
    features: ["OSM tiles", "Marker popup", "Responsive map height"],
    extraHead: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />
<script defer src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>`,
    html: `
    <div class="wrap mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header><h1>Origin map</h1><p>Demo geospatial shell — requires network for tiles.</p></header>
      <div id="map" class="map" role="presentation"></div>
    </div>`,
    css: `
    body{margin:0;background:#0b0d12;color:#e9edf5;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .wrap{max-width:1100px;margin:0 auto;padding:1.25rem 1.25rem 2rem}
    h1{margin:0 0 .35rem;font-size:1.5rem} p{margin:0 0 1rem;opacity:.7;line-height:1.45}
    .map{height:min(70vh,560px);border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.10)}`,
    js: `
    addEventListener("DOMContentLoaded", () => {
      if (!window.L) { document.getElementById("map").textContent = "Leaflet failed to load — check network / CSP."; return; }
      const map = L.map("map").setView([56.95, 24.1], 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
      L.marker([56.95, 24.1]).addTo(map).bindPopup("Demo origin marker");
    });`,
  },
  {
    n: 27,
    title: "Gamified experience",
    goal: "Step-through VIN analysis with a playful progress bar.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["3-step wizard", "Progress fill", "Confetti-less completion state"],
    html: `
    <div class="wrap mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div class="bar"><div id="fill" class="fill"></div></div>
      <section id="s0" class="step">
        <h1>VIN quest</h1>
        <p>Demo gamification — no backend.</p>
        <input id="vin" maxlength="17" placeholder="Enter VIN" />
        <button type="button" data-next>Next</button>
      </section>
      <section id="s1" class="step hidden">
        <h2>Scanning registries…</h2>
        <p>Synthetic progress animation.</p>
        <button type="button" data-next>Next</button>
      </section>
      <section id="s2" class="step hidden">
        <h2>Report ready (fake)</h2>
        <p>You finished the demo flow.</p>
        <button type="button" id="reset">Play again</button>
      </section>
    </div>`,
    css: `
    body{margin:0;background:#05060a;color:#e9edf5;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .wrap{max-width:640px;margin:0 auto;padding:2rem 1.25rem}
    .bar{height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin-bottom:1.25rem}
    .fill{height:100%;width:0%;background:linear-gradient(90deg,#0066ff,#7cf0ff);transition:width .45s ease}
    .step{display:grid;gap:.75rem}
    .hidden{display:none}
    h1,h2{margin:0}
    p{margin:0;opacity:.75;line-height:1.45}
    input{padding:.85rem 1rem;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.35);color:#fff;font:inherit;outline:none}
    button{justify-self:start;border:0;border-radius:12px;padding:.75rem 1.1rem;font-weight:800;cursor:pointer;background:#e8f0ff;color:#05060a}`,
    js: `
    let step = 0;
    const fill = document.getElementById("fill");
    function show(i) {
      document.querySelectorAll(".step").forEach((s, j) => s.classList.toggle("hidden", j !== i));
      fill.style.width = ((i + 1) / 3 * 100) + "%";
      step = i;
    }
    document.querySelectorAll("[data-next]").forEach((b) => b.addEventListener("click", () => {
      if (step === 0 && document.getElementById("vin").value.trim().length < 11) { alert("Enter at least 11 chars (demo)."); return; }
      show(Math.min(2, step + 1));
    }));
    document.getElementById("reset").addEventListener("click", () => { document.getElementById("vin").value = ""; show(0); fill.style.width = "0%"; });
    show(0);`,
  },
  {
    n: 28,
    title: "Ultra-fast minimal (performance focus)",
    goal: "No frameworks, tiny assets, readable single-purpose landing.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["Sub-100KB total (excluding browser)", "No CDN dependencies", "Instant paint"],
    bodyClass: "bg-white text-black",
    html: `<div class="mx-auto mt-24 w-full max-w-lg px-4 font-sans"><h1 class="mb-2 text-4xl font-semibold tracking-tight">VIN</h1><input id="v" maxlength="17" class="w-full border border-black px-2 py-2 text-xl outline-none" /><p id="m" class="mt-2 min-h-[1.2em] text-sm text-neutral-600"></p></div>`,
    css: ``,
    js: `const v=document.getElementById("v"),m=document.getElementById("m");v.addEventListener("input",()=>{const x=v.value.toUpperCase().replace(/[^A-Z0-9]/g,"");v.value=x;m.textContent=x.length?x.length+"/17":""});`,
  },
  {
    n: 29,
    title: "Scandinavian clean design",
    goal: "Soft daylight palette, airy spacing, whisper shadows.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["Muted sage accents", "Soft card elevation", "Quiet typography"],
    html: `
    <div class="wrap mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header><h1>Quiet diligence</h1><p>Soft surfaces, clear hierarchy.</p></header>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article class="card"><h2>VIN</h2><input maxlength="17" placeholder="·················" /></article>
        <article class="card"><h2>Notes</h2><p>Demo copy: registry checks feel calmer when typography breathes.</p></article>
      </div>
    </div>`,
    css: `
    body{margin:0;background:#f3f6f4;color:#1e2a24;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .wrap{max-width:980px;margin:0 auto;padding:clamp(2.5rem,6vw,4.5rem) 1.25rem}
    header{max-width:60ch;margin-bottom:1.75rem}
    h1{margin:0 0 .5rem;font-size:clamp(2rem,4vw,2.8rem);letter-spacing:-.02em;font-weight:650}
    p{margin:0;line-height:1.55;color:#4b5c53}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem}
    .card{background:#fff;border:1px solid rgba(30,42,36,.08);border-radius:18px;padding:1.15rem;box-shadow:0 18px 50px rgba(20,40,30,.06)}
    h2{margin:0 0 .5rem;font-size:1.05rem}
    input{width:100%;padding:.75rem .85rem;border-radius:14px;border:1px solid rgba(30,42,36,.12);background:#fbfcfb;font:inherit;outline:none}`,
    js: `document.querySelector("input").addEventListener("input",(e)=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"");});`,
  },
  {
    n: 30,
    title: "Experimental AI generative UI",
    goal: "Each reload randomizes hero layout, palette, and density — generative UI sketch.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["Random palette", "Shuffle section order", "Density mode"],
    html: `
    <div id="root" class="root mx-auto grid w-full max-w-4xl gap-4 px-4 py-8 sm:px-6 sm:py-10">
      <section data-block="hero" class="block"><h1>Generative shell</h1><p>Reload to re-roll.</p></section>
      <section data-block="vin" class="block"><label>VIN</label><input maxlength="17" /></section>
      <section data-block="cta" class="block"><button type="button" id="roll">Re-roll without reload</button></section>
    </div>`,
    css: `
    :root{--bg:#f6f7fb;--fg:#0b1020;--a:#0066ff;--pad:clamp(1.25rem,3vw,2.25rem)}
    body{margin:0;background:var(--bg);color:var(--fg);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .root{max-width:980px;margin:0 auto;padding:var(--pad);display:grid;gap:var(--gap,1rem)}
    .block{border:1px solid rgba(0,0,0,.10);border-radius:18px;padding:var(--pad);background:rgba(255,255,255,.65)}
    h1{margin:0 0 .35rem;font-size:var(--h,clamp(2rem,4vw,3rem));line-height:1.02}
    p{margin:0;opacity:.75;line-height:1.45}
    label{display:block;font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;opacity:.55;margin-bottom:.35rem}
    input{width:100%;padding:.85rem 1rem;border-radius:14px;border:1px solid rgba(0,0,0,.12);font:inherit;outline:none}
    button{border:0;border-radius:14px;padding:.75rem 1rem;font-weight:800;cursor:pointer;background:var(--a);color:#fff}`,
    js: `
    const palettes = [
      {bg:"#f6f7fb",fg:"#0b1020",a:"#0066ff"},
      {bg:"#0b0d12",fg:"#e9edf5",a:"#7cf0ff"},
      {bg:"#fff6ea",fg:"#241612",a:"#ff6a3d"},
      {bg:"#f3f6f4",fg:"#1e2a24",a:"#2f7d57"},
    ];
    function roll() {
      const p = palettes[(Math.random() * palettes.length) | 0];
      document.documentElement.style.setProperty("--bg", p.bg);
      document.documentElement.style.setProperty("--fg", p.fg);
      document.documentElement.style.setProperty("--a", p.a);
      const dense = Math.random() > 0.55;
      document.documentElement.style.setProperty("--gap", dense ? ".65rem" : "1.25rem");
      document.documentElement.style.setProperty("--h", dense ? "clamp(1.6rem,3vw,2.2rem)" : "clamp(2rem,5vw,3.2rem)");
      const root = document.getElementById("root");
      [...root.querySelectorAll(".block")].sort(() => Math.random() - 0.5).forEach((el) => root.appendChild(el));
    }
    document.getElementById("roll").addEventListener("click", roll);
    roll();`,
  },
];
