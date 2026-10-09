"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { adminActionPillBase } from "@/components/admin/adminActionPill";
import type { CsddFormFields } from "@/lib/admin-source-blocks";
import {
  applyCsddTechDataToBlock,
  csddTechLookupNr1,
  csddVinMatchesOrder,
} from "@/lib/csdd-tech-data-apply";
import type { CsddTechDataResult } from "@/lib/csdd-tech-data";

const pillClass = `${adminActionPillBase} bg-emerald-800 hover:bg-emerald-900 focus-visible:ring-emerald-700`;

type Props = {
  value: CsddFormFields;
  orderVin?: string;
  disabled?: boolean;
  onChange: (next: CsddFormFields) => void;
};

export function AdminCsddTechFetchButton({ value, orderVin = "", disabled, onChange }: Props) {
  const nr1 = csddTechLookupNr1(value.registrationNumber, orderVin);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!nr1 || disabled || busy) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/csdd-tech-data", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nr1 }),
      });
      const data = (await res.json().catch(() => ({}))) as CsddTechDataResult & { error?: string };
      if (!res.ok) {
        setError(
          data.error === "unauthorized"
            ? "Nav admin sesijas"
            : data.error === "invalid_nr1"
              ? "Nav derīga VIN vai numurzīmes"
              : "Neizdevās ielādēt CSDD reģistra datus",
        );
        return;
      }
      if (!data.found) {
        setError(data.message || "CSDD reģistrā šāds numurs netika atrasts");
        return;
      }
      const next = applyCsddTechDataToBlock(value, data.data, { nr1 });
      const mismatch = csddVinMatchesOrder(data.data.vin, orderVin);
      if (!next) {
        setStatus(
          mismatch === false
            ? `${data.message}. Reģistra dati nav mainījušies. Reģistra VIN (${data.data.vin}) atšķiras no pasūtījuma.`
            : `${data.message}. Reģistra dati nav mainījušies.`,
        );
        return;
      }
      onChange(next);
      const conflictN = Object.keys(next.conflicts ?? {}).length;
      const conflictNote =
        conflictN > 0 ? ` ${conflictN} laukos RAW/PDF vērtība atšķiras no reģistra (skat. dzeltenās atzīmes).` : "";
      setStatus(
        mismatch === false
          ? `${data.message}. Reģistra VIN (${data.data.vin}) atšķiras no pasūtījuma.${conflictNote}`
          : `${data.message}.${conflictNote}`,
      );
    } catch {
      setError("Neizdevās savienoties ar CSDD releju");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={pillClass}
        disabled={disabled || busy || !nr1}
        title={
          nr1
            ? `Ielasīt tehniskos datus no CSDD reģistra (${nr1})`
            : "Nav VIN vai reģistrācijas numura"
        }
        onClick={() => void load()}
      >
        {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden /> : null}
        {busy ? "Ielasa reģistru…" : "Ielasīt no reģistra"}
      </button>
      {status ? (
        <p className="text-[9px] text-emerald-800/90" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="text-[9px] text-rose-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
