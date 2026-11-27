"use client";

import { AmxButton } from "@/components/admin/mobile/AdminMobileGlass";
import { AUTO_RECORDS_URL, CHECKTHISREG_URL, checkThisRegHint, copyVinToClipboard } from "@/lib/checkthisreg";

const DESKTOP_BASE = "rounded-md border px-2 py-1 text-[10px] transition";
const DESKTOP_DEFAULT = `${DESKTOP_BASE} border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50`;
const DESKTOP_PRIMARY = `${DESKTOP_BASE} border-transparent bg-[#1d1d1f] font-semibold text-white hover:bg-black`;

/** Viena ārējā saite: VIN starpliktuvē + vietne jaunā cilnē. */
function ExtLink({
  label,
  url,
  vin,
  primary,
  variant,
  dataKey,
}: {
  label: string;
  url: string;
  vin: string;
  primary: boolean;
  variant: "desktop" | "glass";
  dataKey: string;
}) {
  const v = vin.trim();
  const title = v ? `Atver ${label}; VIN ${v} nokopēts` : `Atver ${label}`;
  if (variant === "glass") {
    return (
      <AmxButton
        variant={primary ? "primary" : "secondary"}
        title={title}
        data-ext-link={dataKey}
        onClick={() => {
          copyVinToClipboard(v);
          window.open(url, "_blank", "noopener,noreferrer");
        }}
      >
        {label}
      </AmxButton>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => copyVinToClipboard(v)}
      title={title}
      data-ext-link={dataKey}
      className={primary ? DESKTOP_PRIMARY : DESKTOP_DEFAULT}
    >
      {label}
    </a>
  );
}

/**
 * Pogas «CheckThisReg» un «auto-records.com» dīlera datu blokā - jebkuram auto (Nila lēmums 27.11).
 * `highlightMake` (piem. «Renault») - CheckThisReg izcelta + «<Marka> dati - CheckThisReg»
 * (dīlera ielase «datu nav» un marka/gads no CHECKTHISREG_STRONG_MAKES).
 */
export function AdminDealerExtLinks({
  vin,
  highlightMake = null,
  variant = "desktop",
}: {
  vin: string;
  highlightMake?: string | null;
  variant?: "desktop" | "glass";
}) {
  const hl = Boolean(highlightMake);
  const hint = highlightMake ? checkThisRegHint(highlightMake) : null;
  if (variant === "glass") {
    return (
      <div className="mt-2.5" data-checkthisreg={hl ? "highlighted" : "default"}>
        <div className="amx-grid2">
          <ExtLink label="CheckThisReg" url={CHECKTHISREG_URL} vin={vin} primary={hl} variant="glass" dataKey="checkthisreg" />
          <ExtLink label="auto-records.com" url={AUTO_RECORDS_URL} vin={vin} primary={false} variant="glass" dataKey="auto-records" />
        </div>
        {hint ? <p className="amx-mut mt-1 px-1 text-[13px]">{hint}</p> : null}
      </div>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" data-checkthisreg={hl ? "highlighted" : "default"}>
      <ExtLink label="CheckThisReg" url={CHECKTHISREG_URL} vin={vin} primary={hl} variant="desktop" dataKey="checkthisreg" />
      {hint ? <span className="text-[10px] font-medium text-slate-700">{hint}</span> : null}
      <ExtLink label="auto-records.com" url={AUTO_RECORDS_URL} vin={vin} primary={false} variant="desktop" dataKey="auto-records" />
    </span>
  );
}
