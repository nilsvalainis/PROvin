"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatB2bPartnerOrderDate } from "@/lib/b2b-partner-orders";

/** Partnera kabinets: izpildītās atskaites pēc PROVIN pogas klikšķa. Bez cenām un klientu datiem. */

type Row = { id: string; readyAt: string; title: string; vin: string };

const TH = "pb-2 text-left text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";

function rigaMonth(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga", year: "numeric", month: "2-digit" }).format(new Date(iso));
}

function shiftMonth(m: string, d: number): string {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  const t = new Date(Date.UTC(y, mo - 1 + d, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function B2bPartnerBusinessPoga() {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  const thisMonth = useMemo(() => rigaMonth(new Date().toISOString()), []);
  const [month, setMonth] = useState<string | "all">(thisMonth);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/partner/business-poga", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { enabled?: boolean; rows?: Row[] } | null) => {
        if (cancelled || !data) return;
        setEnabled(data.enabled === true);
        setRows(Array.isArray(data.rows) ? data.rows : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled || !rows) return null;
  const shown = month === "all" ? rows : rows.filter((r) => rigaMonth(r.readyAt) === month);
  const monthLabel = (m: string) =>
    new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-15T12:00:00Z`));
  const pill = "rounded-full border px-3 py-1 text-[0.75rem] transition";

  return (
    <section aria-labelledby="b2b-business-poga-title">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">{t("pogaEyebrow")}</p>
      <h2 id="b2b-business-poga-title" className="mt-1 text-[1.05rem] font-semibold tracking-[-0.02em] text-zinc-100">
        {t("pogaTitle")}
      </h2>
      <div className="mt-2.5 h-px w-full bg-white/10" aria-hidden />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {month !== "all" ? (
          <span className="mr-1 inline-flex items-center gap-2 text-[0.8rem] font-semibold capitalize text-zinc-100">
            <button type="button" aria-label={t("pogaPrev")} className="px-1 text-zinc-500 hover:text-zinc-200" onClick={() => setMonth(shiftMonth(month, -1))}>
              ‹
            </button>
            {monthLabel(month)}
            <button
              type="button"
              aria-label={t("pogaNext")}
              disabled={month >= thisMonth}
              className="px-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              ›
            </button>
          </span>
        ) : null}
        <button
          type="button"
          className={`${pill} ${month !== "all" ? "border-zinc-100 bg-zinc-100 text-zinc-900" : "border-white/15 text-zinc-300 hover:border-white/30"}`}
          onClick={() => setMonth(thisMonth)}
        >
          {t("pogaMonth")}
        </button>
        <button
          type="button"
          className={`${pill} ${month === "all" ? "border-zinc-100 bg-zinc-100 text-zinc-900" : "border-white/15 text-zinc-300 hover:border-white/30"}`}
          onClick={() => setMonth("all")}
        >
          {t("pogaAllTime")}
        </button>
      </div>

      <div className="mt-4 grid max-w-sm grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
          <p className="text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">{t("pogaDone")}</p>
          <p className="mt-1 text-[1.05rem] font-semibold tabular-nums text-zinc-100">{shown.length}</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
          <p className="text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">{t("pogaTotal")}</p>
          <p className="mt-1 text-[1.05rem] font-semibold tabular-nums text-zinc-100">{rows.length}</p>
          <p className="mt-0.5 text-[0.7rem] text-zinc-500">{t("pogaTotalHint")}</p>
        </div>
      </div>

      {shown.length ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse text-[0.8rem]">
            <thead>
              <tr>
                <th className={TH}>{t("pogaDate")}</th>
                <th className={TH}>{t("pogaCar")}</th>
                <th className={TH}>{t("pogaVin")}</th>
                <th className={`${TH} text-right`}>{t("pogaStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-t border-white/[0.07]">
                  <td className="py-2.5 pr-3 text-zinc-400">{formatB2bPartnerOrderDate(r.readyAt, locale)}</td>
                  <td className="py-2.5 pr-3 text-zinc-200">{r.title || "-"}</td>
                  <td className="py-2.5 pr-3 font-mono text-[0.72rem] text-zinc-400">{r.vin}</td>
                  <td className="py-2.5 text-right font-semibold text-emerald-300">{t("pogaReady")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-5 text-[0.8125rem] text-zinc-400">{t("pogaEmpty")}</p>
      )}
    </section>
  );
}
