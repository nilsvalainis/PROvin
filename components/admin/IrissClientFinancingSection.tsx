"use client";

import { useState } from "react";
import {
  formatIrissClientFinancingChip,
  IRISS_CLIENT_FINANCING_PRESETS,
  irissClientFinancingPatchFromPercent,
  parseIrissClientFinancingPercent,
} from "@/lib/iriss-client-financing";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

const presetBtn =
  "rounded-full border px-3 py-1.5 text-[12px] font-semibold shadow-sm transition";

function isPresetPercent(p: number): boolean {
  return (IRISS_CLIENT_FINANCING_PRESETS as readonly number[]).includes(p);
}

export function IrissClientFinancingSection({
  rec,
  onPatchRecord,
}: {
  rec: IrissPasutijumsRecord;
  onPatchRecord: (patch: Partial<IrissPasutijumsRecord>) => void;
}) {
  const percent = parseIrissClientFinancingPercent(rec.clientFinancingPercent);
  const [customOpen, setCustomOpen] = useState(() => percent > 0 && !isPresetPercent(percent));
  const summary = percent > 0 ? formatIrissClientFinancingChip(rec.totalBudget, percent) : "Nav izvēlēts";

  const setPercent = (next: number) => {
    onPatchRecord(irissClientFinancingPatchFromPercent(next));
    if (next > 0 && !isPresetPercent(next)) setCustomOpen(true);
  };

  return (
    <div className="mt-3 rounded-xl border border-[#e5e7eb] bg-[#fafafa]">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] font-semibold text-[#111827]">
        <span>Klienta finansējums</span>
        <span className="text-[12px] font-medium text-[#6b7280]">{summary}</span>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[#e5e7eb] bg-white px-3 py-2.5">
        {IRISS_CLIENT_FINANCING_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setCustomOpen(false);
              setPercent(p);
            }}
            className={`${presetBtn} ${
              percent === p
                ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)] text-[var(--color-provin-accent)]"
                : "border-slate-200 bg-white text-[#111827] hover:bg-slate-50"
            }`}
          >
            {formatIrissClientFinancingChip(rec.totalBudget, p)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className={`${presetBtn} ${
            customOpen || (percent > 0 && !isPresetPercent(percent))
              ? "border-[var(--color-provin-accent)] text-[var(--color-provin-accent)]"
              : "border-slate-200 bg-white text-[#111827] hover:bg-slate-50"
          }`}
        >
          Cits %
        </button>
      </div>
      {customOpen ? (
        <label className="block border-t border-[#e5e7eb] bg-white px-3 py-2.5">
          <span className="mb-1 block text-[11px] font-medium text-[#6b7280]">Procents no budžeta</span>
          <input
            type="number"
            min={0}
            max={100}
            className="min-h-[40px] w-full max-w-[8rem] rounded-lg border border-slate-200 px-2.5 text-[14px]"
            value={percent || ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setPercent(0);
                return;
              }
              setPercent(Number.parseInt(raw, 10) || 0);
            }}
          />
        </label>
      ) : null}
    </div>
  );
}
