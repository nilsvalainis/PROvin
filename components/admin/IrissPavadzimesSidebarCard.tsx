"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatWaybillDateTime } from "@/lib/iriss-pavadzimes-parse";
import type { IrissPavadzimeListRow, IrissPavadzimeValidityTone } from "@/lib/iriss-pavadzimes-types";

function toneClass(tone: IrissPavadzimeValidityTone): string {
  if (tone === "expired") return "text-[#DC2626]";
  if (tone === "today") return "text-[#D97706]";
  return "text-[#8e8e93]";
}

function cell(v: string): string {
  return v.trim() || "-";
}

export function IrissPavadzimesSidebarCard() {
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
    const t = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const now = new Date(nowMs);

  return (
    <div className="mt-3 rounded-lg bg-[#f2f2f7] px-2 py-1.5">
      <Link
        href="/admin/iriss/pavadzimes"
        className="admin-nav-link block px-0.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93] hover:text-[var(--color-apple-text)]"
      >
        Pavadzīmes
      </Link>
      {rows.length === 0 ? null : (
        <ul>
          {rows.map((row) => {
            const pdfHref = `/api/admin/iriss-pavadzimes/${encodeURIComponent(row.id)}/pdf`;
            const until = formatWaybillDateTime(row.validUntil, now) || "-";
            const title = [row.number, row.plate, row.brandModel, until].filter((x) => x.trim() && x !== "-").join(" ");
            return (
              <li key={row.id}>
                <a
                  href={pdfHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={title}
                  className="flex min-w-0 items-baseline gap-1 py-0.5 text-[10px] leading-tight text-[var(--color-apple-text)] hover:bg-black/[0.04]"
                >
                  <span className="shrink-0 font-mono tabular-nums">{cell(row.number)}</span>
                  <span className="shrink-0 font-semibold">{cell(row.plate)}</span>
                  <span className="min-w-0 truncate">{cell(row.brandModel)}</span>
                  <span className={`ml-auto shrink-0 tabular-nums ${toneClass(row.validityTone)}`}>{until}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
