"use client";

import { Loader2 } from "lucide-react";
import { adminProBtn } from "@/lib/admin-pro-tones";
import {
  factCheckDismissKey,
  isIntervalWarningFlag,
  visibleFactCheckFlags,
} from "@/lib/admin-fact-check-client";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

export function AdminFactCheckButton({
  busy,
  disabled,
  onClick,
}: {
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={adminProBtn("neutral")}
      disabled={disabled || busy}
      onClick={onClick}
      title="Pārbaudīt komentāra faktus pret PROVIN agregātu bāzi (tekstu nemaina)"
      aria-busy={busy}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : null}
      Pārbaudīt faktus
    </button>
  );
}

function FlagCard({
  flag,
  onDismiss,
}: {
  flag: FactCheckFlag;
  onDismiss: (flag: FactCheckFlag) => void;
}) {
  const isError = flag.level === "E";
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 ${
        isError
          ? "border-red-200/90 bg-red-50 text-red-950"
          : "border-amber-200/80 bg-amber-50/80 text-amber-950"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide">{isError ? "E" : "W"}</p>
        <button
          type="button"
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-white/70"
          onClick={() => onDismiss(flag)}
        >
          Ignorēt
        </button>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug">{flag.sentence}</p>
      <p className="mt-1 text-[11px] leading-snug opacity-90">{flag.message}</p>
      {flag.sources?.some((s) => s.url || s.title) ? (
        <ul className="mt-1 space-y-0.5">
          {flag.sources.map((s, i) => (
            <li key={`${s.title}-${i}`} className="text-[10px] leading-snug">
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-dotted">
                  {s.title}
                </a>
              ) : (
                s.title
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function AdminFactCheckPanel({
  flags,
  dismissed,
  onDismiss,
}: {
  flags: readonly FactCheckFlag[] | undefined;
  dismissed: ReadonlySet<string> | readonly string[];
  onDismiss: (flag: FactCheckFlag) => void;
}) {
  const visible = visibleFactCheckFlags(flags, dismissed);
  if (visible.length === 0) return null;
  const interval = visible.filter(isIntervalWarningFlag);
  const rest = visible.filter((f) => !isIntervalWarningFlag(f));
  return (
    <div
      className="mt-2 space-y-1.5 rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-[12px] text-amber-950"
      role="status"
    >
      <p className="text-[11px] font-semibold">Faktu pārbaude</p>
      {rest.map((f) => (
        <FlagCard key={factCheckDismissKey(f)} flag={f} onDismiss={onDismiss} />
      ))}
      {interval.length > 0 ? (
        <details className="rounded-lg border border-amber-200/70 bg-amber-50/50 px-2 py-1.5">
          <summary className="cursor-pointer text-[11px] font-medium">
            Intervāla brīdinājumi ({interval.length})
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {interval.map((f) => (
              <FlagCard key={factCheckDismissKey(f)} flag={f} onDismiss={onDismiss} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function AdminFactCheckPublishConfirm({
  items,
  onContinue,
  onBack,
}: {
  items: { label: string; sentence: string; message: string }[];
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="presentation"
      onClick={onBack}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fact-check-publish-title"
        className="w-full max-w-lg rounded-xl border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="fact-check-publish-title" className="text-sm font-semibold text-[var(--color-apple-text)]">
          Faktu pārbaudes kļūdas
        </h3>
        <p className="mt-1 text-[12px] leading-snug text-[var(--color-provin-muted)]">
          Ir atvērtas E kļūdas. Teksts netiek dzēsts un netiek mainīts. Vari turpināt PDF tāpat.
        </p>
        <ul className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto">
          {items.map((item, i) => (
            <li
              key={`${item.label}-${i}`}
              className="rounded-lg border border-red-200/90 bg-red-50 px-2.5 py-2 text-[11px] text-red-950"
            >
              <p className="font-semibold">{item.label}</p>
              <p className="mt-0.5 leading-snug">{item.sentence}</p>
              <p className="mt-1 leading-snug opacity-90">{item.message}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className={adminProBtn("neutral")} onClick={onBack}>
            Atpakaļ
          </button>
          <button type="button" className={adminProBtn("primary")} onClick={onContinue}>
            Turpināt tik un tā
          </button>
        </div>
      </div>
    </div>
  );
}
