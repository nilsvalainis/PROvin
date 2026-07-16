"use client";

import {
  createEmptyManualBanner,
  type ProvinManualBanner,
  type ProvinManualBannerSeverity,
} from "@/lib/provin-alert-banners";
import { AlertTriangle, Info, Plus, Trash2 } from "lucide-react";

const SEVERITY_OPTIONS: { id: ProvinManualBannerSeverity; label: string }[] = [
  { id: "grey", label: "Pelēks (info)" },
  { id: "yellow", label: "Dzeltens" },
  { id: "red", label: "Sarkans" },
];

function severityChrome(severity: ProvinManualBannerSeverity) {
  if (severity === "red") {
    return {
      bar: "border-l-[#FF4D4D] bg-[#FF4D4D]/[0.04]",
      ico: "text-[#FF4D4D]",
      Icon: AlertTriangle,
    };
  }
  if (severity === "yellow") {
    return {
      bar: "border-l-[#FFC107] bg-[#FFC107]/[0.04]",
      ico: "text-[#FFC107]",
      Icon: AlertTriangle,
    };
  }
  return {
    bar: "border-l-[#8e8e93] bg-[#8e8e93]/[0.08]",
    ico: "text-[#8e8e93]",
    Icon: Info,
  };
}

export function AdminManualBannersEditor({
  banners,
  onChange,
}: {
  banners: ProvinManualBanner[];
  onChange: (next: ProvinManualBanner[]) => void;
}) {
  const patch = (id: string, patchFields: Partial<ProvinManualBanner>) => {
    onChange(banners.map((b) => (b.id === id ? { ...b, ...patchFields } : b)));
  };

  const remove = (id: string) => {
    onChange(banners.filter((b) => b.id !== id));
  };

  const add = (severity: ProvinManualBannerSeverity) => {
    onChange([...banners, createEmptyManualBanner(severity)]);
  };

  return (
    <div className="space-y-2" role="region" aria-label="Manuālie brīdinājumi">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
          Manuālie brīdinājumi
        </p>
        <div className="flex flex-wrap gap-1">
          {SEVERITY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="inline-flex items-center gap-1 rounded border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-apple-text)] hover:bg-black/[0.04]"
              onClick={() => add(opt.id)}
            >
              <Plus className="h-3 w-3" aria-hidden />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {banners.length === 0 ? (
        <p className="text-[10px] text-[var(--color-provin-muted)]">
          Pievieno pelēku, dzeltenu vai sarkanu joslu ar savu tekstu — tā parādīsies PDF augšā.
        </p>
      ) : null}

      {banners.map((b) => {
        const chrome = severityChrome(b.severity);
        const Icon = chrome.Icon;
        return (
          <div
            key={b.id}
            className={`rounded-lg border-l-2 px-2.5 py-2 shadow-[0_2px_16px_rgba(15,23,42,0.04)] ${chrome.bar}`}
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Icon className={`h-4 w-4 shrink-0 ${chrome.ico}`} aria-hidden strokeWidth={1.5} />
              <select
                className="rounded border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-1 py-0.5 text-[10px]"
                value={b.severity}
                onChange={(e) =>
                  patch(b.id, { severity: e.target.value as ProvinManualBannerSeverity })
                }
                aria-label="Brīdinājuma veids"
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <label className="ml-auto inline-flex cursor-pointer select-none items-center gap-1.5 text-[10px] font-medium text-[var(--color-provin-muted)]">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300/80 text-[var(--color-provin-accent)]"
                  checked={b.includeInPdf !== false}
                  onChange={(e) => patch(b.id, { includeInPdf: e.target.checked })}
                />
                Rādīt PDF
              </label>
              <button
                type="button"
                className="rounded p-0.5 text-[var(--color-provin-muted)] hover:bg-black/[0.04] hover:text-red-600"
                onClick={() => remove(b.id)}
                aria-label="Dzēst manuālo brīdinājumu"
                title="Dzēst"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <textarea
              className="w-full min-h-[52px] resize-y rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25"
              value={b.text}
              onChange={(e) => patch(b.id, { text: e.target.value })}
              placeholder="Ieraksti brīdinājuma tekstu…"
              aria-label="Manuālā brīdinājuma teksts"
            />
          </div>
        );
      })}
    </div>
  );
}
