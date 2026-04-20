"use client";

import { AdminClipboardButton } from "@/components/admin/AdminClipboardButton";
import {
  AUTORECORDS_BASE_URL,
  buildAutodnaVinCheckUrl,
  buildAutorecordsVinCheckUrl,
  buildCarverticalVinCheckUrl,
  normalizeVinForServiceUrls,
} from "@/lib/admin-vin-urls";

const linkPill =
  "inline-flex h-8 min-w-[2.85rem] items-center justify-center rounded-xl border border-white/20 bg-white/55 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 shadow-sm backdrop-blur-xl transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)]/35 focus-visible:ring-offset-1";

/** Blakus VIN ievades laukam — kopē VIN uz starpliktuvi. */
export function AdminVinCopyButton({
  value,
  onCopied,
}: {
  value: string;
  onCopied?: () => void;
}) {
  return (
    <AdminClipboardButton
      value={value}
      onCopied={onCopied}
      titleReady="Kopēt VIN"
      titleCopied="Kopēts"
      ariaReady="Kopēt VIN starpliktuvē"
      ariaCopied="VIN nokopēts starpliktuvē"
    />
  );
}

/** Zem VIN — vienota iOS stila saites. Bez VIN — bāzes URL vai disabled. */
export function AdminVinServiceLinkRow({ vin }: { vin: string }) {
  const dna = buildAutodnaVinCheckUrl(vin);
  const cv = buildCarverticalVinCheckUrl(vin);
  const ar = buildAutorecordsVinCheckUrl(vin);
  const cvHandoffVin = normalizeVinForServiceUrls(vin);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {dna ? (
        <a
          href={dna}
          target="_blank"
          rel="noopener noreferrer"
          className={linkPill}
          title="AutoDNA — VIN no URL"
        >
          DNA
        </a>
      ) : (
        <span
          className={`${linkPill} cursor-not-allowed opacity-50`}
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
          className={linkPill}
          title="CarVertical — bāzes URL + Tampermonkey (GM_*) aizpilda VIN"
          data-provin-handoff-vin={cvHandoffVin}
        >
          CV
        </a>
      ) : (
        <span
          className={`${linkPill} cursor-not-allowed opacity-50`}
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
          className={linkPill}
          title="Auto-Records — ?vin= + Tampermonkey; citādi Copy"
        >
          AR
        </a>
      ) : (
        <a
          href={AUTORECORDS_BASE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkPill} opacity-90`}
          title="Auto-Records"
        >
          AR
        </a>
      )}
    </div>
  );
}
