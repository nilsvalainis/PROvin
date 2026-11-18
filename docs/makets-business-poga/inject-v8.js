// Vizuālam maketam: PROVIN poga v8 - melns/balts stikls ar gradientu kā provin.lv sākumlapā.
window.__pv8 = async function (anchor, ref, opts) {
  opts = opts || {};
  if (!document.getElementById('pv8css')) {
    const st = document.createElement('style'); st.id = 'pv8css';
    st.textContent = `
.pv8{all:initial;position:relative;overflow:hidden;display:flex;align-items:center;gap:16px;width:100%;box-sizing:border-box;cursor:pointer;
  min-height:80px;padding:16px 18px 16px 22px;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;
  color:#fff;background:linear-gradient(160deg,#23262e 0%,#0e0f13 100%);
  border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 14px 30px -18px rgba(0,0,0,.65)}
.pv8::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.10) 48%,transparent 58%)}
.pv8 span,.pv8 i{all:unset}
.pv8 .wm{position:relative;z-index:1;flex:none;font-weight:800;font-size:28px;letter-spacing:-.035em;line-height:1;white-space:nowrap}
.pv8 .wm i{font-style:normal;color:#5c9dff}
.pv8 .act{position:relative;z-index:1;flex:1;min-width:0;font-size:14px;font-weight:600;line-height:1.3;white-space:normal;text-wrap:balance;
  padding-left:16px;border-left:1px solid rgba(255,255,255,.18);opacity:.92}
.pv8 .end{position:relative;z-index:1;flex:none;display:flex;align-items:center;gap:10px}
.pv8 .p{font-weight:800;font-size:18px;white-space:nowrap;font-variant-numeric:tabular-nums}
.pv8 .go{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.16)}
.pv8 svg{width:15px;height:15px;display:block}
.pv8 svg path{fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.pv8.light{color:#0c0d10;background:linear-gradient(160deg,#ffffff 0%,#eceef2 100%);border-color:rgba(0,0,0,.10);
  box-shadow:inset 0 1px 0 #fff,0 14px 30px -18px rgba(0,0,0,.35)}
.pv8.light::after{background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.7) 48%,transparent 58%)}
.pv8.light .wm i{color:#2563eb}
.pv8.light .act{border-left-color:rgba(0,0,0,.14)}
.pv8.light .go{background:#0c0d10;color:#fff;border-color:#0c0d10}`;
    document.head.appendChild(st);
    const l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800&display=swap'; document.head.appendChild(l);
  }
  document.querySelectorAll('.pv8').forEach((e) => e.remove());
  const a = document.createElement('a'); a.className = 'pv8' + (opts.light ? ' light' : '');
  a.innerHTML = '<span class="wm">PRO<i>VIN</i></span><span class="act">Pilnīgākā auto vēstures pārbaude Eiropā</span>' +
    '<span class="end"><span class="p">69,99 €</span><span class="go"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></span>';
  a.style.borderRadius = ref ? getComputedStyle(ref).borderRadius : '16px';
  a.style.margin = opts.margin || '10px 0 0';
  anchor.insertAdjacentElement(opts.where || 'afterend', a);
  await document.fonts.ready; await new Promise((r) => setTimeout(r, 500));
  const act = a.querySelector('.act'), wm = a.querySelector('.wm'), p = a.querySelector('.p');
  const lines = () => Math.round(act.getBoundingClientRect().height / parseFloat(getComputedStyle(act).lineHeight));
  let k = 1;
  while ((lines() > 2 || a.scrollWidth > a.clientWidth) && k > 0.7) { k -= 0.02; wm.style.fontSize = 28 * k + 'px'; act.style.fontSize = Math.max(12, 14 * k) + 'px'; p.style.fontSize = 18 * k + 'px'; }
  if (lines() > 2 || a.scrollWidth > a.clientWidth) { a.querySelector('.go').style.display = 'none'; }
  return { r: a.style.borderRadius, h: a.offsetHeight, lines: lines(), fit: a.scrollWidth <= a.clientWidth, wm: wm.style.fontSize || '28px' };
};
