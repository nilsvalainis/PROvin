"use client";

import Link from "next/link";
import { ATRA_POTENTIAL_LABEL, atraHistoryDate, atraShortVin, type AtraHistoryRow } from "@/lib/atra-parbaude";
import { formatDealerCheckEur } from "@/lib/dealer-check";

/** «Pēdējās pārbaudes»: VIN SCAN vēsture + dīlera pārbaudes vienā tabulā. */
export function AdminAtraParbaudeHistory({
  rows,
  onExport,
  allScansOpen,
  onToggleAllScans,
}: {
  rows: AtraHistoryRow[];
  onExport: () => void;
  allScansOpen?: boolean;
  onToggleAllScans?: () => void;
}) {
  return (
    <section id="atra-pedejas" className="rounded-[14px] border border-[#e5e5ea] bg-white px-[18px] py-4" data-atra-history>
      <h2 className="mb-2.5 flex flex-wrap items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]">
        Pēdējās pārbaudes
        {onToggleAllScans ? (
          <button
            type="button"
            aria-expanded={allScansOpen}
            onClick={onToggleAllScans}
            className="text-[12.5px] font-medium normal-case tracking-normal text-[#8e8e93] hover:text-[#111]"
          >
            Visi skenējumi {allScansOpen ? "▾" : "›"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onExport}
          disabled={rows.length === 0}
          className="ml-auto rounded-[10px] border border-[#e5e5ea] bg-white px-3 py-1.5 text-[13px] font-semibold normal-case tracking-normal text-[#111] disabled:opacity-45"
        >
          Eksportēt CSV
        </button>
      </h2>
      {rows.length === 0 ? (
        <p className="text-[13px] text-[#8e8e93]">Vēl nav pārbaužu.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-[#8e8e93]">
                <th className="py-1.5 pr-2 font-semibold">Datums</th>
                <th className="py-1.5 pr-2 font-semibold">Auto</th>
                <th className="py-1.5 pr-2 font-semibold">Potenciāls</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Maksa</th>
                <th className="py-1.5 text-right font-semibold">Pas.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-[#e5e5ea]">
                  <td className="whitespace-nowrap py-2 pr-2 tabular-nums text-[#3a3a3c]">{atraHistoryDate(r.at)}</td>
                  <td className="py-2 pr-2">
                    <Link href={r.href} className="font-semibold text-[#111] hover:underline">
                      {r.title || atraShortVin(r.vin)}
                    </Link>{" "}
                    <span className="font-mono text-[12px] text-[#8e8e93]">{r.title ? r.plate || atraShortVin(r.vin) : r.plate}</span>
                  </td>
                  <td className="py-2 pr-2 text-[#3a3a3c]">{r.potential ? ATRA_POTENTIAL_LABEL[r.potential] : "-"}</td>
                  <td className="whitespace-nowrap py-2 pr-2 text-right tabular-nums">{formatDealerCheckEur(r.costCents)}</td>
                  <td className="whitespace-nowrap py-2 text-right">
                    {r.orderId ? (
                      <Link href={`/admin/orders/${encodeURIComponent(r.orderId)}`} className="text-[#0b3fa8] hover:underline">
                        Atvērt
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
