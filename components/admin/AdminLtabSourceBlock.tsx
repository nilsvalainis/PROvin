"use client";

import {
  AdminSourceCommentField,
  type AdminGeminiSourceCommentSlot,
} from "@/components/admin/AdminSourceCommentField";
import { AdminGeminiContextRawField } from "@/components/admin/AdminGeminiContextRawField";
import { LossAmountFieldChrome } from "@/components/admin/LossAmountFieldChrome";
import { CountryFlagWithCode } from "@/components/admin/CountryFlagWithCode";
import { AdminCountryCombobox } from "@/components/admin/AdminCountryCombobox";
import { AdminIncidentFieldFillOption } from "@/components/admin/AdminIncidentFieldFillOption";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import { AdminHistoryVendorPdfUpload } from "@/components/admin/AdminHistoryVendorPdfUpload";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import type { CopilotSourceKey } from "@/lib/admin-copilot-types";
import type { LtabBlockState, LtabIncidentRow, WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { SUBHEADING_LUCIDE } from "@/lib/admin-lucide-registry";
import {
  emptyLtabCertificateClaim,
  formatLtabCertificateAmountEur,
  LTAB_CERTIFICATE_FOOTER_DEFAULT,
  LTAB_CERTIFICATE_SECTION_LABEL,
  LTAB_CERTIFICATE_TITLE,
  ltabCertificateHasContent,
  type LtabCertificate,
  type LtabCertificateClaim,
} from "@/lib/ltab-report-extract";
import { normalizeLossAmountEurDisplay } from "@/lib/loss-amount-format";
import {
  ADMIN_INCIDENT_DATA_UNAVAILABLE,
  isIncidentDataUnavailableText,
} from "@/lib/admin-incident-field-presets";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { emptyLtabRow } from "@/lib/admin-source-blocks";
import {
  LTAB_COMMENT_TEMPLATES,
  applyLtabCommentTemplate,
} from "@/lib/admin-ltab-comment-presets";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const mileCell = "px-1.5 py-0.5";

type Props = {
  value: LtabBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: LtabBlockState) => void;
  trafficFillLevel?: TrafficFillLevel;
  sessionId: string;
  pdfInclude: boolean;
  onPdfIncludeChange: (next: boolean) => void;
  geminiComment?: AdminGeminiSourceCommentSlot;
  getSourceBlocks?: () => WorkspaceSourceBlocks;
  applyPatchedBlocks?: (
    patched: Partial<WorkspaceSourceBlocks>,
    changedKeys: CopilotSourceKey[],
  ) => void;
};

export function AdminLtabSourceBlock({
  value,
  readOnly,
  disabled,
  onChange,
  trafficFillLevel,
  sessionId,
  pdfInclude,
  onPdfIncludeChange,
  geminiComment,
  getSourceBlocks,
  applyPatchedBlocks,
}: Props) {
  const setRow = (index: number, patch: Partial<LtabIncidentRow>) => {
    const rows = value.rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange({ ...value, rows });
  };

  const addRow = () => {
    onChange({ ...value, rows: [...value.rows, emptyLtabRow()] });
  };

  const removeRow = (index: number) => {
    if (value.rows.length <= 1) return;
    onChange({ ...value, rows: value.rows.filter((_, i) => i !== index) });
  };

  const cert: LtabCertificate = value.certificate ?? {
    issuedAt: "",
    vehicleLine: "",
    makeModel: "",
    year: "",
    plate: "",
    accidentCount: "",
    insuredFrom: "",
    insuredTo: "",
    insuredDays: "",
    claims: [],
    footerNote: "",
  };

  const patchCert = (patch: Partial<LtabCertificate>) => {
    onChange({ ...value, certificate: { ...cert, ...patch } });
  };

  const setClaim = (index: number, patch: Partial<LtabCertificateClaim>) => {
    const base = cert.claims.length > 0 ? cert.claims : [emptyLtabCertificateClaim()];
    const claims = base.map((r, i) => (i === index ? { ...r, ...patch } : r));
    patchCert({ claims });
  };

  const addClaim = () => {
    patchCert({ claims: [...cert.claims, emptyLtabCertificateClaim()] });
  };

  const removeClaim = (index: number) => {
    patchCert({ claims: cert.claims.filter((_, i) => i !== index) });
  };

  const showCertificate = ltabCertificateHasContent(value.certificate) || !readOnly;

  return (
    <AdminCollapsibleShell
      sessionId={sessionId}
      blockId="ltab"
      header={
        <AdminSourceBlockHeader
          blockKey="ltab"
          trafficFillLevel={trafficFillLevel}
          className={`shrink-0 ${trafficFillLevel ? "mb-0" : "mb-0"}`}
        />
      }
      headerActions={<AdminPdfIncludeToggle checked={pdfInclude} onChange={onPdfIncludeChange} />}
    >
      <div className={`flex h-full min-h-0 flex-col overflow-hidden ${trafficFillLevel ? "p-0" : "p-2"}`}>
          <div className={`min-h-0 flex-1 overflow-y-auto ${trafficFillLevel ? "px-2 pt-2" : ""}`}>
            {getSourceBlocks && applyPatchedBlocks ? (
              <AdminHistoryVendorPdfUpload
                target="ltab"
                sessionId={sessionId}
                disabled={disabled}
                readOnly={readOnly}
                getSourceBlocks={getSourceBlocks}
                applyPatchedBlocks={applyPatchedBlocks}
              />
            ) : null}
            <p className="mb-1.5 mt-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              <AdminProvinLucide icon={SUBHEADING_LUCIDE.incidents} />
              Negadījumi (datums · summa · valsts)
            </p>
            <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-slate-200/90">
              <table className="w-full min-w-[280px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                    <th className={mileCell}>Datums</th>
                    <th className={mileCell}>Zaudējumu summa:</th>
                    <th className={mileCell}>Valsts</th>
                    {!readOnly ? <th className={`w-9 ${mileCell}`} aria-hidden /> : null}
                  </tr>
                </thead>
                <tbody>
                  {value.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-100 last:border-b-0">
                      <td className={`${mileCell} align-top`}>
                        {readOnly ? (
                          <span className="text-[var(--color-provin-muted)]">{row.csngDate.trim() || "—"}</span>
                        ) : (
                          <div>
                            <input
                              type="text"
                              className={inp}
                              placeholder="piem., 2024"
                              value={row.csngDate}
                              disabled={disabled}
                              onChange={(e) => setRow(ri, { csngDate: e.target.value })}
                              aria-label={`LTAB Datums, rinda ${ri + 1}`}
                            />
                            <AdminIncidentFieldFillOption
                              value={row.csngDate}
                              disabled={disabled}
                              onFill={() => setRow(ri, { csngDate: ADMIN_INCIDENT_DATA_UNAVAILABLE })}
                            />
                          </div>
                        )}
                      </td>
                      <td className={`${mileCell} align-top`}>
                        <LossAmountFieldChrome value={row.lossAmount}>
                          {readOnly ? (
                            <span
                              className={
                                !row.lossAmount.trim()
                                  ? "text-[var(--color-provin-muted)]"
                                  : "font-semibold"
                              }
                            >
                              {row.lossAmount.trim() || "—"}
                            </span>
                          ) : (
                            <div>
                              <input
                                type="text"
                                className={`${inp} max-w-full border-0 bg-transparent shadow-none ring-0 focus:ring-0`}
                                placeholder="2930.00 €"
                                value={row.lossAmount}
                                disabled={disabled}
                                onChange={(e) => setRow(ri, { lossAmount: e.target.value })}
                                onBlur={(e) => {
                                  if (isIncidentDataUnavailableText(e.target.value)) return;
                                  const n = normalizeLossAmountEurDisplay(e.target.value);
                                  if (n !== e.target.value.trim()) setRow(ri, { lossAmount: n });
                                }}
                                aria-label={`LTAB Zaudējumu summa, rinda ${ri + 1}`}
                              />
                              <AdminIncidentFieldFillOption
                                value={row.lossAmount}
                                disabled={disabled}
                                onFill={() => setRow(ri, { lossAmount: ADMIN_INCIDENT_DATA_UNAVAILABLE })}
                              />
                            </div>
                          )}
                        </LossAmountFieldChrome>
                      </td>
                      <td className={`${mileCell} align-top`}>
                        {readOnly ? (
                          <CountryFlagWithCode countryLabel={row.incidentNo.trim() || "—"} />
                        ) : (
                          <div>
                            <AdminCountryCombobox
                              className={inp}
                              placeholder="Latvija"
                              value={row.incidentNo}
                              disabled={disabled}
                              onChange={(next) => setRow(ri, { incidentNo: next })}
                              aria-label={`LTAB Valsts, rinda ${ri + 1}`}
                            />
                            <AdminIncidentFieldFillOption
                              value={row.incidentNo}
                              disabled={disabled}
                              onFill={() => setRow(ri, { incidentNo: ADMIN_INCIDENT_DATA_UNAVAILABLE })}
                            />
                          </div>
                        )}
                      </td>
                      {!readOnly ? (
                        <td className={`${mileCell} align-top`}>
                          {value.rows.length > 1 ? (
                            <button
                              type="button"
                              disabled={disabled}
                              className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                              onClick={() => removeRow(ri)}
                              title="Noņemt rindu"
                            >
                              ×
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!readOnly && !disabled ? (
              <button
                type="button"
                className="mt-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
                onClick={addRow}
              >
                + Rinda
              </button>
            ) : null}

            {showCertificate ? (
              <div className="mt-3 overflow-hidden rounded-lg border border-slate-200/90 bg-white">
                <p className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  <AdminProvinLucide icon={SUBHEADING_LUCIDE.ltabCertificate} />
                  {LTAB_CERTIFICATE_SECTION_LABEL}
                </p>
                <div className="space-y-2 px-2.5 py-2">
                  <p className="text-[12px] font-semibold text-[var(--color-apple-text)]">
                    {cert.issuedAt.trim()
                      ? `${LTAB_CERTIFICATE_TITLE} uz ${cert.issuedAt}`
                      : LTAB_CERTIFICATE_TITLE}
                  </p>
                  {readOnly ? (
                    <>
                      {cert.vehicleLine.trim() ? (
                        <p className="text-[11px] leading-snug text-[var(--color-apple-text)]">{cert.vehicleLine}</p>
                      ) : null}
                      {cert.accidentCount.trim() ? (
                        <p className="text-[11px] text-[var(--color-apple-text)]">
                          Negadījumu skaits: {cert.accidentCount}
                        </p>
                      ) : null}
                      {cert.insuredFrom.trim() || cert.insuredTo.trim() || cert.insuredDays.trim() ? (
                        <p className="text-[11px] text-[var(--color-apple-text)]">
                          Laikā no {cert.insuredFrom || "—"} līdz {cert.insuredTo || "—"}
                          {cert.insuredDays.trim() ? ` apdrošināts ${cert.insuredDays} dienas.` : "."}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <span className="mb-0.5 block text-[9px] font-medium uppercase tracking-wide text-slate-500">
                          Izziņa uz
                        </span>
                        <input
                          className={inp}
                          placeholder="13.08.2026 20:06:02"
                          value={cert.issuedAt}
                          disabled={disabled}
                          onChange={(e) => patchCert({ issuedAt: e.target.value })}
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-0.5 block text-[9px] font-medium uppercase tracking-wide text-slate-500">
                          Transportlīdzeklis
                        </span>
                        <input
                          className={inp}
                          placeholder="AUDI A6 AVANT, izlaiduma gads 2016. Valsts numura zīme OB5401."
                          value={cert.vehicleLine}
                          disabled={disabled}
                          onChange={(e) => patchCert({ vehicleLine: e.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-0.5 block text-[9px] font-medium uppercase tracking-wide text-slate-500">
                          Negadījumu skaits
                        </span>
                        <input
                          className={inp}
                          placeholder="2"
                          value={cert.accidentCount}
                          disabled={disabled}
                          onChange={(e) => patchCert({ accidentCount: e.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-0.5 block text-[9px] font-medium uppercase tracking-wide text-slate-500">
                          Apdrošināts (dienas)
                        </span>
                        <input
                          className={inp}
                          placeholder="2216"
                          value={cert.insuredDays}
                          disabled={disabled}
                          onChange={(e) => patchCert({ insuredDays: e.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-0.5 block text-[9px] font-medium uppercase tracking-wide text-slate-500">
                          Periods no
                        </span>
                        <input
                          className={inp}
                          placeholder="31.07.2019"
                          value={cert.insuredFrom}
                          disabled={disabled}
                          onChange={(e) => patchCert({ insuredFrom: e.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-0.5 block text-[9px] font-medium uppercase tracking-wide text-slate-500">
                          Periods līdz
                        </span>
                        <input
                          className={inp}
                          placeholder="31.01.2027"
                          value={cert.insuredTo}
                          disabled={disabled}
                          onChange={(e) => patchCert({ insuredTo: e.target.value })}
                        />
                      </label>
                    </div>
                  )}
                  <p className="pt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Zaudējumu dati
                  </p>
                  <div className="overflow-x-auto rounded-md border border-slate-200/90">
                    <table className="w-full min-w-[360px] border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                          <th className={mileCell}>CSNg datums</th>
                          <th className={mileCell}>Statuss</th>
                          <th className={mileCell}>Zaudējumu summa</th>
                          {!readOnly ? <th className={`w-9 ${mileCell}`} aria-hidden /> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {(cert.claims.length > 0 ? cert.claims : [emptyLtabCertificateClaim()]).map((row, ri) => (
                          <tr key={ri} className="border-b border-slate-100 last:border-b-0">
                            <td className={`${mileCell} align-top`}>
                              {readOnly ? (
                                <span className="text-[var(--color-apple-text)]">
                                  {[row.date, row.time].filter(Boolean).join(" ") || "—"}
                                </span>
                              ) : (
                                <div className="flex flex-col gap-0.5">
                                  <input
                                    className={inp}
                                    placeholder="16.06.2021"
                                    value={row.date}
                                    disabled={disabled}
                                    onChange={(e) => setClaim(ri, { date: e.target.value })}
                                    aria-label={`LTAB izziņa datums, rinda ${ri + 1}`}
                                  />
                                  <input
                                    className={inp}
                                    placeholder="07:40"
                                    value={row.time}
                                    disabled={disabled}
                                    onChange={(e) => setClaim(ri, { time: e.target.value })}
                                    aria-label={`LTAB izziņa laiks, rinda ${ri + 1}`}
                                  />
                                </div>
                              )}
                            </td>
                            <td className={`${mileCell} align-top`}>
                              {readOnly ? (
                                <span>{row.status.trim() || "—"}</span>
                              ) : (
                                <input
                                  className={inp}
                                  placeholder="Cietušais"
                                  value={row.status}
                                  disabled={disabled}
                                  onChange={(e) => setClaim(ri, { status: e.target.value })}
                                  aria-label={`LTAB izziņa statuss, rinda ${ri + 1}`}
                                />
                              )}
                            </td>
                            <td className={`${mileCell} align-top`}>
                              {readOnly ? (
                                <span className="font-semibold">
                                  {formatLtabCertificateAmountEur(row.amount) || row.amount || "—"}
                                </span>
                              ) : (
                                <input
                                  className={inp}
                                  placeholder="2778.22"
                                  value={row.amount}
                                  disabled={disabled}
                                  onChange={(e) => setClaim(ri, { amount: e.target.value })}
                                  aria-label={`LTAB izziņa summa, rinda ${ri + 1}`}
                                />
                              )}
                            </td>
                            {!readOnly ? (
                              <td className={`${mileCell} align-top`}>
                                {cert.claims.length > 1 ? (
                                  <button
                                    type="button"
                                    disabled={disabled}
                                    className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                                    onClick={() => removeClaim(ri)}
                                    title="Noņemt rindu"
                                    aria-label={`Noņemt LTAB izziņas rindu ${ri + 1}`}
                                  >
                                    ×
                                  </button>
                                ) : null}
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!readOnly && !disabled ? (
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
                      onClick={addClaim}
                    >
                      + Izziņas rinda
                    </button>
                  ) : null}
                  <p className="text-[10px] leading-snug text-slate-500">
                    {cert.footerNote.trim() || LTAB_CERTIFICATE_FOOTER_DEFAULT}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className={`mt-auto w-full min-w-0 shrink-0 pt-2 ${trafficFillLevel ? "px-2 pb-2" : ""}`}>
            {!readOnly && !disabled ? (
              <div className="mb-1.5 flex flex-wrap items-center gap-1">
                <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
                  Šabloni
                </span>
                {LTAB_COMMENT_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:border-[var(--color-provin-accent)]/40 hover:bg-slate-50"
                    title={template.text}
                    onClick={() =>
                      onChange({
                        ...value,
                        comments: applyLtabCommentTemplate(value.comments, template.text),
                      })
                    }
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            ) : null}
            <AdminSourceCommentField
              label="Komentāri:"
              value={value.comments}
              onChange={(next) => onChange({ ...value, comments: next })}
              readOnly={readOnly}
              disabled={disabled}
              compact
              gemini={geminiComment}
              aria-label="LTAB — komentāri"
            />
            <AdminGeminiContextRawField
              value={value.geminiContextRaw}
              onChange={(next) => onChange({ ...value, geminiContextRaw: next })}
              readOnly={readOnly}
              disabled={disabled}
              ariaLabel="LTAB — Gemini AI papildu konteksts"
            />
          </div>
      </div>
    </AdminCollapsibleShell>
  );
}
