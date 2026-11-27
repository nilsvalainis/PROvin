"use client";

import { AmxButton } from "@/components/admin/mobile/AdminMobileGlass";
import { CHECKTHISREG_URL, checkThisRegHint, copyVinToClipboard } from "@/lib/checkthisreg";

/**
 * Poga «CheckThisReg» dīlera datu blokā (markām no CHECKTHISREG_STRONG_MAKES).
 * Klikšķis: VIN starpliktuvē + vietne jaunā cilnē. `highlighted` - dīlera ielase bez datiem.
 */
export function AdminCheckThisRegButton({
  make,
  vin,
  highlighted,
  variant = "desktop",
}: {
  make: string;
  vin: string;
  highlighted: boolean;
  variant?: "desktop" | "glass";
}) {
  const onClick = () => copyVinToClipboard(vin);
  const title = vin.trim() ? `Atver CheckThisReg; VIN ${vin.trim()} nokopēts` : "Atver CheckThisReg";
  if (variant === "glass") {
    return (
      <div className="mt-2.5" data-checkthisreg={highlighted ? "highlighted" : "default"}>
        <AmxButton
          variant={highlighted ? "primary" : "secondary"}
          className="w-full"
          title={title}
          onClick={() => {
            onClick();
            window.open(CHECKTHISREG_URL, "_blank", "noopener,noreferrer");
          }}
        >
          CheckThisReg
        </AmxButton>
        {highlighted ? <p className="amx-mut mt-1 px-1 text-[13px]">{checkThisRegHint(make)}</p> : null}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5" data-checkthisreg={highlighted ? "highlighted" : "default"}>
      <a
        href={CHECKTHISREG_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        title={title}
        className={
          highlighted
            ? "rounded-md border border-transparent bg-[#1d1d1f] px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-black"
            : "rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 transition hover:bg-slate-50"
        }
      >
        CheckThisReg
      </a>
      {highlighted ? <span className="text-[10px] font-medium text-slate-700">{checkThisRegHint(make)}</span> : null}
    </span>
  );
}
