"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { isValidPlateNumber, normalizePlateNumber } from "@/lib/order-field-validation";
import { decodeVin, type VinDecodeResult, type VinRegion } from "@/lib/vin-decode";
import type { PublicPlateView } from "@/lib/vin-dekoders-plate";
import { decodeVinModel, type VinModelInfo } from "@/lib/vin-model-codes";

export type VinDecoderLabels = {
  inputLabel: string;
  inputPlaceholder: string;
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
  ctaFree: string;
  ctaAudit: string;
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
  /** Sākumlapa ar `?vin=` priekšaizpildi un pasūtījuma formu. */
  auditHref: string;
  freeCheckHref: string;
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

/** Bezmaksas VIN dekoders (audits P10 A): viss notiek pārlūkā, bez servera un ārējiem pieprasījumiem. */
export function VinDecoderTool({ locale, labels, auditHref, freeCheckHref, initialVin, source = "decoder" }: Props) {
  const [value, setValue] = useState(initialVin ?? "");
  const [result, setResult] = useState<VinDecodeResult | null>(() => (initialVin ? decodeVin(initialVin) : null));
  const [remote, setRemote] = useState<Remote>({ state: "idle" });
  const [plateError, setPlateError] = useState(false);
  const [src, setSrc] = useState<Source>(source);
  const reqId = useRef(0);

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

  // `?q=` / `?vin=` no sākumlapas kartītes: lapa paliek statiska, ievadi nolasa pārlūkā.
  useEffect(() => {
    if (initialVin) return;
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
  const auditVin = result?.ok ? result.vin : "";

  return (
    <div className="mt-8">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(value, src);
        }}
      >
        <label className="block min-w-0 flex-1">
          <span className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            {labels.inputLabel}
          </span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={labels.inputPlaceholder}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={24}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "vin-decoder-error" : undefined}
            className={`${tp5Styles.inlineInput} font-mono uppercase tracking-[0.08em] placeholder:normal-case placeholder:tracking-normal`}
          />
        </label>
        <button type="submit" className={`${tp5Styles.liquidCta} sm:!w-auto sm:min-w-[11rem]`}>
          <span className={tp5Styles.liquidCtaShimmer} aria-hidden />
          <span className={tp5Styles.liquidCtaLabel}>{labels.submit}</span>
        </button>
      </form>
      {error ? (
        <p id="vin-decoder-error" role="alert" className="mt-2 text-[0.84rem] text-red-300">
          {error}
        </p>
      ) : null}

      {remote.state === "loading" && remote.kind === "plate" ? (
        <p className="mt-6 text-[0.9rem] text-zinc-400" aria-live="polite">
          {labels.loading}
        </p>
      ) : null}
      {remote.state === "error" ? (
        <p role="alert" className="mt-6 text-[0.9rem] text-amber-200">
          {remote.message}
        </p>
      ) : null}
      {remote.state === "plate" ? (
        <div className="mt-6" aria-live="polite">
          {remote.view ? (
            <PlateResult view={remote.view} labels={labels} />
          ) : (
            <p className="text-[0.95rem] text-zinc-300">{labels.plateNotFound.replace("{plate}", remote.plate)}</p>
          )}
        </div>
      ) : null}
      {result?.ok ? (
        <div className="mt-6" aria-live="polite">
          {model ? (
            <div className="mb-4">
              <p className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.02em] text-zinc-50 sm:text-[2rem]">
                {model.make} {localModel(model.model, labels)}
              </p>
              <p className="mt-1 text-[0.9rem] text-zinc-400">
                {[
                  model.modelYear ? labels.modelYearSub.replace("{year}", String(model.modelYear)) : null,
                  model.generation || null,
                  result.country ? countryName(result.country) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          ) : null}
          <p className="font-mono text-[0.95rem] tracking-[0.08em] text-zinc-200">
            <span className="text-[#93c5fd]">{result.wmi}</span>
            {result.vin.slice(3, 9)}
            {model?.scheme === "mercedes" ? result.vin[9] : <span className="text-[#93c5fd]">{result.vin[9]}</span>}
            {result.vin.slice(10)}
          </p>
          <dl className="mt-4 divide-y divide-white/10 border-y border-white/10 text-[0.88rem]">
            {(
              [
                [labels.rowMake, result.make ?? labels.unknownMake],
                [labels.rowCountry, result.country ? countryName(result.country) : "-"],
                ...(model
                  ? ([
                      [labels.rowModel, `${localModel(model.model, labels)} (${model.code})`],
                      ...(model.generation ? ([[labels.rowGeneration, model.generation]] as const) : []),
                      ...(producedText(model, labels) ? ([[labels.rowProduced, producedText(model, labels)]] as const) : []),
                    ] as const)
                  : []),
                [labels.rowRegion, labels.regions[result.region]],
                [model ? labels.rowModelYear : labels.rowYear, yearValue],
                [labels.rowPlant, result.plantCode],
                [
                  labels.rowCheck,
                  result.checkDigitValid === null
                    ? labels.checkNa
                    : result.checkDigitValid
                      ? labels.checkOk
                      : labels.checkBad,
                ],
              ] as const
            ).map(([label, val]) => (
              <div key={label} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-2.5">
                <dt className="text-zinc-400">{label}</dt>
                <dd className="font-semibold text-zinc-100">{val}</dd>
              </div>
            ))}
          </dl>
          {showYearHint ? <p className="mt-2 text-[0.78rem] text-zinc-500">{labels.yearHint}</p> : null}
          {model ? <p className="mt-2 text-[0.78rem] text-zinc-500">{labels.modelHint}</p> : null}
        </div>
      ) : null}

      {result?.ok || (remote.state === "plate" && remote.view) ? (
        <>
          {memory > 0 ? (
            <div className="mt-6 rounded-2xl border border-[#1a6fd4]/40 bg-[#1a6fd4]/[0.08] px-5 py-4">
              <p className="text-[0.98rem] font-semibold text-zinc-50">{labels.memoryTitle.replace("{n}", String(memory))}</p>
              <p className="mt-1 text-[0.86rem] leading-relaxed text-zinc-300">{labels.memoryBody}</p>
            </div>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={`${auditHref}${auditVin ? `?vin=${encodeURIComponent(auditVin)}` : ""}#home-hero`}
              onClick={() => track("cta_audit", src)}
              className={`${tp5Styles.liquidCtaLink} sm:flex-1`}
            >
              <span className={tp5Styles.liquidCtaShimmer} aria-hidden />
              <span className={tp5Styles.liquidCtaLabel}>{labels.ctaAudit}</span>
            </a>
            <a
              href={freeCheckHref}
              onClick={() => track("cta_free", src)}
              className="inline-flex min-h-[54px] items-center justify-center rounded-full border border-white/20 bg-white/[0.05] px-5 text-center text-[12px] font-semibold uppercase tracking-[0.1em] text-white/90 no-underline transition hover:border-white/35 hover:bg-white/[0.08] hover:text-white sm:flex-1"
            >
              {labels.ctaFree}
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}

function PlateResult({ view, labels }: { view: PublicPlateView; labels: VinDecoderLabels }) {
  const inspection =
    view.inspection === "valid"
      ? { text: labels.inspectionValid, cls: "border-emerald-400/40 text-emerald-300" }
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
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.02em] text-zinc-50 sm:text-[2rem]">
            {[view.make, view.model].filter(Boolean).join(" ")}
          </p>
          <p className="mt-1 text-[0.9rem] text-zinc-400">
            {[view.year, view.fuel, view.powerKw ? `${view.powerKw} kW` : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
        {inspection ? (
          <span className={`rounded-full border px-3 py-1.5 text-[0.8rem] font-semibold ${inspection.cls}`}>{inspection.text}</span>
        ) : null}
      </div>
      <p className="font-mono text-[0.95rem] tracking-[0.08em] text-zinc-200">{view.plate}</p>
      <dl className="mt-4 divide-y divide-white/10 border-y border-white/10 text-[0.88rem]">
        {rows
          .filter(([, v]) => v)
          .map(([label, val]) => (
            <div key={label} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-2.5">
              <dt className="text-zinc-400">{label}</dt>
              <dd className="font-semibold text-zinc-100">{val}</dd>
            </div>
          ))}
      </dl>
      <p className="mt-2 text-[0.78rem] text-zinc-500">{labels.plateSourceLine}</p>
    </div>
  );
}
