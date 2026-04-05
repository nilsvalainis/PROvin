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
  "inline-flex h-7 min-w-[2.75rem] items-center justify-center rounded-md px-2 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

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

/** Zem VIN — AutoDNA (zils), CarVertical (dzeltens), Auto-Records (oranžs). Bez VIN — bāzes URL vai disabled. */
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
          title="CarVertical — bāzes URL + Tampermonkey (GM_*) aizpilda VIN"
          data-provin-handoff-vin={cvHandoffVin}
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
