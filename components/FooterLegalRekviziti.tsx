"use client";

import { useMemo, useState } from "react";

type Props = {
  legalName: string;
  regNo: string;
  legalAddress: string;
};

/**
 * Diskrēts juridisko rekvizītu atvērums footerī:
 * - redzama maza saite "Rekvizīti"
 * - saturs atklājas uz hover vai klikšķa.
 */
export function FooterLegalRekviziti({ legalName, regNo, legalAddress }: Props) {
  const [open, setOpen] = useState(false);
  const hasAll = Boolean(legalName.trim() && regNo.trim() && legalAddress.trim());

  const line = useMemo(() => {
    if (!hasAll) return "PROVIN.LV";
    // Bez etiķetēm (Reģ. nr./Adrese), kā prasīts.
    return `${legalName.trim()} | ${regNo.trim()} | ${legalAddress.trim()}`;
  }, [hasAll, legalAddress, legalName, regNo]);

  return (
    <div className="group mt-2 text-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center text-[8px] text-[#c4c4c8] underline decoration-[#d8d8dc] underline-offset-2 transition-all duration-300 ease-in-out hover:text-[#9ca3af]"
        aria-expanded={open}
        aria-controls="footer-rekviziti"
      >
        Rekvizīti
      </button>
      <p
        id="footer-rekviziti"
        className={`mx-auto mt-1 max-w-[70ch] text-center text-[8px] leading-relaxed text-[#c4c4c8] transition-all duration-300 ease-in-out ${
          open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {line}
      </p>
    </div>
  );
}

