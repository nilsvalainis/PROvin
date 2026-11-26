"use client";

import { Fragment, useMemo, type ReactNode } from "react";

import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import type { CsddFormFields } from "@/lib/admin-source-blocks";
import {
  buildCsddBloki,
  CSDD_BRAKE_DIFF_WARN_PCT,
  csddBlokiT,
  buildCsddTaRepeatSentence,
  csddDefectNodeLabel,
  csddSourceRef,
  csddTaCodesLabel,
  csddTaInspectionsCount,
  formatNum,
  type CsddPdfBlokKey,
  type CsddPdfBlokiFlags,
} from "@/lib/csdd-bloki";

/*
 * Krāsas ar `!`: admin tēma piespiež `p/span` melnu, bet `.text-red-700` pārvērš par sarkanu fona joslu ar baltu
 * tekstu (admin-ios-theme.css). Šeit vajag tikai krāsainu TEKSTU bez fona (kā PDF kartītēs).
 */
const RED = "!text-[#dc2626]";
const AMBER = "!text-[#b45309]";
const MUTED = "!text-[#8e8e93]";

/** Tās pašas krāsas kā PDF (#16a34a/#d97706/#dc2626 uz #F5FBF7/#FFFBEB/#FEF2F2). */
const CHIP: Record<1 | 2 | 3, string> = {
  1: "bg-[#F5FBF7] !text-[#16a34a]",
  2: "bg-[#FFFBEB] !text-[#d97706]",
  3: "bg-[#FEF2F2] !text-[#dc2626]",
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
        {/* Nav `tracking-wide`: PRO tēma tādiem virsrakstiem liek pasvītrojumu - atdalītājs ir tikai bloka border-t. */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
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

function Cell({ k, v, tone }: { k: string; v: string; tone?: "red" | "amber" | "muted" | "nodata" }) {
  const cls =
    tone === "red"
      ? `text-[12px] font-semibold ${RED}`
      : tone === "amber"
        ? `text-[12px] font-semibold ${AMBER}`
        : tone === "muted"
          ? `text-[11px] font-medium ${MUTED}`
          : tone === "nodata"
            ? `text-[11px] font-medium ${RED}`
            : "text-[12px] font-semibold text-slate-900";
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1">
      <p className="truncate text-[9px] font-medium uppercase tracking-wide text-slate-500">{k}</p>
      <p className={`tabular-nums ${cls}`}>{v}</p>
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
        <p className={`text-[11px] font-medium ${RED}`} data-csdd-nodata="">
          {csddBlokiT("noData", lv)}
        </p>
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
                      <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${w.tone === "alert" ? "bg-[#dc2626]" : "bg-amber-400"}`} />
                      {w.label}
                    </p>
                    <p className={`text-[12px] font-semibold ${w.tone === "alert" ? RED : AMBER}`}>{w.value}</p>
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
              b.taHistoryState ? (
                <p className={`text-[11px] ${MUTED}`} data-csdd-ta-state={b.taHistoryState}>
                  {csddBlokiT(b.taHistoryState === "no_lv_rating" ? "taNoLvInspection" : "taLastOnly", lv)}
                </p>
              ) : (
                <p className={`text-[11px] font-medium ${RED}`} data-csdd-nodata="">
                  {csddBlokiT("noData", lv)}
                </p>
              )
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                  <Cell k={csddBlokiT("taCount", lv)} v={String(b.ta.inspectionCount)} />
                  <Cell k={csddBlokiT("taRating2", lv)} v={csddTaInspectionsCount(b.ta.rating2Count, lv)} />
                  <Cell k={csddBlokiT("taRating3", lv)} v={csddTaInspectionsCount(b.ta.rating3Count, lv)} tone={b.ta.rating3Count > 0 ? "red" : undefined} />
                  <Cell k={csddBlokiT("taReinspections", lv)} v={String(b.ta.reinspectionCount)} />
                </div>
                {b.ta.repeated.length > 0 ? (
                  <>
                    <p className="mt-1.5 text-[11px] leading-snug text-slate-900" data-csdd-ta-sentence="">
                      {buildCsddTaRepeatSentence(b.ta, lv)}
                    </p>
                    <div className="mt-1 overflow-x-auto">
                      <table className="w-full min-w-[420px] table-fixed border-collapse tabular-nums">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="w-[30%] pb-1 text-left text-[9px] font-semibold uppercase tracking-wide">{csddBlokiT("taDefectCol", lv)}</th>
                            {b.ta.years.map((y) => (
                              <th key={y} className="pb-1 text-center text-[10px] font-bold text-slate-900">
                                {y}
                              </th>
                            ))}
                            <th className="w-[84px] pb-1 pr-1.5 text-right text-[9px] font-semibold uppercase leading-tight">
                              {csddBlokiT("taYearsCol", lv)}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.ta.repeated.map((r) => {
                            const codes = csddTaCodesLabel(r.codes, lv);
                            return (
                              <Fragment key={r.key}>
                                <tr>
                                  <td className="pr-1.5 pt-1.5 align-middle">
                                    <span className="block text-[11px] font-bold leading-tight text-slate-900">{csddDefectNodeLabel(r.key, lv)}</span>
                                    {codes ? <span className="block text-[9px] text-slate-400">{codes}</span> : null}
                                  </td>
                                  {b.ta.years.map((y) => {
                                    const v = r.byYear[y];
                                    return (
                                      <td key={y} className="pt-1.5 text-center align-middle">
                                        {v ? (
                                          <span className={`inline-flex h-5 w-[26px] items-center justify-center rounded-md text-[11px] font-bold ${CHIP[v]}`}>{v}</span>
                                        ) : (
                                          <span className="text-[18px] font-bold leading-none text-slate-300">·</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="whitespace-nowrap pt-1.5 text-right align-middle text-[11px] font-bold text-slate-900">
                                    {r.yearCount} <span className="text-[9px] font-medium text-slate-400">{csddBlokiT("taYearsOf", lv, { m: b.ta.years.length })}</span>
                                  </td>
                                </tr>
                                {r.latestText ? (
                                  <tr className="border-b border-slate-100">
                                    <td colSpan={b.ta.years.length + 2} className="pb-1.5 pt-0.5 text-[10px] leading-snug text-slate-500">
                                      <span className="font-semibold text-slate-500">{csddBlokiT("taLatest", lv, { d: r.latestDate })}</span> «{r.latestText}»
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-500">
                      <span className="font-semibold">{csddBlokiT("legendTitle", lv)}</span>
                      {([1, 2, 3] as const).map((v) => (
                        <span key={v} className="inline-flex items-center gap-1">
                          <span className={`inline-flex h-4 w-5 items-center justify-center rounded-[5px] text-[10px] font-bold ${CHIP[v]}`}>{v}</span>
                          {csddBlokiT(`legend${v}`, lv)}
                        </span>
                      ))}
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[16px] font-bold leading-none text-slate-300">·</span>
                        {csddBlokiT("legend0", lv)}
                      </span>
                    </p>
                  </>
                ) : null}
                {b.ta.notes.length > 0 ? (
                  <>
                    <p className="mb-0.5 mt-2 text-[9px] font-bold uppercase tracking-wide text-slate-500">{csddBlokiT("taNotes", lv)}</p>
                    <ul className="divide-y divide-slate-100 text-[10.5px] text-slate-900">
                      {b.ta.notes.map((n) => (
                        <li key={n.text} className="py-1 leading-snug">
                          <span className="font-semibold text-slate-500">{n.dates.join(", ")}</span> - {n.text}
                        </li>
                      ))}
                    </ul>
                  </>
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
              const cells: { k: string; v: string; nodata?: boolean }[] = [
                { k: `CO2${m.co2Cycle ? ` ${m.co2Cycle}` : ""}`, v: m.co2 ? `${n(m.co2)} g/km` : nd, nodata: !m.co2 },
                {
                  k: csddBlokiT("consumption", lv),
                  v: m.consumption ? `${n(m.consumption)} l${m.consumptionCity ? ` · ${csddBlokiT("city", lv)} ${n(m.consumptionCity)}` : ""}` : nd,
                  nodata: !m.consumption,
                },
                { k: csddBlokiT("euro", lv), v: m.euro || nd, nodata: !m.euro },
              ];
              if (m.co || m.coHigh) cells.push({ k: "CO %", v: [m.co ? n(m.co) : "", m.coHigh ? `${csddBlokiT("coHigh", lv)} ${n(m.coHigh)}` : ""].filter(Boolean).join(" · ") });
              if (m.hc) cells.push({ k: "HC ppm", v: n(m.hc) });
              if (m.lambda) cells.push({ k: csddBlokiT("lambda", lv), v: n(m.lambda) });
              // Divi dažādi CSDD mērījumi: dūmainības koeficients (m⁻¹, vecā metode) vai atgāzu cietās daļiņas (skaits cm⁻³).
              if (m.smoke) cells.push({ k: csddBlokiT("smoke", lv), v: `${n(m.smoke)} m⁻¹` });
              if (m.particles) cells.push({ k: csddBlokiT("particles", lv), v: `${m.particles} cm⁻³` });
              return (
                <>
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                    {cells.map((c) => (
                      <Cell key={c.k} k={c.k} v={c.v} tone={c.nodata ? "nodata" : undefined} />
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
                            <td className={r.diffPct != null && r.diffPct > CSDD_BRAKE_DIFF_WARN_PCT ? `font-semibold ${AMBER}` : ""}>
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
