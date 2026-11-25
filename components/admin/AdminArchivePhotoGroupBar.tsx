"use client";

import { useState } from "react";

import {
  setVendorArchiveShowSource,
  vendorArchiveAdminLabel,
  type VendorArchiveGroupMeta,
} from "@/lib/vendor-archive-photo-group";

type ArchiveGroup = { id: string; title: string; photos: { id: string }[]; archive?: VendorArchiveGroupMeta };

const btn =
  "inline-flex h-6 items-center rounded-md border border-slate-300 bg-white px-2 text-[10px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * AutoDNA / CarVertical arhīva foto grupas rinda adminā: avots (tikai adminam), «Rādīt avotu klientam»
 * un viena klikšķa pārvietošana uz otru sadaļu. Grupām bez arhīva meta neko nerāda.
 */
export function AdminArchivePhotoGroupBar({
  group,
  disabled,
  moveLabel,
  onMove,
  onGroupChange,
}: {
  group: ArchiveGroup;
  disabled?: boolean;
  /** «Uz izsoļu arhīvu» / «Uz sludinājuma vēsturi». */
  moveLabel: string;
  onMove?: (groupId: string) => Promise<string | null>;
  onGroupChange: (next: ArchiveGroup) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const meta = group.archive;
  if (!meta) return null;
  const expectedNote =
    meta.expected && meta.expected !== group.photos.length ? ` · atskaitē ${meta.expected}` : "";
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-slate-100/80 px-2 py-1 text-[10px] text-slate-600">
      <span className="font-semibold text-slate-700" title="Avots redzams tikai adminā">
        {vendorArchiveAdminLabel(meta)}
        {expectedNote}
      </span>
      <label className="inline-flex items-center gap-1">
        <input
          type="checkbox"
          className="h-3 w-3"
          checked={meta.showSource === true}
          disabled={disabled || busy}
          onChange={(e) => onGroupChange(setVendorArchiveShowSource(group, e.target.checked))}
        />
        Rādīt avotu klientam
      </label>
      {onMove ? (
        <button
          type="button"
          className={btn}
          disabled={disabled || busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const err = await onMove(group.id);
              if (err) setError(err);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Pārvieto…" : moveLabel}
        </button>
      ) : null}
      {error ? <span className="text-red-700">{error}</span> : null}
    </div>
  );
}
