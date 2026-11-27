"use client";

import type { VendorReportSummary } from "@/lib/vendor-report-warnings";

/**
 * AutoDNA / CarVertical fona joslā pēc atskaites ievietošanas: visi brīdinājumi (sarkans - risks,
 * oranžs - uzmanību) un iekļauto fotogrāfiju skaits.
 */
export function AdminVendorReportSummary({ summary, photosLoading }: { summary: VendorReportSummary; photosLoading?: boolean }) {
  const { warnings, photos } = summary;
  const short = photos.inReport != null && photos.inserted < photos.inReport;
  return (
    <div className="mt-1.5 space-y-0.5 border-t border-slate-200 pt-1.5" data-provin-vendor-report-summary="">
      {warnings.length === 0 ? (
        <p className="font-medium text-emerald-700">Brīdinājumu nav</p>
      ) : (
        <ul className="space-y-0.5">
          {warnings.map((w) => (
            <li key={w.key} className="flex items-start gap-1.5">
              <span
                aria-hidden
                className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${w.level === "red" ? "bg-red-600" : "bg-orange-500"}`}
              />
              <span className={`min-w-0 break-words font-medium ${w.level === "red" ? "text-red-700" : "text-orange-700"}`}>{w.text}</span>
            </li>
          ))}
        </ul>
      )}
      <p className={photosLoading ? "text-slate-600" : short ? "text-orange-700" : "text-slate-600"}>
        Iekļautas fotogrāfijas:{" "}
        {photosLoading ? (
          "ielādē…"
        ) : (
          <>
            <span className="font-semibold">{photos.inserted}</span>
            {photos.inReport != null ? ` / atskaitē ${photos.inReport}` : ""}
          </>
        )}
      </p>
    </div>
  );
}
