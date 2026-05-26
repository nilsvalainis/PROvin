"use client";

import { AdminVendorAvotuSourceBlock } from "@/components/admin/AdminVendorAvotuSourceBlock";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import type { AdminGeminiSourceCommentSlot } from "@/components/admin/AdminSourceCommentField";
import {
  citiAvotiSectionLabel,
  emptyCitiAvotiSection,
  type CitiAvotiBlockState,
  type CitiAvotiSectionState,
  type VendorAvotuBlockState,
} from "@/lib/admin-source-blocks";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

type Props = {
  value: CitiAvotiBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: CitiAvotiBlockState) => void;
  trafficFillLevel?: TrafficFillLevel;
  sessionId: string;
  pdfInclude: boolean;
  onPdfIncludeChange: (next: boolean) => void;
  geminiComment?: (sectionIndex: number) => AdminGeminiSourceCommentSlot;
};

function sectionFromVendor(
  prev: CitiAvotiSectionState,
  vendor: VendorAvotuBlockState,
): CitiAvotiSectionState {
  return {
    ...vendor,
    rawUnprocessedData: prev.rawUnprocessedData ?? "",
    label: prev.label ?? "",
  };
}

/** Citi avoti — vairākas identiskas avotu sekcijas ar RAW žurnālu katram. */
export function AdminCitiAvotiSourceBlock({
  value,
  readOnly,
  disabled,
  onChange,
  trafficFillLevel,
  sessionId,
  pdfInclude,
  onPdfIncludeChange,
  geminiComment,
}: Props) {
  const sections = value.sections.length > 0 ? value.sections : [emptyCitiAvotiSection()];
  const total = sections.length;

  const setSections = (next: CitiAvotiSectionState[]) => {
    onChange({ sections: next.length > 0 ? next : [emptyCitiAvotiSection()] });
  };

  const updateSection = (index: number, patch: Partial<CitiAvotiSectionState>) => {
    const next = sections.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setSections(next);
  };

  const addSection = () => {
    setSections([...sections, emptyCitiAvotiSection()]);
  };

  const removeSection = (index: number) => {
    if (sections.length <= 1) return;
    setSections(sections.filter((_, i) => i !== index));
  };

  return (
    <AdminCollapsibleShell
      sessionId={sessionId}
      blockId="citi-avoti"
      header={
        <AdminSourceBlockHeader
          blockKey="citi_avoti"
          trafficFillLevel={trafficFillLevel}
          className={`shrink-0 ${trafficFillLevel ? "mb-0" : "mb-0"}`}
        />
      }
      headerActions={<AdminPdfIncludeToggle checked={pdfInclude} onChange={onPdfIncludeChange} />}
    >
      <div className={`flex min-h-0 flex-col overflow-hidden ${trafficFillLevel ? "p-0" : "p-2"}`}>
        <div className={`min-h-0 flex-1 space-y-3 overflow-y-auto ${trafficFillLevel ? "px-2 pt-2" : ""}`}>
          {sections.map((section, index) => {
            const heading = citiAvotiSectionLabel(section, index, total);
            return (
              <div
                key={index}
                className="rounded-lg border border-slate-200/90 bg-white/60 p-2 shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      {heading}
                    </span>
                    {!readOnly && !disabled ? (
                      <input
                        type="text"
                        className={`${inp} max-w-[220px]`}
                        placeholder="Avota nosaukums (neobligāti)"
                        value={section.label ?? ""}
                        onChange={(e) => updateSection(index, { label: e.target.value.slice(0, 120) })}
                        aria-label={`Citi avoti — avota nosaukums ${index + 1}`}
                      />
                    ) : section.label?.trim() ? (
                      <span className="text-[10px] text-[var(--color-provin-muted)]">({section.label.trim()})</span>
                    ) : null}
                  </div>
                  {!readOnly && !disabled && sections.length > 1 ? (
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-50"
                      onClick={() => removeSection(index)}
                    >
                      Noņemt avotu
                    </button>
                  ) : null}
                </div>

                <label
                  className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]"
                  htmlFor={`citi-avoti-raw-${index}`}
                >
                  RAW datu žurnāls
                </label>
                {readOnly ? (
                  <div
                    id={`citi-avoti-raw-${index}`}
                    className="mb-2 min-h-[56px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-slate-100 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]"
                  >
                    {(section.rawUnprocessedData ?? "").trim() ? (
                      section.rawUnprocessedData
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                ) : (
                  <textarea
                    id={`citi-avoti-raw-${index}`}
                    className="mb-2 w-full min-h-[72px] resize-y rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
                    rows={3}
                    disabled={disabled}
                    placeholder="Iekopē neapstrādātos datus no avota (atsaucei; netiek automātiski parsēts)…"
                    value={section.rawUnprocessedData ?? ""}
                    onChange={(e) =>
                      updateSection(index, { rawUnprocessedData: e.target.value.slice(0, 500_000) })
                    }
                    aria-label={`Citi avoti RAW žurnāls ${index + 1}`}
                  />
                )}

                <AdminVendorAvotuSourceBlock
                  embedded
                  blockKey="citi_avoti"
                  sectionIndex={index}
                  value={section}
                  readOnly={readOnly}
                  disabled={disabled}
                  sessionId={sessionId}
                  geminiComment={geminiComment?.(index)}
                  onChange={(vendor) => updateSection(index, sectionFromVendor(section, vendor))}
                />
              </div>
            );
          })}

          {!readOnly && !disabled ? (
            <button
              type="button"
              className="w-full rounded-md border border-dashed border-slate-300 bg-slate-50/80 px-2 py-1.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:border-[var(--color-provin-accent)] hover:bg-white"
              onClick={addSection}
            >
              + Pievienot papildu avotu
            </button>
          ) : null}
        </div>
      </div>
    </AdminCollapsibleShell>
  );
}
