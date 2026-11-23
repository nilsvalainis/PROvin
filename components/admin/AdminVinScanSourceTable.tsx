"use client";

import { useState, type ReactNode } from "react";
import { atraFreeGroups } from "@/lib/atra-parbaude";
import type { VinScanStatus } from "@/lib/vin-scan/types";
import { isVinScanWantedSource } from "@/lib/vin-scan/wanted";

export type SourceTableStatus = VinScanStatus | "idle" | "checking";

export type SourceTableItem = {
  id: string;
  label: string;
  country: string;
  status: SourceTableStatus;
  summary: string;
  /** Pārlūka avots vēl nav atdevis gatavu lapu u.tml. - stabils rindas statuss, nevis globāls paziņojums. */
  note?: string;
  href: string;
  hasDetails: boolean;
};

type Group = { id: string; label: string };

const GROUP_ORDER: Group[] = [
  { id: "registri", label: "Reģistri" },
  { id: "izsoles", label: "Izsoles un foto" },
  { id: "citi", label: "Atsaukumi, drošība, citi" },
];

/** Avota grupa kā «Bezmaksas avoti» ķekšos; maksas JoJ - izsolēs. */
const GROUP_OF: Record<string, string> = (() => {
  const out: Record<string, string> = { joj_copart_iaai: "izsoles" };
  for (const g of atraFreeGroups(true)) for (const item of g.items) out[item.id] = g.id;
  return out;
})();

export function sourceTableGroupOf(id: string): string {
  return GROUP_OF[id] ?? "citi";
}

type Tone = "found" | "none" | "busy" | "warn" | "bad" | "idle" | "alert";

function toneOf(item: SourceTableItem): Tone {
  const s = item.status;
  if (isVinScanWantedSource(item.id)) {
    if (s === "found") return "alert";
    if (s === "none") return "found";
  }
  if (s === "checking") return "busy";
  if (item.note && s !== "found" && s !== "none") return "warn";
  if (s === "found") return "found";
  if (s === "none") return "none";
  if (s === "idle") return "idle";
  if (s === "unknown" || s === "blocked" || s === "timeout") return "bad";
  return "warn";
}

const DOT: Record<Tone, string> = {
  found: "bg-[#0b3fa8]",
  alert: "bg-[#d70015]",
  none: "bg-[#c7c7cc]",
  busy: "animate-pulse bg-[#c7c7cc]",
  warn: "bg-[#ff9f0a]",
  bad: "bg-[#d70015]",
  idle: "bg-transparent ring-1 ring-[#c7c7cc]",
};

const STATUS_LV: Record<SourceTableStatus, string> = {
  found: "Ir dati",
  none: "Nav ierakstu",
  unknown: "Neizdevās",
  blocked: "Bloķē",
  timeout: "Noildze",
  config_missing: "Nav atslēgas",
  browser_only: "Tikai pārlūkā",
  manual: "Līdz pogai",
  skipped: "Nav atslēgas",
  needs_input: "Vajag ievadi",
  idle: "Gaida",
  checking: "Pārbauda…",
};

function statusText(item: SourceTableItem): { text: string; cls: string } {
  const tone = toneOf(item);
  if (isVinScanWantedSource(item.id) && item.status === "found") {
    return { text: `Meklēšanā${item.summary ? ` · ${item.summary}` : ""}`, cls: "font-semibold text-[#d70015]" };
  }
  if (tone === "busy") return { text: STATUS_LV.checking, cls: "text-[#8e8e93]" };
  if (tone === "warn" && item.note) return { text: item.note, cls: "text-[#a05a00]" };
  if (tone === "found") return { text: item.summary || STATUS_LV.found, cls: "text-[#111]" };
  if (tone === "none") return { text: item.summary || STATUS_LV.none, cls: "text-[#8e8e93]" };
  if (tone === "bad") {
    return { text: `${STATUS_LV[item.status]}${item.summary ? ` · ${item.summary}` : ""}`, cls: "text-[#d70015]" };
  }
  return { text: `${STATUS_LV[item.status]}${item.summary ? ` · ${item.summary}` : ""}`, cls: "text-[#8e8e93]" };
}

/**
 * «Ātrā pārbaude» (dators): viena kompakta avotu tabula grupās. Rindu secība nemainās skenēšanas laikā,
 * rindas augstums fiksēts (kopsavilkums vienā rindā), garās detaļas sakļautas zem «Detaļas».
 */
export function AdminVinScanSourceTable({
  items,
  busy = false,
  actions,
  meta,
  error,
  details,
  initialOpenId = null,
}: {
  items: readonly SourceTableItem[];
  busy?: boolean;
  actions?: ReactNode;
  meta?: string;
  error?: string;
  details?: (id: string) => ReactNode;
  initialOpenId?: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [onlyFound, setOnlyFound] = useState(false);
  const found = items.filter((i) => i.status === "found").length;
  const none = items.filter((i) => i.status === "none").length;
  const working = items.filter((i) => i.status === "checking").length;
  const shown = onlyFound ? items.filter((i) => i.status === "found") : items;
  const groups = GROUP_ORDER.map((g) => ({ ...g, items: shown.filter((i) => sourceTableGroupOf(i.id) === g.id) })).filter(
    (g) => g.items.length > 0,
  );
  const pill = "inline-flex items-center rounded-full px-2.5 py-[3px] text-[12px] font-semibold tabular-nums";
  return (
    <section className="rounded-[14px] border border-[#e5e5ea] bg-white px-[18px] py-4" data-atra-sources aria-busy={busy}>
      <div className="flex min-h-[32px] flex-wrap items-center gap-2">
        <h2 className="mr-1 text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]">Avoti</h2>
        <span className={`${pill} bg-[#e8eefc] text-[#0b3fa8]`}>{found} atrasti</span>
        <span className={`${pill} bg-[#f2f2f7] text-[#3a3a3c]`}>{none} nav ierakstu</span>
        <span className={`${pill} bg-[#f2f2f7] text-[#3a3a3c]`} data-atra-working>
          {working} strādā
        </span>
        {meta ? <span className="text-[12px] text-[#8e8e93]">{meta}</span> : null}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {actions}
          <button
            type="button"
            aria-pressed={onlyFound}
            onClick={() => setOnlyFound((v) => !v)}
            className="rounded-[8px] px-2 py-1 text-[12.5px] text-[#8e8e93] hover:text-[#111]"
          >
            {onlyFound ? "Rādīt visus" : "Rādīt tikai atrastos"}
          </button>
        </span>
      </div>
      {error ? <p className="mt-1 text-[12.5px] text-[#d70015]">{error}</p> : null}
      <table className="mt-2 w-full table-fixed border-collapse text-[13px]">
        <colgroup>
          <col className="w-[22px]" />
          <col className="w-[190px]" />
          <col className="w-[52px]" />
          <col />
          <col className="w-[96px]" />
        </colgroup>
        {groups.map((g) => (
          <tbody key={g.id} data-atra-source-group={g.id}>
            <tr>
              <th colSpan={5} className="pb-1 pt-3 text-left text-[11px] font-semibold uppercase tracking-[0.4px] text-[#8e8e93]">
                {g.label}
              </th>
            </tr>
            {g.items.map((item) => {
              const open = openId === item.id && item.hasDetails;
              const st = statusText(item);
              return (
                <SourceRow
                  key={item.id}
                  item={item}
                  open={open}
                  dot={DOT[toneOf(item)]}
                  text={st.text}
                  textCls={st.cls}
                  onToggle={() => setOpenId(open ? null : item.id)}
                  detail={open && details ? details(item.id) : null}
                />
              );
            })}
          </tbody>
        ))}
      </table>
    </section>
  );
}

function SourceRow({
  item,
  open,
  dot,
  text,
  textCls,
  onToggle,
  detail,
}: {
  item: SourceTableItem;
  open: boolean;
  dot: string;
  text: string;
  textCls: string;
  onToggle: () => void;
  detail: ReactNode;
}) {
  return (
    <>
      <tr className="h-[38px] border-t border-[#efeff4]" data-atra-source={item.id} data-status={item.status}>
        <td className="align-middle">
          <i className={`block h-2 w-2 rounded-full ${dot}`} aria-hidden />
        </td>
        <td className="truncate pr-2 align-middle font-semibold text-[#111]">{item.label}</td>
        <td className="align-middle text-[12px] text-[#8e8e93]">{item.country}</td>
        <td className={`truncate pr-3 align-middle ${textCls}`} title={text}>
          {text}
        </td>
        <td className="whitespace-nowrap text-right align-middle text-[12.5px]">
          {item.hasDetails ? (
            <button type="button" aria-expanded={open} onClick={onToggle} className="text-[#3a3a3c] hover:text-[#111]">
              {open ? "▾" : "▸"} Detaļas
            </button>
          ) : null}
          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${item.label} - atvērt`}
              className="ml-2 font-semibold text-[#0b3fa8]"
            >
              ↗
            </a>
          ) : null}
        </td>
      </tr>
      {open ? (
        <tr data-atra-source-detail={item.id}>
          <td />
          <td colSpan={4} className="pb-3 pr-2">
            <div className="rounded-[10px] bg-[#f7f7f9] px-3 py-2.5 text-[12.5px] leading-snug text-[#3a3a3c]">{detail}</div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
