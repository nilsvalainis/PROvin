"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminVinHandoffBinder } from "@/components/admin/AdminVinHandoffBinder";
import {
  AdminVinScanPanel,
  type VinScanPanelSnapshot,
} from "@/components/admin/AdminVinScanPanel";
import { canonicalizeListingUrl, isPlausibleListingUrl, isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { isCsddTechDataResult, type CsddTechData } from "@/lib/csdd-tech-data";
import {
  emptyVinScanPlates,
  isValidScanPlate,
  normalizeScanPlate,
  type VinScanPlateKind,
  type VinScanPlates,
} from "@/lib/vin-scan/plates";
import { formatCsddPlateLookup } from "@/lib/vin-scan/parse";
import { VinScanLiveCountsContext } from "@/components/admin/AdminSourceHealthStrip";
import { collectVinScanMileage, pickVinScanVehicle } from "@/lib/vin-scan/summary";
import { vinScanCountBreakdown } from "@/lib/vin-scan/types";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-[13px] tracking-wide text-[var(--color-apple-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25 max-md:h-12 max-md:rounded-[10px] max-md:text-[17px]";

const btnSecondary =
  "rounded-md border border-slate-300 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] hover:bg-black/[0.04] disabled:opacity-50 dark:border-slate-600 max-md:h-11 max-md:rounded-xl max-md:px-4 max-md:text-[15px] max-md:normal-case max-md:tracking-normal";

const FOREIGN_FIELDS: { kind: Exclude<VinScanPlateKind, "lv">; label: string }[] = [
  { kind: "nl", label: "NL numurs" },
  { kind: "lt", label: "LT numurs" },
  { kind: "fi", label: "FI numurs" },
  { kind: "uk", label: "UK numurs" },
];

type PlateView = { ok: boolean; vin: string; make: string; model: string; year: string; status: string };

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
      <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const lab = "mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[#86868b]";
const dockInp =
  "min-w-0 w-full h-11 rounded-[10px] border border-[#d2d2d7] bg-white px-3 font-mono text-[16px] tracking-wide text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none md:h-10 md:text-[14px]";

/**
 * Variants A: telefonā VIN + LV numurs piestiprināti apakšā (vienas rokas lietošana), zem tiem ↺ vēsture + „Pārbaudīt”;
 * rezultāti virs tiem. Galddatorā — viena rinda augšā (VIN · numurs · Pārbaudīt). Vēsture sakļauta, ielādējas tikai pēc pieskāriena.
 */
export function AdminVinScanPageClient({
  initialVin = "",
  footer,
}: {
  initialVin?: string;
  /** Avotu stāvoklis — pašā apakšā (straumēts no servera). */
  footer?: React.ReactNode;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => normalizeVin(initialVin));
  const [platesDraft, setPlatesDraft] = useState<VinScanPlates>(() => emptyVinScanPlates());
  const [plateBusy, setPlateBusy] = useState(false);
  const [plate, setPlate] = useState<PlateView | null>(null);
  const [csddData, setCsddData] = useState<CsddTechData | null>(null);
  const [scanNonce, setScanNonce] = useState(() => (isValidVin(normalizeVin(initialVin)) ? 1 : 0));
  const [scanForce, setScanForce] = useState(false);
  const [scanSnapshot, setScanSnapshot] = useState<VinScanPanelSnapshot | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [foreignOpen, setForeignOpen] = useState(false);
  const [listingDraft, setListingDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const vin = useMemo(() => normalizeVin(draft), [draft]);
  const valid = isValidVin(vin);
  const listingUrl = useMemo(() => canonicalizeListingUrl(listingDraft), [listingDraft]);
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
  const canScan =
    valid ||
    isValidScanPlate("lv", plates.lv) ||
    FOREIGN_FIELDS.some((f) => isValidScanPlate(f.kind, plates[f.kind])) ||
    isPlausibleListingUrl(listingUrl);
  const hasScanResult = Boolean(
    scanSnapshot?.scannedAt && scanSnapshot.rows.some((row) => row.status !== "idle"),
  );
  const scanBusy = Boolean(scanSnapshot?.busy);
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

  async function runScan(force = false) {
    if (!valid && isValidScanPlate("lv", plates.lv)) {
      const resolved = plate?.ok && plate.vin ? plate : await lookupLvPlate();
      if (resolved?.ok && isValidVin(resolved.vin)) setDraft(normalizeVin(resolved.vin));
      requestScan(true);
      return;
    }
    requestScan(force);
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

  const foreignCount = FOREIGN_FIELDS.filter((f) => platesDraft[f.kind].trim()).length;

  const vinInput = (
    <input
      type="text"
      inputMode="text"
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      className={dockInp}
      value={draft}
      onChange={(e) => setDraft(e.target.value.toUpperCase())}
      onKeyDown={(e) => {
        if (e.key === "Enter" && canScan) {
          e.preventDefault();
          void runScan(false);
        }
      }}
      aria-label="VIN"
    />
  );
  const plateInput = (
    <input
      type="text"
      inputMode="text"
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      className={dockInp}
      value={platesDraft.lv}
      onChange={(e) => setPlatesDraft((prev) => ({ ...prev, lv: e.target.value.toUpperCase() }))}
      onBlur={() => {
        void lookupLvPlate();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void lookupLvPlate();
        }
      }}
      aria-label="LV numurs"
    />
  );
  const scanButton = (
    <button
      type="button"
      disabled={!canScan || scanBusy || plateBusy}
      onClick={() => void runScan(false)}
      className="h-[50px] rounded-[10px] bg-[#1d1d1f] px-5 text-[17px] font-semibold text-white transition hover:bg-black disabled:opacity-40 md:h-10 md:text-[14px]"
    >
      {scanBusy ? "Pārbauda…" : "Pārbaudīt"}
    </button>
  );
  const historyButton = (
    <button
      type="button"
      aria-expanded={historyOpen}
      aria-label="Iepriekšējās pārbaudes"
      title="Iepriekšējās pārbaudes"
      onClick={() => setHistoryOpen((o) => !o)}
      className={`h-11 w-11 shrink-0 rounded-[10px] border text-[17px] transition ${
        historyOpen ? "border-[#1d1d1f] bg-[#f5f5f7]" : "border-[#d2d2d7] bg-white"
      } text-[#1d1d1f]`}
    >
      ↺
    </button>
  );

  return (
    <div className="mt-4 space-y-4 max-md:pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:mt-5">
      <AdminVinHandoffBinder vin={valid ? vin : ""} />
      {/* Galddators: viena rinda augšā. */}
      <div className="hidden md:block">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((o) => !o)}
            className="text-[12px] text-[#86868b] hover:text-[#1d1d1f]"
          >
            Vēsture {historyOpen ? "▾" : "›"}
          </button>
        </div>
        <div className="grid grid-cols-[2fr_1fr_auto] gap-2.5 rounded-xl border border-[#e5e5ea] bg-white p-3">
          <label className="block min-w-0"><span className={lab}>VIN</span>{vinInput}</label>
          <label className="block min-w-0"><span className={lab}>LV numurs</span>{plateInput}</label>
          <div className="flex items-end">{scanButton}</div>
        </div>
      </div>
      {/* Telefons: piestiprināts apakšā virs cilņu joslas. */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-30 border-t border-[#e5e5ea] bg-white/95 px-4 pb-3 pt-3 backdrop-blur md:hidden">
        <div className="grid grid-cols-[1.6fr_1fr] gap-2">
          <label className="block min-w-0"><span className={lab}>VIN</span>{vinInput}</label>
          <label className="block min-w-0"><span className={lab}>LV numurs</span>{plateInput}</label>
        </div>
        <div className="mt-2 grid grid-cols-[2.75rem_1fr] gap-2">
          {historyButton}
          {scanButton}
        </div>
      </div>
      <div>
        <button
          type="button"
          aria-expanded={foreignOpen}
          onClick={() => setForeignOpen((open) => !open)}
          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)] hover:text-[var(--color-apple-text)]"
        >
          Sludinājums un ārvalstu numuri
          {foreignCount + (listingDraft.trim() ? 1 : 0) && !foreignOpen
            ? ` · ${foreignCount + (listingDraft.trim() ? 1 : 0)}`
            : ""}
          <Chevron open={foreignOpen} />
        </button>
        {foreignOpen ? (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block space-y-1 sm:col-span-2 lg:col-span-4">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
                Sludinājums
              </span>
              <input
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                className={inp}
                value={listingDraft}
                onChange={(e) => setListingDraft(e.target.value)}
                aria-label="Sludinājums"
              />
            </label>
            {FOREIGN_FIELDS.map((field) => (
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
                  aria-label={field.label}
                />
              </label>
            ))}
          </div>
        ) : null}
      </div>
      {plate || plateBusy || hasScanResult ? (
        <div className="flex flex-wrap items-center gap-2 max-md:flex-col max-md:items-stretch">
          {plate || plateBusy ? (
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
          {hasScanResult ? (
            <>
              <button
                type="button"
                disabled={!canScan || scanBusy}
                onClick={() => void runScan(true)}
                className={btnSecondary}
              >
                Skenēt no jauna
              </button>
              <button type="button" disabled={!valid || creating} onClick={() => void createManualOrder()} className={btnSecondary}>
                {creating ? "Veido…" : "Izveidot manuālo pasūtījumu"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {createError ? <p className="text-[10px] text-rose-600 dark:text-rose-300">{createError}</p> : null}
      <AdminVinScanPanel
        vin={vin}
        plates={plates}
        listingUrl={listingUrl}
        scanNonce={scanNonce}
        scanForce={scanForce}
        onSnapshot={onSnapshot}
        historyOpen={historyOpen}
      />
      {footer ? (
        <VinScanLiveCountsContext.Provider
          value={
            hasScanResult && scanSnapshot
              ? vinScanCountBreakdown(scanSnapshot.rows.filter((row) => row.status !== "idle"))
              : null
          }
        >
          <div className="border-t border-[#e5e5ea] pt-3">{footer}</div>
        </VinScanLiveCountsContext.Provider>
      ) : null}
    </div>
  );
}
