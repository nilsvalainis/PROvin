// Vizuālam maketam: 3 uzkrītošāki varianti bez rāmja (P1, P2, P3), viena rinda.
(function () {
  const css = `
  .pvp{all:initial;position:relative;display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;color:inherit;text-decoration:none;cursor:pointer;
    font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:18px;line-height:1.2;white-space:nowrap;margin:22px 0 8px}
  .pvp span,.pvp i,.pvp b{all:unset}
  .pvp::before{content:attr(data-label);position:absolute;top:-16px;left:0;font:600 10px/1 Inter,system-ui,sans-serif;letter-spacing:.12em;color:#9ca3af}
  .pvp .wm{font-weight:800;letter-spacing:-.02em}
  .pvp .wm i{font-style:normal;color:#2563eb}
  .pvp[data-dark] .wm i{color:#5c9dff}
  .pvp .act{font-weight:700;letter-spacing:-.015em}
  .pvp .p{margin-left:auto;font-weight:800;font-variant-numeric:tabular-nums;color:#2563eb}
  .pvp[data-dark] .p{color:#5c9dff}
  .pvp svg{display:block;flex:none}
  .pvp svg path{fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}

  /* P1: biezas līnijas virs un zem */
  .pvp.p1{padding:16px 0;border-top:2px solid currentColor;border-bottom:2px solid currentColor}
  .pvp.p1 svg{width:20px;height:20px;color:#2563eb}
  .pvp.p1[data-dark] svg{color:#5c9dff}

  /* P2: zila vertikāla svītra kreisajā malā */
  .pvp.p2{padding:12px 0 12px 16px;border-left:4px solid #2563eb}
  .pvp.p2[data-dark]{border-left-color:#5c9dff}
  .pvp.p2 svg{width:20px;height:20px;color:#2563eb}

  /* P3: zils aplis ar bultu + zila apakšlīnija */
  .pvp.p3{padding:12px 0 14px;border-bottom:3px solid #2563eb}
  .pvp.p3[data-dark]{border-bottom-color:#5c9dff}
  .pvp.p3 .go{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#2563eb;color:#fff;flex:none}
  .pvp.p3[data-dark] .go{background:#5c9dff;color:#000}
  .pvp.p3 .go svg{width:17px;height:17px}`;
  if (!document.getElementById('pvp-css')) {
    const l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap'; document.head.appendChild(l);
    const s = document.createElement('style'); s.id = 'pvp-css'; s.textContent = css; document.head.appendChild(s);
  }
  const arrow = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  window.__pvpInject = function (anchor, opts) {
    opts = opts || {};
    document.querySelectorAll('.pvp').forEach((e) => e.remove());
    let prev = anchor;
    const out = [];
    ['p1', 'p2', 'p3'].forEach((v) => {
      const a = document.createElement('a');
      a.className = 'pvp ' + v; a.href = '#'; a.dataset.label = v.toUpperCase();
      if (opts.dark) a.setAttribute('data-dark', '');
      const go = v === 'p3' ? '<span class="go">' + arrow + '</span>' : arrow;
      a.innerHTML = '<span class="wm">PRO<i>VIN</i></span><span class="act">Visas datubāzes. Viena atskaite.</span><span class="p">69,99 €</span>' + go;
      if (opts.color) a.style.color = opts.color;
      prev.insertAdjacentElement('afterend', a); prev = a; out.push(a);
    });
    const fit = () => out.forEach((a) => { let f = 18; a.style.fontSize = f + 'px'; while (a.scrollWidth > a.clientWidth && f > 12) { f -= 0.25; a.style.fontSize = f + 'px'; } });
    document.fonts.ready.then(fit); setTimeout(fit, 500);
    return out;
  };
})();
