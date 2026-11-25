"use client";

/**
 * CARFAX avota bloks: tā pati forma kā AutoDNA / CarVertical (nobraukums, negadījumi, laikposms,
 * komentāri, foto) + strukturētās atskaites kopsavilkums (`report`), ko aizpilda PDF parsētājs.
 */
import type { ReactNode } from "react";

import { AdminVendorAvotuSourceBlock } from "@/components/admin/AdminVendorAvotuSourceBlock";
import type { AdminAiSourceCommentSlot } from "@/components/admin/AdminSourceCommentField";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import type { CopilotSourceKey } from "@/lib/admin-copilot-types";
import type { CarfaxBlockState, VendorAvotuBlockState, WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { SUBHEADING_LUCIDE } from "@/lib/admin-lucide-registry";
import { carfaxOwnerStats, formatCarfaxOwnerCount, type CarfaxReport } from "@/lib/carfax-report";
import type { SourceBlockPhotoGroup } from "@/lib/source-block-photo-types";

type Props = {
  value: CarfaxBlockState;
  onChange: (next: CarfaxBlockState) => void;
  readOnly?: boolean;
  disabled?: boolean;
  trafficFillLevel?: TrafficFillLevel;
  sessionId: string;
  pdfInclude?: boolean;
  onPdfIncludeChange?: (next: boolean) => void;
  aiComment?: AdminAiSourceCommentSlot;
  getSourceBlocks?: () => WorkspaceSourceBlocks;
  applyPatchedBlocks?: (patched: Partial<WorkspaceSourceBlocks>, changedKeys: CopilotSourceKey[]) => void;
  photosPersistenceEnabled?: boolean;
  onPhotoGroupsStructuralCommit?: (next: SourceBlockPhotoGroup[]) => void;
};

const STATUS_CLASS: Record<string, string> = {
  ok: "text-emerald-700",
  attention: "text-red-700",
  unavailable: "text-red-700",
};

function Row({ k, v, tone }: { k: string; v: ReactNode; tone?: string }) {
  return (
    <tr className="border-b border-slate-100 last:border-b-0 align-top">
      <td className="w-[38%] px-1.5 py-0.5 text-[var(--color-provin-muted)]">{k}</td>
      <td className={`px-1.5 py-0.5 ${tone ?? "text-[var(--color-apple-text)]"}`}>{v}</td>
    </tr>
  );
}

function Table({ children }: { children: ReactNode }) {
  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-slate-200/90">
      <table className="w-full text-[11px]">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 mt-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
      {children}
    </p>
  );
}

function km(v: string): string {
  return v ? `${Number(v).toLocaleString("lv-LV").replace(/ /g, " ")} km` : "";
}

export function CarfaxReportPanel({ report }: { report: CarfaxReport }) {
  const mc = report.mileageCheck;
  const ownerStats = carfaxOwnerStats(report);
  const head = [report.vehicleTitle, report.vin, report.reportCreatedAt ? `izveidota ${report.reportCreatedAt}` : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="mb-3" data-provin-carfax-report>
      <Sub>
        <AdminProvinLucide icon={SUBHEADING_LUCIDE.ltabCertificate} />
        CARFAX atskaite
      </Sub>
      {head ? <p className="mb-1 text-[11px] text-[var(--color-apple-text)]">{head}</p> : null}
      {report.pdf ? (
        <p className="mb-1 text-[10px] text-[var(--color-provin-muted)]">
          Oriģināls: {report.pdf.name}
          {report.pdf.dropboxPath ? ` · Dropbox ${report.pdf.dropboxPath}` : ""}
        </p>
      ) : null}
      {report.quickChecks.length > 0 ? (
        <Table>
          {report.quickChecks.map((q) => (
            <Row key={q.title} k={q.titleLv} v={q.textLv} tone={STATUS_CLASS[q.status]} />
          ))}
          {mc.statusLv && !report.quickChecks.some((q) => q.title === "Mileage") ? (
            <Row k="Nobraukuma pārbaude" v={mc.statusLv} tone={STATUS_CLASS[mc.status || "ok"]} />
          ) : null}
        </Table>
      ) : null}
      {report.damages.length > 0 ? (
        <>
          <Sub>Bojājumu detaļas</Sub>
          <Table>
            {report.damages.map((d, i) => (
              <Row
                key={`${d.date}-${i}`}
                k={`${d.date}${d.country ? ` · ${d.country}` : ""}`}
                tone="text-red-700"
                v={
                  [
                    d.cause,
                    d.areas.length ? `zonas: ${d.areas.join(", ")}` : "",
                    d.components.length ? `komponentes: ${d.components.join(", ")}` : "",
                    d.severity ? `smagums: ${d.severity}` : "",
                    d.repairCost ? `aplēse: ${d.repairCost}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "detaļas nav norādītas"
                }
              />
            ))}
          </Table>
        </>
      ) : null}
      {mc.lastReadingKm || mc.projectionKm ? (
        <>
          <Sub>Nobraukuma pārbaude</Sub>
          <Table>
            {mc.lastReadingKm ? (
              <Row k="Pēdējais rādījums" v={[km(mc.lastReadingKm), mc.lastReadingDate].filter(Boolean).join(" · ")} />
            ) : null}
            {mc.projectionKm ? <Row k="Prognoze šodien" v={`~${km(mc.projectionKm)}`} /> : null}
            {mc.projectionSimilarKm ? <Row k="Līdzīgiem auto" v={`~${km(mc.projectionSimilarKm)}`} /> : null}
          </Table>
        </>
      ) : null}
      {ownerStats.total > 0 || report.ownersNote ? (
        <>
          <Sub>Īpašnieki</Sub>
          <Table>
            {ownerStats.total > 0 ? (
              <Row
                k={`Īpašnieku skaits${ownerStats.country ? ` · ${ownerStats.country}` : ""}`}
                v={formatCarfaxOwnerCount(ownerStats)}
              />
            ) : null}
            {report.ownersNote ? <Row k="Īpašnieki" v={report.ownersNote} tone="text-red-700" /> : null}
            {report.owners.map((o) => (
              <Row
                key={o.index}
                k={`${o.index}. ${o.country}`}
                v={[o.purchaseYear ? `no ${o.purchaseYear}` : "", o.lengthOfUse, o.ownerType].filter(Boolean).join(" · ") || "-"}
              />
            ))}
          </Table>
        </>
      ) : null}
      {report.vehicle.length + report.technical.length + report.equipment.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Tehniskie dati un komplektācija
          </summary>
          <div className="mt-1">
            <Table>
              {[...report.vehicle, ...report.technical.filter((t) => !report.vehicle.some((v) => v.label === t.label))].map(
                (t) => (
                  <Row key={t.label} k={t.label} v={t.value} />
                ),
              )}
              {report.originalPrice.total ? (
                <Row
                  k="Jauna auto cena"
                  v={`${report.originalPrice.total} (bāze ${report.originalPrice.base || "-"}, opcijas ${report.originalPrice.options || "-"})`}
                />
              ) : null}
              {report.equipment.length > 0 ? <Row k={`Komplektācija (${report.equipment.length})`} v={report.equipment.join("; ")} /> : null}
            </Table>
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function AdminCarfaxSourceBlock({
  value,
  onChange,
  readOnly = false,
  disabled,
  trafficFillLevel,
  sessionId,
  pdfInclude = true,
  onPdfIncludeChange,
  aiComment,
  getSourceBlocks,
  applyPatchedBlocks,
  photosPersistenceEnabled = false,
  onPhotoGroupsStructuralCommit,
}: Props) {
  const report = value?.report;
  return (
    <AdminVendorAvotuSourceBlock
      blockKey="carfax"
      value={value}
      readOnly={readOnly}
      disabled={disabled}
      onChange={(next: VendorAvotuBlockState) => onChange(next as CarfaxBlockState)}
      trafficFillLevel={trafficFillLevel}
      sessionId={sessionId}
      pdfInclude={pdfInclude}
      onPdfIncludeChange={onPdfIncludeChange}
      aiComment={aiComment}
      getSourceBlocks={getSourceBlocks}
      applyPatchedBlocks={applyPatchedBlocks}
      photosPersistenceEnabled={photosPersistenceEnabled}
      onPhotoGroupsStructuralCommit={onPhotoGroupsStructuralCommit}
      extraPanel={report ? <CarfaxReportPanel report={report} /> : null}
    />
  );
}
