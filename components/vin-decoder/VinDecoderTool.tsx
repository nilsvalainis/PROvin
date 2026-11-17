"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import inputStyles from "./vin-input.module.css";
import { isPlausibleListingUrl, isValidPlateNumber, normalizePlateNumber } from "@/lib/order-field-validation";
import { freeEvalPrefillHref } from "@/lib/free-eval-prefill";
import { heroPrefillHref, type HeroPrefillPlan } from "@/lib/hero-prefill";
import { decodeVin, type VinDecodeResult, type VinRegion } from "@/lib/vin-decode";
import type { PublicPlateView } from "@/lib/vin-dekoders-plate";
import { decodeVinModel, type VinModelInfo } from "@/lib/vin-model-codes";

export type VinDecoderLabels = {
  inputLabel: string;
  inputPlaceholder: string;
  modeVin: string;
  modePlate: string;
  vinPlaceholder: string;
  platePlaceholder: string;
  submit: string;
  errLength: string;
  errChars: string;
  rowMake: string;
  rowCountry: string;
  rowRegion: string;
  rowYear: string;
  rowPlant: string;
  rowCheck: string;
  checkOk: string;
  checkBad: string;
  checkNa: string;
  unknownMake: string;
  yearHint: string;
  rowModel: string;
  rowGeneration: string;
  rowProduced: string;
  rowModelYear: string;
  yearNotInVin: string;
  producedOngoing: string;
  modelYearSub: string;
  modelHint: string;
  /** Mercedes "-klase" un "kupeja / kabriolets" lokalizācija. */
  classSuffix: string;
  coupeCabrio: string;
  resultKicker: string;
  fromRegistry: string;
  fromVin: string;
  badgeDecoded: string;
  /** "{vin11}" = pirmās 11 VIN zīmes. */
  /** "{q}" = numurzīme vai VIN. */
  listingPlaceholder: string;
  listingSubmit: string;
  listingInvalid: string;
  /** Slēgtās rindas, atdalītas ar "|". */
  lockedItems: string;
  lockedOverlayTitle: string;
  lockedOverlayBody: string;
  ctaUnlock: string;
  listingInlineLead: string;
  vinSourceLine: string;
  newCheck: string;
  regions: Record<VinRegion, string>;
  errPlate: string;
  loading: string;
  plateNotFound: string;
  plateError: string;
  plateQuota: string;
  rateLimited: string;
  plateSourceLine: string;
  rowPlateYear: string;
  rowFuel: string;
  rowPower: string;
  rowDisplacement: string;
  rowColor: string;
  rowFirstReg: string;
  rowInspection: string;
  rowVinMasked: string;
  inspectionValid: string;
  inspectionExpiring: string;
  inspectionExpired: string;
  /** "{n}" = ierakstu skaits. */
  memoryTitle: string;
  memoryBody: string;
};

type Remote =
  | { state: "idle" }
  | { state: "loading"; kind: "vin" | "plate" }
  | { state: "plate"; plate: string; view: PublicPlateView | null; memory: number }
  | { state: "vin"; memory: number; model: VinModelInfo | null }
  | { state: "error"; message: string };

type Source = "home" | "decoder" | "direct";

function track(cta: "cta_audit" | "cta_free", src: Source) {
  try {
    const body = JSON.stringify({ cta, src });
    if (!navigator.sendBeacon?.("/api/vin-dekoders/event", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/vin-dekoders/event", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    }
  } catch {
    /* uzskaite nedrīkst traucēt klikšķim */
  }
}

function lvDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso || "-";
}

type Props = {
  locale: string;
  labels: VinDecoderLabels;
  /** Sākumlapas ceļš (`/lv`): no /vin-dekoders lapas pasūtījums un sludinājums ved uz turieni. */
  home: string;
  /** Sākumlapā: VIN / numurzīme nonāk HERO pasūtījuma formā bez pārlēciena. */
  onAudit?: (q: string, plan: HeroPrefillPlan) => void;
  /** Sākumlapā: sludinājuma saite + VIN nonāk bezmaksas novērtējuma formā. */
  onListing?: (listingUrl: string, q: string) => void;
  /** Kursors uzreiz laukā (sākumlapā pēc pogas «Pārbaudīt»). */
  autoFocus?: boolean;
  /** Uzreiz atšifrēts VIN (testi). */
  initialVin?: string;
  /** Kur atrodas dekoders (uzskaitei); `?src=` no URL ir svarīgāks. */
  source?: Source;
};

/** Ražotāja modeļa nosaukums lietotāja valodā (tabula ir latviski). */
function localModel(name: string, labels: VinDecoderLabels): string {
  return name.replace(/-klase/g, labels.classSuffix).replace("kupeja / kabriolets", labels.coupeCabrio);
}

function producedText(m: VinModelInfo, labels: VinDecoderLabels): string | null {
  if (!m.produced) return null;
  return m.produced.to ? `${m.produced.from}-${m.produced.to}` : `${m.produced.from}-${labels.producedOngoing}`;
}

const GHOST_BTN =
  "inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.04] px-5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 no-underline transition hover:border-white/35 hover:bg-white/[0.08] hover:text-white";
const CARD = "rounded-[20px] border border-white/[0.09] bg-gradient-to-b from-white/[0.05] to-white/[0.015]";

function Primary({ children }: { children: ReactNode }) {
  return (
    <>
      <span className={tp5Styles.liquidCtaShimmer} aria-hidden />
      <span className={tp5Styles.liquidCtaLabel}>{children}</span>
    </>
  );
}

/** Rindas trešais elements `true` = telefonā visā platumā (piem. VIN, lai nelūzt). */
function Grid({ rows }: { rows: Array<[string, ReactNode] | [string, ReactNode, boolean]> }) {
  return (
    <dl className="m-0 grid grid-cols-2 border-t border-[#262a36] lg:grid-cols-4">
      {rows.map(([label, val, wide]) => (
        <div key={label} className={`flex min-w-0 flex-col gap-1 border-b border-[#262a36] py-3.5 pr-4 ${wide ? "col-span-2 lg:col-span-1" : ""}`}>
          <dt className="text-[12px] text-zinc-400">{label}</dt>
          <dd className="m-0 break-words text-[15px] font-semibold text-zinc-50">{val}</dd>
        </div>
      ))}
    </dl>
  );
}

function Header({ kicker, title, sub, badge }: { kicker: string; title: string; sub: string; badge?: { text: string; cls: string } | null }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{kicker}</p>
        <p className="mt-2 text-[1.65rem] font-extrabold leading-tight tracking-[-0.03em] text-zinc-50 sm:text-[2.1rem]">{title}</p>
        {sub ? <p className="mt-2 text-[15px] text-zinc-400">{sub}</p> : null}
      </div>
      {badge ? <span className={`shrink-0 self-start rounded-full border px-3 py-2 text-[13px] font-semibold ${badge.cls}`}>{badge.text}</span> : null}
    </div>
  );
}

const SECTION_TITLE = "text-[12px] font-bold uppercase tracking-[0.14em] text-zinc-400";

/**
 * Bezmaksas VIN / numurzīmes pārbaude: VIN atšifrē pārlūkā, numurzīmi caur CSDD (serveris).
 * Pēc rezultāta - sludinājuma saite un pasūtījums ar to pašu VIN / numurzīmi (nav jāievada vēlreiz).
 */
export function VinDecoderTool({ locale, labels, home, onAudit, onListing, autoFocus, initialVin, source = "decoder" }: Props) {
  const [value, setValue] = useState(initialVin ?? "");
  const [mode, setMode] = useState<"vin" | "plate">("vin");
  const [result, setResult] = useState<VinDecodeResult | null>(() => (initialVin ? decodeVin(initialVin) : null));
  const [remote, setRemote] = useState<Remote>({ state: "idle" });
  const [plateError, setPlateError] = useState(false);
  const [src, setSrc] = useState<Source>(source);
  const [listing, setListing] = useState("");
  const [listingError, setListingError] = useState(false);
  const reqId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  /** VIN uzreiz atšifrē pārlūkā; serveris piedod arhīva skaitu un uzskaita. Numurzīme iet tikai caur serveri (CSDD). */
  const submit = useCallback(
    async (raw: string, from: Source) => {
      const id = ++reqId.current;
      const plate = normalizePlateNumber(raw);
      const isPlate = isValidPlateNumber(plate);
      const looksPlate = !isPlate && plate.length > 0 && plate.length <= 7;
      setPlateError(looksPlate);
      setResult(isPlate || looksPlate ? null : decodeVin(raw));
      const local = isPlate || looksPlate ? null : decodeVin(raw);
      if (!isPlate && !local?.ok) {
        // Kļūdainu ievadi arī uzskaitām (serveris atbild 400).
        void fetch(`/api/vin-dekoders?q=${encodeURIComponent(raw.slice(0, 40))}&src=${from}`).catch(() => undefined);
        setRemote({ state: "idle" });
        return;
      }
      setRemote({ state: "loading", kind: isPlate ? "plate" : "vin" });
      try {
        const res = await fetch(`/api/vin-dekoders?q=${encodeURIComponent(isPlate ? plate : local!.ok ? local!.vin : raw)}&src=${from}`);
        const body = (await res.json().catch(() => ({}))) as { error?: string; found?: boolean; csdd?: PublicPlateView; memoryRecords?: number; model?: VinModelInfo | null };
        if (id !== reqId.current) return;
        if (!res.ok) {
          const msg = body.error === "quota" ? labels.plateQuota : body.error === "rate_limited" ? labels.rateLimited : labels.plateError;
          setRemote(isPlate ? { state: "error", message: msg } : { state: "vin", memory: 0, model: null });
          return;
        }
        setRemote(
          isPlate
            ? { state: "plate", plate, view: body.found ? (body.csdd ?? null) : null, memory: body.memoryRecords ?? 0 }
            : { state: "vin", memory: body.memoryRecords ?? 0, model: body.model ?? null },
        );
      } catch {
        if (id !== reqId.current) return;
        setRemote(isPlate ? { state: "error", message: labels.plateError } : { state: "vin", memory: 0, model: null });
      }
    },
    [labels],
  );

  // `?q=` / `?vin=` no saites: lapa paliek statiska, ievadi nolasa pārlūkā.
  useEffect(() => {
    if (initialVin || source === "home") return;
    const params = new URLSearchParams(window.location.search);
    const fromSrc = params.get("src");
    const from: Source = fromSrc === "home" || fromSrc === "decoder" ? fromSrc : source;
    setSrc(from);
    const q = (params.get("q") ?? params.get("vin"))?.slice(0, 24);
    if (!q) return;
    setValue(q);
    void submit(q, from);
  }, [initialVin, source, submit]);

  const countryName = useMemo(() => {
    try {
      const names = new Intl.DisplayNames([locale], { type: "region" });
      return (code: string) => names.of(code) ?? code;
    } catch {
      return (code: string) => code;
    }
  }, [locale]);

  const model = result?.ok ? (decodeVinModel(result) ?? (remote.state === "vin" ? remote.model : null)) : null;
  const yearValue = !result?.ok
    ? "-"
    : model?.modelYear
      ? String(model.modelYear)
      : model?.scheme === "mercedes" || model?.scheme === "learned"
        ? labels.yearNotInVin
        : result.modelYears.length
          ? result.modelYears.join(" / ")
          : "-";
  const showYearHint = Boolean(result?.ok && !model && result.modelYears.length > 1);
  const error = plateError ? labels.errPlate : result && !result.ok ? (result.error === "length" ? labels.errLength : labels.errChars) : null;
  const memory = remote.state === "vin" || remote.state === "plate" ? remote.memory : 0;
  const plateView = remote.state === "plate" ? remote.view : null;
  /** Ko nodot tālāk: numurzīmes gadījumā numurzīmi (slēpto VIN neatklājam), citādi VIN. */
  const handoff = plateView ? plateView.plate : result?.ok ? result.vin : "";

  function audit(plan: HeroPrefillPlan) {
    track("cta_audit", src);
    if (onAudit) onAudit(handoff, plan);
    else window.location.assign(heroPrefillHref(home, { vin: handoff, plan }));
  }

  function sendListing() {
    const url = listing.trim();
    if (!isPlausibleListingUrl(url)) {
      setListingError(true);
      return;
    }
    setListingError(false);
    track("cta_free", src);
    if (onListing) onListing(url, handoff);
    else window.location.assign(freeEvalPrefillHref(home, { listingUrl: url, vin: handoff }));
  }

  function reset() {
    reqId.current += 1;
    setValue("");
    setResult(null);
    setRemote({ state: "idle" });
    setPlateError(false);
    inputRef.current?.focus();
  }

  const showNext = Boolean(handoff);
  const locked = labels.lockedItems.split("|").map((x) => x.trim()).filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      <form
        className={`${inputStyles.box}${mode === "plate" ? ` ${inputStyles.isPlate}` : ""}`}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(value, src);
        }}
      >
        <div className={inputStyles.toggle} role="group" aria-label={labels.inputLabel}>
          <i className={inputStyles.knob} aria-hidden />
          <button type="button" aria-pressed={mode === "vin"} onClick={() => setMode("vin")}>
            {labels.modeVin}
          </button>
          <button type="button" aria-pressed={mode === "plate"} onClick={() => setMode("plate")}>
            {labels.modePlate}
          </button>
        </div>
        <label className={inputStyles.field}>
          <span className={inputStyles.euStrip} aria-hidden>
            <svg viewBox="0 0 24 24">
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * Math.PI * 2;
                return <circle key={i} cx={12 + Math.cos(a) * 8} cy={12 + Math.sin(a) * 8} r={1.3} fill="#ffcc00" />;
              })}
            </svg>
            <b>LV</b>
          </span>
          <span className="sr-only">{labels.inputLabel}</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              const next = event.target.value;
              setValue(next);
              const compact = next.replace(/[\s-]/g, "");
              if (compact.length >= 10) setMode("vin");
              else if (compact.length > 0 && compact.length <= 7 && /\d/.test(compact) && /[a-z]/i.test(compact)) setMode("plate");
            }}
            placeholder={mode === "plate" ? labels.platePlaceholder : labels.vinPlaceholder}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={24}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "vin-decoder-error" : undefined}
            className={inputStyles.input}
          />
          <button type="submit" className={inputStyles.go}>
            {labels.submit} <span aria-hidden>→</span>
          </button>
        </label>
        <button type="submit" className={`${inputStyles.go} ${inputStyles.goMobile}`}>
          {labels.submit} <span aria-hidden>→</span>
        </button>
        {showNext ? (
          <div className={inputStyles.under}>
            <button type="button" onClick={reset} className={inputStyles.newCheck}>
              {labels.newCheck} ↺
            </button>
          </div>
        ) : null}
      </form>
      {error ? (
        <p id="vin-decoder-error" role="alert" className="-mt-2 text-[0.84rem] text-red-300">
          {error}
        </p>
      ) : null}

      {remote.state === "loading" && remote.kind === "plate" ? (
        <p className="text-[0.9rem] text-zinc-400" aria-live="polite">
          {labels.loading}
        </p>
      ) : null}
      {remote.state === "error" ? (
        <p role="alert" className="text-[0.9rem] text-amber-200">
          {remote.message}
        </p>
      ) : null}
      {remote.state === "plate" && !remote.view ? (
        <p className="text-[0.95rem] text-zinc-300" aria-live="polite">
          {labels.plateNotFound.replace("{plate}", remote.plate)}
        </p>
      ) : null}

      {plateView || result?.ok ? (
        <div className={`${CARD} flex flex-col gap-6 p-5 sm:p-8`} aria-live="polite">
          {plateView ? <PlateBody view={plateView} labels={labels} /> : null}
          {result?.ok && !plateView ? (
            <>
              <Header
                kicker={labels.resultKicker}
                title={model ? `${model.make} ${localModel(model.model, labels)}` : (result.make ?? labels.unknownMake)}
                sub={[model?.modelYear ? labels.modelYearSub.replace("{year}", String(model.modelYear)) : null, model?.generation || null, result.country ? countryName(result.country) : null]
                  .filter(Boolean)
                  .join(" · ")}
                badge={
                  result.checkDigitValid === false
                    ? { text: labels.checkBad, cls: "border-amber-400/40 text-amber-200" }
                    : { text: `✓ ${labels.badgeDecoded}`, cls: "border-emerald-400/30 text-emerald-300" }
                }
              />
              <p className="font-mono text-[0.95rem] tracking-[0.08em] text-zinc-200">
                <span className="text-[#93c5fd]">{result.wmi}</span>
                {result.vin.slice(3, 9)}
                {model?.scheme === "mercedes" ? result.vin[9] : <span className="text-[#93c5fd]">{result.vin[9]}</span>}
                {result.vin.slice(10)}
              </p>
              <div className="flex flex-col gap-3">
                <p className={SECTION_TITLE}>{labels.fromVin}</p>
                <Grid
                  rows={[
                    [labels.rowMake, result.make ? `${result.make} (${result.wmi})` : labels.unknownMake],
                    [labels.rowCountry, result.country ? countryName(result.country) : "-"],
                    ...(model
                      ? ([
                          [labels.rowModel, `${localModel(model.model, labels)} (${model.code})`],
                          ...(model.generation ? ([[labels.rowGeneration, model.generation]] as Array<[string, string]>) : []),
                          ...(producedText(model, labels) ? ([[labels.rowProduced, producedText(model, labels)!]] as Array<[string, string]>) : []),
                        ] as Array<[string, string]>)
                      : []),
                    [labels.rowRegion, labels.regions[result.region]],
                    [model ? labels.rowModelYear : labels.rowYear, yearValue],
                    [labels.rowPlant, result.plantCode],
                    [labels.rowCheck, result.checkDigitValid === null ? labels.checkNa : result.checkDigitValid ? labels.checkOk : labels.checkBad],
                  ]}
                />
                {showYearHint ? <p className="text-[0.78rem] text-zinc-500">{labels.yearHint}</p> : null}
                {model ? <p className="text-[0.78rem] text-zinc-500">{labels.modelHint}</p> : null}
              </div>
            </>
          ) : null}

          {memory > 0 ? (
            <div className="rounded-2xl border border-[#1a6fd4]/40 bg-[#1a6fd4]/[0.08] px-5 py-4">
              <p className="text-[0.98rem] font-semibold text-zinc-50">{labels.memoryTitle.replace("{n}", String(memory))}</p>
              <p className="mt-1 text-[0.86rem] leading-relaxed text-zinc-300">{labels.memoryBody}</p>
            </div>
          ) : null}

          {showNext ? (
            <div className="flex flex-col gap-4 border-t border-[#262a36] pt-6">
              {/* Aizslēgtais priekšskatījums (makets A3): audita lauki izplūduši, virsū viena poga. */}
              <div className="relative overflow-hidden rounded-2xl border border-[#262a36]">
                <div aria-hidden className="grid select-none grid-cols-2 gap-3 p-4 opacity-80 blur-[5px] sm:grid-cols-3 sm:p-5">
                  {locked.concat(locked.slice(0, Math.max(0, 6 - locked.length))).slice(0, 6).map((item, i) => (
                    <div key={`${item}-${i}`} className="h-[58px] rounded-xl bg-gradient-to-r from-white/[0.14] to-white/[0.05] p-2.5">
                      <span className="block h-2 w-3/5 rounded bg-white/20" />
                      <span className="mt-2.5 block h-3 w-4/5 rounded bg-white/30" />
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#050608]/20 to-[#050608]/80 p-4 text-center">
                  <div className="flex max-w-[34rem] flex-col items-center gap-2">
                    <p className="text-balance text-[16px] font-semibold leading-snug text-zinc-50 sm:text-[17px]">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className="mr-1.5 inline-block h-4 w-4 -translate-y-px align-middle text-[#93c5fd]">
                        <rect x="3" y="7" width="10" height="7" rx="1.5" />
                        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
                      </svg>
                      {labels.lockedOverlayTitle}
                    </p>
                    <p className="text-[13.5px] leading-relaxed text-zinc-400">{labels.lockedOverlayBody}</p>
                    <button
                      type="button"
                      onClick={() => audit("audits")}
                      className={`${tp5Styles.liquidCta} mt-1 !min-h-[48px] !w-auto !px-6 !py-0`}
                    >
                      <Primary>{labels.ctaUnlock}</Primary>
                    </button>
                  </div>
                </div>
              </div>
              <form
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendListing();
                }}
              >
                <span className="text-[13px] text-zinc-400">{labels.listingInlineLead}</span>
                <div className="flex min-w-0 flex-1 gap-2">
                  <label className="block min-w-0 flex-1 sm:max-w-[22rem]">
                    <span className="sr-only">{labels.listingPlaceholder}</span>
                    <input
                      type="url"
                      inputMode="url"
                      value={listing}
                      onChange={(event) => setListing(event.target.value)}
                      placeholder={labels.listingPlaceholder}
                      autoComplete="off"
                      aria-invalid={listingError ? true : undefined}
                      className={`${tp5Styles.inlineInput} ${listingError ? tp5Styles.inlineInputError : ""}`}
                    />
                  </label>
                  <button type="submit" className={GHOST_BTN}>
                    {labels.listingSubmit}
                  </button>
                </div>
              </form>
              {listingError ? (
                <p role="alert" className="-mt-2 text-[0.84rem] text-red-300">
                  {labels.listingInvalid}
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="text-[12.5px] leading-relaxed text-zinc-500">{plateView ? labels.plateSourceLine : labels.vinSourceLine}</p>
        </div>
      ) : null}
    </div>
  );
}

function PlateBody({ view, labels }: { view: PublicPlateView; labels: VinDecoderLabels }) {
  const inspection =
    view.inspection === "valid"
      ? { text: labels.inspectionValid, cls: "border-emerald-400/30 text-emerald-300" }
      : view.inspection === "expiring"
        ? { text: labels.inspectionExpiring, cls: "border-amber-400/40 text-amber-200" }
        : view.inspection === "expired"
          ? { text: labels.inspectionExpired, cls: "border-red-400/40 text-red-300" }
          : null;
  const rows: Array<[string, string]> = [
    [labels.rowPlateYear, view.year],
    [labels.rowFuel, view.fuel],
    [labels.rowPower, view.powerKw ? `${view.powerKw} kW` : ""],
    [labels.rowDisplacement, view.displacementCm3 ? `${Number(view.displacementCm3).toLocaleString("lv-LV")} cm³` : ""],
    [labels.rowColor, view.color],
    [labels.rowFirstReg, view.firstRegistration ? lvDate(view.firstRegistration) : ""],
    [labels.rowInspection, view.inspectionValidUntil ? lvDate(view.inspectionValidUntil) : ""],
    [labels.rowVinMasked, view.vinMasked],
  ];
  return (
    <>
      <Header
        kicker={labels.resultKicker}
        title={[view.make, view.model].filter(Boolean).join(" ")}
        sub={[view.plate, view.year, view.fuel, view.powerKw ? `${view.powerKw} kW` : ""].filter(Boolean).join(" · ")}
        badge={inspection}
      />
      <div className="flex flex-col gap-3">
        <p className={SECTION_TITLE}>{labels.fromRegistry}</p>
        <Grid rows={rows.filter(([, v]) => v).map(([l, v]) => (l === labels.rowVinMasked ? [l, v, true] : [l, v]))} />
      </div>
    </>
  );
}
