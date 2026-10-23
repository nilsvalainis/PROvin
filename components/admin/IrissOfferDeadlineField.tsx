"use client";

import { useEffect, useState } from "react";
import { offerDeadlineInputInitial, offerDeadlineRemainingLv } from "@/lib/iriss-offer-deadline-ui";
import { normalizeOfferValidUntilAt, parseOfferDeadlineInput } from "@/lib/iriss-offer-valid-until";

type Props = {
  label: string;
  /** Sākuma vērtība (validUntilAt UTC vai vecais validUntil datums). */
  initial: { validUntilAt?: string; validUntil?: string };
  /** iso - derīgs termiņš (UTC ISO) vai null, ja ievade nepilnīga / kļūdaina; ymd - ievadītais datums. */
  onChange: (next: { iso: string | null; ymd: string }) => void;
  disabled?: boolean;
  idPrefix: string;
};

const inputClass =
  "h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-[15px] text-[var(--color-apple-text)] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 disabled:opacity-50";

/** "Piedāvājuma termiņš": datums + laiks Rīgas laikā; zem tā "Rīgas laiks" un "Atlicis N d. N st." */
export function IrissOfferDeadlineField({ label, initial, onChange, disabled = false, idPrefix }: Props) {
  const [value, setValue] = useState(() => offerDeadlineInputInitial(initial));
  const [now, setNow] = useState(() => Date.now());
  /** Kļūdu rāda tikai pēc labošanas (atverot beigušos piedāvājumu - nav kļūdas). */
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const initialIso = normalizeOfferValidUntilAt(initial.validUntilAt);
  const initialMs = initialIso ? Date.parse(initialIso) : null;
  const complete = Boolean(value.ymd && value.hm);
  const parsed = complete ? parseOfferDeadlineInput(value.ymd, value.hm, now) : null;
  const error = touched && parsed && !parsed.ok ? parsed.message : "";

  const update = (next: { ymd: string; hm: string }) => {
    setValue(next);
    setTouched(true);
    const r = next.ymd && next.hm ? parseOfferDeadlineInput(next.ymd, next.hm) : null;
    onChange({ iso: r && r.ok ? r.iso : null, ymd: next.ymd });
  };

  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">{label}</span>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
        <input
          id={`${idPrefix}-date`}
          type="date"
          aria-label={`${label}: datums`}
          className={inputClass}
          value={value.ymd}
          disabled={disabled}
          onChange={(e) => update({ ...value, ymd: e.target.value })}
        />
        <input
          id={`${idPrefix}-time`}
          type="time"
          step={60}
          aria-label={`${label}: laiks`}
          className={inputClass}
          value={value.hm}
          disabled={disabled}
          onChange={(e) => update({ ...value, hm: e.target.value.slice(0, 5) })}
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[12px] text-[var(--color-provin-muted)]">
        <span>Rīgas laiks</span>
        {parsed?.ok ? (
          <span className="tabular-nums">{offerDeadlineRemainingLv(parsed.ms, now)}</span>
        ) : !touched && initialMs != null ? (
          <span className="tabular-nums">{offerDeadlineRemainingLv(initialMs, now)}</span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1 text-[12px] font-semibold text-red-700" aria-live="polite">
          {error}
        </p>
      ) : touched && value.ymd && !value.hm ? (
        <p className="mt-1 text-[12px] text-amber-800">Ievadi arī laiku.</p>
      ) : null}
    </div>
  );
}
