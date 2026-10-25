"use client";

import type { ReactNode } from "react";

/** j61: sadaļas zaļā svira (51x31, pieskāriena zona 44 px augsta). Noklusējums ieslēgts nosaka izsaucējs. */
export function IrissOfferSectionSwitch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Ekrāna lasītājam: piem. "Rādīt klientam: Izsole". */
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="-my-1.5 -mr-1 inline-flex h-11 min-w-[56px] shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="iriss-offer-section-switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

/** j61: piedāvājuma sadaļas kartīte - virsraksts + "Rāda klientam" + zaļā svira virsraksta rindā. */
export function IrissOfferSectionCard({
  title,
  sub,
  visible,
  onVisibleChange,
  children,
  className = "",
}: {
  title: string;
  /** Ja nav - "Rāda klientam" / "Paslēpts klientam" pēc sviras. */
  sub?: string;
  /** Ja nav - kartīte bez sviras (piem. termiņš). */
  visible?: boolean;
  onVisibleChange?: (next: boolean) => void;
  children?: ReactNode;
  className?: string;
}) {
  const hasSwitch = typeof visible === "boolean" && Boolean(onVisibleChange);
  const subText = sub ?? (hasSwitch ? (visible ? "Rāda klientam" : "Paslēpts klientam") : "");
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white p-3.5 ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[#333]">{title}</h2>
          {subText ? (
            <p
              className={`mt-0.5 text-[12px] ${hasSwitch && !visible ? "font-medium" : ""}`}
              // IRISS tēma pārkrāso pelēkos tekstus melnus - krāsa tieši.
              style={{ color: hasSwitch && !visible ? "#b45309" : "#8a8a8e" }}
            >
              {subText}
            </p>
          ) : null}
        </div>
        {hasSwitch ? (
          <IrissOfferSectionSwitch checked={visible!} onChange={onVisibleChange!} label={`Rādīt klientam: ${title}`} />
        ) : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
