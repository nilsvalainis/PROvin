"use client";

import {
  IRISS_ORDER_PATH_STAGES,
  IRISS_ORDER_STAGES,
  IRISS_ORDER_STAGE_LV,
  type IrissOrderStage,
  type IrissOrderStageSignals,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";
import { irissOrderAdvanceReceived, irissOrderStage, irissOrderStageIsAuto, irissOrderStageSource } from "@/lib/iriss-order-stage";
import { formatIrissAdvanceShortDate } from "@/lib/iriss-advance";

/** P5: galvenes statusa pilule (dators un telefons) - viens posms, izvēlne ar 5 posmiem + «Neaktīvs». */
export function IrissOrderStageSelect({
  stage,
  onChange,
  className = "",
}: {
  stage: IrissOrderStage;
  onChange: (stage: IrissOrderStage) => void;
  className?: string;
}) {
  return (
    <select
      className={`iriss-status-pill h-8 rounded-full border border-[var(--hair)] bg-[var(--s1)] px-2.5 text-[12px] font-semibold text-[var(--ink)] outline-none ${className}`}
      data-status={stage}
      value={stage}
      aria-label="Pasūtījuma statuss"
      onChange={(e) => onChange(e.target.value as IrissOrderStage)}
    >
      {IRISS_ORDER_STAGES.map((s) => (
        <option key={s} value={s}>
          {IRISS_ORDER_STAGE_LV[s]}
        </option>
      ))}
    </select>
  );
}

/**
 * P5: labā bloka «Statuss» ceļš. Klikšķis uz posma = maiņa ar roku. «AUTO» - posmu iestatīja sistēma (PD / Autoparks).
 * Pelēkais teksts pa labi - no kurienes posms. «Avanss» ir atzīme Rezervēts posmā (2A).
 */
export function IrissOrderStagePath({
  rec,
  signals,
  onChange,
}: {
  rec: IrissPasutijumsRecord;
  signals?: IrissOrderStageSignals | null;
  onChange: (stage: IrissOrderStage) => void;
}) {
  const stage = irissOrderStage(rec, signals);
  const auto = irissOrderStageIsAuto(rec, signals);
  const curIdx = (IRISS_ORDER_PATH_STAGES as readonly string[]).indexOf(stage);
  const advanceOk = irissOrderAdvanceReceived(rec);
  const advanceDate = rec.advance?.paidAt ? formatIrissAdvanceShortDate(rec.advance.paidAt) : "";
  return (
    <div data-iriss-stage-path={stage}>
      <ol className="m-0 list-none p-0" aria-label="Pasūtījuma ceļš">
        {IRISS_ORDER_PATH_STAGES.map((s, i) => {
          const state = stage === "inactive" ? "todo" : i < curIdx ? "done" : i === curIdx ? "cur" : "todo";
          const src = state === "todo" ? "" : irissOrderStageSource(s, rec, signals);
          return (
            <li key={s}>
              <button
                type="button"
                aria-current={state === "cur" ? "step" : undefined}
                onClick={() => s !== stage && onChange(s)}
                className="flex min-h-10 w-full items-center gap-2.5 rounded-[10px] px-1 text-left hover:bg-[var(--fill)]"
              >
                <span
                  aria-hidden
                  className={`grid h-5 w-5 flex-none place-items-center rounded-full border-2 text-[11px] text-white ${
                    state === "done"
                      ? "border-[var(--iriss-ok)] bg-[var(--iriss-ok)]"
                      : state === "cur"
                        ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent)]"
                        : "border-[var(--hair)]"
                  }`}
                >
                  {state === "done" ? "✓" : ""}
                </span>
                <span className={`flex-1 text-[14px] ${state === "cur" ? "font-bold text-[var(--ink)]" : state === "todo" ? "text-[var(--ink3)]" : "text-[var(--ink)]"}`}>
                  {IRISS_ORDER_STAGE_LV[s]}
                </span>
                {state === "cur" && auto ? (
                  <span className="rounded-md border border-[var(--hair)] px-1.5 py-px text-[10px] font-bold tracking-[0.04em] text-[var(--ink3)]">AUTO</span>
                ) : null}
                {src ? <span className="text-[12px] text-[var(--ink3)]">{src}</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
      {stage === "reserved" ? (
        <div className="mt-2 flex min-h-9 items-center justify-between border-t border-[var(--iriss-line,var(--hair))] pt-1.5 text-[13px]">
          <span className="text-[var(--iriss-ink-2,var(--ink2))]">Avanss</span>
          {advanceOk ? (
            <span className="font-semibold text-[var(--iriss-ok)]">Saņemts {advanceDate} ✓</span>
          ) : (
            <span className="text-[var(--ink3)]">Nav saņemts</span>
          )}
        </div>
      ) : null}
      <div className="mt-2.5 flex gap-2 border-t border-[var(--iriss-line,var(--hair))] pt-2.5">
        <button
          type="button"
          aria-pressed={stage === "inactive"}
          onClick={() => stage !== "inactive" && onChange("inactive")}
          className={`inline-flex h-[34px] items-center justify-center rounded-full border border-[var(--hair)] px-3 text-[13px] font-semibold ${
            stage === "inactive" ? "bg-[var(--ink)] text-[var(--s1)]" : "bg-[var(--s1)] text-[var(--ink3)]"
          }`}
        >
          Neaktīvs
        </button>
      </div>
    </div>
  );
}
