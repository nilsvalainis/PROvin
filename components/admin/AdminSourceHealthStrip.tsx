"use client";

import { useEffect, useRef, useState } from "react";
import { sourceHealthColor, type SourceHealthDoc, type SourceHealthColor } from "@/lib/source-health";
import { formatVinScanCountLine, vinScanNeedsBrowser } from "@/lib/vin-scan/types";

export type SourceHealthItem = { id: string; label: string; manual?: boolean };

const DOT: Record<SourceHealthColor, string> = {
  green: "bg-[#34c759]",
  orange: "bg-[#ff9f0a]",
  red: "bg-[#ff3b30]",
  gray: "bg-[#d1d1d6]",
};

function ago(iso: string | null, nowMs: number): string {
  if (!iso) return "—";
  const d = nowMs - Date.parse(iso);
  if (!Number.isFinite(d)) return "—";
  const m = Math.round(d / 60000);
  if (m < 60) return `pirms ${Math.max(1, m)} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `pirms ${h} h`;
  return new Date(iso).toLocaleDateString("lv-LV", { day: "2-digit", month: "2-digit", timeZone: "Europe/Riga" });
}

function fullTime(iso: string): string {
  return new Date(iso).toLocaleString("lv-LV", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Riga" });
}

/** VIN pārbaudes augšējā josla: katram avotam punkts (zaļš/oranžs/sarkans) + pēdējā veiksme/kļūda; klikšķis — pēdējās kļūdas. */
export function AdminSourceHealthStrip({ doc, items }: { doc: SourceHealthDoc; items: SourceHealthItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setNowMs(Date.now()), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const now = nowMs ?? 0;
  return (
    <div ref={ref} className="relative mb-3 flex flex-wrap items-center gap-1.5" aria-label="Avotu veselība">
      {items.map((it) => {
        const e = doc.sources[it.id];
        const color = it.manual ? "gray" : nowMs == null ? "gray" : sourceHealthColor(e, now);
        const title = it.manual
          ? "Manuāls avots (bez automātiskas ielādes)"
          : !e
            ? "Vēl nav ielādes datu"
            : `Pēdējā veiksme: ${e.lastOkAt ? fullTime(e.lastOkAt) : "—"} · Pēdējā kļūda: ${e.lastErrAt ? fullTime(e.lastErrAt) : "—"}`;
        return (
          <div key={it.id} className="relative">
            <button
              type="button"
              title={title}
              onClick={() => setOpen((p) => (p === it.id ? null : it.id))}
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition ${
                open === it.id ? "border-[#c7c7cc] bg-white" : "border-[#e5e5ea] bg-white hover:border-[#d1d1d6]"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${DOT[color]}`} aria-hidden />
              <span className="font-medium text-[#1d1d1f]">{it.label}</span>
              <span className="text-[#8e8e93]">
                {it.manual ? "manuāls" : !e ? "—" : color === "red" ? `kļūda ${ago(e.lastErrAt, now)}` : `ok ${ago(e.lastOkAt, now)}`}
              </span>
            </button>
            {open === it.id ? (
              <div className="absolute left-0 top-8 z-30 w-[300px] rounded-xl border border-[#e5e5ea] bg-white p-3 text-[12px] text-[#3a3a3c] shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                <p className="font-semibold text-[#1d1d1f]">{it.label}</p>
                {it.manual ? (
                  <p className="mt-1 text-[#8e8e93]">Dati tiek ievadīti manuāli — automātiskas ielādes žurnāla nav.</p>
                ) : !e ? (
                  <p className="mt-1 text-[#8e8e93]">Vēl nav reģistrētu ielādes mēģinājumu.</p>
                ) : (
                  <>
                    <p className="mt-1 text-[#6e6e73]">
                      Veiksmīgi: {e.okCount} · Kļūdas: {e.errCount}
                    </p>
                    <p className="text-[#6e6e73]">Pēdējā veiksme: {e.lastOkAt ? fullTime(e.lastOkAt) : "—"}</p>
                    {e.errors.length > 0 ? (
                      <ul className="mt-2 space-y-1 border-t border-[#f0f0f2] pt-2">
                        {e.errors.map((x, i) => (
                          <li key={i}>
                            <span className="tabular-nums text-[#8e8e93]">{fullTime(x.at)}</span> — {x.msg}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-[#8e8e93]">Kļūdu nav.</p>
                    )}
                  </>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Kompakta rinda lapas apakšā: „Avotu stāvoklis · N / M OK ›”; pieskāriens izvērš pilno joslu. */
export function AdminSourceHealthCompact({ doc, items }: { doc: SourceHealthDoc; items: SourceHealthItem[] }) {
  const [open, setOpen] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => setNowMs(Date.now()), []);
  const auto = items.filter((it) => !it.manual);
  let ok: number | null = null;
  let error = 0;
  let browser = 0;
  if (nowMs != null) {
    ok = 0;
    for (const it of auto) {
      const color = sourceHealthColor(doc.sources[it.id], nowMs);
      if (color === "green") {
        ok += 1;
        continue;
      }
      if (color !== "red") continue;
      const msg = doc.sources[it.id]?.errors[0]?.msg ?? "";
      if (vinScanNeedsBrowser("unknown", msg)) browser += 1;
      else error += 1;
    }
  }
  const countLine =
    ok == null ? "…" : formatVinScanCountLine({ total: auto.length, ok, error, browser });
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-1 text-left"
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">Avotu stāvoklis</span>
        <span className="text-[11px] tabular-nums" style={{ color: error ? "#DC2626" : "#86868b" }}>
          {countLine} {open ? "▾" : "›"}
        </span>
      </button>
      {open ? (
        <div className="mt-2">
          <AdminSourceHealthStrip doc={doc} items={items} />
        </div>
      ) : null}
    </div>
  );
}
