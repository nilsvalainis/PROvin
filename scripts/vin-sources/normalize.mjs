/** Apvieno visu avotu rezultātus PROVIN konsultācijai svarīgajos griezumos. */

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

function toDate(value) {
  if (!value) return null;
  // LKF/mnt lieto dd-mm-yyyy vai dd.mm.yyyy, tjekbil ISO
  const dk = /^(\d{2})[-.](\d{2})[-.](\d{4})$/.exec(String(value).trim());
  const d = dk ? new Date(`${dk[3]}-${dk[2]}-${dk[1]}`) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Reģistru datumi ir kalendāra datumi — toISOString tos nobīdītu pa laika joslu. */
function isoDay(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildMileageTimeline(results) {
  const points = [];
  for (const r of results) {
    for (const m of r.mileage ?? []) {
      const date = toDate(m.date);
      if (date && Number.isFinite(m.km)) points.push({ date, km: m.km, origin: m.origin, source: r.source });
    }
    for (const i of r.inspections ?? []) {
      const date = toDate(i.date);
      if (date && Number.isFinite(i.km)) points.push({ date, km: i.km, origin: `apskate (${i.result})`, source: r.source });
    }
  }
  points.sort((a, b) => a.date - b.date);

  // Viens un tas pats rādījums bieži nāk no diviem reģistriem ar dienas nobīdi
  const DEDUPE_WINDOW_MS = 3 * 24 * 3600 * 1000;
  const unique = [];
  for (const p of points) {
    const dup = unique.find((u) => u.km === p.km && Math.abs(u.date - p.date) <= DEDUPE_WINDOW_MS);
    if (dup) {
      if (!dup.origin.includes(p.origin)) dup.origin = `${dup.origin}; ${p.origin}`;
    } else {
      unique.push(p);
    }
  }

  const rollbacks = [];
  let peak = null;
  for (const p of unique) {
    if (peak && p.km < peak.km - 1000) rollbacks.push({ from: peak, to: p, deltaKm: peak.km - p.km });
    if (!peak || p.km > peak.km) peak = p;
  }

  const first = unique[0];
  const last = unique[unique.length - 1];
  const years = first && last ? (last.date - first.date) / YEAR_MS : 0;
  const gapYears = last ? (Date.now() - last.date) / YEAR_MS : null;

  return {
    points: unique.map((p) => ({ date: isoDay(p.date), km: p.km, origin: p.origin, source: p.source })),
    latestKm: last?.km ?? null,
    latestDate: last ? isoDay(last.date) : null,
    avgKmPerYear: years > 0.5 ? Math.round((last.km - first.km) / years) : null,
    rollbacks: rollbacks.map((r) => ({
      deltaKm: r.deltaKm,
      fromKm: r.from.km,
      fromDate: isoDay(r.from.date),
      toKm: r.to.km,
      toDate: isoDay(r.to.date),
    })),
    staleYears: gapYears != null ? Math.round(gapYears * 10) / 10 : null,
  };
}

export function buildLegalStatus(results) {
  const items = [];
  for (const r of results) {
    if (!r.legal) continue;
    const l = r.legal;
    if (l.status) items.push({ source: r.source, label: "Reģistrācijas statuss", value: `${l.status}${l.statusDate ? ` (${String(l.statusDate).slice(0, 10)})` : ""}` });
    if (l.secondaryStatus) items.push({ source: r.source, label: "Sekundārais statuss", value: l.secondaryStatus });
    if (l.blocked) items.push({ source: r.source, label: "Bloķēts reģistrā", value: "JĀ", flag: true });
    if (l.leased) items.push({ source: r.source, label: "Līzings", value: `aktīvs ${l.leasingFrom ?? ""}–${l.leasingTo ?? ""}`.trim(), flag: true });
    if (l.conditionAfterImport) items.push({ source: r.source, label: "Stāvoklis pēc importa", value: l.conditionAfterImport, flag: true });
    for (const doc of l.debtDocuments ?? []) {
      items.push({
        source: r.source,
        label: "Ķīla / parāds (Bilbogen)",
        value: [doc.beloeb ?? doc.amount, doc.kreditor ?? doc.creditor, doc.dato ?? doc.date].filter(Boolean).join(" · ") || JSON.stringify(doc).slice(0, 200),
        flag: true,
      });
    }
    if (l.bankruptcy) items.push({ source: r.source, label: "Maksātnespēja", value: JSON.stringify(l.bankruptcy).slice(0, 200), flag: true });
    for (const w of r.wanted ?? []) {
      items.push({ source: r.source, label: "Meklēts / zagts", value: JSON.stringify(w).slice(0, 200), flag: true });
    }
  }
  return items;
}

export function buildOwnerChanges(results) {
  const out = [];
  for (const r of results) {
    // DK: publiskajos datos īpašnieku vārdi nav pieejami, bet OCTA polišu vēsture
    // praksē atspoguļo īpašnieku maiņas (tjekbil.dk pats "tidligere ejer" rēķina no tās).
    const history = r.insurance?.history ?? [];
    if (history.length) {
      const changes = history
        .map((h) => ({ date: h.created, company: h.company, status: h.status }))
        .sort((a, b) => (toDate(a.date) ?? 0) - (toDate(b.date) ?? 0));
      out.push({
        source: r.source,
        basis: "apdrošināšanas polišu vēsture",
        estimatedOwners: new Set(changes.map((c) => c.date)).size,
        changes,
      });
    }
    // EE: kasutusajalugu tabula (etiķetes precizējam pēc reāla VIN)
    const eeHistory = (r.tables ?? []).find((t) => /kasutus|omanik|ajalugu/i.test([...(t.headers ?? []), ...(t.rows?.[0] ?? [])].join(" ")));
    if (eeHistory) out.push({ source: r.source, basis: "kasutusajalugu", rows: eeHistory.rows });
  }
  return out;
}

export function buildAccidents(results) {
  const out = [];
  for (const r of results) {
    if (r.source === "lkf.ee") {
      // captcha kritums nav "tīra vēsture" — to nedrīkst rādīt kā pārbaudītu rezultātu
      if (r.captchaFailed || r.error) out.push({ source: r.source, unavailable: true, note: r.note ?? r.error ?? null });
      else out.push({ source: r.source, status: r.status, hasClaims: r.status === "atrasti_gadijumi", note: r.note ?? null, tables: r.claimsTables ?? [] });
    }
    const failedInspections = (r.inspections ?? []).filter((i) => i.result && !/godkendt|korras/i.test(i.result));
    if (failedInspections.length) out.push({ source: r.source, failedInspections });
    if (r.legal?.conditionAfterImport) out.push({ source: r.source, importCondition: r.legal.conditionAfterImport });
  }
  return out;
}

export function buildFacts(results) {
  const ok = results.filter((r) => r && r.found);
  return {
    sourcesQueried: results.map((r) => ({ source: r.source, found: !!r.found, note: r.note ?? null, durationMs: r.durationMs })),
    vehicle: ok.find((r) => r.vehicle)?.vehicle ?? null,
    mileage: buildMileageTimeline(ok),
    inspections: ok.flatMap((r) => (r.inspections ?? []).map((i) => ({ ...i, source: r.source }))),
    legal: buildLegalStatus(ok),
    owners: buildOwnerChanges(ok),
    accidents: buildAccidents(results),
  };
}
