/** Static landing specs — concepts 11–20 */
export const specs11_20 = [
  {
    n: 11,
    title: "Futuristic Orb",
    goal: "Canvas-driven energy orb with pulsing gradients — no heavy WebGL stack.",
    tech: ["HTML", "CSS", "Canvas 2D", "Vanilla JS"],
    features: ["Animated gradient orb", "Pointer parallax nudge", "Lightweight loop"],
    html: `
    <div class="wrap">
      <canvas id="orb" width="900" height="520" aria-label="Animated orb"></canvas>
      <div class="copy">
        <h1>Orbital VIN scan</h1>
        <p>Soft pulsing field — demo shader-ish look in 2D.</p>
        <input id="vin" maxlength="17" placeholder="Optional VIN label" />
      </div>
    </div>`,
    css: `
    body{margin:0;background:radial-gradient(circle at 50% 20%,#0b1530,#020308);color:#e8eefc;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .wrap{max-width:980px;margin:0 auto;padding:2rem 1.25rem 3rem;display:grid;gap:1.25rem;justify-items:center}
    canvas{width:min(96vw,900px);height:auto;border-radius:22px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.25)}
    .copy{width:min(96vw,720px);text-align:center}
    h1{margin:.25rem 0 .5rem;font-size:clamp(1.8rem,3vw,2.4rem)}
    p{margin:0 0 1rem;opacity:.75}
    input{width:100%;max-width:520px;padding:.85rem 1rem;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.35);color:#fff;font:inherit;outline:none}`,
    js: `
    const c = document.getElementById("orb");
    const ctx = c.getContext("2d");
    let mx = 0, my = 0, t = 0;
    addEventListener("pointermove", (e) => { const r = c.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5; });
    function draw() {
      t += 0.016;
      const w = c.width, h = c.height;
      ctx.clearRect(0,0,w,h);
      const pulse = 0.55 + Math.sin(t * 2.2) * 0.08;
      const g = ctx.createRadialGradient(w*(.5+mx*.15), h*(.42+my*.12), 40, w*.5, h*.45, h*.65);
      g.addColorStop(0, "rgba(0,102,255," + (0.55*pulse) + ")");
      g.addColorStop(0.35, "rgba(126,240,255," + (0.25*pulse) + ")");
      g.addColorStop(0.7, "rgba(20,30,60," + (0.35*pulse) + ")");
      g.addColorStop(1, "rgba(2,3,8,0.95)");
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle = "rgba(255,255,255,.08)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(w/2, h/2, h*0.18 + Math.sin(t*3)*6, 0, Math.PI*2); ctx.stroke();
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);`,
  },
  {
    n: 12,
    title: "Typography-first Hero",
    goal: "Oversized headline hierarchy with subtle kinetic typography.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["Clamp mega type", "Split-line motion", "Scroll-linked skew micro"],
    html: `
    <section class="hero">
      <p class="eyebrow">PROVIN</p>
      <h1 class="k1">Decode</h1>
      <h1 class="k2">the machine</h1>
      <p class="sub">Kinetic demo — transform driven by scroll.</p>
    </section>`,
    css: `
    body{margin:0;background:#f4f6fb;color:#07080d;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .hero{min-height:160vh;padding:clamp(2.5rem,8vw,6rem) 1.25rem}
    .eyebrow{letter-spacing:.35em;text-transform:uppercase;font-size:.72rem;opacity:.45;margin:0}
    .k1,.k2{margin:0;line-height:.9;font-weight:850;letter-spacing:-.04em;text-transform:uppercase}
    .k1{font-size:clamp(3.2rem,14vw,9rem);transform-origin:left center;transition:transform .15s ease-out}
    .k2{font-size:clamp(2.2rem,9vw,5.5rem);opacity:.85;transform-origin:left center;transition:transform .15s ease-out}
    .sub{max-width:46ch;margin-top:1.25rem;font-size:1.05rem;color:#2b3140}`,
    js: `
    const h = document.querySelector(".hero");
    const k1 = document.querySelector(".k1");
    const k2 = document.querySelector(".k2");
    addEventListener("scroll", () => {
      const p = Math.min(1, scrollY / (innerHeight * 0.9));
      k1.style.transform = "translateX(" + (p * 18) + "px) skewX(" + (-4 * p) + "deg)";
      k2.style.transform = "translateX(" + (-p * 10) + "px) skewX(" + (3 * p) + "deg)";
      h.style.opacity = String(1 - p * 0.15);
    });`,
  },
  {
    n: 13,
    title: "Bento Grid (iOS style)",
    goal: "Asymmetric tile grid with mixed card spans like Apple marketing grids.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["CSS grid spans", "Soft glass tiles", "Live clock micro-widget"],
    html: `
    <div class="page">
      <header><h1>Bento audit</h1><p id="clk" class="clk"></p></header>
      <div class="bento">
        <div class="tile a"><h2>VIN</h2><p>17 chars unlock the deck.</p><input maxlength="17" placeholder="·················" /></div>
        <div class="tile b"><h2>Risk</h2><p>Demo heat: <strong>Low</strong></p></div>
        <div class="tile c"><h2>Mileage</h2><p>Demo curve stable.</p></div>
        <div class="tile d"><h2>Listings</h2><p>3 clusters matched.</p></div>
        <div class="tile e"><h2>Export</h2><p>PDF / CSV placeholders.</p></div>
      </div>
    </div>`,
    css: `
    body{margin:0;background:#0b0d12;color:#e9edf5;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .page{max-width:1100px;margin:0 auto;padding:2rem 1.25rem 3rem}
    header{display:flex;justify-content:space-between;gap:1rem;align-items:baseline;flex-wrap:wrap}
    h1{margin:0;font-size:clamp(1.6rem,3vw,2.2rem)} .clk{margin:0;opacity:.55;font-size:.85rem;font-variant-numeric:tabular-nums}
    .bento{display:grid;gap:.85rem;grid-template-columns:repeat(6,1fr);grid-auto-rows:minmax(120px,auto);margin-top:1.25rem}
    .tile{border-radius:22px;padding:1.1rem;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
    .tile h2{margin:0 0 .35rem;font-size:1rem} .tile p{margin:0 0 .75rem;opacity:.75;font-size:.92rem;line-height:1.45}
    .tile input{width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.14);padding:.65rem .8rem;background:rgba(0,0,0,.25);color:#fff;font:inherit;outline:none}
    .a{grid-column:span 4;grid-row:span 2} .b{grid-column:span 2} .c{grid-column:span 2} .d{grid-column:span 3} .e{grid-column:span 3}
    @media(max-width:860px){.bento{grid-template-columns:repeat(2,1fr)}.a,.b,.c,.d,.e{grid-column:span 2}}`,
    js: `
    const clk = document.getElementById("clk");
    setInterval(() => { clk.textContent = new Date().toLocaleTimeString(); }, 250);`,
  },
  {
    n: 14,
    title: "Minimal form-first",
    goal: "Single VIN field with instant validation feedback — nothing else competes for attention.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["17-char VIN gate", "Live status chip", "No secondary chrome"],
    html: `
    <div class="wrap">
      <label for="vin">Vehicle Identification Number</label>
      <input id="vin" inputmode="text" autocomplete="off" maxlength="17" spellcheck="false" />
      <p id="msg" class="msg" role="status"></p>
    </div>`,
    css: `
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff;color:#0a0a0a;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .wrap{width:min(92vw,560px);padding:1rem}
    label{display:block;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#5c5f66;margin-bottom:.65rem}
    input{width:100%;font-size:clamp(1.4rem,4.5vw,2rem);padding:.85rem 0;border:0;border-bottom:2px solid #0a0a0a;background:transparent;letter-spacing:.14em;text-transform:uppercase;outline:none}
    .msg{margin:.85rem 0 0;font-size:.95rem;color:#3a3d44;min-height:1.25em}`,
    js: `
    const vin = document.getElementById("vin");
    const msg = document.getElementById("msg");
    function sync() {
      const v = vin.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (vin.value !== v) vin.value = v;
      if (!v) { msg.textContent = ""; return; }
      if (v.length < 17) { msg.textContent = "Need " + (17 - v.length) + " more characters"; return; }
      const bad = /[IOQ]/.test(v);
      msg.textContent = bad ? "Letters I, O, Q are not used in VINs" : "Format OK (demo only)";
    }
    vin.addEventListener("input", sync);`,
  },
  {
    n: 15,
    title: "Luxury Automotive",
    goal: "Dark metal canvas with champagne gold accents and slow cinematic motion.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["Gold gradient accents", "Soft vignette", "Ambient drift animation"],
    html: `
    <div class="lux">
      <div class="veil" aria-hidden="true"></div>
      <div class="inner">
        <p class="eyebrow">PROVIN · Atelier demo</p>
        <h1>Precision history<br/><span>for considered purchases.</span></h1>
        <div class="row"><input maxlength="17" placeholder="VIN" /><button type="button" id="go">Commission report</button></div>
      </div>
    </div>`,
    css: `
    body{margin:0;background:#030303;color:#f3efe8;font-family:"Georgia",ui-serif,serif}
    .lux{position:relative;min-height:100vh;overflow:hidden;background:radial-gradient(1200px at 20% 0%,#1a1208,#030303)}
    .veil{position:absolute;inset:-20%;background:conic-gradient(from 180deg at 50% 50%,rgba(212,175,55,.14),transparent 40%,rgba(212,175,55,.10),transparent 70%);animation:spin 28s linear infinite;opacity:.9}
    @keyframes spin{to{transform:rotate(360deg)}}
    .inner{position:relative;z-index:1;max-width:920px;margin:0 auto;padding:clamp(3rem,8vw,6rem) 1.25rem}
    .eyebrow{letter-spacing:.35em;text-transform:uppercase;font-size:.68rem;color:rgba(243,239,232,.55)}
    h1{margin:.75rem 0 1.5rem;font-size:clamp(2.2rem,5vw,3.6rem);line-height:1.05;font-weight:500}
    h1 span{color:rgba(243,239,232,.72);display:inline-block;margin-top:.35rem}
    .row{display:flex;gap:.75rem;flex-wrap:wrap;align-items:center}
    input{flex:1;min-width:220px;padding:.95rem 1rem;border-radius:999px;border:1px solid rgba(212,175,55,.35);background:rgba(0,0,0,.35);color:#f3efe8;font:inherit;outline:none;box-shadow:0 0 0 1px rgba(212,175,55,.12) inset}
    button{border:0;border-radius:999px;padding:.95rem 1.35rem;font:inherit;font-weight:600;cursor:pointer;color:#1a1208;background:linear-gradient(135deg,#f3e7c8,#d4af37);box-shadow:0 18px 60px rgba(212,175,55,.25)}`,
    js: `
    document.getElementById("go").addEventListener("click", () => alert("Demo only — no report is generated."));`,
  },
  {
    n: 16,
    title: "Hacker Style Terminal",
    goal: "CLI fantasy: VIN entry as a shell command with printed audit lines.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["Fake shell prompt", "Command parsing", "Typed log lines"],
    html: `
    <div class="term">
      <div id="log" class="log" aria-live="polite"></div>
      <form id="f" class="row"><span class="prompt">provinc@audit:~$</span><input id="cmd" autocomplete="off" spellcheck="false" /></form>
    </div>`,
    css: `
    body{margin:0;background:#000;color:#33ff66;font-family:ui-monospace,Menlo,Consolas,monospace}
    .term{min-height:100vh;padding:1rem 1rem 2rem;max-width:900px;margin:0 auto}
    .log{white-space:pre-wrap;line-height:1.45;font-size:.9rem;min-height:40vh;border:1px solid #113311;padding:.75rem;background:#020802}
    .row{display:flex;gap:.5rem;align-items:center;margin-top:.75rem}
    .prompt{opacity:.75;flex:0 0 auto}
    input{flex:1;background:transparent;border:0;color:#33ff66;font:inherit;outline:none}`,
    js: `
    const log = document.getElementById("log");
    function println(s){ log.textContent += s + "\\n"; log.scrollTop = log.scrollHeight; }
    println("provinc-audit-shell v0 (demo)");
    println("try: decode <VIN>");
    document.getElementById("f").addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = document.getElementById("cmd").value.trim();
      document.getElementById("cmd").value = "";
      println("$ " + raw);
      const m = raw.match(/^decode\\s+([A-Z0-9]{11,17})$/i);
      if (!m) { println("err: usage decode <VIN>"); return; }
      const v = m[1].toUpperCase();
      println("[info] normalizing…");
      println("[ok] checksum: FAKE");
      println("[ok] wmi: " + v.slice(0,3) + " (demo)");
    });`,
  },
  {
    n: 17,
    title: "Scroll storytelling",
    goal: "Apple-like tall page: panels shift with scroll for a product-story rhythm.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["Parallax layers", "Pinned headline", "Section opacity choreography"],
    html: `
    <div class="story">
      <section class="panel p1"><div class="blob"></div><h1>Read the car<br/>like a brief.</h1></section>
      <section class="panel p2"><h2>Registries</h2><p>Cross-check stamps across EU clusters — demo copy.</p></section>
      <section class="panel p3"><h2>Dealers</h2><p>Independent chains leave fingerprints — demo copy.</p></section>
      <section class="panel p4"><h2>Listings</h2><p>Marketplaces echo mileage claims — demo copy.</p></section>
    </div>`,
    css: `
    body{margin:0;background:#020308;color:#e9edf5;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .story{overflow-x:hidden}
    .panel{min-height:110vh;padding:clamp(3rem,10vw,7rem) clamp(1.25rem,4vw,3rem);position:relative}
    h1,h2{margin:0;line-height:1.05}
    h1{font-size:clamp(2.4rem,6vw,4rem);font-weight:750;position:sticky;top:18vh}
    h2{font-size:clamp(1.6rem,3vw,2.2rem);margin-bottom:.75rem}
    p{max-width:52ch;opacity:.78;line-height:1.55}
    .blob{position:absolute;inset:-20% 10% auto; height:70vh;border-radius:40%;filter:blur(60px);opacity:.55;background:radial-gradient(circle at 30% 30%,rgba(0,102,255,.55),transparent 60%);transform:translateY(var(--ty,0))}`,
    js: `
    const blob = document.querySelector(".blob");
    addEventListener("scroll", () => {
      const y = scrollY * 0.12;
      blob.style.setProperty("--ty", y + "px");
      document.querySelectorAll(".panel").forEach((p) => {
        const r = p.getBoundingClientRect();
        const vis = 1 - Math.min(1, Math.abs(r.top + r.height/2 - innerHeight/2) / (innerHeight*0.9));
        p.style.opacity = String(0.35 + 0.65 * vis);
      });
    });`,
  },
  {
    n: 18,
    title: "Video-first landing",
    goal: "Cinematic background with readable overlay UI. Uses a lightweight sample clip via HTTPS.",
    tech: ["HTML", "CSS", "Vanilla JS", "HTML5 video"],
    features: ["Muted background video", "Gradient scrim", "Overlay CTA"],
    html: `
    <div class="stage">
      <video class="bg" autoplay muted loop playsinline>
        <source src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm" type="video/webm" />
      </video>
      <div class="scrim"></div>
      <div class="ui">
        <h1>See the story move.</h1>
        <p>Replace with your own clip in <code>assets/</code> for production.</p>
        <a class="btn" href="#vin">Continue</a>
        <div id="vin" class="vin"><input maxlength="17" placeholder="VIN" /></div>
      </div>
    </div>`,
    css: `
    body{margin:0;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;color:#fff}
    .stage{position:relative;min-height:100vh;overflow:hidden;background:#000}
    .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(1.05) contrast(1.05)}
    .scrim{position:absolute;inset:0;background:linear-gradient(120deg,rgba(2,3,12,.82),rgba(2,3,12,.35),rgba(0,102,255,.18))}
    .ui{position:relative;z-index:1;min-height:100vh;display:grid;align-content:end;padding:clamp(2rem,6vw,4rem) clamp(1.25rem,4vw,3rem);gap:.75rem;max-width:760px}
    h1{margin:0;font-size:clamp(2rem,5vw,3.2rem);line-height:1.05;text-shadow:0 12px 40px rgba(0,0,0,.45)}
    p{margin:0;opacity:.85;max-width:52ch;line-height:1.5}
    code{font-size:.9em;background:rgba(255,255,255,.12);padding:.1rem .35rem;border-radius:6px}
    .btn{display:inline-flex;width:max-content;padding:.75rem 1.1rem;border-radius:999px;background:#fff;color:#05060a;font-weight:700;text-decoration:none;margin-top:.25rem}
    .vin{margin-top:1rem}
    .vin input{width:min(520px,100%);padding:.85rem 1rem;border-radius:14px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.35);color:#fff;font:inherit;outline:none}`,
    js: `
    const v = document.querySelector(".bg");
    v.play?.().catch(()=>{});`,
  },
  {
    n: 19,
    title: "Minimal monochrome (white theme)",
    goal: "Strict black/white system with contrast through scale and spacing alone.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["No chroma accents", "Bold type ramp", "Grid rhythm"],
    html: `
    <div class="wrap">
      <header><span>PROVIN</span><span>DEMO</span></header>
      <h1>Monochrome<br/>audit lane</h1>
      <p>Only black, white, and greys appear in this concept.</p>
      <div class="grid">
        <div><h2>VIN</h2><input maxlength="17" /></div>
        <div><h2>Output</h2><pre id="o"></pre></div>
      </div>
    </div>`,
    css: `
    :root{--b:#050505;--w:#ffffff;--g:#6b6b6b}
    body{margin:0;background:var(--w);color:var(--b);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .wrap{max-width:980px;margin:0 auto;padding:clamp(2rem,5vw,4rem) 1.25rem}
    header{display:flex;justify-content:space-between;font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;color:var(--g);border-bottom:1px solid #000;padding-bottom:.75rem}
    h1{margin:1.25rem 0 1rem;font-size:clamp(2.4rem,7vw,4.6rem);line-height:.95;font-weight:850;letter-spacing:-.04em}
    p{margin:0 0 2rem;max-width:52ch;color:var(--g);line-height:1.55}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem}
    h2{margin:0 0 .5rem;font-size:1rem;letter-spacing:.12em;text-transform:uppercase}
    input{width:100%;padding:.85rem .9rem;border:2px solid #000;background:#fff;color:#000;font:inherit;letter-spacing:.12em;text-transform:uppercase}
    pre{margin:0;min-height:120px;border:2px solid #000;padding:.85rem;background:#fafafa;color:#000;overflow:auto}
    @media(max-width:760px){.grid{grid-template-columns:1fr}}`,
    js: `
    document.querySelector("input").addEventListener("input", (e) => {
      const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"");
      e.target.value = v;
      document.getElementById("o").textContent = v.length >= 11 ? "DEMO OK\\n" + v : "";
    });`,
  },
  {
    n: 20,
    title: "SaaS Startup style",
    goal: "Classic SaaS marketing stack: hero, pricing cards, testimonials.",
    tech: ["HTML", "CSS", "Vanilla JS"],
    features: ["Three-tier pricing", "Fake testimonials", "Simple annual toggle demo"],
    html: `
    <header class="top">
      <strong>PROVIN</strong>
      <nav><a href="#p">Pricing</a><a href="#t">Love</a></nav>
    </header>
    <section class="hero">
      <h1>Vehicle intelligence for teams.</h1>
      <p>Demo pricing — numbers are fictional.</p>
      <label class="tog"><input id="annual" type="checkbox" checked /> Annual billing</label>
    </section>
    <section id="p" class="pricing">
      <article class="price"><h2>Starter</h2><p class="amt" data-a="49" data-m="59">€49</p><ul><li>10 reports</li><li>Email support</li></ul><button type="button">Choose</button></article>
      <article class="price featured"><h2>Pro</h2><p class="amt" data-a="129" data-m="159">€129</p><ul><li>100 reports</li><li>Priority queue</li></ul><button type="button">Choose</button></article>
      <article class="price"><h2>Scale</h2><p class="amt" data-a="399" data-m="499">€399</p><ul><li>API access (fake)</li><li>Account manager</li></ul><button type="button">Choose</button></article>
    </section>
    <section id="t" class="love">
      <h2>Loved by demo buyers</h2>
      <div class="quotes">
        <figure><blockquote>“We ship faster decisions now.”</blockquote><figcaption>— Alex, Fleet Ops (fake)</figcaption></figure>
        <figure><blockquote>“Feels like a serious diligence tool.”</blockquote><figcaption>— Dana, VC (fake)</figcaption></figure>
      </div>
    </section>`,
    css: `
    body{margin:0;background:#f6f7fb;color:#0b1020;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .top{max-width:1100px;margin:0 auto;padding:1rem 1.25rem;display:flex;justify-content:space-between;align-items:center;gap:1rem}
    nav{display:flex;gap:1rem} a{color:inherit;text-decoration:none;font-weight:600;opacity:.75}
    .hero{max-width:900px;margin:0 auto;padding:3rem 1.25rem 1rem;text-align:center}
    h1{margin:0 0 .75rem;font-size:clamp(2rem,4vw,3rem);line-height:1.05}
    .tog{display:inline-flex;gap:.5rem;align-items:center;margin-top:1rem;font-size:.95rem}
    .pricing{max-width:1100px;margin:0 auto;padding:2rem 1.25rem 3rem;display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
    .price{border:1px solid rgba(0,0,0,.10);border-radius:18px;padding:1.25rem;background:#fff}
    .featured{border-color:rgba(0,102,255,.45);box-shadow:0 18px 60px rgba(0,102,255,.12)}
    .amt{font-size:2rem;font-weight:800;margin:.25rem 0 1rem}
    ul{margin:0 0 1rem;padding-left:1.1rem;color:#2b3140;line-height:1.45}
    button{width:100%;border:0;border-radius:12px;padding:.85rem;font-weight:700;cursor:pointer;background:#0b1020;color:#fff}
    .love{max-width:980px;margin:0 auto;padding:2rem 1.25rem 4rem}
    .quotes{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
    figure{margin:0;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:1rem;background:#fff}
    blockquote{margin:0 0 .5rem} figcaption{font-size:.85rem;color:#5c6470}
    @media(max-width:900px){.pricing{grid-template-columns:1fr}.quotes{grid-template-columns:1fr}}`,
    js: `
    const chk = document.getElementById("annual");
    function sync() {
      document.querySelectorAll(".amt").forEach((el) => {
        const n = chk.checked ? el.dataset.a : el.dataset.m;
        el.textContent = "€" + n;
      });
    }
    chk.addEventListener("change", sync); sync();`,
  },
];
