"use client";

import Link from "next/link";

export function PdPrintTrigger({ backHref }: { backHref: string }) {
  return (
    <div className="pdc-noprint" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <Link className="pd-btn" href={backHref}>
        ‹ Atpakaļ
      </Link>
      <button type="button" className="pd-btn p" onClick={() => window.print()}>
        Drukāt / saglabāt PDF
      </button>
    </div>
  );
}
