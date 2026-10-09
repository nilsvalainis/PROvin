"use client";

import { useEffect, useRef, useState } from "react";
import {
  irissSectionSaveButtonLabel,
  irissSectionSaveInlineText,
  type IrissOrderSaveResult,
  type IrissSectionSaveStatus,
} from "@/lib/iriss-order-section-save";

export function IrissOrderSectionSaveButton({
  onSave,
  disabled = false,
}: {
  onSave: () => Promise<IrissOrderSaveResult>;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState<IrissSectionSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimer.current != null) window.clearTimeout(savedTimer.current);
    };
  }, []);

  const saving = status === "saving";
  const inline = irissSectionSaveInlineText(status, error);
  const inlineClass =
    status === "error"
      ? "max-w-full text-[12px] font-medium leading-snug text-red-700"
      : status === "saved"
        ? "text-[12px] font-semibold text-emerald-700"
        : "text-[12px] font-medium text-[var(--color-provin-muted)]";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
      <button
        type="button"
        disabled={disabled || saving}
        aria-busy={saving}
        aria-label={irissSectionSaveButtonLabel(status)}
        onClick={() => {
          void (async () => {
            if (saving || disabled) return;
            setStatus("saving");
            setError(null);
            const result = await onSave();
            if (result.ok) {
              setStatus("saved");
              if (savedTimer.current != null) window.clearTimeout(savedTimer.current);
              savedTimer.current = window.setTimeout(() => setStatus("idle"), 2500);
              return;
            }
            setStatus("error");
            setError(result.error);
          })();
        }}
        className="inline-flex min-h-[44px] min-w-[7.25rem] shrink-0 items-center justify-center rounded-full border border-[var(--color-provin-accent)] bg-transparent px-3.5 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-[var(--color-provin-accent)]/8 disabled:opacity-50"
      >
        {irissSectionSaveButtonLabel(status)}
      </button>
      {inline ? (
        <span role={status === "error" ? "alert" : "status"} className={inlineClass}>
          {inline}
        </span>
      ) : null}
    </div>
  );
}
