"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminVinHandoffBinder } from "@/components/admin/AdminVinHandoffBinder";
import { AdminVinMemoryPanel } from "@/components/admin/AdminVinMemoryPanel";
import { AdminVinScanPanel, type VinScanPanelSnapshot } from "@/components/admin/AdminVinScanPanel";
import { VinScanLiveCountsContext } from "@/components/admin/AdminSourceHealthStrip";
import { AdminMobileVinCameraSheet } from "@/components/admin/mobile/AdminMobileVinCameraSheet";
import { AdminDealerCheckPage, type DealerCheckEmbedState } from "@/components/admin/AdminDealerCheckPage";
import { AdminAtraFreeSources, AdminAtraPaidSources, RunButton } from "@/components/admin/AdminAtraParbaudeSources";
import { AdminAtraParbaudeHistory } from "@/components/admin/AdminAtraParbaudeHistory";
import { AdminAtraCopyButton, AdminAtraFactCards, AdminAtraPotential } from "@/components/admin/AdminAtraParbaudeFacts";
import { atraStoryScore, atraSummaryText, buildAtraFacts } from "@/lib/atra-parbaude-facts";
import { AdminVinScanPageClient } from "@/components/admin/AdminVinScanPageClient";
import { AdminMobileSegments } from "@/components/admin/mobile/AdminMobileChrome";
import { ADMIN_MOBILE_MQ } from "@/lib/admin-mobile-shell";
import {
  ATRA_JOJ_APPROX_CENTS,
  ATRA_JOJ_ID,
  ATRA_PAGE_PATH,
  ATRA_SPECKR_ID,
  ATRA_TITLE,
  atraFreeGroups,
  atraFreeSourceIds,
  atraHistoryToCsv,
  atraOneautoSelected,
  atraPaidCost,
  mergeAtraHistory,
  parseAtraQuery,
  type AtraHistoryEntry,
  type AtraHistoryMeta,
  type AtraPaidId,
} from "@/lib/atra-parbaude";
import { ATRA_MANUAL_ORDER_LABEL, buildAtraManualOrderBody } from "@/lib/atra-parbaude-manual-order";
import {
  DEALER_CHECK_DEFAULT_TEMPLATE,
  type DealerCheckRecord,
  type DealerCheckTemplateId,
} from "@/lib/dealer-check";
import { dealerCheckCsddLookupQuery } from "@/lib/dealer-check-csdd";
import type { DealerCheckHistoryEntry } from "@/lib/dealer-check-history";
import { buildDealerCheckManualOrderBody, dealerCheckManualOrderCanCreate } from "@/lib/dealer-check-manual-order";
import { isCsddTechDataResult, type CsddTechData } from "@/lib/csdd-tech-data";
import { canonicalizeListingUrl, isPlausibleListingUrl, isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { emptyVinScanPlates, isValidScanPlate, normalizeScanPlate, type VinScanPlateKind, type VinScanPlates } from "@/lib/vin-scan/plates";
import { formatCsddPlateLookup } from "@/lib/vin-scan/parse";
import { VIN_SCAN_HISTORY_KEY, mergeVinScanHistory, parseVinScanHistory } from "@/lib/vin-scan/camera-vin";
import { collectVinScanMileage, pickVinScanVehicle } from "@/lib/vin-scan/summary";
import { vinScanCountBreakdown } from "@/lib/vin-scan/types";
import type { SpeckrOrderSnapshot } from "@/lib/speckr-order";
import { parseSpeckrOrderSnapshotRaw } from "@/lib/speckr-order";

export type AtraDealerInitial = {
  initialVin: string;
  initialPlate: string;
  initialCsdd: CsddTechData | null;
  initialCsddMessage: string;
  fromAutoparks: boolean;
  initialRecord: DealerCheckRecord | null;
  initialEntries: DealerCheckHistoryEntry[];
};

type PlateView = { ok: boolean; vin: string; make: string; model: string; year: string; status: string };

const FOREIGN_FIELDS: { kind: Exclude<VinScanPlateKind, "lv">; label: string }[] = [
  { kind: "nl", label: "NL numurs" },
  { kind: "lt", label: "LT numurs" },
  { kind: "fi", label: "FI numurs" },
  { kind: "uk", label: "UK numurs" },
  { kind: "se", label: "SE numurs" },
];

const card = "rounded-[14px] border border-[#e5e5ea] bg-white px-[18px] py-4";
const fld =
  "flex min-h-[48px] flex-col justify-center rounded-[10px] border border-[#d1d1d6] bg-white px-3.5 py-1.5 focus-within:border-[#0b3fa8]";
const fldLabel = "text-[11px] font-semibold text-[#8e8e93]";
const fldInput =
  "w-full min-w-0 bg-transparent text-[17px] font-semibold tracking-[0.5px] text-[#111] outline-none placeholder:text-[15px] placeholder:font-normal placeholder:tracking-normal placeholder:text-[#b0b0b5]";
const btn =
  "inline-flex min-h-[42px] items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-[#e5e5ea] bg-white px-[18px] text-[14.5px] font-semibold text-[#111] disabled:opacity-45";

function vehicleTitle(v: { make?: string; model?: string } | null | undefined): string {
  return [v?.make, v?.model].filter(Boolean).join(" ").trim();
}

/**
 * «Ātrā pārbaude»: viens lauks (VIN vai LV numurs), bezmaksas avoti ieslēgti, maksas izslēgti ar kopsummu,
 * rezultāti pakāpeniski, viens «Izveidot manuālu pasūtījumu» ar VIN SCAN + dīlera datiem.
 */
export function AdminAtraParbaudePage({
  initialVin = "",
  initialPlate = "",
  autoScan = false,
  isAdmin,
  thecarapiEnabled,
  dealer,
  footer,
}: {
  initialVin?: string;
  initialPlate?: string;
  autoScan?: boolean;
  isAdmin: boolean;
  thecarapiEnabled: boolean;
  dealer: AtraDealerInitial | null;
  footer?: React.ReactNode;
}) {
  const router = useRouter();
  const startVin = isValidVin(normalizeVin(initialVin)) ? normalizeVin(initialVin) : "";
  const [query, setQuery] = useState(() => startVin || initialPlate);
  const [vin, setVin] = useState(startVin);
  const [plate, setPlate] = useState(() => {
    const p = normalizeScanPlate(initialPlate);
    return isValidScanPlate("lv", p) ? p : "";
  });
  const [plateInfo, setPlateInfo] = useState<PlateView | null>(null);
  const [plateBusy, setPlateBusy] = useState(false);
  const [csdd, setCsdd] = useState<CsddTechData | null>(dealer?.initialRecord?.csddSnapshot ?? dealer?.initialCsdd ?? null);
  const [listingDraft, setListingDraft] = useState("");
  const [foreign, setForeign] = useState<VinScanPlates>(() => emptyVinScanPlates());
  const [foreignOpen, setForeignOpen] = useState(false);
  const freeAll = useMemo(() => atraFreeSourceIds(thecarapiEnabled), [thecarapiEnabled]);
  const groups = useMemo(() => atraFreeGroups(thecarapiEnabled), [thecarapiEnabled]);
  const [freeOn, setFreeOn] = useState<string[]>(freeAll);
  const [paidOn, setPaidOn] = useState<AtraPaidId[]>([]);
  const [template, setTemplate] = useState<DealerCheckTemplateId>(dealer?.initialRecord?.template ?? DEALER_CHECK_DEFAULT_TEMPLATE);
  const [scanNonce, setScanNonce] = useState(() => (autoScan && startVin ? 1 : 0));
  const [scanForce, setScanForce] = useState(false);
  const [snapshot, setSnapshot] = useState<VinScanPanelSnapshot | null>(null);
  const [dealerNonce, setDealerNonce] = useState(0);
  const [dealerState, setDealerState] = useState<DealerCheckEmbedState | null>(null);
  const [speckr, setSpeckr] = useState<SpeckrOrderSnapshot | null>(null);
  const [speckrBusy, setSpeckrBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [recent, setRecent] = useState<AtraHistoryEntry[]>([]);
  const [allScansOpen, setAllScansOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<HTMLElement | null>(null);
  const dealerSeen = useRef<string>(dealer?.initialRecord?.id ?? "");

  const valid = isValidVin(vin);
  const listingUrl = useMemo(() => canonicalizeListingUrl(listingDraft), [listingDraft]);
  const plates = useMemo<VinScanPlates>(
    () => ({
      lv: plate,
      nl: normalizeScanPlate(foreign.nl),
      lt: normalizeScanPlate(foreign.lt),
      fi: normalizeScanPlate(foreign.fi),
      uk: normalizeScanPlate(foreign.uk),
      se: normalizeScanPlate(foreign.se),
    }),
    [plate, foreign],
  );
  const hasForeign = FOREIGN_FIELDS.some((f) => isValidScanPlate(f.kind, plates[f.kind]));
  const canRun = valid || Boolean(plate) || hasForeign || isPlausibleListingUrl(listingUrl);
  const paidAllowed = useMemo<AtraPaidId[]>(() => (isAdmin ? paidOn : []), [isAdmin, paidOn]);
  const cost = useMemo(() => atraPaidCost(paidAllowed), [paidAllowed]);
  const oneauto = useMemo(() => atraOneautoSelected(paidAllowed), [paidAllowed]);
  const jojOn = paidAllowed.includes(ATRA_JOJ_ID);
  const paidScanIds = useMemo(() => (jojOn ? [ATRA_JOJ_ID] : []), [jojOn]);
  const rows = useMemo(() => snapshot?.rows ?? [], [snapshot]);
  const doneRows = rows.filter((r) => r.status !== "idle");
  const hasScanResult = Boolean(snapshot?.scannedAt && doneRows.length > 0);
  const scanBusy = Boolean(snapshot?.busy);
  const busy = scanBusy || plateBusy || Boolean(dealerState?.busy) || speckrBusy;
  const vehicle = useMemo(() => {
    if (plateInfo?.ok && (plateInfo.make || plateInfo.model)) return { make: plateInfo.make, model: plateInfo.model, year: plateInfo.year };
    if (csdd?.make || csdd?.model) return { make: csdd.make, model: csdd.model, year: csdd.year };
    return pickVinScanVehicle(rows);
  }, [plateInfo, csdd, rows]);
  const title = vehicleTitle(vehicle);
  const dealerRecordForFacts = dealerState?.record ?? null;
  const facts = useMemo(
    () =>
      buildAtraFacts({
        vin,
        plate,
        title,
        year: vehicle?.year ?? "",
        rows,
        dealer: dealerRecordForFacts && normalizeVin(dealerRecordForFacts.vin) === vin ? dealerRecordForFacts : null,
        csdd,
        hasListing: isPlausibleListingUrl(listingUrl),
      }),
    [vin, plate, title, vehicle, rows, dealerRecordForFacts, csdd, listingUrl],
  );
  const score = useMemo(() => atraStoryScore(facts), [facts]);
  const summary = useMemo(() => atraSummaryText({ vin, title, year: vehicle?.year ?? "" }, facts, score), [vin, title, vehicle, facts, score]);

  /* ---------- vēsture: abas krātuves ---------- */
  useEffect(() => {
    let local: AtraHistoryEntry[] = [];
    try {
      local = parseVinScanHistory(localStorage.getItem(VIN_SCAN_HISTORY_KEY));
    } catch {
      local = [];
    }
    setRecent(local);
    let stop = false;
    void fetch("/api/admin/vin-scan/history", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { entries?: unknown } | null) => {
        if (stop || !data || !Array.isArray(data.entries)) return;
        const server = parseVinScanHistory(JSON.stringify(data.entries)) as AtraHistoryEntry[];
        // Serveris ir galvenais (tur ir «Ātrā pārbaude» lauki); pārlūka kopija tikai papildina.
        setRecent((prev) => mergeVinScanHistory(server, prev) as AtraHistoryEntry[]);
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(VIN_SCAN_HISTORY_KEY, JSON.stringify(recent));
    } catch {
      /* nav krātuves */
    }
  }, [recent]);

  const remember = useCallback((v: string, meta: AtraHistoryMeta | null) => {
    if (!isValidVin(v)) return;
    void fetch("/api/admin/vin-scan/history", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vin: v, ...(meta ? { meta } : {}) }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { entries?: unknown } | null) => {
        if (data && Array.isArray(data.entries) && data.entries.length) {
          setRecent(parseVinScanHistory(JSON.stringify(data.entries)) as AtraHistoryEntry[]);
        }
      })
      .catch(() => undefined);
    setRecent((prev) => {
      const at = new Date().toISOString();
      const old = prev.find((e) => e.vin === v);
      return [{ ...(old ?? {}), ...(meta ?? {}), vin: v, at }, ...prev.filter((e) => e.vin !== v)].slice(0, 15);
    });
  }, []);

  const dealerEntriesState = dealerState?.entries;
  const dealerEntriesInitial = dealer?.initialEntries;
  const historyRows = useMemo(
    () => mergeAtraHistory(recent, dealerEntriesState ?? dealerEntriesInitial ?? []),
    [recent, dealerEntriesState, dealerEntriesInitial],
  );

  /* ---------- CSDD ---------- */
  async function lookupCsdd(nr1: string): Promise<{ view: PlateView; data: CsddTechData | null }> {
    setPlateBusy(true);
    try {
      const res = await fetch("/api/admin/csdd-tech-data", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nr1 }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok || !isCsddTechDataResult(data)) {
        const status = res.status === 401 ? "Nav admin sesijas" : "CSDD vaicājums neizdevās";
        return { view: { ok: false, vin: "", make: "", model: "", year: "", status }, data: null };
      }
      return { view: formatCsddPlateLookup(data), data: data.found ? data.data : null };
    } catch {
      return { view: { ok: false, vin: "", make: "", model: "", year: "", status: "CSDD vaicājums neizdevās" }, data: null };
    } finally {
      setPlateBusy(false);
    }
  }

  async function resolvePlate(p: string): Promise<{ vin: string; csdd: CsddTechData | null }> {
    if (!p) return { vin: "", csdd: null };
    if (plateInfo?.ok && isValidVin(plateInfo.vin)) return { vin: normalizeVin(plateInfo.vin), csdd };
    const { view, data } = await lookupCsdd(p);
    setPlateInfo(view);
    setCsdd(data);
    if (view.ok && isValidVin(view.vin)) {
      const v = normalizeVin(view.vin);
      setVin(v);
      return { vin: v, csdd: data };
    }
    return { vin: "", csdd: data };
  }

  function onQuery(text: string) {
    const upper = text.toUpperCase();
    setQuery(upper);
    const q = parseAtraQuery(upper);
    setPlateInfo(null);
    setSpeckr(null);
    if (q.kind === "vin") {
      if (q.vin !== vin) setCsdd(null);
      setVin(q.vin);
      setPlate("");
    } else if (q.kind === "plate") {
      setPlate(q.plate);
      setVin("");
      setCsdd(null);
    } else {
      setVin("");
      setPlate("");
    }
  }

  /* ---------- palaišana ---------- */
  async function runCheck(force = false) {
    if (!canRun || busy) return;
    setCreateError("");
    let v = vin;
    let csddNow = csdd;
    if (!isValidVin(v) && plate) {
      const resolved = await resolvePlate(plate);
      v = resolved.vin;
      csddNow = resolved.csdd;
    }
    // Dīlera datiem vajag CSDD (kā agrāk dīlera lapā); tikai, ja ieķeksēts OneAuto.
    if (isAdmin && oneauto.length && isValidVin(v) && !csddNow) {
      const query = dealerCheckCsddLookupQuery(plate, v);
      if (query) {
        const { data } = await lookupCsdd(query);
        csddNow = data;
        setCsdd(data);
      }
    }
    if (isValidVin(v)) {
      remember(v, {
        ...(plate ? { plate } : {}),
        ...(title ? { title } : {}),
        // OneAuto faktiski iekasēto pieskaita dīlera ieraksts; šeit tikai JoJ.
        costCents: jojOn ? ATRA_JOJ_APPROX_CENTS : 0,
      });
    }
    setScanForce(force);
    setScanNonce((n) => n + 1);
    if (isAdmin && oneauto.length && (isValidVin(v) || plate)) {
      setDealerNonce((n) => n + 1);
    }
    if (isAdmin && paidAllowed.includes(ATRA_SPECKR_ID) && isValidVin(v)) void loadSpeckr(v);
  }

  async function loadSpeckr(v: string) {
    setSpeckrBusy(true);
    try {
      const res = await fetch("/api/admin/sources/speckr", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vin: v }),
      });
      const data: unknown = await res.json().catch(() => null);
      const snap = parseSpeckrOrderSnapshotRaw(data);
      setSpeckr(
        snap ?? {
          vin: v,
          fetchedAt: new Date().toISOString(),
          result: { outcome: "error", summary: res.status === 503 ? "Speckr nav konfigurēts" : "Speckr neatbildēja", lines: [] },
        },
      );
    } catch {
      setSpeckr({ vin: v, fetchedAt: new Date().toISOString(), result: { outcome: "error", summary: "Tīkla kļūda", lines: [] } });
    } finally {
      setSpeckrBusy(false);
    }
  }

  /* ---------- dīlera ieraksts → vēsture ---------- */
  const onDealerState = useCallback((s: DealerCheckEmbedState) => setDealerState(s), []);
  const dealerRecord = dealerState?.record ?? null;
  useEffect(() => {
    if (!dealerRecord?.id || dealerSeen.current === dealerRecord.id) return;
    dealerSeen.current = dealerRecord.id;
    const rv = normalizeVin(dealerRecord.vin);
    // Saraksta «Atvērt» rāda citu auto - ievade seko.
    if (isValidVin(rv) && rv !== vin) {
      setQuery(rv);
      setVin(rv);
      setPlate(dealerRecord.plate ? normalizeScanPlate(dealerRecord.plate) : "");
      setPlateInfo(null);
    }
    if (isValidVin(rv) && dealerRecord.fetchedAt) remember(rv, { dealerCheckId: dealerRecord.id });
  }, [dealerRecord, vin, remember]);

  // Pēc pārbaudes: potenciāls un auto nosaukums vēsturē (vienreiz katrai skenēšanai).
  const savedPotential = useRef("");
  const scannedAt = snapshot?.scannedAt ?? "";
  useEffect(() => {
    // Tikai pēc šajā lapā palaistas pārbaudes (kešā atvērts auto vēsturē laiku nemaina).
    if (!scanNonce || !valid || scanBusy || !scannedAt || !hasScanResult) return;
    const key = `${vin}|${scannedAt}|${score.level}`;
    if (savedPotential.current === key) return;
    savedPotential.current = key;
    remember(vin, { potential: score.level, ...(title ? { title } : {}) });
  }, [scanNonce, valid, scanBusy, scannedAt, hasScanResult, vin, score.level, title, remember]);

  /* ---------- manuālais pasūtījums (viens ceļš) ---------- */
  const dealerCsdd = dealerState?.csdd ?? csdd;
  const dealerUsable =
    isAdmin &&
    valid &&
    dealerCheckManualOrderCanCreate({ vin, plate, csdd: dealerCsdd, record: dealerRecord, comments: dealerState?.comments });
  const canCreate = isAdmin && valid && !creating && !busy && (hasScanResult || dealerUsable);

  async function createManualOrder() {
    if (!canCreate) return;
    setCreating(true);
    setCreateError("");
    const plateVehicle =
      plateInfo?.ok && (plateInfo.make || plateInfo.model || plateInfo.year)
        ? { make: plateInfo.make, model: plateInfo.model, year: plateInfo.year }
        : null;
    const vinScan = {
      vin,
      plate: plate || csdd?.registrationNumber || "",
      plates,
      plateStatus: plateInfo?.status || "",
      csdd,
      vehicle: plateVehicle ?? pickVinScanVehicle(rows),
      mileage: collectVinScanMileage(rows),
      scannedAt: snapshot?.scannedAt || "",
      sources: rows,
    };
    const dealerBody = dealerUsable
      ? buildDealerCheckManualOrderBody({ vin, plate, csdd: dealerCsdd, record: dealerRecord, comments: dealerState?.comments })
      : null;
    try {
      const res = await fetch("/api/admin/manual-orders", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildAtraManualOrderBody({ vinScan, dealer: dealerBody, speckr: speckr?.vin === vin ? speckr : null })),
      });
      const data = (await res.json().catch(() => null)) as { orderId?: unknown; error?: unknown } | null;
      const orderId = typeof data?.orderId === "string" ? data.orderId : "";
      if (!res.ok || !orderId) {
        setCreateError(
          res.status === 401 ? "Nav admin sesijas" : typeof data?.error === "string" ? data.error : "Neizdevās izveidot pasūtījumu",
        );
        return;
      }
      remember(vin, { orderId });
      router.push(`/admin/orders/${encodeURIComponent(orderId)}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Tīkla kļūda");
    } finally {
      setCreating(false);
    }
  }

  function exportCsv() {
    const blob = new Blob([atraHistoryToCsv(historyRows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "atras-parbaudes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const q = parseAtraQuery(query);
  const foreignCount = FOREIGN_FIELDS.filter((f) => foreign[f.kind].trim()).length;
  const progressTotal = rows.length;
  const progressDone = doneRows.length;
  const showResult = hasScanResult || scanBusy || Boolean(dealerRecord) || Boolean(dealerState?.busy) || Boolean(speckr);

  return (
    <div className="mt-4 space-y-3 pb-10 md:mt-5" data-atra-parbaude>
      <AdminVinHandoffBinder vin={valid ? vin : ""} />
      <div className="flex items-center justify-between gap-3 md:hidden">
        <h1 className="text-[22px] font-semibold tracking-tight text-[#111]">{ATRA_TITLE}</h1>
      </div>
      <div className="flex justify-end">
        <a href="#atra-pedejas" className="rounded-full border border-[#e5e5ea] bg-white px-[11px] py-1 text-[13px] text-[#3a3a3c]">
          Pēdējās pārbaudes ›
        </a>
      </div>

      {/* Ievade */}
      <section className={card}>
        <div className="flex flex-wrap items-stretch gap-2.5">
          <label className={`${fld} min-w-[240px] flex-[2]`}>
            <span className={fldLabel}>VIN vai numurs</span>
            <input
              className={`${fldInput} font-mono`}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onBlur={() => {
                if (q.kind === "plate" && !plateInfo) void resolvePlate(q.plate);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runCheck(false);
                }
              }}
              placeholder="WBA… vai AB1234"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-label="VIN vai numurs"
              data-provin-handoff-vin
            />
          </label>
          <label className={`${fld} min-w-[200px] flex-[1.2]`}>
            <span className={fldLabel}>Sludinājums</span>
            <input
              type="url"
              inputMode="url"
              className={`${fldInput} !text-[14px] !font-normal !tracking-normal`}
              value={listingDraft}
              onChange={(e) => setListingDraft(e.target.value)}
              placeholder="saite - nav obligāti"
              autoComplete="off"
              spellCheck={false}
              aria-label="Sludinājums"
            />
          </label>
          <button type="button" className={`${btn} md:hidden`} onClick={() => setCameraOpen(true)}>
            Kamera
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-[#3a3a3c]">
          {plateBusy ? <span className="text-[#8e8e93]">CSDD…</span> : null}
          {plate && plateInfo ? (
            plateInfo.ok ? (
              <>
                <span className="rounded-full bg-[#e8eefc] px-2.5 py-[3px] text-[12.5px] font-semibold text-[#0b3fa8]">LV numurs → VIN no CSDD</span>
                <span className="font-mono">{plateInfo.vin}</span>
                <span>{[plateInfo.make, plateInfo.model].filter(Boolean).join(" ")}{plateInfo.year ? ` · ${plateInfo.year}` : ""}</span>
              </>
            ) : (
              <span className="text-[#d70015]">{plateInfo.status}</span>
            )
          ) : null}
          {query.trim() && q.kind === "none" ? <span className="text-[#8e8e93]">Ievadi 17 zīmju VIN vai LV numuru</span> : null}
          <button
            type="button"
            aria-expanded={foreignOpen}
            onClick={() => setForeignOpen((o) => !o)}
            className="ml-auto text-[13px] text-[#8e8e93] hover:text-[#111]"
          >
            Ārvalstu numuri{foreignCount && !foreignOpen ? ` · ${foreignCount}` : ""} {foreignOpen ? "▾" : "›"}
          </button>
        </div>
        {foreignOpen ? (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {FOREIGN_FIELDS.map((f) => (
              <label key={f.kind} className={fld}>
                <span className={fldLabel}>{f.label}</span>
                <input
                  className={`${fldInput} font-mono !text-[15px]`}
                  value={foreign[f.kind]}
                  onChange={(e) => setForeign((prev) => ({ ...prev, [f.kind]: e.target.value.toUpperCase() }))}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={f.label}
                />
              </label>
            ))}
          </div>
        ) : null}
        {valid ? (
          <div className="mt-2.5">
            <AdminVinMemoryPanel vin={vin} />
          </div>
        ) : null}
      </section>

      {/* Avoti */}
      <div className={`grid grid-cols-1 gap-3 ${isAdmin ? "lg:grid-cols-2" : ""}`}>
        <AdminAtraFreeSources
          groups={groups}
          selected={freeOn}
          onToggle={(id) => setFreeOn((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
          onAll={(on) => setFreeOn(on ? [...freeAll] : [])}
        />
        {isAdmin ? (
          <AdminAtraPaidSources
            selected={paidOn}
            onToggle={(id) => setPaidOn((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
            template={template}
            onTemplate={setTemplate}
            cost={cost}
            ledgerBar={dealerState?.ledgerBar ?? ""}
            vin={valid ? vin : ""}
            canRun={canRun}
            busy={busy}
            onRun={() => void runCheck(false)}
          />
        ) : (
          <div className="flex justify-end">
            <RunButton cost={cost} canRun={canRun} busy={busy} onRun={() => void runCheck(false)} />
          </div>
        )}
      </div>

      {/* Rezultāts */}
      {showResult ? (
        <section className={card} data-atra-result>
          <div className="flex flex-wrap items-center gap-3.5">
            <div className="min-w-0">
              <h2 className="text-[20px] font-semibold tracking-tight text-[#111]">{title || "Auto"}</h2>
              <p className="text-[13px] text-[#8e8e93]">
                <span className="font-mono">{vin}</span>
                {plate ? ` · ${plate}` : ""}
                {vehicle?.year ? ` · ${vehicle.year}` : ""}
              </p>
            </div>
            {progressTotal ? (
              <div className="ml-auto flex items-center gap-2.5 text-[13px] text-[#3a3a3c]">
                <span className="h-1.5 w-[140px] overflow-hidden rounded-[3px] bg-[#e5e5ea]">
                  <i className="block h-full bg-[#0b3fa8]" style={{ width: `${Math.round((progressDone / progressTotal) * 100)}%` }} />
                </span>
                {progressDone} no {progressTotal} avotiem
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {isAdmin ? (
              <button
                type="button"
                disabled={!canCreate}
                onClick={() => void createManualOrder()}
                className={`${btn} !border-[#1b1c1f] !bg-[#1b1c1f] !text-white`}
              >
                {creating ? "Veido…" : ATRA_MANUAL_ORDER_LABEL}
              </button>
            ) : null}
            <AdminAtraCopyButton text={summary} className={btn} />
            <button type="button" disabled={!canRun || busy} onClick={() => void runCheck(true)} className={btn}>
              Skenēt no jauna
            </button>
          </div>
          {createError ? <p className="mt-2 text-[13px] text-[#d70015]">{createError}</p> : null}
          {speckr ? (
            <div className="mt-3 rounded-[10px] bg-[#f7f7f9] px-3.5 py-2.5 text-[13px] text-[#3a3a3c]" data-atra-speckr>
              <b className="font-semibold">Speckr</b> · {speckr.result.summary || speckr.result.outcome}
              {speckr.result.lines.length ? (
                <ul className="mt-1 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                  {speckr.result.lines.slice(0, 16).map((l) => (
                    <li key={`${l.label}-${l.value}`}>
                      <span className="text-[#8e8e93]">{l.label}:</span> {l.value}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : speckrBusy ? (
            <p className="mt-3 text-[13px] text-[#8e8e93]">Speckr…</p>
          ) : null}
        </section>
      ) : null}

      {showResult && valid ? (
        <>
          <AdminAtraPotential score={score} />
          <AdminAtraFactCards facts={facts} vin={vin} />
        </>
      ) : null}

      <AdminVinScanPanel
        vin={vin}
        plates={plates}
        listingUrl={listingUrl}
        scanNonce={scanNonce}
        scanForce={scanForce}
        onSnapshot={setSnapshot}
        historyOpen={allScansOpen}
        sourceIds={freeOn}
        paidSourceIds={paidScanIds}
      />

      {isAdmin && dealer ? (
        <AdminDealerCheckPage
          initialVin={dealer.initialRecord?.vin || dealer.initialVin}
          initialPlate={dealer.initialRecord?.plate || dealer.initialPlate}
          initialCsdd={dealer.initialCsdd}
          initialCsddMessage={dealer.initialCsddMessage}
          fromAutoparks={dealer.fromAutoparks}
          initialRecord={dealer.initialRecord}
          initialEntries={dealer.initialEntries}
          basePath={ATRA_PAGE_PATH}
          embed={{
            vin,
            plate,
            template,
            selected: oneauto,
            csdd,
            loadNonce: dealerNonce,
            onState: onDealerState,
            historyTarget,
          }}
        />
      ) : null}

      <AdminAtraParbaudeHistory
        rows={historyRows}
        onExport={exportCsv}
        allScansOpen={allScansOpen}
        onToggleAllScans={() => setAllScansOpen((o) => !o)}
      />
      {isAdmin ? (
        <details className="rounded-[14px] border border-[#e5e5ea] bg-white px-[18px] py-3">
          <summary className="cursor-pointer text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]">
            Dīlera pārbaužu saraksts ar filtriem
          </summary>
          <div ref={setHistoryTarget} />
        </details>
      ) : null}

      {footer ? (
        <VinScanLiveCountsContext.Provider value={hasScanResult ? vinScanCountBreakdown(doneRows) : null}>
          <div className="border-t border-[#e5e5ea] pt-3">{footer}</div>
        </VinScanLiveCountsContext.Provider>
      ) : null}

      <AdminMobileVinCameraSheet
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onVin={(v) => {
          onQuery(v);
          setCameraOpen(false);
        }}
      />
    </div>
  );
}

/**
 * Telefonā paliek 3. posma stikla skats (#1139): VIN pārbaude un Dīlera datu pārbaude kā divi segmenti.
 * Datorā - jaunā «Ātrā pārbaude» lapa. Kamēr nav zināms ekrāna platums, neko nezīmē (lai nepalaiž skenēšanu divreiz).
 */
export function AdminAtraParbaudeShell({
  phoneDealerTab = false,
  ...props
}: React.ComponentProps<typeof AdminAtraParbaudePage> & { phoneDealerTab?: boolean }) {
  const [phone, setPhone] = useState<boolean | null>(null);
  const dealer = props.dealer;
  const dealerFirst = Boolean(dealer && (phoneDealerTab || dealer.initialRecord || dealer.fromAutoparks || dealer.initialPlate));
  const [tab, setTab] = useState<"vin" | "dilera">(dealerFirst ? "dilera" : "vin");
  useEffect(() => {
    const mq = window.matchMedia(ADMIN_MOBILE_MQ);
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  if (phone === null) return null;
  if (!phone) return <AdminAtraParbaudePage {...props} />;
  return (
    <>
      {props.isAdmin && dealer ? (
        <div className="px-4 pt-3">
          <AdminMobileSegments
            value={tab}
            onChange={(id) => setTab(id === "dilera" ? "dilera" : "vin")}
            items={[
              { id: "vin", label: "VIN pārbaude" },
              { id: "dilera", label: "Dīlera dati" },
            ]}
          />
        </div>
      ) : null}
      {tab === "dilera" && props.isAdmin && dealer ? (
        <AdminDealerCheckPage
          initialVin={dealer.initialVin}
          initialPlate={dealer.initialPlate}
          initialCsdd={dealer.initialCsdd}
          initialCsddMessage={dealer.initialCsddMessage}
          fromAutoparks={dealer.fromAutoparks}
          initialRecord={dealer.initialRecord}
          initialEntries={dealer.initialEntries}
        />
      ) : (
        <AdminVinScanPageClient initialVin={props.autoScan ? props.initialVin : ""} footer={props.footer} />
      )}
    </>
  );
}
