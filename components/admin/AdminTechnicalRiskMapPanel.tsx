"use client";

import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import type { TechnicalRiskMap } from "@/lib/admin-ai-technical-risk-map-types";

export function AdminTechnicalRiskMapPanel({
  sessionId,
  map,
  lintWarning,
  operatorFlags,
  onHideCostBandsChange,
}: {
  sessionId: string;
  map?: TechnicalRiskMap | null;
  lintWarning?: string | null;
  operatorFlags?: string[] | null;
  onHideCostBandsChange?: (hide: boolean) => void;
}) {
  if (!map && !lintWarning && !operatorFlags?.length) return null;
  const id = map?.identification;
  const flags = operatorFlags?.filter((f) => f.trim()) ?? [];
  return (
    <div className="mt-2 space-y-2">
      {lintWarning ? (
        <p
          className="rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-[12px] text-amber-950"
          role="status"
        >
          {lintWarning}
        </p>
      ) : null}
      {flags.length > 0 ? (
        <div
          className="rounded-xl border border-sky-200/90 bg-sky-50 px-3 py-2 text-[12px] text-sky-950"
          role="status"
        >
          {flags.map((f) => (
            <p key={f}>{f}</p>
          ))}
        </div>
      ) : null}
      {map ? (
        <AdminCollapsibleShell
          sessionId={sessionId}
          blockId="technical-risk-map"
          defaultCollapsed
          disableCollapse={false}
          header={
            <span className="text-[13px] font-semibold text-[var(--color-apple-text)]">
              Riska karte (operatoram)
            </span>
          }
        >
          <div className="space-y-3 px-1 pb-2 text-[12px] text-[var(--color-apple-text)]">
            {id ? (
              <div>
                <p className="font-semibold">Identifikācija</p>
                <p>
                  Dzinējs: {id.engine.value || "nav"} ({id.engine.confidence}
                  {id.engine.candidates.length ? `; kandidāti ${id.engine.candidates.join(", ")}` : ""})
                </p>
                <p>
                  Kārba: {id.gearbox.value || "nav"} ({id.gearbox.confidence})
                </p>
                <p>
                  Platforma: {id.platform.value || "nav"} ({id.platform.confidence})
                </p>
              </div>
            ) : null}
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={map.hide_cost_bands === true}
                onChange={(e) => onHideCostBandsChange?.(e.target.checked)}
              />
              <span>Slēpt EUR joslas (tikai verificēta KB ar datumu; nākamā ģenerēšana)</span>
            </label>
            <div>
              <p className="font-semibold">Atsaukumi</p>
              <ul className="list-disc pl-4">
                {map.recalls.map((r, i) => (
                  <li key={`${r.id_or_title}-${i}`}>
                    {r.id_or_title}
                    {r.source ? ` (${r.source})` : ""}
                  </li>
                ))}
              </ul>
            </div>
            {map.risks.length > 0 ? (
              <div>
                <p className="font-semibold">Avoti kartē</p>
                <ul className="list-disc pl-4">
                  {map.risks.flatMap((risk, ri) =>
                    risk.sources.map((s, si) => (
                      <li key={`${ri}-${si}`}>
                        {risk.component}: {s.type} {s.ref}
                      </li>
                    )),
                  )}
                </ul>
              </div>
            ) : null}
          </div>
        </AdminCollapsibleShell>
      ) : null}
    </div>
  );
}
