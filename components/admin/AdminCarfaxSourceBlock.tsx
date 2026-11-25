"use client";

/**
 * CARFAX - patstāvīgs avota bloks (Nila norādījums 25.11): savs virsraksts, statuss, pogas («Pirkt CARFAX»,
 * PDF augšupielāde, «Gaida PDF no pasta»), savas tabulas no strukturētās atskaites (`report`).
 * Nav AutoDNA / CarVertical bloks un neizmanto to komponenti; kopējās tabulās CARFAX ieraksti iet ar avotu «CARFAX».
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";

import type { AdminAiSourceCommentSlot } from "@/components/admin/AdminSourceCommentField";
import { AdminSourceCommentField } from "@/components/admin/AdminSourceCommentField";
import { AdminAiContextRawField } from "@/components/admin/AdminAiContextRawField";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import { AdminSourceBlockHeaderTools } from "@/components/admin/AdminClearSourceBlockButton";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { AdminSourceBlockPhotos } from "@/components/admin/AdminSourceBlockPhotos";
import { AdminHistoryVendorPdfUpload } from "@/components/admin/AdminHistoryVendorPdfUpload";
import { AdminFieldResetButton } from "@/components/admin/AdminFieldResetButton";
import { CountryFlagWithCode } from "@/components/admin/CountryFlagWithCode";
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
import {
  emptyCarfaxBlock,
  SOURCE_BLOCK_LABELS,
  type CarfaxBlockState,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { SUBHEADING_LUCIDE } from "@/lib/admin-lucide-registry";
import { ADMIN_SOURCE_DATA_TABLE_CLASS } from "@/lib/admin-source-data-table";
import { formatAutoRecordsDateForOutput, sortAutoRecordsDescending } from "@/lib/auto-records-paste-parse";
import { carfaxComponentLv, carfaxOwnerStats, formatCarfaxOwnerCount, type CarfaxReport } from "@/lib/carfax-report";
import type { CarVerticalTimelineRow } from "@/lib/carvertical-pdf-parse";
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

const cell = "px-1.5 py-0.5 align-top";

function Sub({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 mt-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
      {children}
    </p>
  );
}

function Wrap({ children, minW = 280 }: { children: ReactNode; minW?: number }) {
  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-slate-200/90">
      <table className={`${ADMIN_SOURCE_DATA_TABLE_CLASS} text-[var(--color-apple-text)]`} style={{ minWidth: minW }}>
        {children}
      </table>
    </div>
  );
}

function Head({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
        {cols.map((c, i) => (
          <th key={`${c}-${i}`} className={cell}>
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function KvRow({ k, v, tone }: { k: string; v: ReactNode; tone?: string }) {
  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <td className={`${cell} w-[38%] text-[var(--color-provin-muted)]`}>{k}</td>
      <td className={`${cell} ${tone ?? "text-[var(--color-apple-text)]"}`}>{v}</td>
    </tr>
  );
}

/** „194280” → „194 280”. */
function kmNum(v: string): string {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n.toLocaleString("lv-LV").replace(/\s/g, " ") : "";
}

function km(v: string): string {
  const n = kmNum(v);
  return n ? `${n} km` : "";
}

/** Ātrā pārbaude, bojājumi, nobraukuma pārbaude, īpašnieki un tehniskie dati no CARFAX atskaites. */
export function CarfaxReportPanel({ report }: { report: CarfaxReport }) {
  const mc = report.mileageCheck;
  const ownerStats = carfaxOwnerStats(report);
  const head = [report.vehicleTitle, report.vin, report.reportCreatedAt ? `izveidota ${report.reportCreatedAt}` : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <div data-provin-carfax-report>
      {head ? <p className="mt-1 text-[11px] font-medium text-[var(--color-apple-text)]">{head}</p> : null}
      {report.pdf ? (
        <p className="text-[10px] text-[var(--color-provin-muted)]">
          Oriģināls: {report.pdf.name}
          {report.pdf.via === "email" ? " · no pasta" : ""}
          {report.pdf.dropboxPath ? ` · Dropbox ${report.pdf.dropboxPath}` : ""}
        </p>
      ) : null}

      {report.quickChecks.length > 0 || mc.statusLv ? (
        <>
          <Sub>
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.ltabCertificate} />
            Ātrā pārbaude
          </Sub>
          <Wrap>
            <tbody>
              {report.quickChecks.map((q) => (
                <KvRow key={q.title} k={q.titleLv} v={q.textLv} tone={STATUS_CLASS[q.status]} />
              ))}
              {mc.statusLv && !report.quickChecks.some((q) => q.title === "Mileage") ? (
                <KvRow k="Nobraukuma pārbaude" v={mc.statusLv} tone={STATUS_CLASS[mc.status || "ok"]} />
              ) : null}
            </tbody>
          </Wrap>
        </>
      ) : null}

      <Sub>
        <AdminProvinLucide icon={SUBHEADING_LUCIDE.incidents} />
        Bojājumi (CARFAX)
      </Sub>
      {report.damages.length > 0 ? (
        <Wrap minW={320}>
          <Head cols={["Datums", "Remonta aplēse", "Valsts"]} />
          <tbody data-provin-carfax-damages>
            {report.damages.map((d, i) => (
              <DamageRows
                key={`${d.date}-${i}`}
                date={d.date}
                amount={d.repairCost}
                country={d.country}
                sides={d.areas.join(", ")}
                groups={d.components.map(carfaxComponentLv).join(", ")}
                note={[d.cause, d.severity ? `smagums: ${d.severity}` : ""].filter(Boolean).join(" · ")}
              />
            ))}
          </tbody>
        </Wrap>
      ) : (
        <p
          className={`rounded-lg border border-dashed border-slate-200/90 bg-slate-50/60 px-3 py-2 text-[11px] ${
            report.noDamageReported ? "text-emerald-700" : "text-[var(--color-provin-muted)]"
          }`}
        >
          {report.noDamageReported ? "CARFAX bojājumus nav saņēmis" : "Bojājumu ierakstu nav"}
        </p>
      )}

      {mc.lastReadingKm || mc.projectionKm ? (
        <>
          <Sub>
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.mileage} />
            Nobraukuma pārbaude
          </Sub>
          <Wrap>
            <tbody>
              {mc.lastReadingKm ? (
                <KvRow k="Pēdējais rādījums" v={[km(mc.lastReadingKm), mc.lastReadingDate].filter(Boolean).join(" · ")} />
              ) : null}
              {mc.projectionKm ? <KvRow k="Prognoze šodien" v={`~${km(mc.projectionKm)}`} /> : null}
              {mc.projectionSimilarKm ? <KvRow k="Līdzīgiem auto" v={`~${km(mc.projectionSimilarKm)}`} /> : null}
            </tbody>
          </Wrap>
        </>
      ) : null}

      {ownerStats.total > 0 || report.ownersNote ? (
        <>
          <Sub>Īpašnieki</Sub>
          <Wrap>
            <tbody>
              {ownerStats.total > 0 ? (
                <KvRow
                  k={`Īpašnieku skaits${ownerStats.country ? ` · ${ownerStats.country}` : ""}`}
                  v={formatCarfaxOwnerCount(ownerStats)}
                />
              ) : null}
              {report.ownersNote ? <KvRow k="Īpašnieki" v={report.ownersNote} tone="text-red-700" /> : null}
              {report.owners.map((o) => (
                <KvRow
                  key={o.index}
                  k={`${o.index}. ${o.country}`}
                  v={[o.purchaseYear ? `no ${o.purchaseYear}` : "", o.lengthOfUse, o.ownerType].filter(Boolean).join(" · ") || "-"}
                />
              ))}
            </tbody>
          </Wrap>
        </>
      ) : null}

      {report.vehicle.length + report.technical.length + report.equipment.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Tehniskie dati un komplektācija
          </summary>
          <div className="mt-1">
            <Wrap>
              <tbody>
                {[...report.vehicle, ...report.technical.filter((t) => !report.vehicle.some((v) => v.label === t.label))].map(
                  (t) => (
                    <KvRow key={t.label} k={t.label} v={t.value} />
                  ),
                )}
                {report.originalPrice.total ? (
                  <KvRow
                    k="Jauna auto cena"
                    v={`${report.originalPrice.total} (bāze ${report.originalPrice.base || "-"}, opcijas ${report.originalPrice.options || "-"})`}
                  />
                ) : null}
                {report.equipment.length > 0 ? (
                  <KvRow k={`Komplektācija (${report.equipment.length})`} v={report.equipment.join("; ")} />
                ) : null}
              </tbody>
            </Wrap>
          </div>
        </details>
      ) : null}
    </div>
  );
}

/** Negadījuma rinda + zonu / grupu apakšrinda (tas pats izkārtojums kā CarVertical bojājumu detaļām). */
function DamageRows({
  date,
  amount,
  country,
  sides,
  groups,
  note,
  onRemove,
}: {
  date: string;
  amount: string;
  country: string;
  sides: string;
  groups: string;
  note?: string;
  onRemove?: () => void;
}) {
  const showSub = Boolean(sides || groups || note);
  return (
    <>
      <tr className={showSub ? "" : "border-b border-slate-100 last:border-b-0"}>
        <td className={`${cell} tabular-nums text-[var(--color-apple-text)]`}>{date || "-"}</td>
        <td className={`${cell} font-medium text-red-700`}>{amount || "Dati nav pieejami"}</td>
        <td className={cell}>
          <CountryFlagWithCode countryLabel={country || "-"} />
        </td>
        {onRemove ? (
          <td className={cell}>
            <AdminFieldResetButton title="Nodzēst rindu" aria-label={`Nodzēst CARFAX negadījumu ${date}`} onClick={onRemove} />
          </td>
        ) : null}
      </tr>
      {showSub ? (
        <tr className="border-b border-slate-100/80 bg-slate-50/80">
          <td colSpan={onRemove ? 4 : 3} className={`${cell} py-1`}>
            <div className="overflow-hidden rounded-md border border-slate-200/90 bg-white/90 shadow-sm">
              <div className="grid grid-cols-2 gap-2 border-b border-slate-200/80 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-500">
                <span>Bojātā puse</span>
                <span>Bojājumu grupas</span>
              </div>
              <div className="grid grid-cols-2 gap-2 px-2 py-1 text-[11px]">
                <span className="font-medium text-[var(--color-apple-text)]">{sides || "-"}</span>
                <span className="text-[var(--color-provin-muted)]">{groups || "-"}</span>
              </div>
              {note ? <p className="border-t border-slate-200/80 px-2 py-0.5 text-[10px] text-slate-600">{note}</p> : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
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

/** Nobraukuma rādījumi no CARFAX (kopējā nobraukuma tabulā - ar avotu «CARFAX»). */
function CarfaxMileageTable({
  value,
  onChange,
  editable,
}: {
  value: CarfaxBlockState;
  onChange: (next: CarfaxBlockState) => void;
  editable: boolean;
}) {
  const rows = sortAutoRecordsDescending([...(value.serviceHistory ?? [])]);
  if (rows.length === 0) return null;
  const remove = (row: (typeof rows)[number]) =>
    onChange({ ...value, serviceHistory: (value.serviceHistory ?? []).filter((r) => r !== row) });
  return (
    <>
      <Sub>
        <AdminProvinLucide icon={SUBHEADING_LUCIDE.mileage} />
        Nobraukums (CARFAX)
      </Sub>
      <Wrap>
        <Head cols={["Datums", "Odometrs (km)", "Valsts", ...(editable ? [""] : [])]} />
        <tbody data-provin-carfax-mileage>
          {rows.map((r, i) => (
            <tr key={`${r.date}-${r.odometer}-${i}`} className="border-b border-slate-100 last:border-b-0">
              <td className={`${cell} tabular-nums`}>{formatAutoRecordsDateForOutput(r.date) || "-"}</td>
              <td className={`${cell} tabular-nums`}>{kmNum(r.odometer) || r.odometer || "-"}</td>
              <td className={cell}>
                <CountryFlagWithCode countryLabel={r.country || "-"} />
              </td>
              {editable ? (
                <td className={cell}>
                  <AdminFieldResetButton
                    title="Nodzēst rindu"
                    aria-label={`Nodzēst CARFAX nobraukumu ${r.date}`}
                    onClick={() => remove(r)}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </Wrap>
    </>
  );
}

/** CARFAX vēstures ieraksti; ķeksis «PDF» - vai rinda iet klienta PDF laikposmā. */
function CarfaxHistoryTable({
  value,
  onChange,
  editable,
}: {
  value: CarfaxBlockState;
  onChange: (next: CarfaxBlockState) => void;
  editable: boolean;
}) {
  const rows = (value.vehicleHistoryTimeline ?? []).filter((r) => r.date.trim() || r.description.trim());
  if (rows.length === 0) return null;
  const toggle = (row: CarVerticalTimelineRow) =>
    onChange({
      ...value,
      vehicleHistoryTimeline: (value.vehicleHistoryTimeline ?? []).map((r) =>
        r === row ? { ...r, includeInPdf: r.includeInPdf === false } : r,
      ),
    });
  return (
    <details className="mt-3" open={rows.length <= 12}>
      <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-wide text-slate-500">
        Vēsture (CARFAX) · {rows.length}
      </summary>
      <div className="mt-1">
        <Wrap minW={360}>
          <Head cols={["Datums", "km", "Valsts", "Notikums", "PDF"]} />
          <tbody data-provin-carfax-history>
            {rows.map((r, i) => (
              <tr key={`${r.date}-${i}`} className="border-b border-slate-100 last:border-b-0">
                <td className={`${cell} whitespace-nowrap tabular-nums`}>{r.date || "-"}</td>
                <td className={`${cell} whitespace-nowrap tabular-nums`}>{r.odometer ? kmNum(r.odometer) : ""}</td>
                <td className={cell}>{r.country ? <CountryFlagWithCode countryLabel={r.country} /> : null}</td>
                <td className={cell}>{r.description}</td>
                <td className={cell}>
                  <input
                    type="checkbox"
                    checked={r.includeInPdf !== false}
                    disabled={!editable}
                    onChange={() => toggle(r)}
                    aria-label={`CARFAX vēstures rinda ${r.date} klienta PDF`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Wrap>
      </div>
    </details>
  );
}

/** Negadījumi bez strukturētās atskaites (vecie dati / Copilot rindas) - tajā pašā izkārtojumā. */
function CarfaxIncidentRows({
  value,
  onChange,
  editable,
}: {
  value: CarfaxBlockState;
  onChange: (next: CarfaxBlockState) => void;
  editable: boolean;
}) {
  const rows = (value.incidents ?? []).filter((r) => r.csngDate.trim() || r.lossAmount.trim() || r.incidentNo.trim());
  if (rows.length === 0) return null;
  const details = value.damageDetails ?? [];
  return (
    <>
      <Sub>
        <AdminProvinLucide icon={SUBHEADING_LUCIDE.incidents} />
        Negadījumi (CARFAX)
      </Sub>
      <Wrap minW={320}>
        <Head cols={["Datums", "Zaudējumu summa", "Valsts", ...(editable ? [""] : [])]} />
        <tbody>
          {rows.map((r, i) => {
            const d = details.find((x) => x.date.trim() === r.csngDate.trim());
            return (
              <DamageRows
                key={`${r.csngDate}-${i}`}
                date={r.csngDate}
                amount={r.lossAmount}
                country={r.incidentNo}
                sides={d?.damagedSides ?? ""}
                groups={d?.damageGroups ?? ""}
                onRemove={
                  editable
                    ? () => onChange({ ...value, incidents: (value.incidents ?? []).filter((x) => x !== r) })
                    : undefined
                }
              />
            );
          })}
        </tbody>
      </Wrap>
    </>
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
  const block: CarfaxBlockState = value && typeof value === "object" ? value : emptyCarfaxBlock();
  const report = block.report;
  const editable = !readOnly && !disabled;
  const hasRows =
    (block.serviceHistory ?? []).length > 0 ||
    (block.incidents ?? []).length > 0 ||
    (block.vehicleHistoryTimeline ?? []).length > 0;

  return (
    <AdminCollapsibleShell
      sessionId={sessionId}
      blockId="carfax"
      header={<AdminSourceBlockHeader blockKey="carfax" trafficFillLevel={trafficFillLevel} className="mb-0 shrink-0" />}
      headerActions={
        <AdminSourceBlockHeaderTools
          sourceLabel={SOURCE_BLOCK_LABELS.carfax}
          readOnly={readOnly}
          disabled={disabled}
          onClear={() => onChange(emptyCarfaxBlock())}
        >
          {onPdfIncludeChange ? <AdminPdfIncludeToggle checked={pdfInclude} onChange={onPdfIncludeChange} /> : null}
        </AdminSourceBlockHeaderTools>
      }
    >
      <div className={`flex min-h-0 flex-col overflow-hidden ${trafficFillLevel ? "p-0" : "p-2"}`} data-provin-block="carfax">
        <div className={`min-h-0 flex-1 overflow-y-auto ${trafficFillLevel ? "px-2 pt-2" : ""}`}>
          <CarfaxPurchasePanel
            value={block}
            onChange={onChange}
            readOnly={readOnly}
            disabled={disabled}
            sessionId={sessionId}
            getSourceBlocks={getSourceBlocks}
            applyPatchedBlocks={applyPatchedBlocks}
          />
          {getSourceBlocks && applyPatchedBlocks ? (
            <AdminHistoryVendorPdfUpload
              target="carfax"
              sessionId={sessionId}
              disabled={disabled}
              readOnly={readOnly}
              getSourceBlocks={getSourceBlocks}
              applyPatchedBlocks={applyPatchedBlocks}
            />
          ) : null}
          {report ? <CarfaxReportPanel report={report} /> : null}
          {!report && !hasRows ? (
            <p className="mt-2 rounded-lg border border-dashed border-slate-200/90 bg-slate-50/60 px-3 py-2 text-[11px] text-[var(--color-provin-muted)]">
              CARFAX atskaite nav ielasīta
            </p>
          ) : null}
          {!report ? <CarfaxIncidentRows value={block} onChange={onChange} editable={editable} /> : null}
          <CarfaxMileageTable value={block} onChange={onChange} editable={editable} />
          <CarfaxHistoryTable value={block} onChange={onChange} editable={editable} />
        </div>

        <div className={`mt-auto w-full min-w-0 shrink-0 pt-2 ${trafficFillLevel ? "px-2 pb-2" : ""}`}>
          {sessionId && onPhotoGroupsStructuralCommit ? (
            <AdminSourceBlockPhotos
              sessionId={sessionId}
              photoGroups={block.photoGroups ?? []}
              disabled={readOnly || !!disabled || !photosPersistenceEnabled}
              onCommit={onPhotoGroupsStructuralCommit}
              hidePhotoWatermarks={block.hidePhotoWatermarks === true}
              onHidePhotoWatermarksChange={(next) => onChange({ ...block, hidePhotoWatermarks: next })}
            />
          ) : null}
          <AdminSourceCommentField
            label="Komentāri:"
            value={block.comments ?? ""}
            onChange={(next) => onChange({ ...block, comments: next })}
            readOnly={readOnly}
            disabled={disabled}
            compact
            ai={aiComment}
            aria-label="CARFAX - komentāri"
          />
          <AdminAiContextRawField
            value={block.aiContextRaw ?? ""}
            onChange={(next) => onChange({ ...block, aiContextRaw: next })}
            readOnly={readOnly}
            disabled={disabled}
            ariaLabel="CARFAX - AI papildu konteksts"
          />
        </div>
      </div>
    </AdminCollapsibleShell>
  );
}
