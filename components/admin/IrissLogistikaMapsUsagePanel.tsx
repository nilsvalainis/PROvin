"use client";

import { useEffect, useState } from "react";

type Usage = {
  ok?: boolean;
  configured?: boolean;
  geocodingConfigured?: boolean;
  month?: string;
  mapsJs?: { monthlyUsed: number; monthlyCap: number; dailyUsed: number; dailyCap: number };
  geocoding?: { monthlyUsed: number; monthlyCap: number; dailyUsed: number; dailyCap: number };
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
  return (
    <section className="mt-5 max-w-xl rounded-[22px] bg-[var(--s1)] p-4 shadow-[var(--sh)] sm:p-5">
      <h2 className="text-[15px] font-semibold text-[var(--ink)]">Pārvaldība · Google Maps</h2>
      <p className="mt-1 text-[13px] leading-snug text-[var(--ink2)]">
        Loģistikas karte un ģeokodēšana. Tikai Maps JavaScript API un Geocoding. Cietais limits 10 000 / mēn. katram
        (~320 / dienā). Kešotās adreses skaitītāju netērē.
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
      </dl>
      <p className="mt-2 text-[12px] text-[var(--ink2)]">
        Pārlūka atslēga: {usage?.configured ? "iestatīta" : "nav"}. Servera atslēga:{" "}
        {usage?.geocodingConfigured ? "iestatīta" : "nav"}.
      </p>
    </section>
  );
}
