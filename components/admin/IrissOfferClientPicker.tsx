"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import {
  filterIrissOfferClientOptions,
  irissOfferClientOptions,
  type IrissOfferClientOption,
} from "@/lib/iriss-offer-client-picker";
import type { IrissPasutijumsListRow } from "@/lib/iriss-pasutijumi-types";

export type IrissOfferClientChoice = { orderId: string; name: string } | null;

type Props = {
  value: IrissOfferClientChoice;
  onChange: (next: IrissOfferClientChoice) => void;
  /** Saglabātam piedāvājumam / klienta pasūtījumā - tikai lasāms (Nila atbilde 8). */
  lockedName?: string;
  disabled?: boolean;
};

/** "Klients ▾" piedāvājuma formas galvenē: Bez klienta | Pasūtījumu klienti (meklēšana). */
export function IrissOfferClientPicker({ value, onChange, lockedName, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string>(value?.orderId ?? "");
  const [options, setOptions] = useState<IrissOfferClientOption[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || options) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/iriss-pasutijumi", { credentials: "include" });
        const data = (await res.json().catch(() => ({}))) as { rows?: IrissPasutijumsListRow[] };
        if (cancelled) return;
        if (!res.ok || !Array.isArray(data.rows)) {
          setError("Klientu sarakstu neizdevās ielādēt.");
          setOptions([]);
          return;
        }
        setOptions(irissOfferClientOptions(data.rows));
      } catch {
        if (!cancelled) {
          setError("Tīkla kļūda.");
          setOptions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, options]);

  const visible = useMemo(() => filterIrissOfferClientOptions(options ?? [], query).slice(0, 80), [options, query]);
  const backdropClose = useModalBackdropClose(() => {
    setOpen(false);
    setQuery("");
  });

  if (lockedName !== undefined) {
    return (
      <span
        className="inline-flex h-10 max-w-[45vw] shrink-0 items-center truncate rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-semibold text-[var(--color-apple-text)] sm:max-w-[260px]"
        title="Klients"
      >
        {lockedName || "Bez klienta"}
      </span>
    );
  }

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={() => {
          setPicked(value?.orderId ?? "");
          setOpen(true);
        }}
        className="inline-flex h-10 max-w-[45vw] shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50 sm:max-w-[260px]"
      >
        <span className="truncate">{value?.name || "Bez klienta"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40 sm:items-center sm:p-6"
          role="presentation"
          {...backdropClose}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="iriss-offer-client-title"
            className="flex max-h-[85dvh] w-full flex-col rounded-t-[22px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-xl sm:max-w-md sm:rounded-[22px] sm:pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300 sm:hidden" aria-hidden />
            <h3 id="iriss-offer-client-title" className="text-center text-[17px] font-semibold text-[var(--color-apple-text)]">
              Klients
            </h3>
            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Vārds, tālrunis vai auto"
                aria-label="Meklēt klientu"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[15px] outline-none focus:border-slate-400"
              />
            </label>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-xl border border-slate-200" role="radiogroup" aria-label="Klients">
              <ClientRow checked={picked === ""} name="Bez klienta" sub="" onPick={() => setPicked("")} />
              {options === null ? (
                <p className="px-4 py-3 text-[13px] text-slate-500">Ielādē...</p>
              ) : error ? (
                <p className="px-4 py-3 text-[13px] text-red-700">{error}</p>
              ) : visible.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-slate-500">Nekas nav atrasts.</p>
              ) : (
                visible.map((o) => (
                  <ClientRow key={o.orderId} checked={picked === o.orderId} name={o.name} sub={o.sub} onPick={() => setPicked(o.orderId)} />
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                const o = (options ?? []).find((x) => x.orderId === picked);
                onChange(o ? { orderId: o.orderId, name: o.name } : null);
                close();
              }}
              className="mt-3 h-12 w-full rounded-xl bg-[#373b45] text-[15px] font-semibold text-white"
            >
              Izvēlēties
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ClientRow({ checked, name, sub, onPick }: { checked: boolean; name: string; sub: string; onPick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onPick}
      className={`flex min-h-[52px] w-full items-center gap-3 border-b border-slate-100 px-4 py-2 text-left last:border-b-0 ${checked ? "bg-[#eef3fd]" : "bg-white"}`}
    >
      <span
        className={`h-5 w-5 shrink-0 rounded-full border-2 ${checked ? "border-[#2563eb] bg-[radial-gradient(circle,#2563eb_45%,transparent_50%)]" : "border-slate-300"}`}
        aria-hidden
      />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold text-[var(--color-apple-text)]">{name}</span>
        {sub ? <span className="block truncate text-[13px] text-slate-500">{sub}</span> : null}
      </span>
    </button>
  );
}
