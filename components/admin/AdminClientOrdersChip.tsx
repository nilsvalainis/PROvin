"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatMoneyEur } from "@/lib/format-money";

export type ClientOrdersChipItem = { id: string; created: number; vin: string | null; amountTotal: number | null; href: string };

function day(sec: number): string {
  return new Date(sec * 1000).toLocaleDateString("lv-LV", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Riga" });
}

/** Mazs „3×” blakus klienta e-pastam: iepriekšējie pasūtījumi ar to pašu e-pastu; klikšķis — saraksts ar datumiem, VIN, summām, saitēm. */
export function AdminClientOrdersChip({ items }: { items: ClientOrdersChipItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (items.length === 0) return null;
  return (
    <span ref={ref} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={`Iepriekšējie pasūtījumi ar šo e-pastu: ${items.length}`}
        aria-expanded={open}
        className="inline-flex h-5 items-center rounded-full bg-[#f2f2f7] px-1.5 text-[11px] font-semibold tabular-nums text-[#3a3a3c] hover:bg-[#e5e5ea]"
      >
        {items.length}×
      </button>
      {open ? (
        <span
          role="dialog"
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-6 z-40 block w-[320px] rounded-xl border border-[#e5e5ea] bg-white p-2.5 text-left text-[12px] text-[#3a3a3c] shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
        >
          <span className="block px-1 pb-1 font-semibold text-[#1d1d1f]">Iepriekšējie pasūtījumi ({items.length})</span>
          {items.map((it) => (
            <Link
              key={it.id}
              href={it.href}
              className="admin-nav-link flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[#f5f5f7]"
            >
              <span className="w-[74px] shrink-0 tabular-nums text-[#6e6e73]">{day(it.created)}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#3a3a3c]">{it.vin || "—"}</span>
              <span className="shrink-0 tabular-nums text-[#1d1d1f]">
                {typeof it.amountTotal === "number" ? formatMoneyEur(it.amountTotal, "eur") : "—"}
              </span>
            </Link>
          ))}
        </span>
      ) : null}
    </span>
  );
}
