"use client";

import { useEffect, useState } from "react";

type Usage = {
  ok?: boolean;
  configured?: boolean;
  geocodingConfigured?: boolean;
  month?: string;
  mapsJs?: { monthlyUsed: number; monthlyCap: number; dailyUsed: number; dailyCap: number };
  geocoding?: { monthlyUsed: number; monthlyCap: number; dailyUsed: number; dailyCap: number };
  geocodePlace?: { monthlyUsed: number; monthlyCap: number; dailyUsed: number; dailyCap: number };
  searchDestinations?: { monthlyUsed: number; monthlyCap: number; dailyUsed: number; dailyCap: number };
  directions?: { monthlyUsed: number; monthlyCap: number; dailyUsed: number; dailyCap: number };
};

export function IrissLogistikaMapsUsagePanel() {
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => {
    void fetch("/api/admin/iriss-logistics/maps-usage", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((body: Usage) => setUsage(body))
      .catch(() => setUsage({ ok: false }));
  }, []);

  const maps = usage?.mapsJs;
  const geo = usage?.geocoding;
  const place = usage?.geocodePlace;
  const dest = usage?.searchDestinations;
  const dir = usage?.directions;
  return (
    <section className="mt-5 max-w-xl rounded-[22px] bg-[var(--s1)] p-4 shadow-[var(--sh)] sm:p-5">
      <h2 className="text-[15px] font-semibold text-[var(--ink)]">Pārvaldība · Google Maps</h2>
      <p className="mt-1 text-[13px] leading-snug text-[var(--ink2)]">
        Loģistikas karte, ģeokodēšana un maršruti. Maps JS, Geocoding, GeocodePlace, SearchDestinations un Directions.
        Cietais limits 10 000 / mēn. katram (~320 / dienā), lai nerastos rēķins. Kešotās adreses skaitītāju netērē.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
        <div className="rounded-xl bg-[var(--s2)] px-3 py-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink3)]">Maps JS</dt>
          <dd className="mt-1 tabular-nums text-[15px] font-semibold">
            {maps ? `${maps.monthlyUsed} / ${maps.monthlyCap}` : "…"}
          </dd>
          <dd className="text-[12px] text-[var(--ink2)]">šodien {maps ? `${maps.dailyUsed} / ${maps.dailyCap}` : "…"}</dd>
        </div>
        <div className="rounded-xl bg-[var(--s2)] px-3 py-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink3)]">Geocoding</dt>
          <dd className="mt-1 tabular-nums text-[15px] font-semibold">
            {geo ? `${geo.monthlyUsed} / ${geo.monthlyCap}` : "…"}
          </dd>
          <dd className="text-[12px] text-[var(--ink2)]">šodien {geo ? `${geo.dailyUsed} / ${geo.dailyCap}` : "…"}</dd>
        </div>
        <div className="rounded-xl bg-[var(--s2)] px-3 py-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink3)]">GeocodePlace v4</dt>
          <dd className="mt-1 tabular-nums text-[15px] font-semibold">
            {place ? `${place.monthlyUsed} / ${place.monthlyCap}` : "…"}
          </dd>
          <dd className="text-[12px] text-[var(--ink2)]">šodien {place ? `${place.dailyUsed} / ${place.dailyCap}` : "…"}</dd>
        </div>
        <div className="rounded-xl bg-[var(--s2)] px-3 py-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink3)]">SearchDestinations v4</dt>
          <dd className="mt-1 tabular-nums text-[15px] font-semibold">
            {dest ? `${dest.monthlyUsed} / ${dest.monthlyCap}` : "…"}
          </dd>
          <dd className="text-[12px] text-[var(--ink2)]">šodien {dest ? `${dest.dailyUsed} / ${dest.dailyCap}` : "…"}</dd>
        </div>
        <div className="rounded-xl bg-[var(--s2)] px-3 py-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink3)]">Directions</dt>
          <dd className="mt-1 tabular-nums text-[15px] font-semibold">
            {dir ? `${dir.monthlyUsed} / ${dir.monthlyCap}` : "…"}
          </dd>
          <dd className="text-[12px] text-[var(--ink2)]">šodien {dir ? `${dir.dailyUsed} / ${dir.dailyCap}` : "…"}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[12px] text-[var(--ink2)]">
        Pārlūka atslēga: {usage?.configured ? "iestatīta" : "nav"}. Servera atslēga:{" "}
        {usage?.geocodingConfigured ? "iestatīta" : "nav"}.
      </p>
    </section>
  );
}
