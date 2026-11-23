"use client";

import { useMemo, type ReactNode } from "react";

import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import type { CsddFormFields } from "@/lib/admin-source-blocks";
import {
  buildCsddBloki,
  CSDD_BRAKE_DIFF_WARN_PCT,
  csddBlokiT,
  csddDefectNodeLabel,
  csddSourceRef,
  formatNum,
  type CsddPdfBlokKey,
  type CsddPdfBlokiFlags,
} from "@/lib/csdd-bloki";

const RED = "text-red-700";
const MUTED = "text-slate-400";

const DOT: Record<string, string> = {
  none: "bg-transparent",
  "0": "bg-slate-200",
  "1": "bg-green-600",
  "2": "bg-amber-600",
  "3": "bg-red-600",
};

function Section({
  title,
  src,
  flag,
  flags,
  onFlagChange,
  children,
}: {
  title: string;
  src?: string;
  flag: CsddPdfBlokKey;
  flags?: CsddPdfBlokiFlags;
  onFlagChange?: (key: CsddPdfBlokKey, next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 border-t border-slate-200/80 pt-1.5 first:border-t-0 first:pt-0" data-csdd-bloks-admin={flag}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {title}
          {src ? <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">{src}</span> : null}
        </p>
        {flags && onFlagChange ? (
          <AdminPdfIncludeToggle label="Rādīt PDF" checked={flags[flag]} onChange={(next) => onFlagChange(flag, next)} />
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Cell({ k, v, tone }: { k: string; v: string; tone?: "red" | "amber" | "muted" }) {
  const cls = tone === "red" ? RED : tone === "amber" ? "text-amber-700" : tone === "muted" ? MUTED : "text-slate-900";
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1">
      <p className="truncate text-[9px] font-medium uppercase tracking-wide text-slate-500">{k}</p>
      <p className={`text-[12px] font-semibold tabular-nums ${cls}`}>{v}</p>
    </div>
  );
}

/**
 * Kompakta e.csdd sadaļa PRO admin avotos: brīdinājumi, aizliegumi + CSNg, TA defektu analīze, mērījumi.
 * Katram blokam ķeksis «Rādīt PDF» (noklusējums izslēgts).
 */
export function AdminCsddBlokiPanel({
  value,
  flags,
  onFlagChange,
}: {
  value: CsddFormFields;
  flags?: CsddPdfBlokiFlags;
  onFlagChange?: (key: CsddPdfBlokKey, next: boolean) => void;
}) {
  const b = useMemo(() => buildCsddBloki(value, "lv"), [value]);
  const lv = "lv" as const;

  return (
    <div className="mb-2 min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1.5 text-[11px] text-slate-700" data-csdd-bloki-panel="">
      <p className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-[11px] font-semibold text-slate-800">
        {csddBlokiT("adminTitle", lv)}
        {b ? <span className="text-[10px] font-normal text-slate-500">{csddSourceRef(b.infoDate)}</span> : null}
      </p>
      {!b ? (
        <p className={`text-[11px] font-medium ${RED}`}>{csddBlokiT("noData", lv)}</p>
      ) : (
        <div className="space-y-1.5">
          <Section title={csddBlokiT("warningsTitle", lv)} flag="csddPdfWarnings" flags={flags} onFlagChange={onFlagChange}>
            {b.warnings.length === 0 ? (
              <p className="text-slate-500">{csddBlokiT("none", lv)}</p>
            ) : (
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {b.warnings.map((w) => (
                  <div
                    key={w.id}
                    className={`min-w-0 rounded-md border bg-white px-2 py-1 ${w.tone === "alert" ? "border-red-200" : "border-amber-200"}`}
                    data-csdd-warning={w.id}
                  >
                    <p className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-wide text-slate-500">
                      <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${w.tone === "alert" ? "bg-red-500" : "bg-amber-400"}`} />
                      {w.label}
                    </p>
                    <p className={`text-[12px] font-semibold ${w.tone === "alert" ? RED : "text-amber-700"}`}>{w.value}</p>
                    {w.note ? <p className="text-[10px] text-slate-500">{w.note}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            title={csddBlokiT("restrictionsTitle", lv)}
            src={b.restrictions.allMissing ? csddBlokiT("sectionMissing", lv) : undefined}
            flag="csddPdfRestrictions"
            flags={flags}
            onFlagChange={onFlagChange}
          >
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
              {b.restrictions.rows.map((r) => (
                <Cell
                  key={r.key}
                  k={csddBlokiT(r.key, lv)}
                  v={r.state === "not_checked" ? csddBlokiT("notChecked", lv) : r.state === "none" ? csddBlokiT("none", lv) : r.text}
                  tone={r.state === "not_checked" ? "muted" : r.state === "present" ? "red" : undefined}
                />
              ))}
            </div>
          </Section>

          <Section
            title={csddBlokiT("taTitle", lv)}
            src={b.ta.years.length > 1 ? `${b.ta.years[0]}-${b.ta.years[b.ta.years.length - 1]}` : b.ta.years.length ? String(b.ta.years[0]) : undefined}
            flag="csddPdfTaAnalysis"
            flags={flags}
            onFlagChange={onFlagChange}
          >
            {b.ta.inspectionCount === 0 ? (
              <p className={`font-medium ${RED}`}>{csddBlokiT("noData", lv)}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                  <Cell k={csddBlokiT("taCount", lv)} v={String(b.ta.inspectionCount)} />
                  <Cell k={csddBlokiT("taFailed", lv)} v={`${b.ta.rating2Count} / ${b.ta.rating3Count}`} tone={b.ta.rating3Count > 0 ? "red" : undefined} />
                  <Cell k={csddBlokiT("taReinspections", lv)} v={String(b.ta.reinspectionCount)} />
                  <Cell
                    k={csddBlokiT("taRepeated", lv)}
                    v={b.ta.repeated.length === 0 ? csddBlokiT("none", lv) : b.ta.repeated.length === 1 ? csddBlokiT("taNode1", lv) : csddBlokiT("taNodes", lv, { n: b.ta.repeated.length })}
                  />
                </div>
                {b.ta.repeated.length > 0 ? (
                  <div className="mt-1 overflow-x-auto">
                    <table className="w-full min-w-[280px] border-collapse text-[10px] tabular-nums">
                      <thead>
                        <tr className="text-left text-[9px] text-slate-500">
                          <th className="py-0.5 pr-1 font-medium">{csddBlokiT("taNodeCol", lv)}</th>
                          {b.ta.years.map((y) => (
                            <th key={y} className="w-5 py-0.5 text-center font-medium">
                              {String(y).slice(2)}
                            </th>
                          ))}
                          <th className="w-8 py-0.5 text-right font-medium">{csddBlokiT("taYearsCol", lv)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.ta.repeated.map((r) => (
                          <tr key={r.node} className="border-t border-slate-200/70 align-top" title={r.latestText ? `${r.latestDate}: ${r.latestText}` : undefined}>
                            <td className="py-0.5 pr-1">
                              <span className="font-semibold text-slate-800">{csddDefectNodeLabel(r.node, lv)}</span>{" "}
                              <span className="text-slate-400">{r.codes.join(" · ")}</span>
                            </td>
                            {b.ta.years.map((y) => (
                              <td key={y} className="py-0.5 text-center">
                                <span className={`inline-block h-2.5 w-2.5 rounded-[3px] ${DOT[r.byYear[y] == null ? "none" : String(r.byYear[y])]}`} />
                              </td>
                            ))}
                            <td className="py-0.5 text-right font-semibold">{r.yearCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {b.ta.notes.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-[10px]">
                    {b.ta.notes.map((n) => (
                      <li key={n.text}>
                        <span className="text-slate-400">{n.dates.join(", ")}</span> {n.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </Section>

          <Section
            title={csddBlokiT("measurementsTitle", lv)}
            src={b.measurements.taDate ? `${csddBlokiT("ta", lv)} ${b.measurements.taDate}` : undefined}
            flag="csddPdfMeasurements"
            flags={flags}
            onFlagChange={onFlagChange}
          >
            {(() => {
              const m = b.measurements;
              const n = (v: string) => formatNum(v, lv);
              const nd = csddBlokiT("noData", lv);
              const cells: { k: string; v: string; red?: boolean }[] = [
                { k: `CO2${m.co2Cycle ? ` ${m.co2Cycle}` : ""}`, v: m.co2 ? `${n(m.co2)} g/km` : nd, red: !m.co2 },
                {
                  k: csddBlokiT("consumption", lv),
                  v: m.consumption ? `${n(m.consumption)} l${m.consumptionCity ? ` · ${csddBlokiT("city", lv)} ${n(m.consumptionCity)}` : ""}` : nd,
                  red: !m.consumption,
                },
                { k: csddBlokiT("euro", lv), v: m.euro || nd, red: !m.euro },
              ];
              if (m.co || m.coHigh) cells.push({ k: "CO %", v: [m.co ? n(m.co) : "", m.coHigh ? `${csddBlokiT("coHigh", lv)} ${n(m.coHigh)}` : ""].filter(Boolean).join(" · ") });
              if (m.hc) cells.push({ k: "HC ppm", v: n(m.hc) });
              if (m.lambda) cells.push({ k: csddBlokiT("lambda", lv), v: n(m.lambda) });
              if (m.smoke) cells.push({ k: csddBlokiT("smoke", lv), v: n(m.smoke) });
              if (m.particles) cells.push({ k: csddBlokiT("particles", lv), v: m.particles });
              return (
                <>
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                    {cells.map((c) => (
                      <Cell key={c.k} k={c.k} v={c.v} tone={c.red ? "red" : undefined} />
                    ))}
                  </div>
                  {m.brakes.length > 0 ? (
                    <table className="mt-1 w-full border-collapse text-[10px] tabular-nums">
                      <thead>
                        <tr className="text-left text-[9px] text-slate-500">
                          <th className="font-medium">{csddBlokiT("axle", lv)}</th>
                          <th className="font-medium">{csddBlokiT("left", lv)}</th>
                          <th className="font-medium">{csddBlokiT("right", lv)}</th>
                          <th className="font-medium">{csddBlokiT("diff", lv)}</th>
                          <th className="font-medium">{csddBlokiT("brakeType", lv)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.brakes.map((r, i) => (
                          <tr key={i} className="border-t border-slate-200/70">
                            <td>{r.axle}</td>
                            <td>{n(r.left)}</td>
                            <td>{n(r.right)}</td>
                            <td className={r.diffPct != null && r.diffPct > CSDD_BRAKE_DIFF_WARN_PCT ? "font-semibold text-amber-700" : ""}>
                              {r.diffPct != null ? `${r.diffPct} %` : ""}
                            </td>
                            <td>{r.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                </>
              );
            })()}
          </Section>
        </div>
      )}
    </div>
  );
}
