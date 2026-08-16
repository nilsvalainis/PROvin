"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  ADIFY_HISTORY_PAGE_URL,
  adifyChronologicalPriceRows,
  formatAdifyDeltaLabel,
  formatAdifyDurationLabel,
  formatAdifyPriceLabel,
  formatAdifySignedEur,
  type AdifyListingHistorySnapshot,
} from "@/lib/adify-listing-history";

const adifyPillClass =
  "inline-flex h-[28px] shrink-0 items-center justify-center rounded-md bg-teal-800 px-2 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-teal-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40";

type Props = {
  listingUrl: string;
};

export function AdminAdifyHistoryButton({ listingUrl }: Props) {
  const url = listingUrl.trim();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snapshot, setSnapshot] = useState<AdifyListingHistorySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => setOpen(false), []);

  const load = useCallback(async () => {
    if (!url) return;
    setBusy(true);
    setError(null);
    setSnapshot(null);
    try {
      const res = await fetch("/api/admin/adify-history", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json().catch(() => ({}))) as AdifyListingHistorySnapshot & {
        error?: string;
      };
      if (!res.ok) {
        setError(
          data.error === "invalid_url"
            ? "Nederīga sludinājuma saite"
            : data.error === "unauthorized"
              ? "Nav admin sesijas"
              : "Neizdevās ielādēt Adify vēsturi",
        );
        return;
      }
      if (!data.found) {
        setError(data.message || "Meklētais objekts netika atrasts");
        return;
      }
      setSnapshot(data);
    } catch {
      setError("Neizdevās savienoties ar Adify");
    } finally {
      setBusy(false);
    }
  }, [url]);

  const openDialog = () => {
    if (!url) return;
    setOpen(true);
    void load();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const chrono = snapshot ? adifyChronologicalPriceRows(snapshot.rows) : [];
  const first = chrono[0];
  const last = chrono[chrono.length - 1];

  const dialog =
    open && typeof document !== "undefined" ? (
      <div
        className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-3 sm:items-center"
        onClick={close}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="max-h-[min(88vh,40rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl sm:p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-semibold text-[var(--color-apple-text)]">
                Sludinājuma vēsture (Adify)
              </h2>
              <p className="mt-0.5 break-all text-[11px] text-[var(--color-provin-muted)]">{url}</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)] hover:bg-slate-50"
            >
              Aizvērt
            </button>
          </div>

          {busy ? (
            <p className="py-8 text-center text-sm text-[var(--color-provin-muted)]">Ielasu Adify…</p>
          ) : error ? (
            <p className="py-6 text-center text-sm font-medium text-red-700" role="alert">
              {error}
            </p>
          ) : snapshot ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <section className="min-w-0 rounded-xl border border-slate-200/90 bg-slate-50/60 p-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
                  Cenu izmaiņas no pirmās dienas
                </h3>
                <p className="mt-2 text-lg font-semibold tabular-nums text-[var(--color-apple-text)]">
                  {formatAdifySignedEur(snapshot.priceChangeEur)}
                </p>
                {first && last ? (
                  <p className="mt-1 text-[12px] text-[var(--color-provin-muted)]">
                    {formatAdifyPriceLabel(first.price)} → {formatAdifyPriceLabel(last.price)}
                  </p>
                ) : null}
                <ul className="mt-2 m-0 list-none divide-y divide-slate-200/80">
                  {chrono.map((row, i) => {
                    const deltaLabel = i === 0 ? null : formatAdifyDeltaLabel(row.delta);
                    const dropped = row.delta < 0;
                    return (
                      <li
                        key={`${row.date}-${row.price}-${i}`}
                        className="flex items-baseline justify-between gap-2 py-1.5 text-[12px]"
                      >
                        <span className="tabular-nums text-[var(--color-provin-muted)]">{row.date}</span>
                        <span className="font-semibold tabular-nums text-[var(--color-apple-text)]">
                          {formatAdifyPriceLabel(row.price)}
                          {deltaLabel ? (
                            <span
                              className={`ml-1 text-[10px] font-semibold ${
                                dropped ? "text-emerald-600" : "text-red-600"
                              }`}
                            >
                              {deltaLabel}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="min-w-0 rounded-xl border border-slate-200/90 bg-slate-50/60 p-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
                  Cik ilgi auto ir pārdošanā
                </h3>
                <p className="mt-2 text-lg font-semibold tabular-nums text-[var(--color-apple-text)]">
                  {formatAdifyDurationLabel(snapshot.durationDays)}
                </p>
                <dl className="mt-3 space-y-1.5 text-[12px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--color-provin-muted)]">Pirmais ieraksts</dt>
                    <dd className="font-medium tabular-nums text-[var(--color-apple-text)]">
                      {snapshot.oldestDate || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--color-provin-muted)]">Pēdējais ieraksts</dt>
                    <dd className="font-medium tabular-nums text-[var(--color-apple-text)]">
                      {snapshot.newestDate || "—"}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          ) : null}

          <p className="mt-3 text-right text-[10px] text-slate-500">
            <a
              href={ADIFY_HISTORY_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              adify.lv/history
            </a>
          </p>
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        type="button"
        disabled={!url}
        onClick={openDialog}
        className={adifyPillClass}
        title="Adify — sludinājuma cenu vēsture un pārdošanas ilgums"
      >
        Adify
      </button>
      {dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
