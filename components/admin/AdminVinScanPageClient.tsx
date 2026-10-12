"use client";

import { useMemo, useState } from "react";
import { AdminVinHandoffBinder } from "@/components/admin/AdminVinHandoffBinder";
import { AdminVinScanPanel } from "@/components/admin/AdminVinScanPanel";
import { isValidPlateNumber, isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";
import { isCsddTechDataResult } from "@/lib/csdd-tech-data";
import { formatCsddPlateLookup } from "@/lib/vin-scan/parse";

const inp =
  "min-w-0 w-full max-w-md rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-[13px] tracking-wide text-[var(--color-apple-text)] placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

type PlateView = { ok: boolean; vin: string; make: string; model: string; year: string; status: string };

export function AdminVinScanPageClient({
  initialVin = "",
}: {
  initialVin?: string;
}) {
  const [draft, setDraft] = useState(() => normalizeVin(initialVin));
  const [plateDraft, setPlateDraft] = useState("");
  const [plateBusy, setPlateBusy] = useState(false);
  const [plate, setPlate] = useState<PlateView | null>(null);
  const [scanNonce, setScanNonce] = useState(0);
  const vin = useMemo(() => normalizeVin(draft), [draft]);
  const valid = isValidVin(vin);
  const plateValue = normalizePlateNumber(plateDraft);
  const plateOk = isValidPlateNumber(plateValue);

  async function lookupPlate(): Promise<PlateView | null> {
    if (!plateOk || plateBusy) return plate;
    setPlateBusy(true);
    try {
      const res = await fetch("/api/admin/csdd-tech-data", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nr1: plateValue }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok || !isCsddTechDataResult(data)) {
        const next = { ok: false, vin: "", make: "", model: "", year: "", status: res.status === 401 ? "Nav admin sesijas" : "CSDD vaicājums neizdevās" };
        setPlate(next);
        return next;
      }
      const next = formatCsddPlateLookup(data);
      setPlate(next);
      return next;
    } catch {
      const next = { ok: false, vin: "", make: "", model: "", year: "", status: "CSDD vaicājums neizdevās" };
      setPlate(next);
      return next;
    } finally {
      setPlateBusy(false);
    }
  }

  async function scanWithPlateVin() {
    const resolved = plate?.ok && plate.vin ? plate : await lookupPlate();
    if (!resolved?.ok || !isValidVin(resolved.vin)) return;
    setDraft(normalizeVin(resolved.vin));
    setScanNonce((n) => n + 1);
  }

  return (
    <div className="mt-6 space-y-4">
      <AdminVinHandoffBinder vin={valid ? vin : ""} />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <label className="block max-w-md flex-1 space-y-1">
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
        <label className="block max-w-md flex-1 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
            Reģ. numurs (LV)
          </span>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className={inp}
            value={plateDraft}
            onChange={(e) => setPlateDraft(e.target.value.toUpperCase())}
            onBlur={() => void lookupPlate()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void lookupPlate();
              }
            }}
            placeholder="NG8493"
            aria-label="Latvijas reģistrācijas numurs"
          />
        </label>
      </div>
      {plate || plateOk || plateBusy ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-[var(--color-apple-text)]">
            {plateBusy
              ? "CSDD…"
              : plate
                ? plate.ok
                  ? [plate.vin, [plate.year, plate.make, plate.model].filter(Boolean).join(" "), plate.status]
                      .filter(Boolean)
                      .join(" · ")
                  : plate.status
                : ""}
          </p>
          <button
            type="button"
            disabled={plateBusy || (!plate?.ok && !plateOk)}
            onClick={() => void scanWithPlateVin()}
            className="rounded-md border border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] transition hover:bg-[var(--color-provin-accent-soft)]/70 disabled:opacity-50"
          >
            Skenēt ar šo VIN
          </button>
        </div>
      ) : null}
      <AdminVinScanPanel vin={vin} scanNonce={scanNonce} />
    </div>
  );
}
