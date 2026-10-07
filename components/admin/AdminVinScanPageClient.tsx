"use client";

import { useMemo, useState } from "react";
import { AdminVinHandoffBinder } from "@/components/admin/AdminVinHandoffBinder";
import { AdminVinScanPanel } from "@/components/admin/AdminVinScanPanel";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

const inp =
  "min-w-0 w-full max-w-md rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-[13px] tracking-wide text-[var(--color-apple-text)] placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

export function AdminVinScanPageClient({ initialVin = "" }: { initialVin?: string }) {
  const [draft, setDraft] = useState(() => normalizeVin(initialVin));
  const vin = useMemo(() => normalizeVin(draft), [draft]);
  const valid = isValidVin(vin);

  return (
    <div className="mt-6 space-y-4">
      <AdminVinHandoffBinder vin={valid ? vin : ""} />
      <label className="block max-w-md space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">VIN</span>
        <input
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className={inp}
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          placeholder="Ievadi 11-17 zīmju VIN"
          aria-label="VIN skenēšanai"
        />
      </label>
      <AdminVinScanPanel vin={vin} />
    </div>
  );
}
