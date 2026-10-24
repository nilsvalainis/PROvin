"use client";

import { Car, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import { filterOfferSourceCars, type OfferSourceCarRow } from "@/lib/iriss-offer-source-cars";
import { offerSourceRefString, type OfferSourceKind } from "@/lib/iriss-stock-photos";

type Tab = OfferSourceKind | "empty";

const TAB_LABEL: Record<Tab, string> = { autoparks: "Autoparks", logistics: "Loģistika", empty: "Tukšs" };

type Props = {
  onClose: () => void;
  /** from = "autoparks:<id>" | "logistics:<id>"; tukšs - forma no nulles. */
  onOpen: (from: string) => void;
};

/** Klienta kabinetā "Izveidot piedāvājumu": auto izvēle Autoparks | Loģistika | Tukšs (telefonā apakšējā lapa). */
export function IrissOfferSourceSheet({ onClose, onOpen }: Props) {
  const [tab, setTab] = useState<Tab>("autoparks");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");
  const [rows, setRows] = useState<Partial<Record<OfferSourceKind, OfferSourceCarRow[]>>>({});
  const [errors, setErrors] = useState<Partial<Record<OfferSourceKind, string>>>({});

  useEffect(() => {
    if (tab === "empty" || rows[tab] || errors[tab]) return;
    const kind = tab;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/iriss-offer-seed/cars?kind=${kind}`, { credentials: "include" });
        const data = (await res.json().catch(() => ({}))) as { rows?: OfferSourceCarRow[] };
        if (cancelled) return;
        if (res.status === 403) setErrors((e) => ({ ...e, [kind]: `Nav piekļuves sadaļai ${TAB_LABEL[kind]}.` }));
        else if (!res.ok || !Array.isArray(data.rows)) setErrors((e) => ({ ...e, [kind]: "Sarakstu neizdevās ielādēt." }));
        else setRows((r) => ({ ...r, [kind]: data.rows }));
      } catch {
        if (!cancelled) setErrors((e) => ({ ...e, [kind]: "Tīkla kļūda." }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, rows, errors]);

  const list = tab === "empty" ? [] : rows[tab];
  const visible = useMemo(() => filterOfferSourceCars(list ?? [], query).slice(0, 100), [list, query]);
  const canOpen = tab === "empty" || Boolean(picked && visible.some((r) => r.id === picked));
  const backdropClose = useModalBackdropClose(onClose);

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40 sm:items-center sm:p-6" role="presentation" {...backdropClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="iriss-offer-source-title"
        className="flex max-h-[85dvh] w-full flex-col rounded-t-[22px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-xl sm:max-w-md sm:rounded-[22px] sm:pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300 sm:hidden" aria-hidden />
        <h3 id="iriss-offer-source-title" className="text-center text-[17px] font-semibold text-[var(--color-apple-text)]">
          Izveidot piedāvājumu
        </h3>
        <div className="mt-3 grid grid-cols-3 gap-2" role="tablist" aria-label="Auto avots">
          {(["autoparks", "logistics", "empty"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setPicked("");
                setQuery("");
              }}
              className={`h-11 rounded-xl text-[14px] font-semibold ${tab === t ? "bg-[#373b45] text-white" : "border border-slate-200 bg-white text-[var(--color-apple-text)]"}`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        {tab === "empty" ? (
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-4 text-[14px] text-slate-600">Tukša forma - dati un bildes jāievada pašam.</p>
        ) : (
          <>
            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Marka, modelis vai VIN"
                aria-label="Meklēt auto"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[15px] outline-none focus:border-slate-400"
              />
            </label>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-xl border border-slate-200" role="radiogroup" aria-label="Auto">
              {errors[tab] ? (
                <p className="px-4 py-3 text-[13px] text-red-700">{errors[tab]}</p>
              ) : !list ? (
                <p className="px-4 py-3 text-[13px] text-slate-500">Ielādē...</p>
              ) : visible.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-slate-500">Nekas nav atrasts.</p>
              ) : (
                visible.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={picked === r.id}
                    onClick={() => setPicked(r.id)}
                    className={`flex min-h-[60px] w-full items-center gap-3 border-b border-slate-100 px-4 py-2 text-left last:border-b-0 ${picked === r.id ? "bg-[#eef3fd]" : "bg-white"}`}
                  >
                    <span
                      className={`h-5 w-5 shrink-0 rounded-full border-2 ${picked === r.id ? "border-[#2563eb] bg-[radial-gradient(circle,#2563eb_45%,transparent_50%)]" : "border-slate-300"}`}
                      aria-hidden
                    />
                    <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400" aria-hidden>
                      <Car className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-[var(--color-apple-text)]">{r.title}</span>
                      {r.sub ? <span className="block truncate text-[13px] text-slate-500">{r.sub}</span> : null}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
        <button
          type="button"
          disabled={!canOpen}
          onClick={() => onOpen(tab === "empty" ? "" : offerSourceRefString({ kind: tab, id: picked }))}
          className="mt-3 h-12 w-full shrink-0 rounded-xl bg-[#373b45] text-[15px] font-semibold text-white disabled:opacity-40"
        >
          Atvērt
        </button>
      </div>
    </div>
  );
}
