"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AUTOPARKS_STATUS_SHORT_LV, type AutoparksOwner, type AutoparksStatus } from "@/lib/iriss-autoparks";
import { AUTOPARKS_V2_STATUS_ORDER } from "@/lib/iriss-autoparks-v2";
import {
  AUTOPARKS_V2_DEFAULT_SORT,
  AUTOPARKS_V2_SORT_LV,
  AUTOPARKS_V2_SORTS,
  sortAutoparksV2Rows,
  type AutoparksV2Sort,
  autoparksV2OwnerCounts,
  autoparksV2StatusCounts,
  filterAutoparksV2Rows,
  flattenAutoparksV2Rows,
  type AutoparksV2ListRow,
  type AutoparksV2OwnerFilter,
} from "@/lib/iriss-autoparks-v2-list";
import { CarImg, VinCopy, yearColor } from "./ui";

const BASE = "/admin/iriss/autoparks-v2";
/** Datora statusu flīzes (D1): visi + statusi bez "Pārdots". */
const PIPE: readonly AutoparksStatus[] = AUTOPARKS_V2_STATUS_ORDER.filter((s) => s !== "sold");

export function AutoparksV2List({
  initialCars,
  canAddCar = true,
  logisticsCount = null,
  canSortBySum = false,
}: {
  initialCars: AutoparksV2ListRow[];
  /** «Summa» kārtošana tikai ar tiesību «summas» (Nils 27.10). */
  canSortBySum?: boolean;
  /** Aktīvie Loģistikas auto (vēl nav Autoparkā); null - nav Loģistikas tiesību, flīzi nerāda. */
  logisticsCount?: number | null;
  /** "+ Auto" tikai ar Pamatdatu tiesību (API to pārbauda arī pats). */
  canAddCar?: boolean;
}) {
  const [owner, setOwner] = useState<AutoparksV2OwnerFilter>("all");
  const [status, setStatus] = useState<AutoparksStatus | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  // Nils 27.10: noklusējumā visiem profiliem «Iegāde: jaunākie».
  const [sort, setSort] = useState<AutoparksV2Sort>(AUTOPARKS_V2_DEFAULT_SORT);
  const sortOptions = AUTOPARKS_V2_SORTS.filter((s) => canSortBySum || !s.startsWith("sum_"));

  const ownerCounts = useMemo(() => autoparksV2OwnerCounts(initialCars), [initialCars]);
  const base = useMemo(() => filterAutoparksV2Rows(initialCars, { owner, query }), [initialCars, owner, query]);
  const statusCounts = useMemo(() => autoparksV2StatusCounts(base), [base]);
  const rows = useMemo(
    () => sortAutoparksV2Rows(flattenAutoparksV2Rows(status ? base.filter((r) => r.status === status) : base), sort),
    [base, status, sort],
  );
  const shown: "date" | "sum" | null = sort.startsWith("date_") ? "date" : sort.startsWith("sum_") ? "sum" : null;

  const chips: Array<{ id: AutoparksV2OwnerFilter; m: string; d: string }> = [
    { id: "all", m: `Visi ${ownerCounts.all}`, d: "Visi īpašnieki" },
    { id: "IRISS", m: `ĪRISS ${ownerCounts.IRISS}`, d: "ĪRISS" },
    { id: "DZA", m: `Dzintarzeme ${ownerCounts.DZA}`, d: "Dzintarzeme" },
    { id: "archive", m: "Arhīvs", d: "Arhīvs" },
  ];

  return (
    <div className="ap2">
      <div className="ap2-top">
        <h1>Autoparks</h1>
        <div className="ap2-search ap2-search-d">
          <span aria-hidden>⌕</span>
          <input data-bare value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Marka, modelis vai VIN" aria-label="Meklēt" />
        </div>
        {canAddCar ? (
          <button type="button" className="ap2-btn dark sm" onClick={() => setAdding(true)}>
            + Auto
          </button>
        ) : null}
      </div>

      <div className="ap2-search ap2-search-m">
        <span aria-hidden>⌕</span>
        <input data-bare value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Marka, modelis vai VIN" aria-label="Meklēt" />
      </div>

      <div className="ap2-pipe" role="tablist" aria-label="Statusi">
        <button type="button" className={`ap2-pp ${status === null ? "on" : ""}`} onClick={() => setStatus(null)}>
          <span className="n">{base.length}</span>
          <span className="l">Visi</span>
        </button>
        {logisticsCount != null ? (
          <Link href="/admin/iriss/logistika?view=map" className="ap2-pp ap2-pp-link" title="Auto ceļā: karte un kravas">
            <span className="n">{logisticsCount}</span>
            <span className="l">Loģistika →</span>
          </Link>
        ) : null}
        {PIPE.map((s) => (
          <button key={s} type="button" className={`ap2-pp st-${s} ${status === s ? "on" : ""}`} onClick={() => setStatus((cur) => (cur === s ? null : s))}>
            <span className="n">{statusCounts[s]}</span>
            <span className="l">{AUTOPARKS_STATUS_SHORT_LV[s]}</span>
          </button>
        ))}
      </div>

      <div className="ap2-chips-row">
        <div className="ap2-chips">
          {chips.map((c) => (
            <button key={c.id} type="button" className={`ap2-chip ${owner === c.id ? "on" : ""}`} onClick={() => setOwner(c.id)}>
              <span className="ap2-m">{c.m}</span>
              <span className="ap2-d">{c.d}</span>
            </button>
          ))}
        </div>
        <label className="ap2-sort">
          <span className="sr-only">Kārtot</span>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
          </svg>
          <select value={sort} onChange={(e) => setSort(e.target.value as AutoparksV2Sort)} aria-label="Kārtot">
            {sortOptions.map((s) => (
              <option key={s} value={s}>
                {AUTOPARKS_V2_SORT_LV[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="ap2-thd">
        <span />
        <span>Auto</span>
        <span>VIN</span>
        <span>Statuss</span>
      </div>

      <AutoparksV2ListBody rows={rows} shown={shown} />

      {adding && canAddCar ? <AddCarSheet onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

/** Plakans saraksts (m01): statuss ir tikai filtra virsraksts, ne sadaļa un ne atkārtots uz kartītes. */
/** «Iegāde 12.10.2026» / «12 300 €» - rāda tikai, kārtojot pēc datuma vai summas. */
function sortValueLabel(r: AutoparksV2ListRow, shown: "date" | "sum" | null): string {
  if (shown === "date") {
    const m = r.purchaseDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `Iegāde ${m[3]}.${m[2]}.${m[1]}` : "Iegāde: nav datuma";
  }
  if (shown === "sum") {
    return r.purchasePriceEur == null ? "Summa: nav" : `${Math.round(r.purchasePriceEur).toLocaleString("lv-LV").replace(/\s/g, "\u00a0")}\u00a0€`;
  }
  return "";
}

export function AutoparksV2ListBody({ rows, shown = null }: { rows: readonly AutoparksV2ListRow[]; shown?: "date" | "sum" | null }) {
  if (rows.length === 0) return <p className="ap2-empty">Nav auto</p>;
  return (
    <div className="ap2-list">
      {rows.map((r) => (
        <Link key={r.id} href={`${BASE}/${encodeURIComponent(r.id)}`} className="ap2-row">
          <div className="ap2-row-m">
            <CarImg carId={r.id} />
            <span className="ap2-rt">
              <b>{r.title}</b>
              <span className="meta">{yearColor(r.year, r.color)}</span>
              {shown ? <span className="meta ap2-sortval">{sortValueLabel(r, shown)}</span> : null}
              <VinCopy vin={r.vin} />
            </span>
          </div>
          <div className="cols">
            <CarImg carId={r.id} />
            <span className="ap2-rt">
              <b>{r.title}</b>
              <span className="meta">{yearColor(r.year, r.color)}</span>
              {shown ? <span className="meta ap2-sortval">{sortValueLabel(r, shown)}</span> : null}
            </span>
            <span>
              <VinCopy vin={r.vin} />
            </span>
            <span>
              <span className={`ap2-pill st-${r.status}`}>{AUTOPARKS_STATUS_SHORT_LV[r.status]}</span>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function AddCarSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ make: "", model: "", vin: "", year: "", color: "", owner: "IRISS" as AutoparksOwner });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/iriss-autoparks-v2/pamatdati", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { id?: string } | null;
    setBusy(false);
    if (!res?.ok || !data?.id) {
      setError(res?.status === 400 ? "Ievadi marku, modeli vai VIN" : "Neizdevās saglabāt");
      return;
    }
    router.push(`${BASE}/${encodeURIComponent(data.id)}`);
  }

  return (
    <>
      <div className="ap2-dim" onClick={onClose} />
      <form className="ap2-sheet ap2-form" onSubmit={save}>
        <div className="ap2-grab" />
        <h4>Jauns auto</h4>
        <label>
          Marka
          <input value={form.make} onChange={set("make")} autoFocus />
        </label>
        <label>
          Modelis
          <input value={form.model} onChange={set("model")} />
        </label>
        <label>
          VIN
          <input value={form.vin} onChange={set("vin")} autoCapitalize="characters" spellCheck={false} />
        </label>
        <label>
          Gads
          <input value={form.year} onChange={set("year")} inputMode="numeric" />
        </label>
        <label>
          Krāsa
          <input value={form.color} onChange={set("color")} />
        </label>
        <div className="ap2-chips" style={{ marginTop: 14 }}>
          {(["IRISS", "DZA"] as const).map((o) => (
            <button key={o} type="button" className={`ap2-chip ${form.owner === o ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, owner: o }))}>
              {o === "IRISS" ? "ĪRISS" : "Dzintarzeme"}
            </button>
          ))}
        </div>
        {error ? <p className="ap2-err">{error}</p> : null}
        <button type="submit" className="ap2-btn dark" disabled={busy}>
          Saglabāt
        </button>
      </form>
    </>
  );
}
