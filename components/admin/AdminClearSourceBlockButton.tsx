"use client";

import type { ReactNode } from "react";

type ButtonProps = {
  sourceLabel: string;
  disabled?: boolean;
  onClear: () => void;
};

export function AdminClearSourceBlockButton({ sourceLabel, disabled, onClear }: ButtonProps) {
  return (
    <button
      type="button"
      data-accordion-no-toggle
      disabled={disabled}
      className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/60"
      title={`Nodzēst visus ievadītos laukus — ${sourceLabel}`}
      aria-label={`Nodzēst ievadītos laukus: ${sourceLabel}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const ok = window.confirm(
          `Nodzēst visus ievadītos laukus šajā avotā (${sourceLabel})? Tabulas, iekopējumi, komentāri un foto paliks tukši. Šo nevar atsaukt.`,
        );
        if (!ok) return;
        onClear();
      }}
    >
      Nodzēst laukus
    </button>
  );
}

type ToolsProps = {
  sourceLabel: string;
  readOnly?: boolean;
  disabled?: boolean;
  onClear?: () => void;
  children?: ReactNode;
};

/** PDF toggle + avota lauku notīrīšana avota galvenē. */
export function AdminSourceBlockHeaderTools({
  sourceLabel,
  readOnly,
  disabled,
  onClear,
  children,
}: ToolsProps) {
  if (readOnly || !onClear) return <>{children}</>;
  return (
    <>
      {children}
      <AdminClearSourceBlockButton sourceLabel={sourceLabel} disabled={disabled} onClear={onClear} />
    </>
  );
}
