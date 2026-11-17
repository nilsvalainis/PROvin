"use client";

import { useEffect, useState } from "react";
import type { VinObservation } from "@/lib/vin-memory";

const SOURCE_LV: Record<string, string> = {
  auto1: "Auto1",
  autobid: "Autobid",
  openline: "Openline",
  ecarstrade: "eCarsTrade",
  order: "PROVIN pasūtījums",
  quick_eval: "Ātrais vērtējums",
  logistics: "Loģistika",
};

type Payload = {
  observations: VinObservation[];
  latest: VinObservation | null;
  rollback: { earlier: VinObservation; later: VinObservation } | null;
};

function lvDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

function km(v: number | null): string {
  return v ? `${v.toLocaleString("lv-LV")} km` : "-";
}

/** VIN SCAN lapā: ko mūsu VIN atmiņā zinām par šo VIN (datums + km + avots). Tikai admin. */
export function AdminVinMemoryPanel({ vin }: { vin: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setData(null);
    setFailed(false);
    if (vin.length !== 17) return;
    let alive = true;
    fetch(`/api/admin/vin-memory?vin=${encodeURIComponent(vin)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Payload>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [vin]);

  if (vin.length !== 17 || failed) return null;
  if (!data) return <p className="text-[12px] text-[var(--color-provin-muted)]">Mūsu arhīvs: ielādē…</p>;
  if (!data.observations.length) return <p className="text-[12px] text-[var(--color-provin-muted)]">Mūsu arhīvā par šo VIN ierakstu vēl nav.</p>;

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-[var(--color-apple-text)]">Mūsu arhīvs: {data.observations.length} ieraksti</p>
        {data.latest ? (
          <p className="text-[12px] tabular-nums text-[var(--color-provin-muted)]">
            Pēdējais: {km(data.latest.km)}, {lvDate(data.latest.date)} ({SOURCE_LV[data.latest.source] ?? data.latest.source})
          </p>
        ) : null}
      </div>
      {data.rollback ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-800">
          Nobraukuma pretruna: {km(data.rollback.earlier.km)} {lvDate(data.rollback.earlier.date)} → {km(data.rollback.later.km)}{" "}
          {lvDate(data.rollback.later.date)}
        </p>
      ) : null}
      <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
        {[...data.observations].reverse().map((o) => (
          <li key={`${o.date}-${o.source}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-1.5 text-[12px]">
            <span className="tabular-nums text-[var(--color-apple-text)]">{lvDate(o.date)}</span>
            <span className="min-w-0 flex-1 truncate text-[var(--color-provin-muted)]">
              {SOURCE_LV[o.source] ?? o.source}
              {o.model ? ` · ${o.model}` : ""}
              {o.country ? ` · ${o.country}` : ""}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-[var(--color-apple-text)]">{km(o.km)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
