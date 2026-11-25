"use client";

import { useId, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import {
  FLASH_MAX_JOBS,
  FLASH_MAX_OPERATOR_NOTES_MAX_LEN,
  clipFlashMaxOperatorNotes,
  defaultFlashMaxJobBreadth,
  defaultFlashMaxSelection,
  emptyFlashMaxSelection,
  expandFlashMaxMenuJobs,
  flashMaxSelectionWithData,
  flashMaxUnavailableMenuJobs,
  formatFlashMaxSkipLabel,
  parseCitiAvotiFlashMaxJobId,
  summaryOnlyFlashMaxSelection,
  type FlashMaxJob,
  type FlashMaxSelection,
  type FlashMaxSkipReason,
} from "@/lib/admin-flash-max";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { AI_ADMIN_TIER_BUTTON_ORDER } from "@/lib/ai-admin-field-defaults";
import { aiAdminModelTierLabel, type AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import { COMMENT_BREADTH_LEVELS, COMMENT_BREADTH_SHORT, type CommentBreadth } from "@/lib/ai-comment-breadth";

/**
 * FLASH MAX izvēle (sadaļas, platums, modelis, piezīmes) - viens saturs datora izvēlnei un telefona logam
 * (Nils 17.11: telefonā nebija iespējas izvēlēties sadaļas). Sadaļas bez datiem ir izķeksētas un nav spiežamas.
 */

const SHORT_TIER: Record<AiAdminModelTier, string> = {
  "gemini-flash": "Smart",
  gemini: "Gemini",
  flash: "Sonnet",
  pro: "PRO",
  lite: "Haiku",
};

export type FlashMaxDraft = {
  selection: FlashMaxSelection;
  setSelection: Dispatch<SetStateAction<FlashMaxSelection>>;
  notes: string;
  setNotes: Dispatch<SetStateAction<string>>;
};

/** Izvēles stāvoklis glabājas pie pogas, lai starp atvēršanām nepazūd (kā līdz šim datorā). */
export function useFlashMaxDraft(): FlashMaxDraft {
  const [selection, setSelection] = useState<FlashMaxSelection>(defaultFlashMaxSelection);
  const [notes, setNotes] = useState("");
  return { selection, setSelection, notes, setNotes };
}

type Size = "compact" | "touch";

function JobRow({
  job,
  size,
  checked,
  unavailable,
  tier,
  breadth,
  disabled,
  onToggle,
  onTier,
  onBreadth,
}: {
  job: FlashMaxJob;
  size: Size;
  checked: boolean;
  unavailable: FlashMaxSkipReason | undefined;
  tier: AiAdminModelTier;
  breadth: CommentBreadth;
  disabled: boolean;
  onToggle: (id: string, next: boolean) => void;
  onTier: (id: string, next: AiAdminModelTier) => void;
  onBreadth: (id: string, next: CommentBreadth) => void;
}) {
  const boxId = useId();
  const touch = size === "touch";
  const off = disabled || Boolean(unavailable);
  const selectClass = touch
    ? "h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-1.5 text-[13px] font-semibold text-slate-700 disabled:opacity-40"
    : "h-5 shrink-0 rounded border border-slate-200 bg-white px-0.5 text-[9px] font-semibold text-slate-700 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25 disabled:opacity-40";
  return (
    <div
      data-flash-job={job.id}
      data-unavailable={unavailable ? "" : undefined}
      className={`flex min-w-0 items-center ${touch ? "min-h-11 gap-2.5 py-1" : "gap-1.5 rounded px-0.5 py-0.5"} ${
        unavailable ? "opacity-50" : checked ? "" : "opacity-70"
      }`}
    >
      <label htmlFor={boxId} className={`flex min-w-0 flex-1 items-center ${touch ? "min-h-11 gap-2.5" : "gap-1.5"}`}>
        <input
          id={boxId}
          type="checkbox"
          className={`${touch ? "h-5 w-5" : "h-3 w-3"} shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-600/30`}
          checked={checked && !unavailable}
          disabled={off}
          onChange={(e) => onToggle(job.id, e.target.checked)}
        />
        <span className="min-w-0 flex-1">
          {/* Telefonā garš nosaukums pāriet 2 rindās (bija nogriezts: "Oficiālā dīlera k..."). */}
          <span
            className={`block font-medium text-[var(--color-apple-text)] ${touch ? "line-clamp-2 text-[15px] leading-tight" : "truncate text-[10px]"}`}
          >
            {job.label}
          </span>
          {unavailable ? (
            <span className={`block text-slate-500 ${touch ? "text-[12px]" : "text-[9px]"}`}>
              {formatFlashMaxSkipLabel(unavailable)}
            </span>
          ) : null}
        </span>
      </label>
      <select
        aria-label={`${job.label} platums`}
        disabled={off}
        value={breadth}
        onChange={(e) => onBreadth(job.id, e.target.value as CommentBreadth)}
        className={`${selectClass} ${touch ? "w-[4.6rem]" : "w-[3.4rem]"}`}
      >
        {COMMENT_BREADTH_LEVELS.map((opt) => (
          <option key={opt} value={opt}>
            {COMMENT_BREADTH_SHORT[opt]}
          </option>
        ))}
      </select>
      <select
        aria-label={`${job.label} aģents`}
        disabled={off}
        value={tier}
        onChange={(e) => onTier(job.id, e.target.value as AiAdminModelTier)}
        className={`${selectClass} ${touch ? "w-[5.2rem]" : "max-w-[6.75rem]"}`}
      >
        {AI_ADMIN_TIER_BUTTON_ORDER.map((opt) => (
          <option key={opt} value={opt}>
            {SHORT_TIER[opt]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Cik sadaļu tiks ģenerētas (izvēlētās, kurām ir dati). */
export function flashMaxRunnableCount(draft: FlashMaxDraft, sourceBlocks: WorkspaceSourceBlocks | null | undefined): number {
  const unavailable = flashMaxUnavailableMenuJobs(expandFlashMaxMenuJobs(FLASH_MAX_JOBS, sourceBlocks), sourceBlocks);
  return flashMaxSelectionWithData(draft.selection, unavailable).selectedIds.length;
}

/** Izvēle, ko nodot ģenerēšanai: bez tukšajām sadaļām, ar apgrieztām piezīmēm. */
export function flashMaxDraftToSelection(
  draft: FlashMaxDraft,
  sourceBlocks: WorkspaceSourceBlocks | null | undefined,
): FlashMaxSelection {
  const unavailable = flashMaxUnavailableMenuJobs(expandFlashMaxMenuJobs(FLASH_MAX_JOBS, sourceBlocks), sourceBlocks);
  return { ...flashMaxSelectionWithData(draft.selection, unavailable), operatorNotes: clipFlashMaxOperatorNotes(draft.notes) };
}

export function AdminFlashMaxPanel({
  draft,
  sourceBlocks,
  busy,
  size = "compact",
}: {
  draft: FlashMaxDraft;
  sourceBlocks?: WorkspaceSourceBlocks | null;
  busy?: boolean;
  size?: Size;
}) {
  const { selection, setSelection, notes, setNotes } = draft;
  const touch = size === "touch";
  const menuJobs = useMemo(() => expandFlashMaxMenuJobs(FLASH_MAX_JOBS, sourceBlocks), [sourceBlocks]);
  const unavailable = useMemo(() => flashMaxUnavailableMenuJobs(menuJobs, sourceBlocks), [menuJobs, sourceBlocks]);
  const dailyJobs = menuJobs.filter((j) => j.group === "daily");
  const extraJobs = menuJobs.filter((j) => j.group === "extra");

  // Izvēli (draft) nekad nefiltrē: tukša sadaļa tikai RĀDĀS izķeksēta (checked && !unavailable) un netiek
  // ģenerēta (flashMaxDraftToSelection). Kad dati parādās, ķeksis atgriežas pats - arī ja logs bija atvērts
  // pirms datu ielādes.
  const preset = (next: FlashMaxSelection) => setSelection(next);
  const toggle = (id: string, next: boolean) =>
    setSelection((prev) => {
      let ids = prev.selectedIds;
      // Noklusējumā atzīmēts viss «Citi avoti» bloks; noņemot vienu sadaļu, pārējās paliek atzīmētas.
      if (!next && parseCitiAvotiFlashMaxJobId(id) != null && ids.includes("citi_avoti")) {
        const sectionIds = menuJobs.map((j) => j.id).filter((x) => parseCitiAvotiFlashMaxJobId(x) != null);
        ids = [...ids.filter((x) => x !== "citi_avoti"), ...sectionIds];
      }
      return {
        ...prev,
        selectedIds: next ? [...new Set([...ids, id])] : ids.filter((x) => x !== id),
      };
    });
  const isChecked = (id: string) =>
    selection.selectedIds.includes(id) ||
    (parseCitiAvotiFlashMaxJobId(id) != null && selection.selectedIds.includes("citi_avoti"));
  const setTier = (id: string, next: AiAdminModelTier) => setSelection((prev) => ({ ...prev, tiers: { ...prev.tiers, [id]: next } }));
  const setBreadth = (id: string, next: CommentBreadth) =>
    setSelection((prev) => ({ ...prev, breadths: { ...prev.breadths, [id]: next } }));

  const chip = touch
    ? "min-h-11 rounded-full bg-slate-100 px-3.5 text-[14px] font-medium text-slate-700 disabled:opacity-40"
    : "rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40";
  const groupTitle = `font-semibold uppercase tracking-wide text-slate-400 ${touch ? "pb-1 pt-3 text-[12px]" : "text-[9px]"}`;
  const hint = `leading-snug text-slate-500 ${touch ? "text-[13px]" : "text-[9px]"}`;

  const rows = (jobs: FlashMaxJob[]) =>
    jobs.map((job) => (
      <JobRow
        key={job.id}
        job={job}
        size={size}
        checked={isChecked(job.id)}
        unavailable={unavailable[job.id]}
        tier={selection.tiers[job.id] ?? "gemini-flash"}
        breadth={selection.breadths[job.id] ?? defaultFlashMaxJobBreadth(job.id)}
        disabled={!!busy}
        onToggle={toggle}
        onTier={setTier}
        onBreadth={setBreadth}
      />
    ));

  return (
    <div className="min-w-0">
      <div className={`flex flex-wrap items-start justify-between gap-1.5 ${touch ? "mb-2" : "mb-1.5"}`}>
        <p className={`min-w-0 ${hint}`}>
          Platums: Komp / Vid / Plašs. Kopsavilkums pēc noklusējuma plašs, pārējie kompakti. Sadaļas bez datiem ir
          izķeksētas.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={chip} disabled={busy} onClick={() => preset(defaultFlashMaxSelection())}>
            Noklusējumi
          </button>
          <button type="button" className={chip} disabled={busy} onClick={() => preset(emptyFlashMaxSelection())}>
            Notīrīt
          </button>
          <button type="button" className={chip} disabled={busy} onClick={() => preset(summaryOnlyFlashMaxSelection())}>
            Tikai kopsavilkums
          </button>
        </div>
      </div>
      <p className={groupTitle}>Ikdienas sadaļas</p>
      <div className={touch ? "" : "max-h-[40vh] space-y-0.5 overflow-y-auto pr-0.5"}>
        {rows(dailyJobs)}
        <p className={`${groupTitle} ${touch ? "" : "pt-1.5"}`}>Citas sadaļas</p>
        {rows(extraJobs)}
      </div>
      <label className={`block border-t border-slate-100 ${touch ? "mt-3 pt-3" : "mt-2 pt-2"}`}>
        <span className={`mb-0.5 block ${groupTitle}`}>Papildu piezīmes / komanda</span>
        <span className={`mb-1 block ${hint}`}>
          Iet visiem izvēlētajiem aģentiem. Apstrādā katru tēmu; ja saki „tikai par…”, pārējais netiek papildināts. Jauns
          fakts - labo visus tekstus pēc tā.
        </span>
        <textarea
          className={`w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25 ${
            touch ? "min-h-[6rem] text-[16px]" : "min-h-[4.5rem] text-[11px]"
          }`}
          placeholder="Piem., jauns AutoDNA: 12.03.2019 Vācijā 18 400 €; labo visus komentārus pēc šiem faktiem…"
          value={notes}
          disabled={busy}
          maxLength={FLASH_MAX_OPERATOR_NOTES_MAX_LEN}
          onChange={(e) => setNotes(e.target.value.slice(0, FLASH_MAX_OPERATOR_NOTES_MAX_LEN))}
          aria-label="Papildu piezīmes FLASH MAX ģenerēšanai"
        />
      </label>
    </div>
  );
}

export const FLASH_MAX_TIER_LEGEND = AI_ADMIN_TIER_BUTTON_ORDER.map((t) => `${SHORT_TIER[t]} = ${aiAdminModelTierLabel(t)}`).join(" · ");
