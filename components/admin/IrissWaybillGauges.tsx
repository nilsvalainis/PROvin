"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "@/components/admin/IrissWaybillGauges.module.css";
import { formatWaybillExpiryDdMmHm } from "@/lib/iriss-pavadzimes-countdown";
import type { IrissPavadzimeListRow } from "@/lib/iriss-pavadzimes-types";
import { formatWaybillLeft, irissWaybillGauges, type WaybillGauge } from "@/lib/iriss-waybill-gauges";

const RING: Record<WaybillGauge["status"], string> = {
  ok: "#16a34a",
  soon: "#ea580c",
  expired: "#dc2626",
  free: "#c7c7cc",
};

/**
 * Pavadzīmes vienā skatā: 3 numurzīmes kā apļi (48 h skala) ar atlikušajām stundām un marku/modeli.
 * Pieskāriens aplim atver detaļas (beigu laiks, precīzs atlikums, PDF). Der telefonam un datora sānjoslai.
 */
export function IrissWaybillGauges({
  size = "mobile",
  allHref = "/admin/iriss/pavadzimes",
}: {
  size?: "mobile" | "sidebar";
  /** Saite "Visas ›"; null = nerādīt (pašā pavadzīmju lapā tā vestu uz to pašu lapu). */
  allHref?: string | null;
}) {
  const [rows, setRows] = useState<IrissPavadzimeListRow[] | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/iriss-pavadzimes?active=1", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { rows?: IrissPavadzimeListRow[] } | null;
        if (!cancelled) setRows(res.ok && Array.isArray(json?.rows) ? json.rows : []);
      })
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const now = new Date(nowMs);
  const gauges = irissWaybillGauges(
    (rows ?? []).map((r) => ({ id: r.id, plate: r.plate ?? "", validUntil: r.validUntil, issuedAt: r.issuedAt, number: r.number ?? "", brandModel: r.brandModel })),
    now,
  );
  const active = gauges.find((g) => g.plate === open && g.busy) ?? null;
  const small = size === "sidebar";

  return (
    <section className={`${styles.wg} ${small ? styles.sm : ""}`} aria-label="Pavadzīmes">
      <div className={styles.head}>
        <span>Pavadzīmes</span>
        {allHref ? (
          <Link href={allHref} className="admin-nav-link">
            Visas ›
          </Link>
        ) : null}
      </div>
      <div className={styles.row}>
        {gauges.map((g) => {
          const r = 15.5;
          const c = 2 * Math.PI * r;
          const isOpen = open === g.plate && g.busy;
          return (
            <button
              key={g.plate}
              type="button"
              className={`${styles.item} ${isOpen ? styles.on : ""} ${g.busy ? "" : styles.free}`}
              aria-expanded={g.busy ? isOpen : undefined}
              aria-label={g.busy ? `${g.plate}, ${g.brandModel || "auto"}, atlikušas ${g.hoursLeft} h` : `${g.plate}, brīvs`}
              onClick={() => (g.busy ? setOpen((cur) => (cur === g.plate ? null : g.plate)) : undefined)}
              disabled={rows === null}
            >
              <span className={styles.ring}>
                <svg viewBox="0 0 36 36" aria-hidden>
                  <circle cx="18" cy="18" r={r} fill="none" stroke="#ececf0" strokeWidth="3.5" />
                  {g.busy ? (
                    <circle
                      cx="18"
                      cy="18"
                      r={r}
                      fill="none"
                      stroke={RING[g.status]}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeDasharray={`${(g.share * c).toFixed(2)} ${c.toFixed(2)}`}
                      transform="rotate(-90 18 18)"
                    />
                  ) : null}
                </svg>
                <span className={styles.val} style={{ color: g.busy ? RING[g.status] : "#8e8e93" }}>
                  {rows === null ? "…" : g.busy ? (
                    <>
                      {g.hoursLeft}
                      <small>h</small>
                    </>
                  ) : (
                    "brīvs"
                  )}
                </span>
              </span>
              <span className={styles.plate}>{g.plate.replace(/^([A-Z])/, "$1 ")}</span>
              <span className={styles.car}>{g.busy ? g.brandModel || "auto" : "-"}</span>
            </button>
          );
        })}
      </div>
      {active ? (
        <div className={styles.detail}>
          <p className="truncate text-[13px] font-semibold">{active.brandModel || active.plate}</p>
          <p className="text-[12px]">
            Līdz {formatWaybillExpiryDdMmHm(active.validUntil)} · atlikušas {formatWaybillLeft(active.validUntil, now)}
          </p>
          {active.id ? (
            <a
              className={styles.pdf}
              href={`/api/admin/iriss-pavadzimes/${encodeURIComponent(active.id)}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Atvērt PDF{active.number ? ` · Nr. ${active.number}` : ""}
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
