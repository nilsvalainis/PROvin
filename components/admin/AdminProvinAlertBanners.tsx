"use client";

import { useState } from "react";
import type {
  ProvinAlertBanner,
  ProvinBannerKind,
  ProvinBannerPdfInclude,
  ProvinInfoBanner,
  ProvinManualBanner,
  ProvinManualBannerSeverity,
  ProvinResolvedBanner,
} from "@/lib/provin-alert-banners";
import {
  isProvinBannerIncludedInPdf,
  ownManualBanners,
  PROVIN_INFO_BANNER_KINDS,
  resolveProvinBanners,
  upsertProvinBannerOverride,
} from "@/lib/provin-alert-banners";
import { BANNER_SEVERITY_OPTIONS, bannerSeverityChrome } from "@/components/admin/admin-banner-chrome";
import { AlertTriangle, Pencil, RotateCcw } from "lucide-react";
import type { PdfSummaryTile } from "@/lib/pdf-report-summary";
import { summaryTilesAsResolvedBanners } from "@/lib/pdf-report-summary";

const INFO_KINDS = new Set<ProvinBannerKind>(PROVIN_INFO_BANNER_KINDS);

type CompactWarning = {
  key: string;
  severity: "red" | "yellow";
  label: string;
  title: string;
};

function compactLabelFromResolved(b: ProvinResolvedBanner): string {
  const label = b.card?.label?.trim() ?? "";
  const value = b.card?.value?.trim() ?? "";
  if (label && value) return `${label}: ${value}`;
  if (value) return value;
  if (label) return label;
  return b.text.trim();
}

function compactTitleFromResolved(b: ProvinResolvedBanner): string {
  const bits = [b.card?.label, b.card?.value, b.card?.note || b.text]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean);
  return bits.join(". ") || b.text.trim();
}

/** Sarkans ir augstāks par oranžo. Tas pats veids paliek vienu reizi. */
function upsertCompactWarning(map: Map<string, CompactWarning>, item: CompactWarning) {
  const prev = map.get(item.key);
  if (!prev || (prev.severity === "yellow" && item.severity === "red")) {
    map.set(item.key, item);
  }
}

const FIELD_CLASS =
  "w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

export function AdminProvinAlertBanners({
  banners,
  infoBanners = [],
  summaryTiles = [],
  pdfInclude = {},
  onPdfIncludeChange,
  manualBanners = [],
  onManualBannersChange,
  cardsHidden = false,
}: {
  banners: ProvinAlertBanner[];
  infoBanners?: ProvinInfoBanner[];
  /** Četras kopsavilkuma plāksnītes - rediģējamas un slēdzamas, kamēr kartītes nav paslēptas. */
  summaryTiles?: PdfSummaryTile[];
  pdfInclude?: ProvinBannerPdfInclude;
  onPdfIncludeChange?: (kind: ProvinBannerKind, included: boolean) => void;
  /** Pilns saraksts — aprēķināto brīdinājumu labojumi glabājas tajā pašā masīvā. */
  manualBanners?: ProvinManualBanner[];
  onManualBannersChange?: (next: ProvinManualBanner[]) => void;
  /** Paslēpt pilnās kartītes. Sarkanie un oranžie brīdinājumi paliek kompaktā joslā. */
  cardsHidden?: boolean;
}) {
  const [openKinds, setOpenKinds] = useState<ProvinBannerKind[]>([]);
  const resolved = resolveProvinBanners({ alertBanners: banners, infoBanners, manualBanners });
  const summaryResolved = summaryTilesAsResolvedBanners(summaryTiles, manualBanners);

  const editable = Boolean(onManualBannersChange);

  const patch = (b: ProvinResolvedBanner, fields: Partial<Omit<ProvinManualBanner, "id" | "kind">>) => {
    onManualBannersChange?.(
      upsertProvinBannerOverride(manualBanners, b.kind, { severity: b.severity, ...fields }),
    );
  };

  const reset = (b: ProvinResolvedBanner) => {
    onManualBannersChange?.(upsertProvinBannerOverride(manualBanners, b.kind, null));
  };

  const toggleOpen = (kind: ProvinBannerKind) => {
    setOpenKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));
  };

  if (cardsHidden) {
    const compact = new Map<string, CompactWarning>();
    for (const b of [...summaryResolved, ...resolved]) {
      if (b.severity !== "red" && b.severity !== "yellow") continue;
      const label = compactLabelFromResolved(b);
      if (!label) continue;
      upsertCompactWarning(compact, {
        key: b.kind,
        severity: b.severity,
        label,
        title: compactTitleFromResolved(b),
      });
    }
    for (const b of ownManualBanners(manualBanners)) {
      if (b.severity !== "red" && b.severity !== "yellow") continue;
      const title = (b.title ?? "").trim();
      const value = (b.value ?? "").trim();
      const text = b.text.trim();
      const label = title && value ? `${title}: ${value}` : value || title || text;
      if (!label) continue;
      compact.set(`manual-${b.id}`, {
        key: `manual-${b.id}`,
        severity: b.severity,
        label,
        title: [title, value, text].filter(Boolean).join(". ") || label,
      });
    }
    const warnings = [...compact.values()].sort((a, b) => {
      if (a.severity === b.severity) return 0;
      return a.severity === "red" ? -1 : 1;
    });
    if (warnings.length === 0) return null;
    return (
      <div className="mt-1.5 flex flex-wrap gap-1" role="region" aria-label="Kompaktie brīdinājumi">
        {warnings.map((w) => {
          const orange = w.severity === "yellow";
          return (
            <p
              key={w.key}
              role="alert"
              title={w.title}
              data-provin-severity={w.severity}
              className={`inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight ${
                orange
                  ? "border-[#F97316]/45 bg-[#F97316]/12 text-[#C2410C]"
                  : "border-[#FF4D4D]/45 bg-[#FF4D4D]/10 text-[#C62828]"
              }`}
            >
              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden strokeWidth={1.75} />
              <span className="min-w-0 truncate">{w.label}</span>
            </p>
          );
        })}
      </div>
    );
  }

  if (resolved.length === 0 && summaryResolved.length === 0) return null;

  const renderRow = (b: ProvinResolvedBanner, isInfo: boolean) => {
    const chrome = bannerSeverityChrome(b.severity);
    const Icon = chrome.Icon;
    const open = openKinds.includes(b.kind);
    return (
      <div
        key={b.kind}
        role={isInfo ? "note" : "alert"}
        data-provin-info={isInfo ? b.kind : undefined}
        data-provin-alert={isInfo ? undefined : b.kind}
        data-provin-severity={b.severity}
        data-provin-banner-edited={b.edited ? "1" : undefined}
        className={`rounded-lg border-l-2 px-3 py-1.5 text-[11px] leading-snug text-[#1d1d1f] shadow-[0_2px_16px_rgba(15,23,42,0.05)] ${chrome.bar}`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`h-4 w-4 shrink-0 ${chrome.ico}`} aria-hidden strokeWidth={1.5} />
          <p className="min-w-0 flex-1 font-normal">{b.text}</p>
          {b.edited ? (
            <span className="shrink-0 rounded bg-black/[0.05] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
              Labots
            </span>
          ) : null}
          <label
            className="inline-flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-[10px] font-medium text-[var(--color-provin-muted)] opacity-70 transition-opacity hover:opacity-100"
            title="Rādīt šo ierakstu PDF atskaitē"
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 shrink-0 rounded border-slate-300/80 text-[var(--color-provin-accent)] focus:ring-[var(--color-provin-accent)]/25"
              checked={isProvinBannerIncludedInPdf(b.kind, pdfInclude)}
              disabled={!onPdfIncludeChange}
              onChange={(e) => onPdfIncludeChange?.(b.kind, e.target.checked)}
              aria-label={`Rādīt PDF: ${b.kind}`}
            />
            <span className="hidden sm:inline">Rādīt PDF</span>
          </label>
          {editable ? (
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-[var(--color-provin-muted)] hover:bg-black/[0.05] hover:text-[var(--color-apple-text)]"
              onClick={() => toggleOpen(b.kind)}
              aria-expanded={open}
              aria-label={`Labot brīdinājumu: ${b.kind}`}
              title="Labot"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>

        {editable && open ? (
          <div className="mt-2 border-t border-black/[0.06] pt-2">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <select
                className="rounded border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-1 py-0.5 text-[10px]"
                value={b.severity}
                onChange={(e) => patch(b, { severity: e.target.value as ProvinManualBannerSeverity })}
                aria-label="Brīdinājuma veids"
              >
                {BANNER_SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {b.edited ? (
                <button
                  type="button"
                  className="ml-auto inline-flex items-center gap-1 rounded border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-apple-text)] hover:bg-black/[0.04]"
                  onClick={() => reset(b)}
                >
                  <RotateCcw className="h-3 w-3" aria-hidden />
                  Atjaunot noklusējumu
                </button>
              ) : null}
            </div>
            <div className="mb-1.5 grid grid-cols-2 gap-1.5">
              <input
                className={FIELD_CLASS}
                value={b.override?.title ?? ""}
                onChange={(e) => patch(b, { title: e.target.value })}
                placeholder={b.defaults.card?.label ?? "Kartītes virsraksts"}
                aria-label="Kartītes virsraksts"
              />
              <input
                className={FIELD_CLASS}
                value={b.override?.value ?? ""}
                onChange={(e) => patch(b, { value: e.target.value })}
                placeholder={b.defaults.card?.value ?? "Kartītes galvenā vērtība"}
                aria-label="Kartītes galvenā vērtība"
              />
            </div>
            <textarea
              className={`${FIELD_CLASS} min-h-[52px] resize-y`}
              value={b.override?.text ?? ""}
              onChange={(e) => patch(b, { text: e.target.value })}
              placeholder={b.defaults.text}
              aria-label="Brīdinājuma teksts"
            />
            <p className="mt-1 text-[10px] leading-snug text-[var(--color-provin-muted)]">
              {b.defaults.card
                ? "Tukši lauki paliek pēc noklusējuma. Teksts maina gan šo joslu, gan kartītes paskaidrojumu PDF."
                : "Šis brīdinājums pēc noklusējuma kartīti neveido (dati jau ir kopsavilkuma plāksnītē). Aizpildi virsrakstu vai vērtību, ja gribi atsevišķu kartīti."}
            </p>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2" role="region" aria-label="Brīdinājumi un informācija">
      {summaryResolved.length > 0 ? (
        <>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
            Kopsavilkuma kartītes
          </p>
          {summaryResolved.map((b) => renderRow(b, true))}
        </>
      ) : null}
      {resolved.length > 0 ? (
        <>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
            Automātiskie brīdinājumi
          </p>
          {resolved.map((b) => renderRow(b, INFO_KINDS.has(b.kind)))}
        </>
      ) : null}
    </div>
  );
}
