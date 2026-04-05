"use client";

import { useCallback, useState } from "react";
import {
  AUTORECORDS_BASE_URL,
  buildAutodnaVinCheckUrl,
  buildAutorecordsVinCheckUrl,
  buildCarverticalVinCheckUrl,
} from "@/lib/admin-vin-urls";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7V5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V9a2 2 0 00-2-2H8z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const copyBtnClass =
  "inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-[var(--color-apple-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-35";

function copyViaExecCommand(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Blakus VIN ievades laukam — kopē lauka vērtību (kā redzams) uz starpliktuvi. */
export function AdminVinCopyButton({
  value,
  onCopied,
}: {
  value: string;
  /** Pēc veiksmīgas kopēšanas (piem., lai uzsvērtu VIN lauku ~0,5 s). */
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const trimmed = value.trim();
  const canCopy = trimmed.length > 0;

  const onCopy = useCallback(async () => {
    if (!canCopy) return;
    let ok = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(trimmed);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = copyViaExecCommand(trimmed);
    if (ok) {
      onCopied?.();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }, [canCopy, trimmed, onCopied]);

  return (
    <button
      type="button"
      className={copyBtnClass}
      disabled={!canCopy}
      onClick={() => void onCopy()}
      title={copied ? "Kopēts" : "Kopēt VIN"}
      aria-label={copied ? "VIN nokopēts starpliktuvē" : "Kopēt VIN starpliktuvē"}
    >
      {copied ? (
        <span className="text-[10px] font-bold text-emerald-700" aria-hidden>
          OK
        </span>
      ) : (
        <CopyIcon className="shrink-0" />
      )}
    </button>
  );
}

const linkPill =
  "inline-flex h-7 min-w-[2.75rem] items-center justify-center rounded-md px-2 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

/** Zem VIN — AutoDNA (zils), CarVertical (dzeltens), Auto-Records (oranžs). Bez VIN — bāzes URL vai disabled. */
export function AdminVinServiceLinkRow({ vin }: { vin: string }) {
  const dna = buildAutodnaVinCheckUrl(vin);
  const cv = buildCarverticalVinCheckUrl(vin);
  const ar = buildAutorecordsVinCheckUrl(vin);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {dna ? (
        <a
          href={dna}
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkPill} bg-sky-600 focus-visible:ring-sky-500`}
          title="AutoDNA — VIN no URL"
        >
          DNA
        </a>
      ) : (
        <span
          className={`${linkPill} cursor-not-allowed bg-sky-600/35 opacity-60`}
          title="Ievadi VIN"
        >
          DNA
        </span>
      )}
      {cv ? (
        <a
          href={cv}
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkPill} bg-yellow-500 text-yellow-950 focus-visible:ring-yellow-600`}
          title="CarVertical — ?vin= + Tampermonkey skripts (public/userscripts/)"
        >
          CV
        </a>
      ) : (
        <span
          className={`${linkPill} cursor-not-allowed bg-yellow-500/35 text-yellow-950/70 opacity-60`}
          title="Ievadi VIN"
        >
          CV
        </span>
      )}
      {ar ? (
        <a
          href={ar}
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkPill} bg-orange-500 focus-visible:ring-orange-600`}
          title="Auto-Records — ?vin= + Tampermonkey; citādi Copy"
        >
          AR
        </a>
      ) : (
        <a
          href={AUTORECORDS_BASE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkPill} bg-orange-500/80 focus-visible:ring-orange-600`}
          title="Auto-Records"
        >
          AR
        </a>
      )}
    </div>
  );
}
