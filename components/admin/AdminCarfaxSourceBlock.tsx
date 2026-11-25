"use client";

/**
 * CARFAX avota bloks: tā pati forma kā AutoDNA / CarVertical (nobraukums, negadījumi, laikposms,
 * komentāri, foto) + strukturētās atskaites kopsavilkums (`report`), ko aizpilda PDF parsētājs.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { AdminVendorAvotuSourceBlock } from "@/components/admin/AdminVendorAvotuSourceBlock";
import type { AdminAiSourceCommentSlot } from "@/components/admin/AdminSourceCommentField";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import { useAdminVinHandoff } from "@/components/admin/AdminVinHandoffContext";
import { adminProBtn } from "@/lib/admin-pro-tones";
import {
  CARFAX_PURCHASE_CONFIRM_LV,
  carfaxPreviewUrl,
  carfaxPurchasePending,
  type CarfaxUnmatchedPdf,
} from "@/lib/carfax-inbox-logic";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
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

type InboxState = { serverPdf: CarfaxReport["pdf"] | null; unmatched: CarfaxUnmatchedPdf[] };

/**
 * «Pirkt CARFAX»: pēc apstiprinājuma atver carfax.eu priekšskatījumu ar VIN (kredītu izlieto Nils savā pārlūkā) un
 * pasūtījumā saglabā klikšķa laiku (`purchase`) - pasta ielase zina, kuram pasūtījumam PDF gaidīt.
 * PDF pats ienāk no info@provin.lv pasta (`/api/carfax/pdf-inbox`); nepiesaistītos PDF ar šo VIN var pievienot šeit.
 */
function CarfaxPurchasePanel({
  value,
  onChange,
  readOnly,
  disabled,
  sessionId,
  getSourceBlocks,
  applyPatchedBlocks,
}: Pick<Props, "value" | "onChange" | "readOnly" | "disabled" | "sessionId" | "getSourceBlocks" | "applyPatchedBlocks">) {
  const handoffVin = useAdminVinHandoff()?.vin ?? "";
  const vin = normalizeVin(handoffVin || getSourceBlocks?.().csdd.vin || value?.report?.vin || "");
  const ready = isValidVin(vin);
  const [now, setNow] = useState(() => Date.now());
  const [inbox, setInbox] = useState<InboxState | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const pending = carfaxPurchasePending(value, now);
  const localMd5 = value?.report?.pdf?.md5 ?? "";
  const serverPdf = inbox?.serverPdf;
  const receivedOnServer = Boolean(serverPdf?.md5 && serverPdf.via === "email" && serverPdf.md5 !== localMd5);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      const qs = new URLSearchParams({ sessionId, vin: ready ? vin : "" });
      const res = await fetch(`/api/admin/carfax/inbox?${qs.toString()}`, { cache: "no-store" });
      if (res.ok) setInbox((await res.json()) as InboxState);
    } catch {
      /* nākamajā reizē */
    }
    setNow(Date.now());
  }, [sessionId, vin, ready]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!pending || receivedOnServer) return;
    const t = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(t);
  }, [pending, receivedOnServer, refresh]);

  const onBuy = () => {
    if (readOnly || disabled || !ready) return;
    const url = carfaxPreviewUrl(vin);
    if (!url) return;
    const already = value?.report?.pdf && normalizeVin(value.report.vin) === vin;
    const msg = already ? `Šim VIN CARFAX PDF jau ir pasūtījumā. ${CARFAX_PURCHASE_CONFIRM_LV}` : CARFAX_PURCHASE_CONFIRM_LV;
    if (!window.confirm(msg)) return;
    window.open(url, "_blank", "noopener,noreferrer");
    onChange({ ...value, purchase: { requestedAt: new Date().toISOString(), vin } });
    setNow(Date.now());
  };

  const onAttach = async (md5: string) => {
    if (readOnly || disabled || busy) return;
    setBusy(md5);
    setError("");
    try {
      const res = await fetch("/api/admin/carfax/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, md5, sourceBlocks: getSourceBlocks?.() ?? {} }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        patchedSourceBlocks?: Partial<WorkspaceSourceBlocks>;
        changedKeys?: CopilotSourceKey[];
        error?: string;
      };
      if (!res.ok || !data.patchedSourceBlocks) {
        setError(data.error === "duplicate" ? "Šis PDF jau ir pasūtījumā" : "Neizdevās pievienot");
        return;
      }
      if (applyPatchedBlocks) applyPatchedBlocks(data.patchedSourceBlocks, data.changedKeys ?? ["carfax"]);
      else if (data.patchedSourceBlocks.carfax) onChange(data.patchedSourceBlocks.carfax);
      await refresh();
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mb-2" data-provin-carfax-purchase>
      <button type="button" disabled={readOnly || disabled || !ready} onClick={onBuy} className={adminProBtn("money")}>
        Pirkt CARFAX
      </button>
      {receivedOnServer ? (
        <p className="mt-1 text-[11px] text-emerald-700">CARFAX PDF saņemts no pasta - pārlādē lapu</p>
      ) : pending ? (
        <p className="mt-1 text-[11px] text-slate-600">Gaida CARFAX PDF no pasta…</p>
      ) : null}
      {(inbox?.unmatched ?? []).map((u) => (
        <div key={u.md5} className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-red-700">
            Pastā PDF bez pasūtījuma: {u.fileName}
            {u.receivedAt ? ` · ${new Date(u.receivedAt).toLocaleString("lv-LV")}` : ""}
          </span>
          <button
            type="button"
            disabled={readOnly || disabled || Boolean(busy)}
            onClick={() => void onAttach(u.md5)}
            className={adminProBtn("neutral")}
          >
            {busy === u.md5 ? "Pievieno…" : "Pievienot šim pasūtījumam"}
          </button>
        </div>
      ))}
      {error ? <p className="mt-1 text-[11px] text-red-700">{error}</p> : null}
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
      extraPanel={
        <>
          <CarfaxPurchasePanel
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            disabled={disabled}
            sessionId={sessionId}
            getSourceBlocks={getSourceBlocks}
            applyPatchedBlocks={applyPatchedBlocks}
          />
          {report ? <CarfaxReportPanel report={report} /> : null}
        </>
      }
    />
  );
}
