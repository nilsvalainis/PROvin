/** Static landing specs — concepts 01–10 */
export const specs01_10 = [
  {
    n: 1,
    title: "Glassmorphism Premium Dashboard",
    goal: "Transparent glass UI with depth, fake VIN intelligence panel, and ambient light that follows the pointer.",
    tech: ["HTML", "CSS (backdrop-filter)", "Vanilla JS"],
    features: [
      "Backdrop blur glass panels",
      "Animated hover lifts",
      "Fake VIN decode result card",
      "Mouse-driven radial highlight (CSS variables)",
    ],
    html: `
    <header class="hero mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 sm:px-6">
      <p class="eyebrow">PROVIN · concept demo</p>
      <h1>Vehicle intelligence</h1>
      <p class="lede">Paste a VIN — preview a premium glass dashboard.</p>
      <div class="vin-row">
        <input id="vin" class="vin" maxlength="17" placeholder="WVWZZZ1JZ3W386752" autocomplete="off" />
        <button type="button" id="decode" class="btn">Analyze</button>
      </div>
    </header>
    <section class="grid mx-auto mt-8 grid w-full max-w-6xl grid-cols-1 gap-4 px-4 sm:grid-cols-2 sm:px-6">
      <article class="glass card">
        <h2>Risk snapshot</h2>
        <p class="muted">Synthetic demo data.</p>
        <div id="panel" class="panel" hidden>
          <dl>
            <div><dt>Region</dt><dd id="p-region">—</dd></div>
            <div><dt>Checks</dt><dd id="p-checks">—</dd></div>
            <div><dt>Flags</dt><dd id="p-flags">—</dd></div>
          </dl>
        </div>
      </article>
      <article class="glass card">
        <h2>Mileage signal</h2>
        <div class="spark" aria-hidden="true"></div>
        <p class="muted">Hover cards for micro-interactions.</p>
      </article>
    </section>`,
    css: `
    :root { --mx: 50%; --my: 40%; --glass: rgba(255,255,255,0.08); --stroke: rgba(255,255,255,0.18); }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      color: #e8eefc; background: radial-gradient(900px circle at var(--mx) var(--my), rgba(0,102,255,0.35), transparent 55%),
      radial-gradient(1200px at 20% 0%, #0b1020, #020308); overflow-x: hidden; }
    .skip { position: absolute; left: -9999px; } .skip:focus { left: 1rem; top: 1rem; z-index: 50; background: #fff; color: #000; padding: .5rem .75rem; }
    main { max-width: 1100px; margin: 0 auto; padding: clamp(1.25rem, 3vw, 2.5rem); }
    .hero { padding: 2rem 0 1rem; } .eyebrow { letter-spacing: .2em; text-transform: uppercase; font-size: .7rem; opacity: .65; }
    h1 { font-size: clamp(2rem, 4vw, 3.25rem); margin: .35rem 0; font-weight: 650; } .lede { opacity: .78; max-width: 52ch; }
    .vin-row { display: flex; gap: .75rem; flex-wrap: wrap; margin-top: 1.25rem; }
    .vin { flex: 1 1 240px; padding: .85rem 1rem; border-radius: 14px; border: 1px solid rgba(255,255,255,0.14); background: rgba(0,0,0,0.25); color: #fff; outline: none; }
    .btn { border: 0; border-radius: 14px; padding: .85rem 1.25rem; font-weight: 600; cursor: pointer; color: #041018;
      background: linear-gradient(180deg, #e8f1ff, #b7cfff); box-shadow: 0 10px 40px rgba(0,102,255,0.25); transition: transform .18s ease, box-shadow .18s ease; }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 14px 50px rgba(0,102,255,0.35); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; margin-top: 2rem; }
    .glass { background: var(--glass); border: 1px solid var(--stroke); backdrop-filter: blur(16px) saturate(140%); -webkit-backdrop-filter: blur(16px) saturate(140%);
      border-radius: 18px; transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease; }
    .card { padding: 1.25rem 1.35rem; }
    .glass:hover { transform: translateY(-4px); border-color: rgba(255,255,255,0.28); box-shadow: 0 20px 60px rgba(0,0,0,0.35); }
    h2 { margin: 0 0 .35rem; font-size: 1.05rem; } .muted { margin: 0; opacity: .65; font-size: .9rem; }
    .panel { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.12); }
    dl { display: grid; gap: .65rem; margin: 0; } dl > div { display: flex; justify-content: space-between; gap: 1rem; font-size: .9rem; }
    dt { opacity: .55; } dd { margin: 0; font-weight: 600; }
    .spark { height: 64px; margin: 1rem 0; border-radius: 12px; background: linear-gradient(90deg, rgba(0,102,255,0.15), rgba(255,255,255,0.08), rgba(0,102,255,0.2)); }`,
    js: `
    const root = document.documentElement;
    addEventListener("pointermove", (e) => {
      root.style.setProperty("--mx", (e.clientX / innerWidth) * 100 + "%");
      root.style.setProperty("--my", (e.clientY / innerHeight) * 100 + "%");
    });
    const panel = document.getElementById("panel");
    document.getElementById("decode")?.addEventListener("click", () => {
      const v = (document.getElementById("vin")?.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (v.length < 11) { panel.hidden = true; return; }
      panel.hidden = false;
      document.getElementById("p-region").textContent = "EU registry cluster (demo)";
      document.getElementById("p-checks").textContent = "12 signals matched";
      document.getElementById("p-flags").textContent = v.length === 17 ? "VIN length OK" : "Partial VIN";
    });`,
  },
  {
    n: 2,
    title: "AI Assistant Landing",
    goal: "ChatGPT-style auto expert with typing animation and canned VIN insights.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["Threaded chat UI", "Typing indicator", "Fake AI replies tied to VIN"],
    html: `
    <div class="shell grid min-h-0 w-full max-w-6xl grid-cols-1 text-[#e7e9ee] md:min-h-screen md:grid-cols-[220px_1fr]">
      <aside class="rail"><div class="logo">PROVIN</div><p class="tiny">Concept demo — not a live model.</p></aside>
      <section class="chat">
        <header><h1>Auto analyst</h1><p class="sub">Ask about a VIN.</p></header>
        <div id="thread" class="thread" aria-live="polite"></div>
        <form id="f" class="composer">
          <label class="sr-only" for="q">Message</label>
          <input id="q" autocomplete="off" placeholder="Decode WVWZZZ…" />
          <button type="submit">Send</button>
        </form>
      </section>
    </div>`,
    css: `
    * { box-sizing: border-box; }
    body { margin: 0; background: #0b0d12; color: #e7e9ee; font-family: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
    .shell { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }
    .rail { border-right: 1px solid rgba(255,255,255,0.08); padding: 1.25rem; background: rgba(255,255,255,0.02); }
    .logo { font-weight: 800; letter-spacing: .08em; } .tiny { font-size: .75rem; opacity: .55; line-height: 1.4; }
    .chat { display: flex; flex-direction: column; max-width: 900px; margin: 0 auto; width: 100%; padding: 1rem 1.25rem 1.5rem; }
    header h1 { margin: 0; font-size: 1.35rem; } .sub { margin: .25rem 0 0; opacity: .6; font-size: .9rem; }
    .thread { flex: 1; overflow: auto; padding: 1rem 0; display: flex; flex-direction: column; gap: .75rem; }
    .bubble { max-width: 85%; padding: .75rem .95rem; border-radius: 14px; line-height: 1.45; font-size: .95rem; white-space: pre-wrap; }
    .user { align-self: flex-end; background: #1f3b7a; border: 1px solid rgba(255,255,255,0.08); }
    .bot { align-self: flex-start; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); }
    .typing::after { content: "▍"; animation: blink 1s steps(2) infinite; } @keyframes blink { 50% { opacity: 0; } }
    .composer { display: flex; gap: .5rem; padding-top: .5rem; border-top: 1px solid rgba(255,255,255,0.08); }
    .composer input { flex: 1; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.35); color: #fff; padding: .75rem .9rem; outline: none; }
    .composer button { border: 0; border-radius: 12px; padding: 0 1rem; font-weight: 600; cursor: pointer; background: #e8f0ff; color: #0a1020; }
    @media (max-width: 760px) { .shell { grid-template-columns: 1fr; } .rail { display: none; } }`,
    js: `
    const thread = document.getElementById("thread");
    function addBubble(role, text) {
      const d = document.createElement("div");
      d.className = "bubble " + (role === "user" ? "user" : "bot");
      d.textContent = text; thread.appendChild(d); thread.scrollTop = thread.scrollHeight;
    }
    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
    async function typeBot(full) {
      const el = document.createElement("div"); el.className = "bubble bot typing"; el.textContent = ""; thread.appendChild(el);
      for (let i = 0; i <= full.length; i++) { el.textContent = full.slice(0, i); thread.scrollTop = thread.scrollHeight; await sleep(12 + Math.random() * 18); }
      el.classList.remove("typing");
    }
    function fakeAnswer(vin) {
      const clean = vin.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (clean.length < 11) return "I need at least 11 characters to fake a registry cluster match.";
      return "Demo insight:\\n• WMI suggests passenger vehicle line.\\n• Mileage anomaly risk: LOW (synthetic).\\n• Compare listing photos vs trim (demo).";
    }
    document.getElementById("f").addEventListener("submit", async (e) => {
      e.preventDefault(); const q = document.getElementById("q"); const text = q.value.trim(); if (!text) return;
      addBubble("user", text); q.value = ""; await sleep(350); await typeBot(fakeAnswer(text));
    });
    addBubble("bot", "Hi — paste a VIN for a canned expert-style summary.");`,
  },
  {
    n: 3,
    title: "Brutalist Minimal",
    goal: "High-contrast black/white layout with raw typography and zero friendly rounding.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["No border-radius", "Strict grid", "Oversized type scale"],
    html: `
    <div class="wrap mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header><span class="tag">PROVIN / DEMO</span><h1>AUDIT<br/>THE<br/>VIN</h1></header>
      <section class="grid grid-cols-1 border-2 border-black md:grid-cols-2">
        <div class="cell"><label>VIN</label><input id="vin" maxlength="17" /></div>
        <div class="cell"><p class="big">NO FLUFF.<br/>JUST DATA.</p><button id="go" type="button">RUN</button></div>
      </section>
      <pre id="out" class="out" aria-live="polite"></pre>
    </div>`,
    css: `
    *,*::before,*::after{box-sizing:border-box;border-radius:0!important}
    body{margin:0;background:#fff;color:#000;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    .wrap{max-width:980px;margin:0 auto;padding:2rem 1.25rem}
    header h1{margin:.5rem 0;font-size:clamp(3rem,12vw,7rem);line-height:.9;letter-spacing:-.04em;font-weight:900}
    .tag{display:inline-block;border:2px solid #000;padding:.25rem .5rem;font-size:.7rem;letter-spacing:.15em}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border:2px solid #000;margin-top:1.5rem}
    .cell{border:2px solid #000;padding:1rem;min-height:140px}
    label{display:block;font-size:.75rem;margin-bottom:.35rem}
    input{width:100%;border:2px solid #000;padding:.75rem;font:inherit;background:#fff}
    .big{font-size:clamp(1.2rem,3vw,1.8rem);font-weight:800;line-height:1.1;margin:0 0 1rem}
    button{width:100%;border:2px solid #000;background:#000;color:#fff;padding:.9rem;font:inherit;font-weight:800;cursor:pointer}
    button:hover{background:#fff;color:#000}
    .out{margin-top:1rem;border:2px solid #000;padding:1rem;min-height:4rem;white-space:pre-wrap;background:#fafafa}
    @media(max-width:720px){.grid{grid-template-columns:1fr}}`,
    js: `
    document.getElementById("go").addEventListener("click", () => {
      const v = (document.getElementById("vin").value || "").toUpperCase().replace(/\\s/g,"");
      document.getElementById("out").textContent = v.length >= 11
        ? "DEMO OUTPUT\\nSTATUS: OK\\nCHECKSUM: FAKE\\nVIN: " + v
        : "ERROR: NEED >=11 CHARS";
    });`,
  },
  {
    n: 4,
    title: "Apple-style Ultra Clean",
    goal: "Generous whitespace, system typography, and soft section reveals.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["CSS smooth scroll", "IntersectionObserver fade-ins", "System / SF-like stack"],
    html: `
    <div class="page mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <section class="band reveal"><p class="kicker">PROVIN</p><h1 class="hero">Understand the car<br/>before you buy.</h1>
      <p class="sub">A calm, product-grade layout — demo only.</p></section>
      <section class="band reveal narrow"><h2>Signals</h2><p>Registry deltas, dealer footprints, listing coherence.</p></section>
      <section class="band reveal narrow"><h2>VIN</h2><input class="field" placeholder="17 characters" maxlength="17" /></section>
    </div>`,
    css: `
    html{scroll-behavior:smooth}
    body{margin:0;background:#fbfbfd;color:#0b0b0f;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5}
    .page{max-width:980px;margin:0 auto;padding:clamp(3rem,8vw,6rem) 1.5rem 6rem}
    .kicker{letter-spacing:.24em;text-transform:uppercase;font-size:.72rem;color:#6e6e73;margin:0 0 .75rem}
    .hero{font-size:clamp(2.4rem,5vw,3.6rem);line-height:1.05;font-weight:650;margin:0 0 1rem;letter-spacing:-.02em}
    .sub{font-size:1.1rem;color:#3a3a3f;max-width:40ch;margin:0}
    .band{padding:clamp(2.5rem,6vw,4rem) 0;border-top:1px solid rgba(0,0,0,.06)}
    .narrow{max-width:560px}
    h2{margin:0 0 .5rem;font-size:1.35rem;font-weight:600}
    .field{width:100%;max-width:420px;border:1px solid #d2d2d7;border-radius:12px;padding:.85rem 1rem;font:inherit;background:#fff}
    .reveal{opacity:0;transform:translateY(18px);transition:opacity .8s ease,transform .8s ease}
    .reveal.on{opacity:1;transform:none}`,
    js: `
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) { if (e.isIntersecting) e.target.classList.add("on"); }
    }, { threshold: 0.2 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));`,
  },
  {
    n: 5,
    title: "Cyberpunk Neon",
    goal: "Dark chassis, neon outlines, CRT scanline, and a glitching headline.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["Glowing borders", "Animated scan line", "Glitch text"],
    html: `
    <div class="crt relative min-h-screen w-full overflow-hidden font-mono text-[#e6f7ff]">
      <div class="scan" aria-hidden="true"></div>
      <div class="wrap mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <p class="mono">// PROVIN_NET //</p>
        <h1 class="glitch" data-text="VIN_TRACE">VIN_TRACE</h1>
        <p class="sub">Neon audit lane — synthetic traffic only.</p>
        <div class="panel"><span class="pill">LIVE</span><input id="vin" maxlength="17" placeholder="ENTER_VIN" /><button id="hack" type="button">PULSE</button></div>
        <pre id="log" class="log"></pre>
      </div>
    </div>`,
    css: `
    body{margin:0;background:#03040a;color:#e6f7ff;font-family:ui-monospace,Menlo,Consolas,monospace;min-height:100vh}
    .crt{position:relative;min-height:100vh;overflow:hidden}
    .scan{pointer-events:none;position:absolute;inset:0;background:repeating-linear-gradient(to bottom,rgba(255,255,255,.03),rgba(255,255,255,.03) 1px,transparent 1px,transparent 3px);mix-blend-mode:overlay;animation:drift 9s linear infinite}
    @keyframes drift{to{transform:translateY(12px)}}
    .wrap{position:relative;z-index:1;max-width:900px;margin:0 auto;padding:2.5rem 1.25rem}
    .mono{opacity:.65;letter-spacing:.25em;font-size:.7rem}
    .glitch{font-size:clamp(2.4rem,6vw,4rem);margin:.5rem 0;text-shadow:0 0 12px #00e5ff,0 0 28px #7c4dff;animation:gl 2.6s infinite alternate}
    @keyframes gl{0%{transform:translate(0)}20%{transform:translate(-2px,1px)}40%{transform:translate(2px,-1px)}60%{transform:translate(-1px,-1px)}100%{transform:translate(0)}}
    .sub{opacity:.75}
    .panel{margin-top:1.5rem;display:flex;gap:.75rem;flex-wrap:wrap;align-items:center;border:1px solid rgba(0,229,255,.45);box-shadow:0 0 18px rgba(0,229,255,.25);padding:1rem;background:rgba(0,20,40,.55)}
    .pill{font-size:.65rem;padding:.2rem .45rem;border:1px solid #00e5ff;color:#00e5ff}
    input{flex:1;min-width:200px;background:transparent;border:1px solid rgba(124,77,255,.55);color:#dff;padding:.65rem .75rem;outline:none;box-shadow:0 0 10px rgba(124,77,255,.25)}
    button{border:0;background:linear-gradient(90deg,#00e5ff,#7c4dff);color:#020308;font-weight:800;padding:.65rem 1rem;cursor:pointer;box-shadow:0 0 20px rgba(0,229,255,.35)}
    .log{margin-top:1rem;min-height:4rem;border:1px dashed rgba(0,229,255,.35);padding:.75rem;white-space:pre-wrap;color:#9adfff}`,
    js: `
    document.getElementById("hack").addEventListener("click", () => {
      const v = (document.getElementById("vin").value || "").toUpperCase();
      document.getElementById("log").textContent = v.length >= 11
        ? "[OK] TRACE SPOOFED\\nHASH: 0x" + [...v].map((c)=>c.charCodeAt(0).toString(16)).join("").slice(0,32)
        : "[ERR] INSUFFICIENT BYTES";
    });`,
  },
  {
    n: 6,
    title: "Data Visualization Focus",
    goal: "Dashboard-first story with Chart.js graphs for synthetic risk and mileage.",
    tech: ["HTML", "CSS", "Vanilla JS", "Chart.js (CDN)"],
    features: ["Risk bar chart", "Mileage line chart", "Fake scores"],
    extraHead: `<script defer src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>`,
    html: `
    <div class="dash mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header><h1>Signal desk</h1><p class="muted">Demo charts — not real underwriting.</p></header>
      <div class="charts">
        <canvas id="cRisk" height="180"></canvas>
        <canvas id="cMileage" height="180"></canvas>
      </div>
      <button id="btn" type="button" class="btn">Randomize demo data</button>
    </div>`,
    css: `
    body{margin:0;background:#0a0c12;color:#e8ecf1;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .dash{max-width:1000px;margin:0 auto;padding:2rem 1.25rem 3rem}
    h1{margin:0 0 .25rem;font-size:1.6rem} .muted{margin:0;opacity:.65;font-size:.9rem}
    .charts{display:grid;gap:1.25rem;margin-top:1.5rem}
    @media(min-width:820px){.charts{grid-template-columns:1fr 1fr}}
    canvas{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:.75rem}
    .btn{margin-top:1rem;border:0;border-radius:12px;padding:.75rem 1.1rem;font-weight:600;cursor:pointer;background:#e8f0ff;color:#0a1020}`,
    js: `
    let riskChart, mileChart;
    function rand(){ return Math.round(40 + Math.random()*55); }
    function build() {
      const risk = document.getElementById("cRisk");
      const mile = document.getElementById("cMileage");
      if (typeof Chart === "undefined") { risk.insertAdjacentHTML("afterend", "<p>Chart.js blocked — use a static server.</p>"); return; }
      riskChart?.destroy(); mileChart?.destroy();
      riskChart = new Chart(risk, { type: "bar", data: { labels:["Regs","Dealers","Ads","Photos"], datasets:[{ label:"Risk factors", data:[rand(),rand(),rand(),rand()], backgroundColor:"rgba(0,102,255,.55)" }]}, options:{ plugins:{legend:{labels:{color:"#dfe3ea"}}}, scales:{ x:{ticks:{color:"#9aa3ad"},grid:{color:"rgba(255,255,255,.06)"}}, y:{ticks:{color:"#9aa3ad"},grid:{color:"rgba(255,255,255,.06)"}}}}});
      mileChart = new Chart(mile, { type: "line", data: { labels:["Y-5","Y-4","Y-3","Y-2","Y-1","Now"], datasets:[{ label:"Odometer (k km, fake)", data:[120,132,138,151,160,168].map((n)=>n+Math.round(Math.random()*6)), borderColor:"#9fe870", tension:.35, fill:false }]}, options:{ plugins:{legend:{labels:{color:"#dfe3ea"}}}, scales:{ x:{ticks:{color:"#9aa3ad"},grid:{color:"rgba(255,255,255,.06)"}}, y:{ticks:{color:"#9aa3ad"},grid:{color:"rgba(255,255,255,.06)"}}}}});
    }
    document.getElementById("btn").addEventListener("click", build);
    addEventListener("DOMContentLoaded", build);`,
  },
  {
    n: 7,
    title: "Split Screen Story",
    goal: "Sticky split layout: narrative on the left, vehicle canvas on the right.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["Two-column split", "Sticky visual rail", "Scroll-tied caption swaps"],
    html: `
    <div class="split grid min-h-screen w-full grid-cols-1 text-[#eef1f6] md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <div class="story">
        <p class="eyebrow">PROVIN / DEMO</p>
        <h1>Two lanes. One VIN.</h1>
        <p id="cap" class="cap">Scroll — the rail tracks while copy advances.</p>
        <div style="height:120vh"></div>
        <p class="cap">Dealer fingerprints and registry deltas converge in the final report.</p>
        <div style="height:80vh"></div>
      </div>
      <aside class="rail" aria-hidden="true">
        <div class="car"><div class="glow"></div><div class="vinbox">VIN</div></div>
      </aside>
    </div>`,
    css: `
    *{box-sizing:border-box}
    body{margin:0;background:#05060a;color:#eef1f6;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .split{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);min-height:100vh}
    .story{padding:clamp(1.5rem,4vw,3rem);max-width:640px}
    .eyebrow{letter-spacing:.22em;text-transform:uppercase;font-size:.68rem;opacity:.55}
    h1{font-size:clamp(2rem,4vw,3rem);line-height:1.05;margin:.5rem 0 1rem}
    .cap{opacity:.85;line-height:1.55}
    .rail{border-left:1px solid rgba(255,255,255,.08);position:relative}
    .car{position:sticky;top:0;height:100vh;display:grid;place-items:center;padding:2rem}
    .vinbox{width:min(420px,80%);aspect-ratio:16/10;border:1px solid rgba(255,255,255,.18);border-radius:18px;display:grid;place-items:center;font-weight:700;letter-spacing:.35em;background:radial-gradient(circle at 30% 20%,rgba(0,102,255,.35),rgba(0,0,0,.35))}
    .glow{position:absolute;inset:10%;background:radial-gradient(circle,rgba(0,102,255,.25),transparent 60%);filter:blur(40px)}
    @media(max-width:900px){.split{grid-template-columns:1fr}.rail{display:none}}`,
    js: `
    const cap = document.getElementById("cap");
    addEventListener("scroll", () => {
      const t = Math.min(1, scrollY / 400);
      cap.style.opacity = String(0.65 + 0.35 * (1 - t));
    });`,
  },
  {
    n: 8,
    title: "Interactive Timeline (vehicle history)",
    goal: "Vertical history spine with hover-expanded inspection nodes.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["Animated timeline rail", "Hover detail drawers", "Keyboard-focusable rows"],
    html: `
    <div class="wrap mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <h1>Ownership spine</h1>
      <p class="sub">Synthetic events for layout demo.</p>
      <ol class="tl">
        <li class="item"><button type="button" class="hit"><span class="dot"></span><span class="title">First registration</span><span class="meta">EU · 2016</span></button><div class="detail">Demo: registry stamp + region cluster.</div></li>
        <li class="item"><button type="button" class="hit"><span class="dot"></span><span class="title">Dealer service cluster</span><span class="meta">3 visits</span></button><div class="detail">Demo: invoices OCR placeholder.</div></li>
        <li class="item"><button type="button" class="hit"><span class="dot"></span><span class="title">Listing spike</span><span class="meta">Marketplaces</span></button><div class="detail">Demo: photo hash drift warning (fake).</div></li>
      </ol>
    </div>`,
    css: `
    body{margin:0;background:#0c0d12;color:#e9edf5;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .wrap{max-width:760px;margin:0 auto;padding:2.5rem 1.25rem}
    h1{margin:0 0 .35rem;font-size:1.75rem} .sub{margin:0 0 2rem;opacity:.65}
    .tl{list-style:none;margin:0;padding:0;border-left:2px solid rgba(255,255,255,.12);padding-left:1.25rem}
    .item{position:relative;margin:0 0 1rem}
    .hit{width:100%;text-align:left;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:inherit;padding:.85rem 1rem;border-radius:12px;display:grid;grid-template-columns:auto 1fr auto;gap:.75rem;align-items:center;cursor:pointer}
    .hit:hover,.item.open .hit{border-color:rgba(0,102,255,.45);box-shadow:0 0 0 1px rgba(0,102,255,.18) inset}
    .dot{width:10px;height:10px;border-radius:999px;background:#7eb6ff;box-shadow:0 0 12px rgba(126,182,255,.8)}
    .title{font-weight:650} .meta{font-size:.8rem;opacity:.55}
    .detail{display:none;margin:.5rem 0 0;padding:.75rem 1rem;border-radius:12px;border:1px dashed rgba(255,255,255,.14);background:rgba(0,0,0,.25);font-size:.9rem;line-height:1.45}
    .item.open .detail{display:block}`,
    js: `
    document.querySelectorAll(".hit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const li = btn.closest(".item");
        const open = li.classList.contains("open");
        document.querySelectorAll(".item").forEach((x) => x.classList.remove("open"));
        if (!open) li.classList.add("open");
      });
    });`,
  },
  {
    n: 9,
    title: "Dark → Light mode morphing",
    goal: "Theme toggle with smooth variable-driven transitions across surfaces.",
    tech: ["HTML", "CSS custom properties", "Vanilla JS"],
    features: ["Animated theme toggle", "CSS variables for surfaces", "Persisted preference (localStorage)"],
    html: `
    <div class="bar flex items-center justify-between border-b px-4 py-4 sm:px-5"><strong>PROVIN</strong><button id="t" type="button" aria-pressed="false">Theme</button></div>
    <div class="wrap mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <h1>Readable in any cockpit lighting.</h1>
      <p>Toggle morphs palette via CSS variables — demo only.</p>
      <div class="card"><h2>VIN</h2><input maxlength="17" placeholder="17 chars" /></div>
    </div>`,
    css: `
    :root[data-theme="dark"]{--bg:#07080d;--fg:#eef1f6;--card:#12141c;--bd:rgba(255,255,255,.12)}
    :root[data-theme="light"]{--bg:#f6f7fb;--fg:#0b0d12;--card:#ffffff;--bd:rgba(0,0,0,.10)}
    body{margin:0;background:var(--bg);color:var(--fg);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;transition:background .45s ease,color .45s ease}
    .bar{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;border-bottom:1px solid var(--bd)}
    button{border:1px solid var(--bd);background:transparent;color:inherit;padding:.55rem .9rem;border-radius:999px;cursor:pointer;transition:transform .2s ease}
    button:hover{transform:translateY(-1px)}
    .wrap{max-width:820px;margin:0 auto;padding:clamp(2rem,5vw,4rem) 1.25rem}
    h1{font-size:clamp(2rem,4vw,3rem);margin:0 0 1rem;line-height:1.05}
    .card{margin-top:2rem;padding:1.25rem;border-radius:16px;border:1px solid var(--bd);background:var(--card);transition:background .45s ease,border-color .45s ease}
    input{width:100%;margin-top:.75rem;padding:.85rem 1rem;border-radius:12px;border:1px solid var(--bd);background:transparent;color:inherit;font:inherit}`,
    js: `
    const root = document.documentElement;
    const saved = localStorage.getItem("provinc_demo_theme");
    root.dataset.theme = saved === "light" ? "light" : "dark";
    const btn = document.getElementById("t");
    function sync(){ const light = root.dataset.theme === "light"; btn.setAttribute("aria-pressed", String(light)); btn.textContent = light ? "Dark" : "Light"; }
    sync();
    btn.addEventListener("click", () => {
      root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
      localStorage.setItem("provinc_demo_theme", root.dataset.theme);
      sync();
    });`,
  },
  {
    n: 10,
    title: "Card-based modular UI",
    goal: "Composable tiles with hover expansion for dense feature discovery.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["Reusable card module", "Hover height expansion", "Accent rail"],
    html: `
    <div class="wrap mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <h1>Modular audit deck</h1>
      <div class="deck">
        <article class="card"><h2>Registries</h2><p>Cross-border stamps.</p><div class="more"><p>Demo detail: synthetic harmonization across EU clusters.</p></div></article>
        <article class="card"><h2>Dealers</h2><p>Workshop graph.</p><div class="more"><p>Demo detail: repeated VIN at independent chains.</p></div></article>
        <article class="card"><h2>Listings</h2><p>Market drift.</p><div class="more"><p>Demo detail: mileage deltas vs photo EXIF (fake).</p></div></article>
      </div>
    </div>`,
    css: `
    body{margin:0;background:#05060a;color:#e9edf5;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .wrap{max-width:1100px;margin:0 auto;padding:2.5rem 1.25rem}
    h1{margin:0 0 1.5rem;font-size:clamp(1.8rem,3vw,2.4rem)}
    .deck{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;align-items:start}
    .card{position:relative;border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:1.1rem 1.1rem 1.1rem 1.25rem;background:rgba(255,255,255,.04);overflow:hidden;transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease}
    .card::before{content:"";position:absolute;left:0;top:0;width:4px;height:100%;background:linear-gradient(180deg,#0066ff,#7cf0ff);opacity:.85}
    .card h2{margin:0 0 .35rem;font-size:1.05rem} .card>p{margin:0;opacity:.7;font-size:.92rem;line-height:1.45}
    .more{max-height:0;opacity:0;transition:max-height .45s ease,opacity .35s ease;margin-top:.75rem}
    .card:hover{transform:translateY(-4px);border-color:rgba(0,102,255,.35);box-shadow:0 18px 50px rgba(0,0,0,.35)}
    .card:hover .more{max-height:220px;opacity:1}`,
    js: `/* Hover expansion is CSS-driven */`,
  },
];
