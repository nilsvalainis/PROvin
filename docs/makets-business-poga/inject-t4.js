// Tikai vizuālam maketam: ievieto PROVIN T4 pogu (U2 stils) zem cenas partnera lapā.
// Lietošana: window.__pvInject(cenasElements)
(function () {
  const css = `
  .pvx{all:initial;display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;color:inherit;text-decoration:none;cursor:pointer;
    font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:15px;line-height:1.2;white-space:nowrap;
    padding:14px 0;margin:14px 0;border-top:1px solid color-mix(in srgb,currentColor 18%,transparent);border-bottom:1px solid color-mix(in srgb,currentColor 18%,transparent)}
  .pvx *{all:unset}
  .pvx .wm{font-weight:800;letter-spacing:-.01em}
  .pvx .wm i{font-style:normal;color:#2563eb}
  .pvx[data-dark] .wm i{color:#5c9dff}
  .pvx .act{font-weight:500}
  .pvx .p{margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums}
  .pvx svg{display:block;width:16px;height:16px;flex:none}
  .pvx svg path{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}`;
  if (!document.getElementById('pvx-css')) {
    const l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&display=swap'; document.head.appendChild(l);
    const s = document.createElement('style'); s.id = 'pvx-css'; s.textContent = css; document.head.appendChild(s);
  }
  window.__pvInject = function (anchor, opts) {
    opts = opts || {};
    document.querySelectorAll('.pvx').forEach((e) => e.remove());
    const a = document.createElement('a');
    a.className = 'pvx'; a.href = '#';
    if (opts.dark) a.setAttribute('data-dark', '');
    a.innerHTML = '<span class="wm">PRO<i>VIN</i></span><span class="act">Visas datubāzes. Viena atskaite.</span><span class="p">69,99 €</span><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    if (opts.color) a.style.color = opts.color;
    anchor.insertAdjacentElement(opts.where || 'afterend', a);
    const fit = () => { let f = 15; a.style.fontSize = f + 'px'; while (a.scrollWidth > a.clientWidth && f > 11.5) { f -= 0.25; a.style.fontSize = f + 'px'; } };
    document.fonts.ready.then(fit); setTimeout(fit, 400);
    a.scrollIntoView({ block: 'center' });
    return { w: a.clientWidth, sw: a.scrollWidth };
  };
})();
