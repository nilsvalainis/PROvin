"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { irissLvTransitPlateFont } from "@/components/admin/iriss-lv-transit-plate-font";
import {
  formatWaybillCountdown,
  formatWaybillExpiryDdMmHm,
  parseLvTransitPlate,
  WAYBILL_COUNTDOWN_COLOR,
  WAYBILL_PROGRESS_COLOR,
  waybillRemainingShare,
} from "@/lib/iriss-pavadzimes-countdown";
import type { IrissPavadzimeListRow } from "@/lib/iriss-pavadzimes-types";

const PLATE_RED = "#d21f2b";

/**
 * Krāsas un Barlow kā inline stils: `.admin-ios-theme :is(span, a)` piespiež `color: #000`
 * un manto Inter, tāpēc Tailwind `text-[#…]` / `font-semibold` uz bērniem neuzvar.
 */
const plateGlyphStyle = {
  color: PLATE_RED,
  fontFamily: irissLvTransitPlateFont.style.fontFamily,
  fontWeight: 600,
  fontSize: 16,
  lineHeight: 1,
} as const;

function LvTransitPlate({ plate }: { plate: string }) {
  const parts = parseLvTransitPlate(plate);
  return (
    <span
      className={`${irissLvTransitPlateFont.className} inline-flex h-[22px] w-[104px] shrink-0 overflow-hidden rounded-[3px] border border-[#c8102e] shadow-[0_0_0_1px_#d9d9d6]`}
      style={{
        background: "linear-gradient(#fbfbfa,#efefec)",
        fontFamily: irissLvTransitPlateFont.style.fontFamily,
        fontWeight: 600,
      }}
      aria-label={plate.trim() || "Tranzīts"}
    >
      <span className="relative h-full w-[13px] shrink-0 bg-[#0039a6]">
        <span
          aria-hidden
          className="absolute left-1/2 top-[2px] h-[7px] w-[7px] -translate-x-1/2 rounded-full border border-dotted border-[#ffd200]"
        />
        <span
          className="absolute inset-x-0 bottom-[1px] text-center text-[6.5px] font-semibold leading-none"
          style={{ color: "#ffffff" }}
        >
          LV
        </span>
      </span>
      <span
        className="flex h-full flex-1 items-center justify-between pr-[6px] pl-[5px] leading-none"
        style={plateGlyphStyle}
      >
        {parts ? (
          <>
            <span style={plateGlyphStyle}>{parts.letter}</span>
            <span style={plateGlyphStyle}>{parts.digits}</span>
            <span
              aria-hidden
              className="inline-block h-[0.14em] w-[0.32em]"
              style={{ backgroundColor: PLATE_RED, color: PLATE_RED }}
            />
            <span style={plateGlyphStyle}>{parts.last}</span>
          </>
        ) : (
          <span className="w-full truncate text-center" style={plateGlyphStyle}>
            {plate.trim() || "-"}
          </span>
        )}
      </span>
    </span>
  );
}

export function IrissPavadzimesSidebarCard({ limit }: { limit?: number } = {}) {
  const [rows, setRows] = useState<IrissPavadzimeListRow[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/iriss-pavadzimes?active=1", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { rows?: IrissPavadzimeListRow[] } | null;
        if (!cancelled && res.ok && Array.isArray(json?.rows)) setRows(json.rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const now = new Date(nowMs);
  const shown = limit != null ? rows.slice(0, limit) : rows;
  const hiddenCount = rows.length - shown.length;

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#9ca3af]">PAVADZĪMES</span>
        <Link
          href="/admin/iriss/pavadzimes"
          className="admin-nav-link text-[10px] font-bold text-[#9ca3af] hover:text-[var(--color-apple-text)]"
        >
          {hiddenCount > 0 ? `Visas ${rows.length} ›` : "Visas ›"}
        </Link>
      </div>
      {rows.length === 0 ? null : (
        <ul>
          {shown.map((row) => {
            const pdfHref = `/api/admin/iriss-pavadzimes/${encodeURIComponent(row.id)}/pdf`;
            const expiry = formatWaybillExpiryDdMmHm(row.validUntil) || "-";
            const count = formatWaybillCountdown(row.validUntil, now);
            const share = waybillRemainingShare(row.issuedAt, row.validUntil, now);
            const car = row.brandModel.trim() || "-";
            const title = [row.plate, car, expiry].filter((x) => x !== "-").join(" ");
            return (
              <li key={row.id} className="border-t border-[#f3f4f6]">
                <a
                  href={pdfHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={title}
                  className="block py-[6px]"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <LvTransitPlate plate={row.plate} />
                    <span className="min-w-0 truncate text-[11.5px] font-medium text-[#111]">{car}</span>
                  </span>
                  <span className="mt-0.5 flex items-baseline justify-between gap-1">
                    <span className="text-[10.5px] tabular-nums text-[#6b7280]">{expiry}</span>
                    <span
                      className="text-[10.5px] font-bold tabular-nums"
                      style={{ color: WAYBILL_COUNTDOWN_COLOR[count.status], fontWeight: 700 }}
                    >
                      {count.label}
                    </span>
                  </span>
                  <span className="mt-1 block h-[3px] overflow-hidden rounded-[2px] bg-[#f3f4f6]">
                    <span
                      className="block h-full"
                      style={{
                        width: `${Math.round(share * 1000) / 10}%`,
                        backgroundColor: WAYBILL_PROGRESS_COLOR[count.status],
                      }}
                    />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
