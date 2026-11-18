// Tikai maketam: DZA pogas varianti. window.__dzaVariant(n)
window.__dzaVariant = function (v) {
  document.querySelectorAll('[data-provin-business],.pvdza').forEach((e) => (e.style.display = 'none'));
  if (!document.getElementById('pvdza-css')) {
    const st = document.createElement('style'); st.id = 'pvdza-css';
    st.textContent = `
.pvdza{all:unset;box-sizing:border-box;display:flex;align-items:center;width:100%;margin-top:1rem;cursor:pointer;font-family:Poppins,"Segoe UI",sans-serif;text-decoration:none}
.pvdza *{box-sizing:border-box}
.pvdza .wm{font-family:Inter,system-ui,sans-serif;font-weight:800;letter-spacing:-.035em;line-height:1;white-space:nowrap}
.pvdza .wm b{font-weight:800}
.pvdza svg{flex:none}
/* 1 tumši zils kā DZA teksts */
.v1{height:54px;background:#2c3e50;color:#fff;padding:0 18px;gap:14px}
.v1 .wm{font-size:22px}.v1 .wm b{color:#7fb2ff}
.v1 .t{flex:1;font-size:12px;text-wrap:balance;font-weight:600;line-height:1.25;padding-left:14px;border-left:1px solid rgba(255,255,255,.25)}
.v1 .p{font-size:18px;font-weight:700}
/* 2 DZA pogas tipogrāfija ar ikonu */
.v2{height:54px;justify-content:center;gap:12px;background:#2c3e50;color:#fff;font-size:20px;font-weight:600;text-transform:uppercase}
.v2 small{font-size:20px;font-weight:600;opacity:.7}
/* 3 balta ar grafīta apmali */
.v3{height:54px;justify-content:center;gap:12px;background:#fff;color:#313131;border:2px solid #313131;font-size:20px;font-weight:600;text-transform:uppercase}
.v3 .wm{font-size:22px}.v3 .wm b{color:#2563eb}
/* 4 kartītes stils kā PAMATINFORMĀCIJA */
.v4{background:#fff;border-radius:15px;box-shadow:0 5px 15px rgba(0,0,0,.08);padding:16px 20px;gap:16px;color:#2c3e50;border-bottom:3px solid #f6861e}
.v4 .wm{font-size:26px}.v4 .wm b{color:#2563eb}
.v4 .t{flex:1;font-size:14px;font-weight:600;line-height:1.3}
.v4 .t span{display:block;font-size:12px;font-weight:400;opacity:.75;margin-top:2px}
.v4 .p{font-size:20px;font-weight:700;white-space:nowrap}
/* 5 grafīts ar oranžu akcentu */
.v5{height:54px;background:#313131;color:#fff;padding:0 18px;gap:14px;border-left:6px solid #f6861e}
.v5 .wm{font-size:22px}.v5 .wm b{color:#f6861e}
.v5 .t{flex:1;font-size:12px;text-wrap:balance;font-weight:600;line-height:1.25}
.v5 .p{font-size:18px;font-weight:700}
/* 6 tikai teksts, kreisi */
.v6{height:54px;gap:14px;color:#2c3e50;padding:0 2px}
.v6 .wm{font-size:24px}.v6 .wm b{color:#2563eb}
.v6 .t{flex:1;font-size:13px;font-weight:600;line-height:1.25;padding-left:14px;border-left:1px solid rgba(44,62,80,.25);text-wrap:balance}
.v6 .p{font-size:19px;font-weight:700;white-space:nowrap}
/* 7 tikai teksts, centrēts kā DZA pogas */
.v7{height:54px;justify-content:center;gap:12px;color:#2c3e50;font-size:18px;font-weight:600}
.v7 .wm{font-size:24px}.v7 .wm b{color:#2563eb}
.v7 .dot{opacity:.35}
/* 8 tikai teksts, oranža cena */
.v8{height:54px;gap:14px;color:#2c3e50;padding:0 2px}
.v8 .wm{font-size:24px}.v8 .wm b{color:#2563eb}
.v8 .t{flex:1;font-size:13px;font-weight:600;line-height:1.25;text-wrap:balance}
.v8 .p{font-size:19px;font-weight:700;color:#f6861e;white-space:nowrap}
@media (max-width:575px){.v6,.v7,.v8{height:42px}.v6 .wm,.v8 .wm,.v7 .wm{font-size:19px}.v6 .t,.v8 .t{font-size:11px}.v6 .p,.v8 .p{font-size:15px}.v7{font-size:14px;gap:8px}.v6,.v8{gap:10px}.v6 .t{padding-left:10px}}
@media (max-width:575px){.v1,.v2,.v3,.v5{height:42px}.v2,.v3{font-size:15px;gap:8px}.v2 small{font-size:15px}.v3 .wm{font-size:17px}
.v1 .wm,.v5 .wm{font-size:19px}.v1 .t,.v5 .t{font-size:11px}.v1 .p,.v5 .p{font-size:15px}.v1,.v5{gap:10px;padding:0 12px}.v1 .t{padding-left:10px}
.v4{padding:12px 14px;gap:12px}.v4 .wm{font-size:20px}.v4 .t{font-size:12.5px}.v4 .t span{font-size:11px}.v4 .p{font-size:16px}}
`;
    document.head.appendChild(st);
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@800&display=swap'; document.head.appendChild(l);
  }
  if (v === 0) { document.querySelectorAll('[data-provin-business]').forEach((e) => (e.style.display = '')); return; }
  const shield = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>';
  const chev = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  const html = {
    1: `<span class="wm">PRO<b>VIN</b></span><span class="t">Pilnīgākā auto vēstures pārbaude Eiropā</span><span class="p">69,99 €</span>${chev}`,
    2: `${shield}<span>Pārbaudīt vēsturi</span><small>· 69,99 €</small>`,
    3: `<span class="wm">PRO<b>VIN</b></span><span>Vēstures pārbaude · 69,99 €</span>`,
    4: `<span class="wm">PRO<b>VIN</b></span><span class="t">Pilnīgākā auto vēstures pārbaude Eiropā<span>Dīlera serviss, reģistri, izsoles - vienā atskaitē</span></span><span class="p">69,99 €</span>`,
    6: `<span class="wm">PRO<b>VIN</b></span><span class="t">Pilnīgākā auto vēstures pārbaude Eiropā</span><span class="p">69,99 €</span>${chev}`,
    7: `<span class="wm">PRO<b>VIN</b></span><span>Vēstures pārbaude</span><span class="dot">·</span><span>69,99 €</span>${chev}`,
    8: `<span class="wm">PRO<b>VIN</b></span><span class="t">Pilnīgākā auto vēstures pārbaude Eiropā</span><span class="p">69,99 €</span>${chev}`,
    5: `<span class="wm">PRO<b>VIN</b></span><span class="t">Pilnīgākā auto vēstures pārbaude Eiropā</span><span class="p">69,99 €</span>${chev}`,
  }[v];
  const a = document.createElement('a'); a.className = `pvdza v${v}`; a.href = '#'; a.innerHTML = html;
  const spec = window.__dzaUnderSpecs ? document.querySelector('.car-specs-card') : null;
  if (spec) { a.style.marginTop = '0'; spec.insertAdjacentElement('afterend', a); } else document.querySelector('.btn-favorite').insertAdjacentElement('afterend', a);
};
