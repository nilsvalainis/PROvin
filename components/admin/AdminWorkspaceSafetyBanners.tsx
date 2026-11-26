"use client";

import type { WorkspaceUnsavedReason } from "@/lib/admin-workspace-safety";

const ROW =
  "flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-2 py-1 text-[10px] font-semibold leading-snug";
const BTN =
  "inline-flex h-6 shrink-0 items-center rounded-md border bg-white px-2 text-[9px] font-semibold shadow-sm disabled:opacity-50 dark:bg-transparent";

const UNSAVED_REASON_LABEL: Record<WorkspaceUnsavedReason, string> = {
  persistence_off: "servera glabātuve izslēgta",
  not_hydrated: "ielāde nav pabeigta",
  revision_conflict: "pasūtījums mainīts citur",
  save_error: "saglabāšanas kļūda",
  pending: "",
};

export function formatSecondsAgo(s: number): string {
  if (s < 60) return `pirms ${s} s`;
  return `pirms ${Math.round(s / 60)} min`;
}

export function formatLocalTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  return new Date(ms).toLocaleString("lv-LV", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export type LocalRestoreOffer = {
  savedAtMs: number;
  localTotal: number;
  serverTotal: number;
};

export function AdminWorkspaceSafetyBanners({
  unsaved,
  onSaveNow,
  saveBusy,
  presenceOthers,
  localRestore,
  onLocalRestore,
  onLocalRestoreDismiss,
  conflictNotice,
  onConflictNoticeDismiss,
}: {
  unsaved: { reason: WorkspaceUnsavedReason; message?: string | null } | null;
  onSaveNow: () => void;
  saveBusy: boolean;
  presenceOthers: { clientId: string; label: string; secondsAgo: number }[];
  localRestore: LocalRestoreOffer | null;
  onLocalRestore: () => void;
  onLocalRestoreDismiss: () => void;
  conflictNotice: string | null;
  onConflictNoticeDismiss: () => void;
}) {
  const other = presenceOthers[0];
  if (!unsaved && !other && !localRestore && !conflictNotice) return null;
  const reasonText = unsaved ? (unsaved.message ?? UNSAVED_REASON_LABEL[unsaved.reason]) : "";
  return (
    <div className="flex w-full min-w-0 flex-col gap-1" data-workspace-safety>
      {unsaved ? (
        <div className={`${ROW} border-red-400/60 bg-red-50 text-red-950 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-50`} role="alert">
          <p className="min-w-0 flex-1">
            Nav saglabāts serverī{reasonText ? <span className="font-normal"> - {reasonText}</span> : null}
          </p>
          <button type="button" disabled={saveBusy} onClick={onSaveNow} className={`${BTN} border-red-400/80 text-red-950 dark:text-red-50`}>
            Saglabāt tagad
          </button>
        </div>
      ) : null}
      {localRestore ? (
        <div className={`${ROW} border-amber-400/60 bg-amber-50/95 text-amber-950 dark:border-amber-600/40 dark:bg-amber-950/50 dark:text-amber-50`} role="status">
          <p className="min-w-0 flex-1">
            Šajā ierīcē ir nesaglabāti dati ({formatLocalTime(localRestore.savedAtMs)})
            <span className="font-normal">
              {" "}
              - šeit {localRestore.localTotal} lauki, serverī {localRestore.serverTotal}
            </span>
          </p>
          <button type="button" onClick={onLocalRestore} className={`${BTN} border-amber-400/80 text-amber-950 dark:text-amber-50`}>
            Atjaunot
          </button>
          <button type="button" onClick={onLocalRestoreDismiss} className={`${BTN} border-amber-300/60 text-amber-900/80 dark:text-amber-100/80`}>
            Nē
          </button>
        </div>
      ) : null}
      {other ? (
        <div className={`${ROW} border-sky-300/60 bg-sky-50 text-sky-950 dark:border-sky-600/40 dark:bg-sky-950/40 dark:text-sky-50`} role="status">
          <p className="min-w-0 flex-1">
            Pasūtījums atvērts arī citā pārlūkā ({formatSecondsAgo(other.secondsAgo)})
            {other.label ? <span className="font-normal"> - {other.label}</span> : null}
          </p>
        </div>
      ) : null}
      {conflictNotice ? (
        <div className={`${ROW} border-sky-300/60 bg-sky-50 text-sky-950 dark:border-sky-600/40 dark:bg-sky-950/40 dark:text-sky-50`} role="status">
          <p className="min-w-0 flex-1">{conflictNotice}</p>
          <button type="button" onClick={onConflictNoticeDismiss} className={`${BTN} border-sky-300/80 text-sky-950 dark:text-sky-50`}>
            Labi
          </button>
        </div>
      ) : null}
    </div>
  );
}
