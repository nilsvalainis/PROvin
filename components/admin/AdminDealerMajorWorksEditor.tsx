"use client";

import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import { SUBHEADING_LUCIDE } from "@/lib/admin-lucide-registry";
import type { DealerFacts } from "@/lib/admin-ai-dealer-facts";
import { MAJOR_ASSEMBLY_SPECS } from "@/lib/dealer-major-works";
import {
  dealerMajorWorkEditorRows,
  nextCustomDealerMajorWorkOverrideKey,
  removeDealerMajorWorkOverride,
  upsertDealerMajorWorkOverride,
  type DealerMajorWorkOverride,
} from "@/lib/dealer-major-works-overrides";
import { collectDealerMajorWorkHits } from "@/lib/pdf-dealer-timeline";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const btn =
  "rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50";

export function AdminDealerMajorWorksEditor({
  facts,
  overrides,
  onChange,
  readOnly = false,
  disabled = false,
}: {
  facts: DealerFacts;
  overrides: DealerMajorWorkOverride[];
  onChange: (next: DealerMajorWorkOverride[]) => void;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const automatic = collectDealerMajorWorkHits(facts);
  const rows = dealerMajorWorkEditorRows(automatic, overrides);
  const locked = readOnly || disabled;

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/80 px-2 py-2">
      <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        <AdminProvinLucide icon={SUBHEADING_LUCIDE.serviceWorks} />
        Lielie darbi PDF
      </p>
      <p className="mt-1 text-[10px] leading-snug text-slate-500">
        Automātiski no servisa rindām. Manuālais labojums ir spēcīgāks un paliek pēc PDF ģenerēšanas.
        Automātiski noņem labojumu. Servisa vēsturi nemaina.
      </p>
      {rows.length === 0 ? (
        <p className="mt-1.5 text-[11px] text-slate-500">Nav fiksētu lielo darbu (automātiski).</p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {rows.map((row) => {
            const source = row.effective ?? row.automatic;
            return (
              <li
                key={row.key}
                className={`rounded-md border px-2 py-1.5 ${
                  row.hidden ? "border-slate-200 bg-white/70 text-slate-500" : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-[11px] leading-snug text-slate-700">
                  {row.automatic ? (
                    <>
                      <span className="font-semibold">{row.automatic.factId}</span>{" "}
                      {row.automatic.label}
                      {row.automatic.date ? ` ${row.automatic.date}` : ""}
                      {row.automatic.km ? ` ${row.automatic.km}` : ""}
                    </>
                  ) : (
                    <span className="font-semibold">Manuāla rinda</span>
                  )}
                  {row.hidden ? (
                    <span className="ml-1 text-[10px] font-medium uppercase text-slate-400">slēpts</span>
                  ) : null}
                  {row.override && !row.hidden ? (
                    <span className="ml-1 text-[10px] font-medium uppercase text-slate-400">labots</span>
                  ) : null}
                </p>
                {locked ? (
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    {row.hidden
                      ? "PDF: slēpts"
                      : source
                        ? `${source.label}${source.date ? ` ${source.date}` : ""}${source.km ? ` ${source.km}` : ""}`
                        : "Automātiski"}
                  </p>
                ) : (
                  <div className="mt-1 grid gap-1 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto]">
                    <select
                      className={inp}
                      disabled={row.hidden}
                      value={row.effective?.id ?? row.automatic?.id ?? "body_glass"}
                      aria-label={`Lielie darbi kategorija ${row.key}`}
                      onChange={(e) => {
                        const assemblyId = e.target.value as DealerMajorWorkOverride["assemblyId"];
                        onChange(
                          upsertDealerMajorWorkOverride(overrides, {
                            key: row.key,
                            action: "set",
                            assemblyId,
                            label: row.override?.label,
                            factId: row.automatic?.factId ?? row.override?.factId,
                            date: row.override?.date ?? row.automatic?.date,
                            km: row.override?.km ?? row.automatic?.km,
                          }),
                        );
                      }}
                    >
                      {MAJOR_ASSEMBLY_SPECS.map((spec) => (
                        <option key={spec.id} value={spec.id}>
                          {spec.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className={inp}
                      disabled={row.hidden}
                      value={row.override?.label ?? ""}
                      placeholder={source?.label ?? "Teksts PDF"}
                      aria-label={`Lielie darbi teksts ${row.key}`}
                      onChange={(e) =>
                        onChange(
                          upsertDealerMajorWorkOverride(overrides, {
                            key: row.key,
                            action: row.hidden ? "hide" : "set",
                            assemblyId: (row.effective?.id ??
                              row.automatic?.id ??
                              "body_glass") as DealerMajorWorkOverride["assemblyId"],
                            label: e.target.value,
                            factId: row.automatic?.factId ?? row.override?.factId,
                            date: row.override?.date ?? row.automatic?.date,
                            km: row.override?.km ?? row.automatic?.km,
                          }),
                        )
                      }
                    />
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        className={btn}
                        onClick={() =>
                          onChange(
                            upsertDealerMajorWorkOverride(overrides, {
                              key: row.key,
                              action: row.hidden ? "set" : "hide",
                              assemblyId: (row.effective?.id ??
                                row.automatic?.id ??
                                "body_glass") as DealerMajorWorkOverride["assemblyId"],
                              label: row.override?.label,
                              factId: row.automatic?.factId ?? row.override?.factId,
                              date: row.override?.date ?? row.automatic?.date,
                              km: row.override?.km ?? row.automatic?.km,
                            }),
                          )
                        }
                      >
                        {row.hidden ? "Rādīt" : "Slēpt"}
                      </button>
                      {row.override ? (
                        <button
                          type="button"
                          className={btn}
                          onClick={() => onChange(removeDealerMajorWorkOverride(overrides, row.key))}
                        >
                          Automātiski
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!locked ? (
        <button
          type="button"
          className={`${btn} mt-1.5`}
          onClick={() =>
            onChange(
              upsertDealerMajorWorkOverride(overrides, {
                key: nextCustomDealerMajorWorkOverrideKey(overrides),
                action: "set",
                assemblyId: "body_glass",
              }),
            )
          }
        >
          + Rinda
        </button>
      ) : null}
    </div>
  );
}
