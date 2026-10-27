"use client";

import { useMemo, useState } from "react";
import { decodeVin, type VinDecodeResult, type VinRegion } from "@/lib/vin-decode";

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
  ctaFree: string;
  ctaAudit: string;
  regions: Record<VinRegion, string>;
};

type Props = {
  locale: string;
  labels: VinDecoderLabels;
  /** Sākumlapa ar `?vin=` priekšaizpildi un pasūtījuma formu. */
  auditHref: string;
  freeCheckHref: string;
};

/** Bezmaksas VIN dekoders (audits P10 A): viss notiek pārlūkā, bez servera un ārējiem pieprasījumiem. */
export function VinDecoderTool({ locale, labels, auditHref, freeCheckHref }: Props) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<VinDecodeResult | null>(null);

  const countryName = useMemo(() => {
    try {
      const names = new Intl.DisplayNames([locale], { type: "region" });
      return (code: string) => names.of(code) ?? code;
    } catch {
      return (code: string) => code;
    }
  }, [locale]);

  const error = result && !result.ok ? (result.error === "length" ? labels.errLength : labels.errChars) : null;

  return (
    <div className="mt-8">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          setResult(decodeVin(value));
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
            className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 font-mono text-[1rem] uppercase tracking-[0.08em] text-zinc-100 placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-500 focus:border-[#2563EB] focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="min-h-12 rounded-xl bg-[#2563EB] px-6 text-[0.85rem] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-[#1d4ed8]"
        >
          {labels.submit}
        </button>
      </form>
      {error ? (
        <p id="vin-decoder-error" role="alert" className="mt-2 text-[0.84rem] text-red-300">
          {error}
        </p>
      ) : null}

      {result?.ok ? (
        <div className="mt-6" aria-live="polite">
          <p className="font-mono text-[0.95rem] tracking-[0.08em] text-zinc-200">
            <span className="text-[#93c5fd]">{result.wmi}</span>
            {result.vin.slice(3, 9)}
            <span className="text-[#93c5fd]">{result.vin[9]}</span>
            {result.vin.slice(10)}
          </p>
          <dl className="mt-4 divide-y divide-white/10 border-y border-white/10 text-[0.88rem]">
            {(
              [
                [labels.rowMake, result.make ?? labels.unknownMake],
                [labels.rowCountry, result.country ? countryName(result.country) : "-"],
                [labels.rowRegion, labels.regions[result.region]],
                [labels.rowYear, result.modelYears.length ? result.modelYears.join(" / ") : "-"],
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
          {result.modelYears.length > 1 ? <p className="mt-2 text-[0.78rem] text-zinc-500">{labels.yearHint}</p> : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={`${auditHref}?vin=${encodeURIComponent(result.vin)}#home-hero`}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2563EB] px-5 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-[#1d4ed8]"
            >
              {labels.ctaAudit}
            </a>
            <a
              href={freeCheckHref}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-5 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-zinc-100 transition hover:border-white/40"
            >
              {labels.ctaFree}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
