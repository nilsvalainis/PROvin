/** Konsultācijai gatava Markdown kopsavilkuma ģenerēšana no normalizētajiem faktiem. */

const km = (n) => (Number.isFinite(n) ? `${n.toLocaleString("lv-LV")} km` : "—");

export function renderReport(vin, facts, { regMark } = {}) {
  const L = [];
  L.push(`# VIN ${vin}${regMark ? ` · ${regMark}` : ""}`);
  L.push(`Sagatavots: ${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
  L.push("");

  L.push("## Avoti");
  for (const s of facts.sourcesQueried) {
    L.push(`- ${s.source}: ${s.found ? "dati atrasti" : "nav datu"}${s.note ? ` — ${s.note}` : ""} (${Math.round((s.durationMs ?? 0) / 100) / 10}s)`);
  }
  L.push("");

  if (facts.vehicle) {
    const v = facts.vehicle;
    L.push("## Transportlīdzeklis");
    L.push(
      `${[v.make, v.model, v.variant].filter(Boolean).join(" ")} · ${v.modelYear ?? "?"} · ${v.fuel ?? "?"} · ${v.enginePowerKw ? `${v.enginePowerKw} kW` : "?"}`,
    );
    if (v.firstRegistration) L.push(`Pirmā reģistrācija: ${String(v.firstRegistration).slice(0, 10)}`);
    if (v.color || v.bodyType) L.push(`Virsbūve/krāsa: ${[v.bodyType, v.color].filter(Boolean).join(" · ")}`);
    if (v.use) L.push(`Izmantošanas veids: ${v.use}`);
    L.push("");
  }

  const m = facts.mileage;
  L.push("## Noskrējiens");
  if (!m.points.length) {
    L.push("Odometra ierakstu nav.");
  } else {
    L.push(`Jaunākais: **${km(m.latestKm)}** (${m.latestDate})${m.staleYears ? ` — dati ${m.staleYears} g. veci` : ""}`);
    if (m.avgKmPerYear != null) L.push(`Vidēji gadā: ~${km(m.avgKmPerYear)}`);
    if (m.rollbacks.length) {
      L.push("");
      L.push("**⚠ Odometra pretruna:**");
      for (const r of m.rollbacks) {
        L.push(`- ${km(r.fromKm)} (${r.fromDate}) → ${km(r.toKm)} (${r.toDate}) = mīnus ${km(r.deltaKm)}`);
      }
    } else {
      L.push("Pretrunu odometra rindā nav (visi ieraksti aug).");
    }
    L.push("");
    L.push("| Datums | Odometrs | Ieraksta avots |");
    L.push("| --- | --- | --- |");
    for (const p of m.points) L.push(`| ${p.date} | ${km(p.km)} | ${p.origin} |`);
    L.push("");
  }

  L.push("## Juridiskais statuss");
  if (!facts.legal.length) L.push("Ierakstu nav.");
  else for (const i of facts.legal) L.push(`- ${i.flag ? "⚠ " : ""}${i.label}: ${i.value}  \n  _${i.source}_`);
  L.push("");

  L.push("## Īpašnieki / maiņas");
  if (!facts.owners.length) L.push("Datu nav.");
  else
    for (const o of facts.owners) {
      const n = o.estimatedOwners;
      const prev = n ? n - 1 : 0;
      const owners = n
        ? ` — aplēse: ${n === 1 ? "1 īpašnieks" : `${n} īpašnieki`} (${prev === 1 ? "1 iepriekšējais" : `${prev} iepriekšējie`})`
        : "";
      L.push(`**${o.source}** (${o.basis})${owners}`);
      for (const c of o.changes ?? []) L.push(`- ${c.date} · ${c.company} · ${c.status}`);
      for (const row of o.rows ?? []) L.push(`- ${row.join(" · ")}`);
    }
  L.push("");

  L.push("## Avārijas / bojājumi");
  if (!facts.accidents.length) L.push("Datu nav.");
  else
    for (const a of facts.accidents) {
      if (a.unavailable) L.push(`- ❓ ${a.source}: **nav pārbaudīts** — ${a.note ?? "avots nebija pieejams"}`);
      else if (a.status === "nav_registra") L.push(`- ${a.source}: ${a.note}`);
      else if (a.status === "neskaidrs") L.push(`- ❓ ${a.source}: ${a.note}`);
      else if (a.hasClaims) {
        L.push(`- ⚠ ${a.source}: **atrasti atlīdzību gadījumi:**`);
        for (const t of a.tables) for (const row of t.rows) L.push(`  - ${row.join(" · ")}`);
      } else if (a.status === "nav_gadijumu") L.push(`- ${a.source}: atlīdzību ierakstu nav`);
      for (const f of a.failedInspections ?? []) {
        L.push(`- ⚠ ${a.source}: apskate ${f.date} — ${f.result}${f.faults?.length ? `: ${f.faults.join("; ")}` : ""}`);
      }
      if (a.importCondition) L.push(`- ⚠ ${a.source}: stāvoklis pēc importa — ${a.importCondition}`);
    }
  L.push("");

  const inspections = facts.inspections ?? [];
  if (inspections.length) {
    L.push("## Tehniskās apskates");
    L.push("| Datums | Veids | Rezultāts | Odometrs | Stacija |");
    L.push("| --- | --- | --- | --- | --- |");
    for (const i of inspections) L.push(`| ${i.date} | ${i.type ?? ""} | ${i.result ?? ""} | ${km(i.km)} | ${i.station ?? ""} |`);
    L.push("");
  }

  L.push("---");
  L.push("_Iekšējai lietošanai. Dati no publiskiem valsts reģistru portāliem; nepilnīgi pēc definīcijas (ārzemēs notikušie gadījumi un nepieteiktie bojājumi tajos neparādās)._");
  return L.join("\n");
}
