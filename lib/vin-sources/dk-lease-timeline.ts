/**
 * Dānijas DMR laika joslas troksnis (26.11, Mercedes SE→DK→LV): katru gadu līzinga līgums tiek atjaunots
 * («Līzings beidzas» + «Līzings sākas» tajā pašā dienā) un ar to kopā OCTA ieraksti «aktīva» / «beigusies».
 * Klientam tas ir viens fakts - «Līzings 2016-2025 (gada līgumi)» - un tikai īstās apdrošinātāja maiņas.
 * Darbojas ar gatavām laika joslas rindām, tāpēc der gan jaunai ielasei, gan saglabātiem melnrakstiem.
 */

export type DkTimelineRowLike = { date: string; event: string; odometer?: string; country?: string };

const LEASE_START_RE = /^līzings sākas$/i;
const LEASE_END_RE = /^līzings beidzas$/i;
const INSURANCE_RE = /^apdrošināšana:\s*(.+?),\s*(aktīva|beigusies)$/i;
/** Atjaunots līgums: nākamais sākas ne vēlāk kā nedēļu pēc iepriekšējā beigām. */
const RENEWAL_GAP_DAYS = 7;

function isoDayOf(raw: string): string {
  const t = (raw ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const lv = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (lv) return `${lv[3]}-${lv[2]!.padStart(2, "0")}-${lv[1]!.padStart(2, "0")}`;
  return "";
}

function dayMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function addDays(iso: string, days: number): string {
  return new Date(dayMs(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

export type DkLeaseContract = { from: string; to: string };

/** Līgumi no «sākas» / «beidzas» rindām: katram sākumam - tuvākās vēlākās beigas (ne tās pašas dienas). */
export function pairDkLeaseContracts(starts: string[], ends: string[]): DkLeaseContract[] {
  const s = [...new Set(starts.filter(Boolean))].sort();
  const e = [...ends.filter(Boolean)].sort();
  const used = new Set<number>();
  return s.map((from) => {
    const i = e.findIndex((to, idx) => !used.has(idx) && to > from);
    if (i < 0) return { from, to: "" };
    used.add(i);
    return { from, to: e[i]! };
  });
}

/** Nepārtrauktas līzinga ķēdes (gada līgumi pēc kārtas = viena ķēde). */
export function chainDkLeaseContracts(contracts: DkLeaseContract[]): DkLeaseContract[][] {
  const sorted = [...contracts].filter((c) => c.from).sort((a, b) => a.from.localeCompare(b.from));
  const chains: DkLeaseContract[][] = [];
  for (const c of sorted) {
    const chain = chains[chains.length - 1];
    const last = chain?.[chain.length - 1];
    if (chain && last && last.to && c.from <= addDays(last.to, RENEWAL_GAP_DAYS)) chain.push(c);
    else chains.push([c]);
  }
  return chains;
}

/** «Līzings 2016-2025 (gada līgumi)»; ja līgumi nav ~gadu gari - «(9 līgumi)». */
export function dkLeaseChainLabel(chain: DkLeaseContract[]): string {
  const first = chain[0]!;
  const last = chain[chain.length - 1]!;
  const fromY = first.from.slice(0, 4);
  const toY = last.to ? last.to.slice(0, 4) : "";
  const yearly = chain.every((c) => {
    if (!c.to) return true;
    const days = (dayMs(c.to) - dayMs(c.from)) / 86_400_000;
    return days >= 300 && days <= 400;
  });
  const kind = yearly ? "gada līgumi" : `${chain.length} līgumi`;
  const years = toY ? (toY === fromY ? fromY : `${fromY}-${toY}`) : `no ${fromY}`;
  return `Līzings ${years} (${kind})`;
}

function collapseLeaseRows<T extends DkTimelineRowLike>(rows: T[]): T[] {
  const starts = rows.filter((r) => LEASE_START_RE.test(r.event.trim())).map((r) => isoDayOf(r.date));
  const ends = rows.filter((r) => LEASE_END_RE.test(r.event.trim())).map((r) => isoDayOf(r.date));
  if (starts.length + ends.length < 3) return rows;
  const chains = chainDkLeaseContracts(pairDkLeaseContracts(starts, ends)).filter((c) => c.length >= 2);
  if (chains.length === 0) return rows;
  const inChain = (iso: string, kind: "start" | "end") =>
    chains.some((chain) => chain.some((c) => (kind === "start" ? c.from === iso : c.to === iso)));
  const template = rows.find((r) => LEASE_START_RE.test(r.event.trim()));
  const kept = rows.filter((r) => {
    const iso = isoDayOf(r.date);
    if (LEASE_START_RE.test(r.event.trim())) return !inChain(iso, "start");
    if (LEASE_END_RE.test(r.event.trim())) return !inChain(iso, "end");
    return true;
  });
  for (const chain of chains) {
    const date = rows.find((r) => isoDayOf(r.date) === chain[0]!.from)?.date ?? chain[0]!.from;
    kept.push({ ...(template as T), date, odometer: "", event: dkLeaseChainLabel(chain) });
  }
  return kept;
}

/**
 * OCTA: tās pašas dienas «aktīva» + «beigusies» ir pārreģistrācija (līguma atjaunošana), ne divi fakti.
 * Paliek tikai jauns apdrošinātājs, polises beigas un atjaunošana pēc pārtraukuma.
 */
function collapseInsuranceRows<T extends DkTimelineRowLike>(rows: T[]): T[] {
  const ins = rows
    .map((r, i) => ({ r, i, m: INSURANCE_RE.exec(r.event.trim()), iso: isoDayOf(r.date) }))
    .filter((x) => x.m && x.iso)
    .sort((a, b) => a.iso.localeCompare(b.iso) || a.i - b.i);
  if (ins.length < 2) return rows;
  const drop = new Set<number>();
  const byDay = new Map<string, typeof ins>();
  for (const x of ins) byDay.set(x.iso, [...(byDay.get(x.iso) ?? []), x]);
  let state: { company: string; active: boolean } | null = null;
  for (const day of [...byDay.keys()].sort()) {
    const items = byDay.get(day)!;
    const actives = items.filter((x) => /aktīva/i.test(x.m![2]!));
    const dayItems = actives.length > 0 ? actives : items;
    for (const x of items) if (!dayItems.includes(x)) drop.add(x.i);
    const seenCompany = new Set<string>();
    for (const x of dayItems) {
      const company = x.m![1]!.trim().toLocaleLowerCase("lv");
      const active = /aktīva/i.test(x.m![2]!);
      const same = state && state.company === company && state.active === active;
      const endAfterEnd = !active && state != null && !state.active;
      if (seenCompany.has(company) || same || endAfterEnd) {
        drop.add(x.i);
        continue;
      }
      seenCompany.add(company);
      state = { company, active };
    }
  }
  return rows.filter((_, i) => !drop.has(i));
}

/** Līzinga atjaunošanas un OCTA pārreģistrācijas trokšņa apvienošana Dānijas laika joslā. */
export function collapseDkLeaseInsuranceRows<T extends DkTimelineRowLike>(rows: T[]): T[] {
  return collapseInsuranceRows(collapseLeaseRows(rows));
}
