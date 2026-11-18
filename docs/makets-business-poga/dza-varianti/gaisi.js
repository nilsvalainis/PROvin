// Tikai maketam: gaiši DZA pogas varianti A-D. window.__dzaGaiss('A')
window.__dzaGaiss = function (v) {
  document.querySelectorAll('[data-provin-business],.pvg').forEach((e) => (e.style.display = 'none'));
  if (!document.getElementById('pvg-css')) {
    const st = document.createElement('style'); st.id = 'pvg-css';
    st.textContent = `
.pvg{all:unset;box-sizing:border-box;display:flex;align-items:center;width:100%;height:54px;margin-top:1rem;padding:0 18px;gap:14px;cursor:pointer;font-family:Inter,system-ui,sans-serif;color:#2c3e50;text-decoration:none}
.pvg *{box-sizing:border-box}
.pvg .wm{font-weight:800;letter-spacing:-.035em;line-height:1;white-space:nowrap;font-size:22px;color:#1f2937}
.pvg .wm b{font-weight:800;color:#2563eb}
.pvg .t{flex:1;font-size:13px;font-weight:500;line-height:1.25;text-wrap:balance}
.pvg .p{font-size:17px;font-weight:600;white-space:nowrap}
.pvg svg{flex:none;opacity:.5}
/* A - gaišs laukums, bez rāmja un ēnas */
.pvgA{background:#f4f5f7}
.pvgA .t{padding-left:14px;border-left:1px solid #dfe3e8}
/* B - balts ar plānu, gaišu līniju */
.pvgB{background:#fff;border:1px solid #e5e8ec}
/* C - viena rinda centrā, gaišs laukums */
.pvgC{background:#f4f5f7;justify-content:center;gap:10px;font-size:15px;font-weight:500}
.pvgC .wm{font-size:19px}
.pvgC .dot{opacity:.35}
/* D - viegls zils tonis */
.pvgD{background:#f1f5fc}
.pvgD .p{color:#2563eb}
@media (max-width:575px){.pvg{height:42px;padding:0 12px;gap:10px}.pvg .wm{font-size:18px}.pvg .t{font-size:11px}.pvg .p{font-size:14px}.pvgA .t{padding-left:10px}.pvgC{font-size:13px;gap:7px}.pvgC .wm{font-size:16px}}
`;
    document.head.appendChild(st);
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@500;600;800&display=swap'; document.head.appendChild(l);
  }
  const chev = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  const html = {
    A: `<span class="wm">PRO<b>VIN</b></span><span class="t">Pilnīgākā auto vēstures pārbaude Eiropā</span><span class="p">69,99 €</span>${chev}`,
    B: `<span class="wm">PRO<b>VIN</b></span><span class="t">Pilnīgākā auto vēstures pārbaude Eiropā</span><span class="p">69,99 €</span>${chev}`,
    C: `<span class="wm">PRO<b>VIN</b></span><span>Auto vēstures pārbaude</span><span class="dot">·</span><span>69,99 €</span>${chev}`,
    D: `<span class="wm">PRO<b>VIN</b></span><span class="t">Pilnīgākā auto vēstures pārbaude Eiropā</span><span class="p">69,99 €</span>${chev}`,
  }[v];
  const a = document.createElement('a'); a.className = `pvg pvg${v}`; a.href = '#'; a.innerHTML = html;
  document.querySelector('.btn-favorite').insertAdjacentElement('afterend', a);
};
