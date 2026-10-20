"use client";

import { useEffect, useState } from "react";

export type IrissLimitsRowView = {
  id: string;
  label: string;
  href: string;
  percent: number;
  percentLabel: string;
  spendLabel: string;
  tone: "ok" | "warn" | "bad";
};

export type IrissLimitsView = {
  ok: true;
  updatedAt: string;
  refreshedLabel: string;
  stale: boolean;
  worst: "ok" | "warn" | "bad";
  rows: IrissLimitsRowView[];
};

export function useIrissLimits(): IrissLimitsView | null {
  const [data, setData] = useState<IrissLimitsView | null>(null);
  useEffect(() => {
    let stop = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/limits", { credentials: "include", cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as IrissLimitsView;
        if (!stop && body?.ok) setData(body);
      } catch {
        /* admin-only card stays hidden */
      }
    })();
    return () => {
      stop = true;
    };
  }, []);
  return data;
}

function toneClass(tone: IrissLimitsRowView["tone"]): string {
  if (tone === "bad") return "text-[var(--bad)]";
  if (tone === "warn") return "text-[var(--warn)]";
  return "text-[var(--ink)]";
}

function barClass(tone: IrissLimitsRowView["tone"]): string {
  if (tone === "bad") return "bg-[var(--bad)]";
  if (tone === "warn") return "bg-[var(--warn)]";
  return "bg-[var(--ink3)]";
}

export function IrissLimitsSidebarCard({ data }: { data?: IrissLimitsView | null }) {
  const fetched = useIrissLimits();
  const view = data ?? fetched;
  if (!view) return null;
  return (
    <section className="mt-3 rounded-[16px] bg-[var(--s1)] p-3 shadow-[var(--sh)]">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-extrabold tracking-[0.08em] text-[var(--ink)]">LIMITI</p>
        {view.stale ? null : view.refreshedLabel ? (
          <p className="text-[10px] text-[var(--ink3)]">atj. {view.refreshedLabel}</p>
        ) : null}
      </div>
      <ul className="space-y-2">
        {view.rows.map((row) => (
          <li key={row.id}>
            <a href={row.href} target="_blank" rel="noopener noreferrer" className="block">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-semibold text-[var(--ink)]">{row.label}</span>
                <span className={`text-[12px] font-semibold ${toneClass(row.tone)}`}>{row.percentLabel}</span>
              </div>
              <p className="text-[11px] text-[var(--ink2)]">{row.spendLabel}</p>
              <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[var(--fill)]" aria-hidden>
                <div className={`h-full ${barClass(row.tone)}`} style={{ width: `${row.percent}%` }} />
              </div>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-[var(--ink3)]">
        {view.stale ? `Dati novecojuši · atjaunots ${view.refreshedLabel || "-"}` : "Tikai adminam"}
      </p>
    </section>
  );
}

export function IrissLimitsMobileDot({ data }: { data: IrissLimitsView }) {
  if (data.stale || data.worst === "ok") return null;
  const worst = data.rows.find((row) => row.tone === data.worst) ?? data.rows[0];
  if (!worst) return null;
  return (
    <span className={`ml-1 text-[11px] font-semibold ${toneClass(data.worst)}`}>
      ● {worst.percentLabel}
    </span>
  );
}
