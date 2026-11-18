// Vizuālam maketam: GALA PROVIN poga (stikls, B8 ļoti tievs ›). Tikai maketam.
window.__pvG = async function (anchor, o) {
  o = o || {};
  if (!document.getElementById('pvGcss')) {
    const st = document.createElement('style'); st.id = 'pvGcss';
    st.textContent = `
.pvG{all:initial;position:relative;overflow:hidden;display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;cursor:pointer;padding:0 16px 0 18px;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;color:#0c0d10;background:linear-gradient(160deg,#ffffff 0%,#eceef2 100%);border:1px solid rgba(0,0,0,.12);box-shadow:inset 0 1px 0 #fff,0 10px 24px -16px rgba(0,0,0,.35)}
.pvG::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.75) 48%,transparent 58%)}
.pvG span,.pvG i{all:unset}
.pvG .wm{position:relative;z-index:1;flex:none;font-weight:800;font-size:24px;letter-spacing:-.035em;line-height:1;white-space:nowrap}
.pvG .wm i{font-style:normal;color:#2563eb}
.pvG .act{position:relative;z-index:1;flex:1;min-width:0;font-size:13px;font-weight:600;line-height:1.25;white-space:normal;text-wrap:balance;padding-left:14px;border-left:1px solid rgba(0,0,0,.14)}
.pvG .end{position:relative;z-index:1;flex:none;display:flex;align-items:center;gap:8px}
.pvG .p{font-weight:800;font-size:17px;white-space:nowrap}
.pvG .go{display:block;line-height:0}
.pvG svg{display:block;width:20px;height:20px}
.pvG svg path{fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
.pvG.dark{color:#fff;background:linear-gradient(160deg,#23262e 0%,#0e0f13 100%);border-color:rgba(255,255,255,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 14px 30px -18px rgba(0,0,0,.65)}
.pvG.dark::after{background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.10) 48%,transparent 58%)}
.pvG.dark .wm i{color:#5c9dff}
.pvG.dark .act{border-left-color:rgba(255,255,255,.18)}`;
    document.head.appendChild(st);
    const l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800&display=swap'; document.head.appendChild(l);
  }
  document.querySelectorAll('.pvG').forEach((e) => e.remove());
  const a = document.createElement('a'); a.className = 'pvG' + (o.dark ? ' dark' : '');
  a.innerHTML = '<span class="wm">PRO<i>VIN</i></span><span class="act">Pilnīgākā auto vēstures pārbaude Eiropā</span><span class="end"><span class="p">69,99 €</span><span class="go"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></span></span>';
  a.style.height = (o.h || 60) + 'px'; a.style.borderRadius = o.radius || '0px'; a.style.margin = o.margin || '0';
  anchor.insertAdjacentElement(o.where || 'afterend', a);
  await document.fonts.ready; await new Promise((r) => setTimeout(r, 1500));
  const act = a.querySelector('.act'), wm = a.querySelector('.wm'), p = a.querySelector('.p');
  const lines = () => Math.round(act.getBoundingClientRect().height / parseFloat(getComputedStyle(act).lineHeight));
  let k = 1;
  while ((lines() > 2 || a.scrollWidth > a.clientWidth) && k > 0.66) { k -= 0.02; wm.style.fontSize = 24 * k + 'px'; act.style.fontSize = Math.max(11.5, 13 * k) + 'px'; p.style.fontSize = 17 * k + 'px'; }
  if (lines() > 2 || a.scrollWidth > a.clientWidth) { a.style.gap = '10px'; a.style.paddingLeft = '14px'; a.style.paddingRight = '12px'; act.style.paddingLeft = '10px'; }
  return { h: a.offsetHeight, w: a.clientWidth, lines: lines(), fit: a.scrollWidth <= a.clientWidth, wm: wm.style.fontSize || '24px' };
};
