"use client";

import { useMemo, useState, type ReactNode } from "react";

import { buildAtraFacts, type AtraFactRow, type AtraFacts } from "@/lib/atra-parbaude-facts";
import type { CsddTechData } from "@/lib/csdd-tech-data";
import type { EcsddAutoStatus } from "@/lib/ecsdd-auto-types";
import type { LtabAutoStatus } from "@/lib/ltab-auto-types";
import { buildVinScanResultCard } from "@/lib/vin-scan/result-fields";
import { formatVinScanScannedAt } from "@/lib/vin-scan/summary";
import {
  buildVinScanV4Attention,
  buildVinScanV4Layout,
  formatKmLv,
  vinScanV4LastOdometerLine,
  vinScanV4LtabContradiction,
  vinScanV4MileageRows,
  vinScanV4Notice,
  vinScanV4StatusLine,
  VIN_SCAN_V4_KFZ_ID,
  type VinScanV4Flag,
} from "@/lib/vin-scan/v4-view";
import { kfzAtViewState } from "@/lib/kfzgutachten/austria-signals";
import { buildEcsddFacts, ECSDD_FACT_ROW_ID, ecsddInspectionLine, ecsddIsoToLvDate, type VinScanEcsddFacts } from "@/lib/vin-scan/ecsdd-facts";

/* ---------------- Tipi ---------------- */

/** Viena avota rinda (VIN SCAN panelis, pasūtījuma ieraksts vai ātrā vērtējuma momentuzņēmums). */
export type VinScanV4Row = AtraFactRow & {
  openUrl?: string;
  scannedAt?: string;
  /** Pārlūka importa piezīme u.c. (rāda kļūdu sarakstā). */
  note?: string;
};

export type VinScanV4SmartId = {
  ecsdd: EcsddAutoStatus | null;
  ltab: LtabAutoStatus | null;
  ecsddConfigured: boolean;
  ltabConfigured: boolean;
  /** Servera sesijas Smart-ID kontrolkods, kamēr gaida apstiprinājumu. */
  sessionCode: string;
  starting: boolean;
  hasPlate: boolean;
};

export type VinScanV4Link = { id: string; label: string; href: string };

/** Austrija §57a: ko zina konteiners (pasūtījums) - datums no blokiem, CSDD iepriekšējā valsts, sessionId. */
export type VinScanV4KfzContext = {
  previousCountry?: string;
  firstRegDate?: string;
  orderId?: string;
  listingUrl?: string;
  /** Apskates, kas jau ielasītas Citi avoti «Austrija». */
  listed?: number;
};

/* ---------------- Stils (makets v4: balts, grafīts, #D2D2D7) ---------------- */

const INK = "text-[#1d1d1f]";
const MUTE = "text-[#86868b]";
const RISK = "text-[#b3261e]";
const LAB = "text-[10px] font-semibold uppercase tracking-[0.14em] text-[#86868b] leading-[1.3]";
const PANEL = "min-w-0 rounded-[10px] border border-[#d2d2d7] bg-white px-[18px] pb-1.5 pt-4 max-sm:rounded-[8px] max-sm:px-3 max-sm:pt-3";
const BTN_SM =
  "inline-flex h-[30px] items-center justify-center whitespace-nowrap rounded-[6px] border border-[#d2d2d7] bg-white px-[11px] text-[12.5px] font-semibold text-[#1d1d1f] disabled:opacity-45 max-sm:h-9";
const BTN_SM_DARK =
  "inline-flex h-[30px] items-center justify-center whitespace-nowrap rounded-[6px] border border-[#1d1d1f] bg-[#1d1d1f] px-[11px] text-[12.5px] font-semibold text-white disabled:opacity-45 max-sm:h-9";

export const VIN_SCAN_V4_BTN = BTN_SM;
export const VIN_SCAN_V4_BTN_DARK = BTN_SM_DARK;

function Dot() {
  return <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-px animate-pulse rounded-full bg-[#0061d2] motion-reduce:animate-none" aria-hidden />;
}

export function VinScanV4Panel({
  title,
  count,
  right,
  children,
  className = "",
  ...rest
}: {
  title: string;
  count?: number | null;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
} & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <section className={`${PANEL} ${className}`} {...rest}>
      <div className="mb-0.5 grid gap-[7px]">
        <h3 className={`flex items-baseline gap-2.5 text-[11.5px] font-bold uppercase tracking-[0.1em] ${INK}`}>
          {title}
          {count != null ? <span className={`font-semibold tracking-[0.04em] ${MUTE}`}>{count}</span> : null}
          {right ? <span className={`ml-auto text-[11.5px] font-medium normal-case tracking-normal ${MUTE}`}>{right}</span> : null}
        </h3>
        <div className="relative h-0 border-t border-[#d2d2d7]">
          <span className="absolute -top-px left-0 h-[1.5px] w-[26px] bg-[#0061d2]" aria-hidden />
        </div>
      </div>
      {children}
    </section>
  );
}

/* ---------------- Kopsavilkums ---------------- */

function ieraksti(n: number): string {
  return `${n} ${n % 10 === 1 && n % 100 !== 11 ? "ieraksts" : "ieraksti"}`;
}

function lvDate(sortable: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(sortable);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : sortable;
}

function timeOf(sortable: string): number {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(sortable);
  if (m) return Number(m[1]) + (Number(m[2]) - 1) / 12 + (Number(m[3] ?? 1) - 1) / 365;
  const t = Date.parse(sortable);
  return Number.isFinite(t) ? new Date(t).getFullYear() + new Date(t).getMonth() / 12 : NaN;
}

function MileageChart({ facts }: { facts: AtraFacts }) {
  const pts = facts.mileage.points.filter((p) => Number.isFinite(timeOf(p.date)) && p.km > 0);
  if (pts.length < 2) return null;
  const W = 420;
  const H = 92;
  const L = 34;
  const R = 10;
  const T = 8;
  const B = 18;
  const xs = pts.map((p) => timeOf(p.date));
  const x0 = Math.min(...xs) - 0.3;
  const x1 = Math.max(...xs) + 0.3;
  const yMax = Math.max(...pts.map((p) => p.km)) * 1.08;
  const X = (v: number) => L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (v: number) => T + (1 - v / yMax) * (H - T - B);
  const dropTo = facts.mileage.drop?.to;
  const bad = (p: (typeof pts)[number]) => Boolean(dropTo && p.date === dropTo.date && p.km === dropTo.km);
  const good = pts.filter((p) => !bad(p));
  const years = [...new Set(xs.map((x) => Math.round(x)))].filter((y, i, a) => a.length <= 5 || i % 2 === 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-auto w-full" role="img" aria-label="Nobraukums pēc avotiem">
      {[0, yMax / 2, yMax].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#d2d2d7" strokeWidth={0.7} />
          <text x={L - 5} y={Y(v) + 3} textAnchor="end" fontSize={9.5} fill="#86868b">
            {v ? `${Math.round(v / 1000)}k` : "0"}
          </text>
        </g>
      ))}
      {years.map((y) => (
        <text key={y} x={X(y)} y={H - 4} textAnchor="middle" fontSize={9.5} fill="#86868b">
          {y}
        </text>
      ))}
      {good.length > 1 ? (
        <path
          d={good.map((p, i) => `${i ? "L" : "M"}${X(timeOf(p.date)).toFixed(1)} ${Y(p.km).toFixed(1)}`).join(" ")}
          fill="none"
          stroke="#1d1d1f"
          strokeWidth={1.3}
        />
      ) : null}
      {pts.map((p) => (
        <circle
          key={`${p.date}-${p.km}-${p.source}`}
          cx={X(timeOf(p.date))}
          cy={Y(p.km)}
          r={bad(p) ? 3.4 : 2.6}
          fill={bad(p) ? "#b3261e" : "#fff"}
          stroke={bad(p) ? "#b3261e" : "#1d1d1f"}
          strokeWidth={1.3}
        >
          <title>{`${lvDate(p.date)} · ${formatKmLv(p.km)} km · ${p.source}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function Fact({ k, v, s, risk, sRisk, pending }: { k: string; v: string; s?: string; risk?: boolean; sRisk?: boolean; pending?: boolean }) {
  return (
    <div className="grid min-w-0 content-start gap-[3px] border-b border-[#e8e8ec] py-3 max-sm:py-2.5">
      <p className={LAB}>{k}</p>
      <p className={`text-[16px] font-bold leading-[1.25] tracking-[-0.015em] max-sm:text-[14px] ${risk ? RISK : pending ? `${MUTE} !font-medium` : INK}`}>{v}</p>
      {s ? <p className={`text-[11.5px] leading-[1.4] [overflow-wrap:anywhere] ${sRisk ? RISK : MUTE}`}>{s}</p> : null}
    </div>
  );
}

/** «Nobraukuma ieraksti»: skaits, pēdējie 3, izvēršama pilna tabula (datums · km · starpība · avots). Kritumi sarkanā. */
function MileageFact({ facts }: { facts: AtraFacts }) {
  const [open, setOpen] = useState(false);
  const rows = vinScanV4MileageRows(facts.mileage.points);
  const drop = facts.mileage.drop;
  const diff = (d: number | null) => (d == null ? "" : `${d < 0 ? "-" : "+"}${formatKmLv(Math.abs(d))}`);
  return (
    <div className="col-span-2 grid min-w-0 content-start gap-[3px] border-b border-[#e8e8ec] py-3 max-sm:py-2.5 md:col-span-4 xl:col-span-1" data-v4-mileage>
      <p className={LAB}>Nobraukuma ieraksti</p>
      <p className={`text-[16px] font-bold leading-[1.25] tracking-[-0.015em] max-sm:text-[14px] ${INK}`}>{ieraksti(rows.length)}</p>
      <p className={`text-[11.5px] leading-[1.4] ${drop ? RISK : MUTE}`}>{drop ? `kritums -${formatKmLv(drop.km)} km` : "bez kritumiem"}</p>
      <ul className="m-0 mt-1 list-none p-0 text-[12.5px]">
        {rows.slice(0, 3).map((r) => (
          <li key={`${r.date}-${r.km}-${r.source}`} className={r.drop ? RISK : INK}>
            {r.date} · {formatKmLv(r.km)} km <span className={r.drop ? RISK : MUTE}>· {r.source}</span>
          </li>
        ))}
      </ul>
      {rows.length > 3 ? (
        <button type="button" className={`mt-1 justify-self-start text-[12px] font-semibold text-[#0061d2]`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Paslēpt" : `Visi ${rows.length} rādījumi ›`}
        </button>
      ) : null}
      {open ? (
        <table className="mt-1.5 w-full border-collapse text-[12px]" data-v4-mileage-table>
          <thead>
            <tr className={`${MUTE} text-left`}>
              <th className="py-1 pr-2 font-medium">Datums</th>
              <th className="py-1 pr-2 text-right font-medium">km</th>
              <th className="py-1 pr-2 text-right font-medium">Starpība</th>
              <th className="py-1 font-medium">Avots</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.date}-${r.km}-${r.source}`} className={`border-t border-[#f5f5f7] ${r.drop ? RISK : INK}`}>
                <td className="py-1 pr-2 whitespace-nowrap">{r.date}</td>
                <td className="py-1 pr-2 text-right whitespace-nowrap">{formatKmLv(r.km)}</td>
                <td className={`py-1 pr-2 text-right whitespace-nowrap ${r.diff != null && r.diff < 0 ? RISK : MUTE}`}>{diff(r.diff)}</td>
                <td className="py-1 [overflow-wrap:anywhere]">{[r.source, r.country && r.country !== "LV" ? r.country : ""].filter(Boolean).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

/* ---------------- Avota rinda ---------------- */

function SourceDetail({ row, action }: { row: VinScanV4Row; action?: ReactNode }) {
  const card = buildVinScanResultCard({ ...row, openUrl: row.openUrl ?? "", mileage: row.mileage?.map((m) => ({ ...m, source: m.source ?? "" })) } as Parameters<
    typeof buildVinScanResultCard
  >[0]);
  const kv: [string, string, boolean?][] = [];
  if (card?.vehicle) kv.push(["Auto", [card.vehicle.make, card.vehicle.model, card.vehicle.year].filter(Boolean).join(" ")]);
  if (card?.origin) kv.push(["Valsts", card.origin]);
  for (const m of card?.mileage ?? []) kv.push([`Nobraukums ${m.date}`, m.odometer]);
  for (const i of card?.inspections ?? []) kv.push([`Apskate ${i.date}`, [i.result, i.odometer].filter(Boolean).join(" · ")]);
  for (const i of card?.incidents ?? []) kv.push([`Negadījums${i.date ? ` ${i.date}` : ""}`, i.summary, true]);
  for (const r of card?.recalls ?? []) kv.push([`Atsaukums${r.date ? ` ${r.date}` : ""}`, r.title]);
  for (const l of card?.listings ?? []) kv.push([`Sludinājums ${l.date}`, [l.price, l.odometer].filter(Boolean).join(" · ")]);
  if (card?.finlandLink) kv.push(["Somija", `${card.finlandLink.linked}${card.finlandLink.source ? ` · ${card.finlandLink.source}` : ""}`]);
  const detail = (row.detail ?? "").trim();
  const auctions = card?.auctions ?? [];
  return (
    <div className="grid gap-2.5 pb-3.5 sm:pl-[148px]">
      {kv.length ? (
        <dl className="grid grid-cols-[minmax(8rem,34%)_minmax(0,1fr)] text-[13px] max-sm:grid-cols-[minmax(6.5rem,40%)_minmax(0,1fr)] max-sm:text-[12.5px]">
          {kv.map(([k, v, bad], i) => (
            <div key={`${k}-${i}`} className="contents">
              <dt className={`border-t border-[#f5f5f7] py-[5px] pr-3 ${MUTE}`}>{k}</dt>
              <dd className={`min-w-0 border-t border-[#f5f5f7] py-[5px] [overflow-wrap:anywhere] ${bad ? `${RISK} font-semibold` : ""}`}>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {auctions.map((a, i) => (
        <div key={`${a.date}-${a.lot}-${i}`} className="grid gap-1.5">
          <dl className="grid grid-cols-[minmax(8rem,34%)_minmax(0,1fr)] text-[13px] max-sm:text-[12.5px]">
            {(
              [
                ["Izsole", [a.date, a.venue, a.title].filter(Boolean).join(" · ")],
                ["Cena", a.price ?? ""],
                ["Nobraukums", a.odometer ?? ""],
                ["Lots", a.lot ?? ""],
                ["Bojājums", a.damage ?? ""],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className={`border-t border-[#f5f5f7] py-[5px] pr-3 ${MUTE}`}>{k}</dt>
                  <dd className="min-w-0 border-t border-[#f5f5f7] py-[5px] [overflow-wrap:anywhere]">{v}</dd>
                </div>
              ))}
          </dl>
          <AuctionPhotos urls={a.photoUrls?.length ? a.photoUrls : a.photoUrl ? [a.photoUrl] : []} total={a.photoCount ?? 0} date={a.date ?? ""} />
        </div>
      ))}
      {!auctions.length && card?.photoUrl ? <AuctionPhotos urls={[card.photoUrl]} total={card.photoCount} date="" /> : null}
      {detail ? <p className="whitespace-pre-line break-words text-[12.5px] text-[#424245]">{detail}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        {row.openUrl ? (
          <a href={row.openUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-[#0061d2]">
            Atvērt avotu ↗
          </a>
        ) : null}
        {action}
      </div>
    </div>
  );
}

function AuctionPhotos({ urls, total, date }: { urls: string[]; total: number; date: string }) {
  const shown = urls.filter((u) => /^https?:\/\//i.test(u)).slice(0, 5);
  if (!shown.length) return null;
  const more = Math.max(total, urls.length) - shown.length;
  return (
    <div>
      <p className={`${LAB} mb-1`}>Izsoļu arhīvs · {Math.max(total, urls.length)} foto{date ? ` · ${date}` : ""}</p>
      <div className="grid grid-cols-6 gap-1 max-sm:grid-cols-4">
        {shown.map((u, i) => (
          <a
            key={u}
            href={u}
            target="_blank"
            rel="noopener noreferrer"
            className={`relative block aspect-[4/3] overflow-hidden bg-[#f5f5f7] ${i >= 3 ? "max-sm:hidden" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
            {date ? <span className="absolute bottom-0 left-0 bg-white/80 px-1 text-[9.5px] text-[#424245]">{date}</span> : null}
          </a>
        ))}
        {more > 0 ? (
          <span className="flex aspect-[4/3] items-center justify-center bg-[#f5f5f7] text-[12px] font-semibold text-[#1d1d1f]">+{more}</span>
        ) : null}
      </div>
    </div>
  );
}

function SourceRow({
  row,
  open,
  onToggle,
  action,
  at,
}: {
  row: VinScanV4Row;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
  at: string;
}) {
  return (
    <div className="border-b border-[#d2d2d7] last:border-b-0" data-v4-source={row.id}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="grid min-h-12 w-full grid-cols-[132px_minmax(0,1fr)_auto_14px] items-center gap-x-4 gap-y-1 py-3 text-left max-sm:grid-cols-[minmax(0,1fr)_auto_12px] max-sm:gap-x-2.5 max-sm:gap-y-0.5 max-sm:py-[9px]"
      >
        <span className={`min-w-0 truncate text-[13px] font-[650] tracking-[-0.01em] ${INK}`}>{row.label}</span>
        <span className={`min-w-0 text-[13px] font-medium [overflow-wrap:anywhere] ${INK} max-sm:col-span-3 max-sm:row-start-2 max-sm:text-[12.5px]`}>
          {row.summary}
        </span>
        <span className={`whitespace-nowrap text-[11.5px] ${MUTE} max-sm:col-start-2 max-sm:row-start-1`}>{at}</span>
        <span className={`text-[15px] leading-none ${MUTE} transition-transform motion-reduce:transition-none max-sm:col-start-3 max-sm:row-start-1 ${open ? "rotate-90" : ""}`} aria-hidden>
          ›
        </span>
      </button>
      {open ? <SourceDetail row={row} action={action} /> : null}
    </div>
  );
}

function shortAt(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------------- CSDD / LTAB soļi ---------------- */

function Step({
  no,
  name,
  kf,
  right,
  open,
  onToggle,
  children,
  testId,
}: {
  no: number | null;
  name: string;
  kf: ReactNode;
  right?: ReactNode;
  open?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
  testId: string;
}) {
  const head = (
    <>
      <span className="grid gap-0.5">
        {no != null ? <span className={LAB}>{no}. solis</span> : null}
        <b className={`text-[13.5px] font-bold tracking-[-0.01em] ${INK}`}>{name}</b>
      </span>
      <span className="min-w-0 text-[13px] font-medium max-sm:col-span-3 max-sm:row-start-2 max-sm:text-[12.5px]">{kf}</span>
      <span className={`flex items-center gap-2.5 whitespace-nowrap text-[11.5px] ${MUTE} max-sm:col-start-2 max-sm:row-start-1`}>{right}</span>
    </>
  );
  const grid =
    "grid min-h-[52px] w-full items-center gap-x-4 gap-y-1 py-3 text-left max-sm:gap-x-2.5 max-sm:gap-y-[3px]";
  return (
    <div className="border-b border-[#e8e8ec] last:border-b-0" data-v4-step={testId}>
      {onToggle ? (
        <button
          type="button"
          aria-expanded={Boolean(open)}
          onClick={onToggle}
          className={`${grid} grid-cols-[132px_minmax(0,1fr)_auto_14px] max-sm:grid-cols-[minmax(0,1fr)_auto_12px]`}
        >
          {head}
          <span className={`text-[15px] ${MUTE} transition-transform motion-reduce:transition-none max-sm:col-start-3 max-sm:row-start-1 ${open ? "rotate-90" : ""}`} aria-hidden>
            ›
          </span>
        </button>
      ) : (
        <div className={`${grid} grid-cols-[132px_minmax(0,1fr)_auto] max-sm:grid-cols-[minmax(0,1fr)_auto]`}>{head}</div>
      )}
      {open && children ? <div className="grid gap-2.5 pb-3.5 sm:pl-[148px]">{children}</div> : null}
    </div>
  );
}

function SmartIdCode({ code, where }: { code: string; where: string }) {
  return (
    <span className="flex items-center gap-3.5" data-v4-smartid-code>
      <span className={`text-[24px] font-extrabold leading-none tracking-[0.1em] ${INK}`}>{code}</span>
      <span className={`text-[12.5px] font-medium ${INK}`}>
        Apstiprini Smart-ID telefonā
        <span className={`block text-[11.5px] font-normal ${MUTE}`}>servera sesija · {where} · automātiski</span>
      </span>
    </span>
  );
}

function ecsddView(s: VinScanV4SmartId | null, busy: boolean): { kf: ReactNode; done: boolean; error: boolean } {
  if (!s) return { kf: <span className={MUTE}>{busy ? "lasa…" : "nav palaists"}</span>, done: false, error: false };
  const e = s.ecsdd;
  const code = (e?.state === "awaiting_smartid" && e.verificationCode) || s.sessionCode;
  if (code && (!e || e.state === "awaiting_smartid" || e.state === "awaiting_login" || e.state === "queued")) {
    return { kf: <SmartIdCode code={code} where="e.csdd.lv" />, done: false, error: false };
  }
  if (!s.ecsddConfigured) return { kf: <span className={RISK}>e.csdd relejs nav pieslēgts</span>, done: false, error: true };
  if (!e) return { kf: <span className={MUTE}>{s.starting || busy ? "lasa…" : "nav palaists"}</span>, done: false, error: false };
  if (e.state === "found") return { kf: "Dati ielasīti", done: true, error: false };
  if (e.state === "not_found") return { kf: <span className={RISK}>e.csdd ieraksta nav</span>, done: true, error: false };
  if (e.state === "error") return { kf: <span className={RISK}>{e.message || "Kļūda"}</span>, done: false, error: true };
  if (e.state === "skipped" || e.state === "not_configured") return { kf: <span className={MUTE}>{e.message || "izlaists"}</span>, done: false, error: false };
  return {
    kf: (
      <span className={MUTE}>
        <Dot />
        {e.message || "lasa…"}
      </span>
    ),
    done: false,
    error: false,
  };
}

function ltabView(
  s: VinScanV4SmartId | null,
  busy: boolean,
  contradiction: string | null = null,
): { kf: ReactNode; done: boolean; error: boolean } {
  if (!s) return { kf: <span className={MUTE}>{busy ? "lasa…" : "nav palaists"}</span>, done: false, error: false };
  const l = s.ltab;
  // CSDD saka «reģistrēts LV» - «nav reģistrēts Latvijā» nedrīkst rādīt (26.11); piedāvā atkārtot.
  if (contradiction && l && (l.state === "skipped" || l.state === "not_configured")) {
    return { kf: <span className={RISK}>{contradiction}</span>, done: false, error: true };
  }
  if (!s.hasPlate && !l) return { kf: <span className={RISK}>Nav LV numura - LTAB nav datu</span>, done: false, error: false };
  if (l?.state === "awaiting_smartid" && l.verificationCode) {
    return { kf: <SmartIdCode code={l.verificationCode} where="LTAB" />, done: false, error: false };
  }
  if (!s.ltabConfigured) return { kf: <span className={RISK}>LTAB relejs nav pieslēgts</span>, done: false, error: true };
  if (!l) return { kf: <span className={MUTE}>{s.starting || busy ? "lasa…" : "nav palaists"}</span>, done: false, error: false };
  if (l.state === "no_claims") return { kf: "Negadījumi nav reģistrēti", done: true, error: false };
  if (l.state === "claims") return { kf: <span className={`${RISK} font-semibold`}>{l.message || "Ir OCTA gadījumi"}</span>, done: true, error: false };
  if (l.state === "error") return { kf: <span className={RISK}>{l.message || "Kļūda"}</span>, done: false, error: true };
  if (l.state === "skipped" || l.state === "not_configured") return { kf: <span className={RISK}>{l.message || "Nav datu"}</span>, done: false, error: false };
  return {
    kf: (
      <span className={MUTE}>
        <Dot />
        {l.message || "lasa…"}
      </span>
    ),
    done: false,
    error: false,
  };
}

function rawLines(text: string, max = 40): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max);
}

/* ---------------- Galvenā komponente ---------------- */

/**
 * VIN SCAN v4 (Nila makets v4): viena komponente visās VIN SCAN vietās.
 * Telefonā - variants A (viena kolonna), datorā (xl) - variants B (kreisā kolonna kopsavilkums, labā avoti).
 * Komponente tikai zīmē: skenēšanu, Smart-ID un maksas darbības dod konteiners (sloti un atzvani).
 */
export function AdminVinScanV4({
  vin,
  plate = "",
  title = "",
  spec = "",
  rows,
  busy,
  scannedAt,
  csdd = null,
  csddMessage = "",
  smartId = null,
  onSmartIdRetry,
  smsStep,
  paidServices,
  rowAction,
  onRetry,
  links = [],
  toolbar,
  extraFlags,
  progressLead,
  hasListing = false,
  kfz,
}: {
  vin: string;
  plate?: string;
  title?: string;
  /** «2019 · 3,0 V6 TDI · 170 kW · dīzelis». */
  spec?: string;
  rows: readonly VinScanV4Row[];
  busy: boolean;
  scannedAt: string;
  /** CSDD API (1. solis). */
  csdd?: CsddTechData | null;
  csddMessage?: string;
  /** e.csdd + LTAB caur Smart-ID (2. solis un LTAB bloks). `null` - nerāda (piem. darbiniekam bez admina). */
  smartId?: VinScanV4SmartId | null;
  onSmartIdRetry?: () => void;
  /** 3. solis: CSDD maksas SMS izziņa (poga ar summu un apstiprinājumu). */
  smsStep?: ReactNode;
  /** 6. bloks: maksas pakalpojumi ar summu un apstiprinājumu. */
  paidServices?: ReactNode;
  /** Papildu poga avota detaļās (piem. pasūtījumā «Ielikt AUCTION»). */
  rowAction?: (row: VinScanV4Row) => ReactNode;
  /** «Atkārtot» kļūdu sarakstā (viens avots). */
  onRetry?: (ids: string[]) => void;
  links?: readonly VinScanV4Link[];
  /** Pogas virs rezultātiem (Kopēt, JSON, Skenēt no jauna u.c.). */
  toolbar?: ReactNode;
  extraFlags?: readonly VinScanV4Flag[];
  /** «VIN atrasts CSDD pēc NK-7310». */
  progressLead?: ReactNode;
  hasListing?: boolean;
  /** Austrija §57a (kfzgutachten.at): pasūtījuma dati datumam un Tampermonkey tiltam. */
  kfz?: VinScanV4KfzContext;
}) {
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [emptyOpen, setEmptyOpen] = useState(false);
  const toggle = (id: string) => setOpenIds((cur) => ({ ...cur, [id]: !cur[id] }));
  const layout = useMemo(() => buildVinScanV4Layout(rows), [rows]);
  const kfzState = useMemo(
    () =>
      rows.some((r) => r.id === VIN_SCAN_V4_KFZ_ID) || kfz
        ? kfzAtViewState({
            vin,
            rows,
            previousCountry: kfz?.previousCountry,
            listingUrl: kfz?.listingUrl,
            firstRegDate: kfz?.firstRegDate,
            csddFirstRegIso: csdd?.firstRegistrationIso,
            orderId: kfz?.orderId,
            listed: kfz?.listed,
          })
        : null,
    [vin, rows, kfz, csdd],
  );
  const ecsddRaw = smartId?.ecsdd?.state === "found" ? (smartId.ecsdd.rawText ?? "") : "";
  const ecsddFacts = useMemo<VinScanEcsddFacts | null>(() => buildEcsddFacts(ecsddRaw), [ecsddRaw]);
  // e.csdd (2. solis) ir tāds pats avots kā VIN SCAN rindas: nobraukums, apskates, CSNg (26.11).
  const factRows = useMemo(() => (ecsddFacts ? [...rows.filter((r) => r.id !== ECSDD_FACT_ROW_ID), ecsddFacts.row] : rows), [rows, ecsddFacts]);
  const facts = useMemo(
    () =>
      factRows.some((r) => r.status === "found") || csdd
        ? buildAtraFacts({ vin, plate, title, year: csdd?.year ?? "", rows: factRows, dealer: null, csdd, hasListing })
        : null,
    [vin, plate, title, factRows, csdd, hasListing],
  );
  const flags = useMemo(() => {
    const extra = [...(extraFlags ?? [])];
    const ta = ecsddFacts?.inspections[0];
    for (const d of ta?.defects ?? []) {
      extra.push({
        text: `TA defekts${d.rating ? ` (${d.rating})` : ""}: ${d.description}`,
        source: ["e.csdd", ta?.date ? `TA ${ta.date}` : "", d.code].filter(Boolean).join(" · "),
      });
    }
    if (smartId?.ltab?.state === "claims") extra.push({ text: "OCTA atlīdzība (LTAB)", source: smartId.ltab.message || "LTAB" });
    return buildVinScanV4Attention(facts, extra);
  }, [facts, extraFlags, smartId, ecsddFacts]);
  const done = !busy;
  const at = shortAt(scannedAt);
  const statusLine = vinScanV4StatusLine(layout, busy);
  const progress = layout.counted ? Math.round((layout.done / layout.counted) * 100) : 0;
  const pendingNames = layout.pending.slice(0, 2).map((r) => r.label);
  const smartIdWait = Boolean(smartId && (smartId.sessionCode || smartId.ecsdd?.state === "awaiting_smartid" || smartId.ltab?.state === "awaiting_smartid"));

  // «lasa…» beidzas, kad visi avoti atbildējuši, arī ja kāds fona pieprasījums vēl nav aizvērts (26.11).
  const settled = done || (layout.counted > 0 && layout.pending.length === 0);

  if (!rows.length && !busy && !csdd) return null;

  /* --- kopsavilkums --- */
  const m = facts?.mileage;
  const last = m?.last ?? null;
  const vehicleTitle = title || [csdd?.make, csdd?.model].filter(Boolean).join(" ");
  const nf = (k: string) => (settled ? <Fact k={k} v="Nav datu" risk /> : <Fact k={k} v="lasa…" pending />);
  const ltabState = smartId?.ltab?.state;
  const inspectionUntil = facts?.inspection.until || (ecsddFacts?.nextInspectionIso ? ecsddIsoToLvDate(ecsddFacts.nextInspectionIso) : "");
  const inspectionLine = ecsddInspectionLine(ecsddFacts);
  const theftRows = rows.filter((r) => ["nicb", "cz_patrani", "ca_cpic"].includes(r.id) && (r.status === "found" || r.status === "none"));
  const factsGrid = (
    <>
      {facts && m && m.points.length ? <MileageFact facts={facts} /> : nf("Nobraukuma ieraksti")}
      {facts && !facts.incidents.count && ltabState !== "claims" && (ecsddFacts?.csng.checked || ltabState === "no_claims") ? (
        <Fact
          k="Negadījumi / bojājumi"
          v="Nav reģistrēti"
          s={[ecsddFacts?.csng.checked ? "e.csdd CSNg" : "", ltabState === "no_claims" ? "LTAB 0" : ""].filter(Boolean).join(" · ")}
        />
      ) : facts && (facts.incidents.count || ltabState === "claims" || ltabState === "no_claims") ? (
        <Fact
          k="Negadījumi / bojājumi"
          v={ieraksti(facts.incidents.count + (smartId?.ltab?.state === "claims" ? 1 : 0))}
          s={[...facts.incidents.sources, smartId?.ltab?.state === "claims" ? "LTAB" : smartId?.ltab?.state === "no_claims" ? "LTAB 0" : ""]
            .filter(Boolean)
            .join(" · ")}
          risk={facts.incidents.count > 0 || smartId?.ltab?.state === "claims"}
        />
      ) : (
        nf("Negadījumi / bojājumi")
      )}
      {facts?.countries.length ? <Fact k="Valstis" v={facts.countries.join(" · ")} /> : nf("Valstis")}
      {facts && (inspectionUntil || facts.inspection.last) ? (
        <Fact
          k="Tehniskā apskate"
          v={inspectionUntil ? `līdz ${inspectionUntil}` : facts.inspection.last}
          s={[
            inspectionLine || (inspectionUntil ? facts.inspection.last : ""),
            [...new Set([...facts.inspection.sources, ...(ecsddFacts?.nextInspectionIso ? ["e.csdd"] : [])])].join(" · "),
          ]
            .filter(Boolean)
            .join(" · ")}
          sRisk={Boolean(ecsddFacts?.inspections[0]?.defects.some((d) => Number.parseInt(d.rating, 10) >= 2))}
        />
      ) : (
        nf("Tehniskā apskate")
      )}
      {ecsddFacts?.ownerCount ? (
        <Fact k="Īpašnieki" v={ecsddFacts.ownerCount} s="Latvijā · e.csdd" />
      ) : (
        <Fact k="Īpašnieki" v={settled ? "Nav datu" : "lasa…"} s="CSDD maksas izziņa (3. solis)" risk={settled} pending={!settled} />
      )}
      {facts?.wanted.length ? (
        <Fact k="Zādzība" v="Meklēšanā" s={facts.wanted.join(" · ")} risk />
      ) : theftRows.length ? (
        <Fact k="Zādzība" v="Nav meklēšanā" s={theftRows.map((r) => r.label).join(" · ")} />
      ) : (
        nf("Zādzība")
      )}
      {facts?.auctions.count ? (
        <Fact
          k="Izsoles"
          v={`${facts.auctions.count} ${facts.auctions.count === 1 ? "izsole" : "izsoles"}${facts.auctions.photoCount ? ` · ${facts.auctions.photoCount} foto` : ""}`}
          s={[facts.auctions.years.join(", "), facts.auctions.venues.join(" · ")].filter(Boolean).join(" · ")}
        />
      ) : (
        nf("Izsoles")
      )}
      {facts?.recalls.count ? (
        <Fact k="Atsaukumi" v={`${facts.recalls.count} atrasti`} s={facts.recalls.items.slice(0, 2).join(" · ")} risk />
      ) : (
        nf("Atsaukumi")
      )}
    </>
  );

  const hero = (
    <section className={`${PANEL} !pb-4 max-sm:!pb-3`} data-v4-hero>
      <div className="grid grid-cols-1 items-start gap-[18px] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-8 xl:grid-cols-1 xl:gap-[22px]">
        <div>
          <p className={LAB}>Transportlīdzeklis</p>
          <p className={`mt-1.5 text-[30px] font-extrabold leading-[1.04] tracking-[-0.035em] max-sm:text-[24px] ${vehicleTitle ? INK : "text-[#d2d2d7]"}`}>
            {vehicleTitle || (busy ? "Atpazīst…" : "Auto")}
          </p>
          {vin ? (
            <p className="mt-2.5 text-[12px] font-semibold tracking-[0.14em] [overflow-wrap:anywhere]">
              <b className="mr-2 font-extrabold tracking-normal text-[#0061d2]">VIN</b>
              {vin}
              {plate ? <span className={`ml-3 ${MUTE}`}>{plate}</span> : null}
            </p>
          ) : null}
          {spec ? <p className={`mt-2 text-[12.5px] ${MUTE}`}>{spec}</p> : null}
        </div>
        <div>
          <p className={LAB}>Pēdējais odometra rādījums</p>
          {last && vinScanV4LastOdometerLine(last) ? (
            <>
              <p className={`mt-1.5 whitespace-nowrap text-[40px] font-extrabold leading-none tracking-[-0.035em] max-sm:text-[32px] ${INK}`}>
                {formatKmLv(last.km)}
                <small className={`ml-1 text-[0.42em] font-medium tracking-normal ${MUTE}`}>km</small>
              </p>
              <p className={`mt-1.5 text-[12px] ${MUTE}`} data-v4-last-odometer>
                {lvDate(last.date)} · {last.source} · {ieraksti(m?.points.length ?? 0)}
              </p>
              {facts ? <MileageChart facts={facts} /> : null}
            </>
          ) : (
            <p className="mt-1.5 text-[22px] font-extrabold leading-none max-sm:text-[20px]">
              {settled ? <span className={RISK}>nav datu</span> : <span className={`${MUTE} font-medium`}>lasa…</span>}
            </p>
          )}
        </div>
      </div>
    </section>
  );

  const summary = (
    <>
      {hero}
      <VinScanV4Panel title="Galvenā informācija" data-v4-block="galvena">
        <div className="mb-1.5 grid grid-cols-2 gap-x-4 md:grid-cols-4 md:gap-x-6 xl:grid-cols-1">{factsGrid}</div>
      </VinScanV4Panel>
      {flags.length ? (
        <VinScanV4Panel title="Uzmanību" count={flags.length} data-v4-block="uzmanibu">
          <ul className="m-0 list-none p-0">
            {flags.map((f) => (
              <li
                key={`${f.text}-${f.source}`}
                className="grid grid-cols-[10px_minmax(0,1fr)] items-baseline gap-x-2.5 gap-y-1 border-b border-[#d2d2d7] py-2 text-[13.5px] last:border-b-0"
              >
                <span className="h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-[#b3261e]" aria-hidden />
                <span className="font-semibold">{f.text}</span>
                {f.source ? <em className={`col-start-2 text-[12px] not-italic ${MUTE}`}>{f.source}</em> : null}
              </li>
            ))}
          </ul>
        </VinScanV4Panel>
      ) : null}
    </>
  );

  /* --- CSDD 3 soļi --- */
  const csddRow = layout.csdd;
  const csddKf = csdd
    ? [
        csdd.registrationNumber,
        csdd.inspectionValidUntilIso ? `TA līdz ${lvDate(csdd.inspectionValidUntilIso.slice(0, 10))}` : "",
        csdd.insuranceEndIso ? `OCTA līdz ${lvDate(csdd.insuranceEndIso.slice(0, 10))}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : csddRow?.summary ?? "";
  const ev = ecsddView(smartId, busy);
  const ltabContradiction = vinScanV4LtabContradiction(smartId?.ltab?.message, {
    apiPlate: csdd?.registrationNumber,
    ecsddRegistered: ecsddFacts?.registeredLv,
    ecsddPlate: ecsddFacts?.plate,
  });
  const lv = ltabView(smartId, busy, ltabContradiction);
  const ecsddText = smartId?.ecsdd?.state === "found" ? rawLines(smartId.ecsdd.rawText ?? "") : [];
  const ltabCert = smartId?.ltab?.certificate;
  const csddBlock = (
    <VinScanV4Panel title="CSDD" data-v4-block="csdd">
      <Step
        no={1}
        name="CSDD API"
        testId="csdd-api"
        kf={csddKf || (busy ? <span className={MUTE}>lasa…</span> : <span className={RISK}>{csddMessage || "Nav datu"}</span>)}
        right={csddKf ? at : ""}
        open={Boolean(openIds.__csdd)}
        onToggle={csdd || csddRow ? () => toggle("__csdd") : undefined}
      >
        {csdd ? (
          <dl className="grid grid-cols-[minmax(8rem,34%)_minmax(0,1fr)] text-[13px]">
            {(
              [
                ["Numurs", csdd.registrationNumber],
                ["Marka, modelis", [csdd.make, csdd.model].filter(Boolean).join(" ")],
                ["Gads", csdd.year],
                ["Pirmā reģ.", csdd.firstRegistrationIso ? lvDate(csdd.firstRegistrationIso.slice(0, 10)) : ""],
                ["Dzinējs", [csdd.displacementCm3 ? `${csdd.displacementCm3} cm³` : "", csdd.powerKw ? `${csdd.powerKw} kW` : "", csdd.fuel].filter(Boolean).join(" · ")],
                ["Krāsa", csdd.color],
                ["Tehniskā apskate", csdd.inspectionValidUntilIso ? `līdz ${lvDate(csdd.inspectionValidUntilIso.slice(0, 10))}` : ""],
                ["OCTA", csdd.insuranceEndIso ? `līdz ${lvDate(csdd.insuranceEndIso.slice(0, 10))}` : ""],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className={`border-t border-[#f5f5f7] py-[5px] pr-3 ${MUTE}`}>{k}</dt>
                  <dd className="min-w-0 border-t border-[#f5f5f7] py-[5px]">{v}</dd>
                </div>
              ))}
          </dl>
        ) : null}
        {csddRow ? <SourceDetail row={csddRow} action={rowAction?.(csddRow)} /> : null}
      </Step>
      {smartId ? (
        <Step
          no={2}
          name="e.csdd.lv · Smart-ID"
          testId="ecsdd"
          kf={ev.kf}
          right={
            ev.error && onSmartIdRetry ? (
              <button type="button" className={BTN_SM} onClick={onSmartIdRetry}>
                Atkārtot
              </button>
            ) : ev.done ? (
              shortAt(smartId.ecsdd?.checkedAt ?? smartId.ecsdd?.updatedAt ?? "")
            ) : null
          }
          open={Boolean(openIds.__ecsdd)}
          onToggle={ecsddText.length ? () => toggle("__ecsdd") : undefined}
        >
          <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-words font-[inherit] text-[12.5px] text-[#424245]">{ecsddText.join("\n")}</pre>
        </Step>
      ) : null}
      {smsStep ? (
        <Step no={3} name="CSDD izziņa · SMS" testId="csdd-sms" kf={smsStep} />
      ) : null}
    </VinScanV4Panel>
  );

  const ltabBlock = smartId ? (
    <VinScanV4Panel title="LTAB" data-v4-block="ltab">
      <Step
        no={null}
        name="LTAB OCTA"
        testId="ltab"
        kf={lv.kf}
        right={
          lv.error && onSmartIdRetry ? (
            <button type="button" className={BTN_SM} onClick={onSmartIdRetry}>
              Atkārtot
            </button>
          ) : lv.done ? (
            shortAt(smartId.ltab?.checkedAt ?? smartId.ltab?.updatedAt ?? "")
          ) : null
        }
        open={Boolean(openIds.__ltab)}
        onToggle={ltabCert ? () => toggle("__ltab") : undefined}
      >
        {ltabCert ? (
          <dl className="grid grid-cols-[minmax(8rem,34%)_minmax(0,1fr)] text-[13px]">
            {(
              [
                ["Numurs", ltabCert.plate],
                ["Auto", [ltabCert.makeModel, ltabCert.year].filter(Boolean).join(" · ")],
                ["Negadījumi", ltabCert.accidentCount],
                ["Apdrošināts", [ltabCert.insuredFrom, ltabCert.insuredTo].filter(Boolean).join(" - ")],
                ["Izziņa", ltabCert.issuedAt],
                ...ltabCert.claims.map((c, i) => [`Gadījums ${i + 1}`, [c.date, c.status].filter(Boolean).join(" · ")] as const),
              ] as const
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className={`border-t border-[#f5f5f7] py-[5px] pr-3 ${MUTE}`}>{k}</dt>
                  <dd className="min-w-0 border-t border-[#f5f5f7] py-[5px]">{v}</dd>
                </div>
              ))}
          </dl>
        ) : null}
        {smartId.ltab?.mismatch ? <p className={`text-[12.5px] ${RISK}`}>{smartId.ltab.mismatch}</p> : null}
      </Step>
    </VinScanV4Panel>
  ) : null;

  /* --- avotu bloki Nila secībā --- */
  const group = (id: string) => layout.groups.find((g) => g.id === id);
  const renderGroup = (id: string) => {
    const g = group(id);
    if (!g) return null;
    return (
      <VinScanV4Panel key={g.id} title={g.label} count={g.items.length} data-v4-block={g.id}>
        <div className="grid">
          {g.items.map((row) => (
            <SourceRow
              key={row.id}
              row={row}
              open={Boolean(openIds[row.id])}
              onToggle={() => toggle(row.id)}
              action={rowAction?.(row)}
              at={shortAt(row.scannedAt ?? scannedAt)}
            />
          ))}
        </div>
      </VinScanV4Panel>
    );
  };

  // Austrijas auto: kfz_at rinda saraksta augšā (sarkana), arī aizvērtā sarakstā redzama zem virsraksta.
  const kfzRisk = Boolean(kfzState?.risk);
  const emptyList = [...layout.errors, ...layout.empty].sort(
    (a, b) => Number(kfzRisk && b.id === VIN_SCAN_V4_KFZ_ID) - Number(kfzRisk && a.id === VIN_SCAN_V4_KFZ_ID),
  );
  const empties =
    emptyList.length || links.length || layout.links.length || kfzRisk ? (
      <div className="rounded-[10px] border border-[#d2d2d7] bg-white px-[18px] max-sm:rounded-[8px] max-sm:px-3" data-v4-block="tuksi">
        <button
          type="button"
          aria-expanded={emptyOpen}
          onClick={() => setEmptyOpen((o) => !o)}
          className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_14px] items-center py-3 text-left text-[13px] font-medium text-[#424245]"
        >
          <span>
            Tukši <b className={INK}>{layout.empty.length}</b>
            {layout.errors.length ? (
              <>
                {" · "}
                <span className={RISK}>kļūdas {layout.errors.length}</span>
              </>
            ) : null}
            {links.length + layout.links.length ? (
              <>
                {" · saites pārlūkā "}
                <b className={INK}>{links.length + layout.links.length}</b>
              </>
            ) : null}
          </span>
          <span className={`text-[15px] ${MUTE} transition-transform motion-reduce:transition-none ${emptyOpen ? "rotate-90" : ""}`} aria-hidden>
            ›
          </span>
        </button>
        {kfzRisk && kfzState && !emptyOpen ? (
          <p className={`-mt-1 min-w-0 break-words pb-3 text-[12px] leading-[1.4] ${RISK}`} data-v4-kfz-alert>
            Austrija · §57a apskates: {kfzState.status} ({kfzState.signals.join(", ")}) ·{" "}
            <a
              href={kfzState.url}
              target="_blank"
              rel="noopener noreferrer"
              data-provin-handoff-vin={vin || undefined}
              className="font-medium underline decoration-[#d2d2d7] underline-offset-[3px]"
            >
              Atvērt sarakstu
            </a>
          </p>
        ) : null}
        {emptyOpen ? (
          <div className="grid pb-2.5">
            {emptyList.map((r) => {
              const kfzRow = r.id === VIN_SCAN_V4_KFZ_ID && kfzState;
              const n = kfzRow
                ? { status: kfzState.status, detail: kfzState.detail, error: false, risk: kfzState.risk }
                : vinScanV4Notice(r);
              const href = kfzRow ? kfzState.url : n.error || /saitē/.test(n.detail) ? r.openUrl : "";
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-t border-[#f5f5f7] py-1.5 text-[12.5px]"
                  data-v4-empty={r.id}
                >
                  <span className={`min-w-0 truncate ${INK}`} title={r.label}>
                    {r.label}
                  </span>
                  <span className={`shrink-0 whitespace-nowrap text-right ${n.risk ? RISK : MUTE}`}>{n.status}</span>
                  {n.detail || href || (n.error && onRetry) ? (
                    <span
                      className={`col-span-2 min-w-0 break-words text-[11.5px] leading-[1.4] ${n.risk ? RISK : MUTE}`}
                      data-v4-empty-detail
                    >
                      {n.detail}
                      {href ? (
                        <>
                          {n.detail ? " · " : null}
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-provin-handoff-vin={vin || undefined}
                            className="font-medium underline decoration-[#d2d2d7] underline-offset-[3px]"
                          >
                            {kfzRow ? "Atvērt sarakstu" : "Atvērt"}
                          </a>
                        </>
                      ) : null}
                      {n.error && onRetry ? (
                        <>
                          {n.detail || href ? " · " : null}
                          <button
                            type="button"
                            className={`border-0 bg-transparent p-0 text-[11.5px] font-medium underline decoration-[#d2d2d7] underline-offset-[3px] ${RISK}`}
                            onClick={() => onRetry([r.id])}
                            disabled={busy}
                          >
                            Atkārtot
                          </button>
                        </>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              );
            })}
            {links.length || layout.links.length ? (
              <div className="flex flex-wrap gap-x-3.5 gap-y-1 pt-2 text-[12.5px]">
                {[
                  ...links,
                  ...layout.links.map((r) => ({ id: r.id, label: r.label, href: r.openUrl ?? "" })),
                ]
                  .filter((l, i, a) => l.href && a.findIndex((x) => x.href === l.href) === i)
                  .map((l) => (
                    <a
                      key={l.id}
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-provin-handoff-vin={vin || undefined}
                      className="border-b border-[#d2d2d7] text-[#424245] no-underline"
                    >
                      {l.label}
                      <span className={`text-[10.5px] ${MUTE}`}> ↗</span>
                    </a>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : null;

  const progressBar = (
    <div className="grid gap-2" data-v4-progress>
      <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12px] ${MUTE}`}>
        {progressLead ? <span>{progressLead}</span> : null}
        <span className="ml-auto">
          {busy ? <Dot /> : null}
          {smartIdWait && busy ? "gaida Smart-ID · " : ""}
          {statusLine ? <b className={`font-semibold ${INK}`}>{statusLine}</b> : null}
          {busy && pendingNames.length ? ` · ${pendingNames.join(", ")}` : ""}
          {!busy && scannedAt ? ` · ${formatVinScanScannedAt(scannedAt)}` : ""}
        </span>
      </div>
      <div className="relative h-px bg-[#d2d2d7]">
        {busy ? <i className="absolute -top-px left-0 h-0.5 bg-[#0061d2] transition-[width] duration-300" style={{ width: `${progress}%` }} /> : null}
      </div>
    </div>
  );

  return (
    <div className="grid min-w-0 gap-4 rounded-[10px] bg-[#f2f2f4] p-4 text-[14px] leading-[1.5] text-[#1d1d1f] [font-variant-numeric:tabular-nums] max-sm:gap-3 max-sm:rounded-none max-sm:p-2.5" data-vin-scan-v4>
      {progressBar}
      {toolbar ? <div className="flex flex-wrap items-center justify-end gap-2">{toolbar}</div> : null}
      <div className="grid min-w-0 items-start gap-4 max-sm:gap-3 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* 1. Galvenā informācija + «Uzmanību» (B: kreisā kolonna) */}
        <div className="grid min-w-0 gap-4 max-sm:gap-3">{summary}</div>
        <div className="grid min-w-0 gap-4 max-sm:gap-3">
          {/* 2. CSDD 3 soļos */}
          {csddBlock}
          {/* 3. LTAB */}
          {ltabBlock}
          {/* 4. Izsoles, 5. ārvalstu reģistri */}
          {renderGroup("izsoles")}
          {renderGroup("arvalstu")}
          {/* 6. Maksas pakalpojumi */}
          {paidServices}
          {/* 7. Maksas atskaišu priekšskatījumi, 8. viss pārējais, 9. atsaukumi */}
          {renderGroup("prieksskati")}
          {renderGroup("citi")}
          {renderGroup("atsaukumi")}
          {empties}
        </div>
      </div>
    </div>
  );
}
