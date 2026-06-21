"use client";

import {
  ADMIN_INCIDENT_DATA_UNAVAILABLE,
  isIncidentDataUnavailableText,
} from "@/lib/admin-incident-field-presets";

type Props = {
  value: string;
  disabled?: boolean;
  onFill: () => void;
};

/** Īsa saite zem negadījumu tabulas lauka — aizpilda ar «Dati nav pieejami». */
export function AdminIncidentFieldFillOption({ value, disabled, onFill }: Props) {
  if (disabled) return null;
  const active = isIncidentDataUnavailableText(value);
  return (
    <button
      type="button"
      className={`mt-0.5 block max-w-full truncate text-left text-[9px] leading-tight ${
        active
          ? "font-semibold text-[var(--color-provin-accent)]"
          : "font-medium text-slate-400 hover:text-[var(--color-provin-accent)]"
      }`}
      onClick={onFill}
      title={`Aizpildīt ar «${ADMIN_INCIDENT_DATA_UNAVAILABLE}»`}
    >
      {ADMIN_INCIDENT_DATA_UNAVAILABLE}
    </button>
  );
}
