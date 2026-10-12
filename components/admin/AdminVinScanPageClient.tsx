"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminVinHandoffBinder } from "@/components/admin/AdminVinHandoffBinder";
import {
  AdminVinScanPanel,
  type VinScanPanelSnapshot,
} from "@/components/admin/AdminVinScanPanel";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { isCsddTechDataResult, type CsddTechData } from "@/lib/csdd-tech-data";
import {
  emptyVinScanPlates,
  isValidScanPlate,
  normalizeScanPlate,
  type VinScanPlateKind,
  type VinScanPlates,
} from "@/lib/vin-scan/plates";
import { formatCsddPlateLookup } from "@/lib/vin-scan/parse";
import { collectVinScanMileage, pickVinScanVehicle } from "@/lib/vin-scan/summary";
import { vinScanFormatHint } from "@/lib/vin-scan/vin-check";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-[13px] tracking-wide text-[var(--color-apple-text)] placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const PLATE_FIELDS: { kind: VinScanPlateKind; label: string; placeholder: string }[] = [
  { kind: "lv", label: "LV numurs", placeholder: "NG8493" },
  { kind: "nl", label: "NL numurs", placeholder: "G123BB" },
  { kind: "lt", label: "LT numurs", placeholder: "ABC123" },
  { kind: "fi", label: "FI numurs", placeholder: "ABC123" },
  { kind: "uk", label: "UK numurs", placeholder: "AB12CDE" },
];

type PlateView = { ok: boolean; vin: string; make: string; model: string; year: string; status: string };

export function AdminVinScanPageClient({
  initialVin = "",
}: {
  initialVin?: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => normalizeVin(initialVin));
  const [platesDraft, setPlatesDraft] = useState<VinScanPlates>(() => emptyVinScanPlates());
  const [plateBusy, setPlateBusy] = useState(false);
  const [plate, setPlate] = useState<PlateView | null>(null);
  const [csddData, setCsddData] = useState<CsddTechData | null>(null);
  const [scanNonce, setScanNonce] = useState(0);
  const [scanForce, setScanForce] = useState(false);
  const [scanSnapshot, setScanSnapshot] = useState<VinScanPanelSnapshot | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const vin = useMemo(() => normalizeVin(draft), [draft]);
  const valid = isValidVin(vin);
  const plates = useMemo(
    () => ({
      lv: normalizeScanPlate(platesDraft.lv),
      nl: normalizeScanPlate(platesDraft.nl),
      lt: normalizeScanPlate(platesDraft.lt),
      fi: normalizeScanPlate(platesDraft.fi),
      uk: normalizeScanPlate(platesDraft.uk),
    }),
    [platesDraft],
  );
  const vinHint = vinScanFormatHint(vin);
  const canScan = valid || PLATE_FIELDS.some((f) => isValidScanPlate(f.kind, plates[f.kind]));
  const onSnapshot = useCallback((snapshot: VinScanPanelSnapshot) => {
    setScanSnapshot(snapshot);
  }, []);

  async function lookupLvPlate(): Promise<PlateView | null> {
    if (!isValidScanPlate("lv", plates.lv) || plateBusy) return plate;
    setPlateBusy(true);
    try {
      const res = await fetch("/api/admin/csdd-tech-data", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nr1: plates.lv }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok || !isCsddTechDataResult(data)) {
        const next = {
          ok: false,
          vin: "",
          make: "",
          model: "",
          year: "",
          status: res.status === 401 ? "Nav admin sesijas" : "CSDD vaicājums neizdevās",
        };
        setPlate(next);
        setCsddData(null);
        return next;
      }
      const next = formatCsddPlateLookup(data);
      setPlate(next);
      setCsddData(data.found ? data.data : null);
      if (next.ok && isValidVin(next.vin)) setDraft(normalizeVin(next.vin));
      return next;
    } catch {
      const next = { ok: false, vin: "", make: "", model: "", year: "", status: "CSDD vaicājums neizdevās" };
      setPlate(next);
      setCsddData(null);
      return next;
    } finally {
      setPlateBusy(false);
    }
  }

  function requestScan(force = false) {
    setScanForce(force);
    setScanNonce((n) => n + 1);
  }

  async function scanWithPlateVin() {
    const resolved = plate?.ok && plate.vin ? plate : await lookupLvPlate();
    if (resolved?.ok && isValidVin(resolved.vin)) setDraft(normalizeVin(resolved.vin));
    requestScan(true);
  }

  async function createManualOrder() {
    if (!valid || creating) return;
    setCreating(true);
    setCreateError("");
    const rows = scanSnapshot?.rows ?? [];
    const plateVehicle =
      plate?.ok && (plate.make || plate.model || plate.year)
        ? { make: plate.make, model: plate.model, year: plate.year }
        : null;
    const vehicle = plateVehicle ?? pickVinScanVehicle(rows);
    try {
      const res = await fetch("/api/admin/manual-orders", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vin,
          plate: plates.lv || csddData?.registrationNumber || "",
          plates,
          plateStatus: plate?.status || "",
          csdd: csddData,
          vehicle,
          mileage: collectVinScanMileage(rows),
          scannedAt: scanSnapshot?.scannedAt || "",
          sources: rows,
        }),
      });
      const data = (await res.json().catch(() => null)) as { orderId?: unknown; record?: { id?: unknown }; error?: unknown } | null;
      const orderId =
        (typeof data?.orderId === "string" && data.orderId) ||
        (typeof data?.record?.id === "string" && data.record.id) ||
        "";
      if (!res.ok || !orderId) {
        setCreateError(
          res.status === 401
            ? "Nav admin sesijas"
            : typeof data?.error === "string"
              ? data.error
              : "Neizdevās izveidot pasūtījumu",
        );
        return;
      }
      router.push(`/admin/orders/${encodeURIComponent(orderId)}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Tīkla kļūda");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <AdminVinHandoffBinder vin={valid ? vin : ""} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block space-y-1 sm:col-span-2 lg:col-span-1">
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
          {vin && vinHint.warning ? (
            <p className="text-[10px] text-amber-700 dark:text-amber-300">{vinHint.warning}</p>
          ) : null}
        </label>
        {PLATE_FIELDS.map((field) => (
          <label key={field.kind} className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
              {field.label}
            </span>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className={inp}
              value={platesDraft[field.kind]}
              onChange={(e) => setPlatesDraft((prev) => ({ ...prev, [field.kind]: e.target.value.toUpperCase() }))}
              onBlur={() => {
                if (field.kind === "lv") void lookupLvPlate();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && field.kind === "lv") {
                  e.preventDefault();
                  void lookupLvPlate();
                }
              }}
              placeholder={field.placeholder}
              aria-label={field.label}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {plate || plateBusy || isValidScanPlate("lv", plates.lv) ? (
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
        ) : null}
        <button
          type="button"
          disabled={plateBusy || !isValidScanPlate("lv", plates.lv)}
          onClick={() => void scanWithPlateVin()}
          className="rounded-md border border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] transition hover:bg-[var(--color-provin-accent-soft)]/70 disabled:opacity-50"
        >
          Skenēt ar LV numuru
        </button>
        <button
          type="button"
          disabled={!canScan}
          onClick={() => requestScan(false)}
          className="rounded-md border border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] transition hover:bg-[var(--color-provin-accent-soft)]/70 disabled:opacity-50"
        >
          Skenēt visus avotus
        </button>
        <button
          type="button"
          disabled={!canScan}
          onClick={() => requestScan(true)}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] hover:bg-black/[0.04] disabled:opacity-50 dark:border-slate-600"
        >
          Skenēt no jauna
        </button>
        <button
          type="button"
          disabled={!valid || creating}
          onClick={() => void createManualOrder()}
          className="rounded-md border border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] transition hover:bg-[var(--color-provin-accent-soft)]/70 disabled:opacity-50"
        >
          {creating ? "Veido…" : "Izveidot manuālo pasūtījumu"}
        </button>
      </div>
      {createError ? <p className="text-[10px] text-rose-600 dark:text-rose-300">{createError}</p> : null}
      <AdminVinScanPanel
        vin={vin}
        plates={plates}
        scanNonce={scanNonce}
        scanForce={scanForce}
        onSnapshot={onSnapshot}
      />
    </div>
  );
}
