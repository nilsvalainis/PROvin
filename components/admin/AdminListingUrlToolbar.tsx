"use client";

import { AdminClipboardButton } from "@/components/admin/AdminClipboardButton";
import { buildTirgusDatiOpenUrl } from "@/lib/admin-tirgusdati-url";

/** Tumši zila — kā admin avota blokam „Tirgus dati“ (blue-900). */
const tirgusPillClass =
  "inline-flex h-[28px] shrink-0 items-center justify-center rounded-md bg-blue-900 px-2 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-blue-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1";

type Props = {
  listingUrl: string;
  onCopySuccess?: () => void;
};

/** Blakus sludinājuma URL laukam: Copy + Tirgus dati (sākumlapa; TM hand-off). */
export function AdminListingUrlEndAdornment({ listingUrl, onCopySuccess }: Props) {
  const tdHref = buildTirgusDatiOpenUrl(listingUrl);
  const hasUrl = Boolean(tdHref);

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <AdminClipboardButton
        value={listingUrl}
        onCopied={onCopySuccess}
        titleReady="Kopēt sludinājuma saiti"
        titleCopied="Kopēts"
        ariaReady="Kopēt sludinājuma URL starpliktuvē"
        ariaCopied="Saite nokopēta starpliktuvē"
      />
      {hasUrl ? (
        <a
          href={tdHref!}
          target="_blank"
          rel="noopener noreferrer"
          className={tirgusPillClass}
          title="Tirgus dati — Tampermonkey (GM_*) ieliek sludinājuma URL"
          data-provin-handoff-listing-url={listingUrl.trim()}
        >
          Tirgus
        </a>
      ) : (
        <span
          className={`${tirgusPillClass} cursor-not-allowed opacity-40`}
          title="Ievadi sludinājuma URL"
        >
          Tirgus
        </span>
      )}
    </div>
  );
}
