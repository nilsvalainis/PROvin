"use client";

import { useState } from "react";

import type { CopilotSourceKey } from "@/lib/admin-copilot-types";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import type { VendorArchiveSource } from "@/lib/vendor-archive-photo-group";

const btn =
  "inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * «Ielādēt arhīva foto»: no jau saglabātā AutoDNA / CarVertical PDF -> «Sludinājuma vēsture» grupas
 * (vecajiem pasūtījumiem, kur atskaite ievietota pirms šīs funkcijas). Atkārtoti droši - dublikātus izlaiž.
 */
export function AdminVendorArchivePhotosButton({
  sessionId,
  source,
  disabled,
  getSourceBlocks,
  applyPatchedBlocks,
}: {
  sessionId: string;
  source: VendorArchiveSource;
  disabled?: boolean;
  getSourceBlocks: () => WorkspaceSourceBlocks;
  applyPatchedBlocks: (patched: Partial<WorkspaceSourceBlocks>, changedKeys: CopilotSourceKey[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState("");
  const [isError, setIsError] = useState(false);

  const run = async () => {
    setBusy(true);
    setLine("");
    setIsError(false);
    try {
      const res = await fetch("/api/admin/vendor-archive-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, source, sourceBlocks: getSourceBlocks() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        added?: number;
        notes?: string[];
        patchedSourceBlocks?: Partial<WorkspaceSourceBlocks>;
        changedKeys?: string[];
      };
      if (!res.ok || !data.ok) {
        setIsError(true);
        setLine(data.error === "pdf_missing" ? "Saglabātais PDF nav atrasts" : "Arhīva foto neizdevās ielādēt");
        return;
      }
      if (data.patchedSourceBlocks && data.changedKeys?.length) {
        applyPatchedBlocks(data.patchedSourceBlocks, data.changedKeys as CopilotSourceKey[]);
      }
      const added = data.added ?? 0;
      const head = added > 0 ? `${added} foto ielikti «Sludinājuma vēsturē».` : "Jaunu foto nav.";
      setLine([head, ...(data.notes ?? [])].join(" "));
      setIsError(added === 0 && (data.notes ?? []).some((n) => /nav atrasta|neizdevās|nav nolasāmu/.test(n)));
    } catch {
      setIsError(true);
      setLine("Arhīva foto neizdevās ielādēt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={btn} disabled={disabled || busy} onClick={() => void run()}>
        {busy ? "Ielādē arhīva foto…" : "Ielādēt arhīva foto"}
      </button>
      {line ? <p className={`w-full ${isError ? "text-red-700" : "text-slate-600"}`}>{line}</p> : null}
    </>
  );
}
