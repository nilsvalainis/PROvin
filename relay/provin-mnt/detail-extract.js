// Runs inside the mnt.ee detail page (soidukDetailvaadeAvalik.jsf). Returns plain JSON.
() => {
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const root = document.querySelector("#soidukDetailid") || document.body;
  const title = document.querySelector(".content-title");
  const header = {
    regMark: clean(title?.querySelector("h1")?.textContent),
    makeModel: clean(title?.querySelectorAll("p")[0]?.textContent),
    vin: clean(title?.querySelectorAll("p")[1]?.textContent).replace(/^VIN:\s*/i, ""),
  };
  const cellVal = (td) => {
    const t = clean(td.innerText);
    if (t && !td.querySelector(".icon")) return t;
    const icon = td.querySelector(".icon");
    const cls = icon ? icon.className : "";
    const st = /success/.test(cls) ? "OK" : /error|fail|danger/.test(cls) ? "FAIL" : /warn/.test(cls) ? "WARN" : "";
    const tip = clean(td.querySelector(".info-tooltip")?.textContent);
    return [st, tip].filter(Boolean).join(" - ") || t;
  };
  const leafTables = [...root.querySelectorAll("table")].filter((t) => !t.querySelector("table"));
  // label/value pairs
  const pairs = [];
  const seen = new Set();
  for (const t of leafTables) {
    for (const tr of t.querySelectorAll(":scope > tbody > tr, :scope > tr")) {
      const tds = [...tr.children].filter((c) => c.tagName === "TD");
      if (tds.length !== 2) continue;
      const label = clean(tds[0].innerText).replace(/:$/, "");
      const value = cellVal(tds[1]);
      if (!label || !value || label.length > 60) continue;
      if (!(tds[0].classList.contains("title") || /:$/.test(clean(tds[0].innerText)) || t.classList.contains("soiduk-yldinfo") || t.closest(".details-table"))) continue;
      const k = label + "=" + value;
      if (seen.has(k)) continue;
      seen.add(k);
      pairs.push({ label, value });
    }
  }
  // section headings for context
  // grid tables (thead + rows) e.g. axles, operations
  const tables = [];
  for (const t of leafTables) {
    if (t.classList.contains("inner") || t.classList.contains("titles") || t.classList.contains("soiduk-yldinfo") || t.closest(".details-table")) continue;
    const headers = [...t.querySelectorAll("thead th")].map((th) => clean(th.innerText));
    const rows = [...t.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map(cellVal)).filter((r) => r.some(Boolean));
    if (rows.length) tables.push({ headers, rows });
  }
  // inspections (transposed): titles table gives row labels, each table.inner is one inspection
  const inspections = [];
  const titles = root.querySelector("table.titles");
  if (titles) {
    const labels = [clean(titles.querySelector("thead th")?.innerText), ...[...titles.querySelectorAll("tbody td")].map((td) => clean(td.innerText))];
    for (const inner of root.querySelectorAll("table.inner")) {
      const vals = [clean(inner.querySelector("thead th")?.innerText), ...[...inner.querySelectorAll("tbody td")].map(cellVal)];
      const o = {};
      labels.forEach((l, i) => { if (l) o[l] = vals[i] ?? ""; });
      inspections.push(o);
    }
  }
  // operations (Kuupäev / Toiming)
  const operations = [];
  for (const t of tables) {
    if (/kuupäev/i.test(t.headers[0] || "") && /toiming/i.test(t.headers[1] || "")) for (const r of t.rows) operations.push({ date: r[0], action: r.slice(1).join(" ").replace(/,\s*$/, "") });
  }
  // mileage chart (jqPlot) data
  let mileage = [];
  try {
    const ws = (window.PrimeFaces && PrimeFaces.widgets) || {};
    for (const [id, w] of Object.entries(ws)) {
      if (!/labisoit/i.test(id) || !w || !w.cfg || !Array.isArray(w.cfg.data)) continue;
      for (const series of w.cfg.data) for (const pt of series || []) {
        if (!Array.isArray(pt) || pt.length < 2) continue;
        const d = new Date(typeof pt[0] === "number" ? pt[0] : Date.parse(pt[0]));
        mileage.push({ date: isNaN(d) ? String(pt[0]) : d.toISOString().slice(0, 10), odometerKm: Number(pt[1]), extra: pt.slice(2) });
      }
      const ticks = w.cfg.series || null;
      if (mileage.length) break;
    }
  } catch {}
  const sectionHtml = (title?.outerHTML || "") + (document.querySelector("#soidukDetailid")?.outerHTML || "");
  return {
    header, pairs, tables, inspections, operations, mileage,
    text: clean((title?.innerText || "") + "\n" + root.innerText).slice(0, 60000),
    html: sectionHtml.replace(/<script[\s\S]*?<\/script>/gi, "").slice(0, 400000),
    url: location.href,
  };
}
