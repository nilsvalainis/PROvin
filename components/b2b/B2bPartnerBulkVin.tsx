"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { B2bPartnerBuyReports } from "@/components/b2b/B2bPartnerBuyReports";
import { Link } from "@/i18n/navigation";
import type { B2bPartnerPriceOverrides } from "@/lib/b2b-partner-account";
import { rememberPendingPartnerArchiveRow } from "@/lib/b2b-partner-archive-rows";
import {
  BULK_VIN_MAX,
  isBulkVinOrderable,
  parseCsvFirstColumn,
  planBulkVinCredits,
  splitVinPaste,
  summarizeBulkVinKinds,
  type BulkVinClassified,
  type BulkVinKind,
} from "@/lib/b2b-partner-bulk-vin";
import { getB2bCatalogPlan, type B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import type { B2bCreditRemaining } from "@/lib/b2b-partner-credits";
import type { B2bPartnerAuditPurpose, B2bPartnerOrderRow } from "@/lib/b2b-partner-orders";
import { isPartnerAuditPurpose } from "@/lib/b2b-partner-orders";
import { isPlausibleListingUrl } from "@/lib/order-field-validation";
import { trackMetaLead } from "@/lib/meta-pixel";

const LABEL_CLASS = "mb-1.5 block text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";

type BulkRow = BulkVinClassified & {
  key: string;
  reorder: boolean;
  purpose: B2bPartnerAuditPurpose | null;
  listingUrl: string;
  listingOpen: boolean;
};

type AcceptedRow = {
  vin: string;
  orderId: string;
  order: B2bPartnerOrderRow;
};

function PackageMark({ title }: { title: string }) {
  if (title !== "PROVIN BUSINESS") return <>{title}</>;
  return (
    <>
      PRO<span className="text-[#2563EB]">VIN</span> BUSINESS
    </>
  );
}

function chipClass(kind: BulkVinKind | "received" | "processing"): string {
  if (kind === "valid" || kind === "received") return "bg-emerald-400/15 text-emerald-300";
  if (kind === "invalid") return "bg-red-400/15 text-red-300";
  if (kind === "duplicate") return "bg-amber-400/15 text-amber-200";
  return "bg-sky-400/15 text-sky-300";
}

function Chip({ kind, children }: { kind: BulkVinKind | "received" | "processing"; children: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.68rem] font-semibold leading-none ${chipClass(kind)}`}
    >
      {children}
    </span>
  );
}

function toRows(classified: BulkVinClassified[], prev: readonly BulkRow[]): BulkRow[] {
  const byVin = new Map(prev.map((row) => [row.vin, row]));
  return classified.map((row) => {
    const prevRow = row.vin ? byVin.get(row.vin) : undefined;
    return {
      ...row,
      key: `${row.index}-${row.vin || row.raw}`,
      reorder: prevRow?.reorder === true && row.kind === "already_ordered",
      purpose: prevRow?.purpose ?? null,
      listingUrl: prevRow?.listingUrl ?? "",
      listingOpen: prevRow?.listingOpen === true,
    };
  });
}

export function B2bPartnerBulkVin({
  availablePlans,
  credits,
  dealerEnabled,
  prices,
  locale,
  service,
  onPickService,
  onCreditsReload,
}: {
  availablePlans: B2bPartnerPlanId[];
  credits: B2bCreditRemaining;
  dealerEnabled: boolean;
  prices: B2bPartnerPriceOverrides | null;
  locale: string;
  service: B2bPartnerPlanId | null;
  onPickService: (plan: B2bPartnerPlanId) => void;
  onCreditsReload: () => Promise<B2bCreditRemaining | null>;
}) {
  const t = useTranslations("Partner");
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState("");
  const [phase, setPhase] = useState<"paste" | "list" | "result">("paste");
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [applyAll, setApplyAll] = useState(false);
  const [allPurpose, setAllPurpose] = useState<B2bPartnerAuditPurpose | null>(null);
  const [addVin, setAddVin] = useState("");
  const [accepted, setAccepted] = useState<AcceptedRow[]>([]);
  const [skipped, setSkipped] = useState<BulkRow[]>([]);
  const pasteCount = Math.min(splitVinPaste(paste).length, BULK_VIN_MAX);

  const plan = service ?? (availablePlans.length === 1 ? availablePlans[0]! : null);
  const remainingForPlan = plan ? credits[plan] : 0;
  const counts = useMemo(() => summarizeBulkVinKinds(rows), [rows]);
  const creditPlan = planBulkVinCredits(remainingForPlan, counts.orderable);

  const setPurpose = (key: string, purpose: B2bPartnerAuditPurpose) => {
    setAllPurpose(purpose);
    setRows((prev) =>
      prev.map((row) => {
        if (applyAll && isBulkVinOrderable(row)) return { ...row, purpose };
        if (row.key === key) return { ...row, purpose };
        return row;
      }),
    );
  };

  const checkList = async (text: string) => {
    setFormError("");
    const tokens = splitVinPaste(text);
    if (tokens.length < 1) {
      setFormError(t("bulkEmpty"));
      return;
    }
    setChecking(true);
    try {
      const res = await fetch("/api/partner/orders/bulk-check", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        rows?: BulkVinClassified[];
        truncated?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok || !Array.isArray(data.rows)) {
        setFormError(t("payNetwork"));
        return;
      }
      setRows((prev) => toRows(data.rows ?? [], prev));
      setTruncated(data.truncated === true);
      setPaste(text);
      setPhase("list");
    } catch {
      setFormError(t("payNetwork"));
    } finally {
      setChecking(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFormError("");
    const name = file.name.toLowerCase();
    if (name.endsWith(".xls") && !name.endsWith(".xlsx")) {
      setFormError(t("bulkFileType"));
      return;
    }
    try {
      if (name.endsWith(".csv") || name.endsWith(".txt") || file.type.includes("csv")) {
        const text = await file.text();
        setPaste(parseCsvFirstColumn(text).join("\n"));
        return;
      }
      const form = new FormData();
      form.set("file", file);
      form.set("parseOnly", "1");
      const res = await fetch("/api/partner/orders/bulk-check", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as { tokens?: string[]; error?: string };
      if (!res.ok || !Array.isArray(data.tokens)) {
        setFormError(data.error === "file_type" ? t("bulkFileType") : t("payNetwork"));
        return;
      }
      setPaste(data.tokens.join("\n"));
    } catch {
      setFormError(t("payNetwork"));
    }
  };

  const onOrder = async () => {
    setFormError("");
    if (!plan || !availablePlans.includes(plan)) {
      setFormError(t("needService"));
      return;
    }
    const orderable = rows.filter((row) => isBulkVinOrderable(row));
    const missingPurpose = orderable.some((row) => !row.purpose || !isPartnerAuditPurpose(row.purpose));
    if (missingPurpose) {
      setFormError(t("bulkNeedPurpose"));
      return;
    }
    const badListing = orderable.find((row) => row.listingUrl.trim() && !isPlausibleListingUrl(row.listingUrl.trim()));
    if (badListing) {
      setFormError(t("listingError"));
      return;
    }
    if (!creditPlan.canOrder) return;

    setSubmitting(true);
    try {
      trackMetaLead();
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `bulk_${Date.now()}`;
      const res = await fetch("/api/partner/orders/bulk", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          plan,
          items: orderable.map((row) => ({
            vin: row.vin,
            auditPurpose: row.purpose,
            ...(row.listingUrl.trim() ? { listingUrl: row.listingUrl.trim() } : {}),
            ...(row.reorder ? { reorder: true } : {}),
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        accepted?: AcceptedRow[];
        failed?: { vin: string }[];
        have?: number;
        need?: number;
      };
      if (res.status === 402 || data.error === "no_credits") {
        setFormError(t("noCredits"));
        return;
      }
      if (res.status === 403 || data.error === "dealer_disabled") {
        setFormError(t("dealerDisabled"));
        return;
      }
      if (!res.ok || !data.ok) {
        setFormError(t("payNetwork"));
        return;
      }
      const nextAccepted = Array.isArray(data.accepted) ? data.accepted : [];
      for (const row of nextAccepted) {
        if (row.order) rememberPendingPartnerArchiveRow(row.order);
      }
      const acceptedVins = new Set(nextAccepted.map((row) => row.vin));
      setAccepted(nextAccepted);
      setSkipped(rows.filter((row) => !acceptedVins.has(row.vin)));
      setPhase("result");
      try {
        await onCreditsReload();
      } catch {
        /* atlikums atjaunosies nākamajā ielādē */
      }
    } catch {
      setFormError(t("payNetwork"));
    } finally {
      setSubmitting(false);
    }
  };

  const resetPaste = () => {
    setPhase("paste");
    setRows([]);
    setAccepted([]);
    setSkipped([]);
    setPaste("");
    setAddVin("");
    setFormError("");
    setTruncated(false);
    setApplyAll(false);
    setAllPurpose(null);
  };

  if (phase === "result") {
    return (
      <div className="mt-6 flex flex-col gap-4">
        <p className="text-[0.8125rem] font-medium leading-snug text-emerald-300">
          {t("bulkResultOk", { count: accepted.length })}
        </p>
        <ul className="flex flex-col gap-2">
          {accepted.map((row) => (
            <li
              key={row.orderId}
              className="flex items-center justify-between gap-3 rounded-[0.35rem] bg-white/[0.03] px-3 py-2.5"
            >
              <span className="font-mono text-[0.78rem] tracking-wide text-zinc-100">{row.vin}</span>
              <Chip kind={row.order.status === "processing" ? "processing" : "received"}>
                {row.order.status === "processing" ? t("archiveStatusProcessing") : t("archiveStatusReceived")}
              </Chip>
            </li>
          ))}
        </ul>
        {skipped.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className={`${LABEL_CLASS} mb-0`}>{t("bulkSkippedHeading")}</p>
            <ul className="flex flex-col gap-2">
              {skipped.map((row) => (
                <li
                  key={row.key}
                  className="flex items-center justify-between gap-3 rounded-[0.35rem] bg-white/[0.03] px-3 py-2.5 opacity-60"
                >
                  <span className="font-mono text-[0.78rem] tracking-wide text-zinc-300">{row.vin || row.raw}</span>
                  <Chip kind={row.kind}>
                    {row.kind === "invalid"
                      ? t("bulkChipInvalid", { count: row.charCount })
                      : row.kind === "duplicate"
                        ? t("bulkChipDuplicate")
                        : t("bulkChipOrdered", { date: row.alreadyOrderedLabel || "" })}
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-zinc-200 underline-offset-2 hover:text-white hover:underline"
            onClick={resetPaste}
          >
            {t("bulkResultSubmitMore")}
          </button>
          <Link
            href="/partneriem/konts/profils"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-zinc-200 underline-offset-2 hover:text-white hover:underline"
          >
            {t("bulkResultOpenReports")}
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "list") {
    return (
      <div className="mt-6 flex flex-col gap-4">
        {truncated ? <p className="text-[0.78rem] text-zinc-400">{t("bulkTooMany")}</p> : null}
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 border-zinc-500 bg-transparent text-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40"
            checked={applyAll}
            onChange={(event) => {
              const on = event.target.checked;
              setApplyAll(on);
              if (on && allPurpose) {
                setRows((prev) =>
                  prev.map((row) => (isBulkVinOrderable(row) ? { ...row, purpose: allPurpose } : row)),
                );
              }
            }}
          />
          <span className="text-[0.9rem] font-medium text-zinc-100">{t("bulkPurposeAll")}</span>
        </label>
        {applyAll ? (
          <div className="flex flex-wrap gap-4" role="radiogroup" aria-label={t("auditPurposeAria")}>
            {(["client", "internal"] as const).map((purpose) => (
              <label key={purpose} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="b2b-bulk-purpose-all"
                  checked={allPurpose === purpose}
                  onChange={() => setPurpose(rows[0]?.key ?? "", purpose)}
                  className="h-4 w-4 shrink-0 border-zinc-500 bg-transparent text-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40"
                />
                <span className="text-[0.9rem] font-medium text-zinc-100">
                  {purpose === "client" ? t("auditPurposeClient") : t("auditPurposeInternal")}
                </span>
              </label>
            ))}
          </div>
        ) : null}

        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const orderable = isBulkVinOrderable(row);
            return (
              <li
                key={row.key}
                className={`rounded-[0.35rem] bg-white/[0.03] px-3 py-3 ${orderable ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[0.82rem] tracking-wide text-zinc-100">{row.vin || row.raw}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {row.kind === "valid" ? <Chip kind="valid">{t("bulkChipValid")}</Chip> : null}
                      {row.kind === "invalid" ? (
                        <Chip kind="invalid">{t("bulkChipInvalid", { count: row.charCount })}</Chip>
                      ) : null}
                      {row.kind === "duplicate" ? <Chip kind="duplicate">{t("bulkChipDuplicate")}</Chip> : null}
                      {row.kind === "already_ordered" ? (
                        <>
                          <Chip kind="already_ordered">
                            {t("bulkChipOrdered", { date: row.alreadyOrderedLabel || "" })}
                          </Chip>
                          {row.reportHref ? (
                            <a
                              href={row.reportHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[0.72rem] font-semibold text-sky-300 underline-offset-2 hover:underline"
                            >
                              {t("bulkChipOrderedOpen")}
                            </a>
                          ) : (
                            <Link
                              href="/partneriem/konts/profils"
                              className="text-[0.72rem] font-semibold text-sky-300 underline-offset-2 hover:underline"
                            >
                              {t("bulkChipOrderedOpen")}
                            </Link>
                          )}
                        </>
                      ) : null}
                    </div>
                    {!orderable ? (
                      <p className="mt-1.5 text-[0.75rem] leading-snug text-zinc-400">
                        {row.kind === "invalid"
                          ? t("bulkRowInvalidHint")
                          : row.kind === "duplicate"
                            ? t("bulkRowDuplicateHint")
                            : t("bulkRowOrderedHint")}
                      </p>
                    ) : null}
                    {row.kind === "already_ordered" && !row.reorder ? (
                      <button
                        type="button"
                        className="mt-2 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-emerald-300 underline-offset-2 hover:text-emerald-200 hover:underline"
                        onClick={() =>
                          setRows((prev) =>
                            prev.map((item) => (item.key === row.key ? { ...item, reorder: true } : item)),
                          )
                        }
                      >
                        {t("bulkReorder")}
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-[1rem] leading-none text-zinc-500 hover:text-zinc-200"
                    aria-label={t("bulkRemoveAria")}
                    onClick={() => setRows((prev) => prev.filter((item) => item.key !== row.key))}
                  >
                    ×
                  </button>
                </div>
                {orderable && !applyAll ? (
                  <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label={t("auditPurposeAria")}>
                    {(["client", "internal"] as const).map((purpose) => (
                      <label key={purpose} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name={`b2b-bulk-purpose-${row.key}`}
                          checked={row.purpose === purpose}
                          onChange={() => setPurpose(row.key, purpose)}
                          className="h-4 w-4 shrink-0 border-zinc-500 bg-transparent text-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40"
                        />
                        <span className="text-[0.86rem] font-medium text-zinc-100">
                          {purpose === "client" ? t("auditPurposeClient") : t("auditPurposeInternal")}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
                {orderable ? (
                  <div className="mt-2">
                    {row.listingOpen ? (
                      <input
                        type="url"
                        className={`${styles.inlineInput} mt-1`}
                        value={row.listingUrl}
                        onChange={(event) =>
                          setRows((prev) =>
                            prev.map((item) =>
                              item.key === row.key ? { ...item, listingUrl: event.target.value } : item,
                            ),
                          )
                        }
                        placeholder={t("listingPlaceholder")}
                        aria-label={t("listingAria")}
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-[0.75rem] font-medium text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
                        onClick={() =>
                          setRows((prev) =>
                            prev.map((item) => (item.key === row.key ? { ...item, listingOpen: true } : item)),
                          )
                        }
                      >
                        {t("bulkAddListing")}
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <label className="block min-w-0">
          <span className={LABEL_CLASS}>{t("bulkAddMore")}</span>
          <div className="flex gap-2">
            <input
              type="text"
              className={`${styles.inlineInput} font-mono uppercase tracking-wide`}
              value={addVin}
              onChange={(event) => setAddVin(event.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
              maxLength={17}
              aria-label={t("bulkAddMoreAria")}
            />
            <button
              type="button"
              className="shrink-0 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-zinc-300"
              disabled={checking || !addVin.trim() || rows.length >= BULK_VIN_MAX}
              onClick={() => {
                const next = `${rows.map((row) => row.raw || row.vin).join("\n")}\n${addVin.trim()}`;
                setAddVin("");
                void checkList(next);
              }}
            >
              {t("bulkAddMoreCta")}
            </button>
          </div>
        </label>

        {availablePlans.length > 1 ? (
          <fieldset className="min-w-0" disabled={submitting}>
            <legend className={LABEL_CLASS}>{t("servicePick")}</legend>
            <div className="flex flex-col gap-3" role="radiogroup" aria-label={t("servicePick")}>
              {availablePlans.map((item) => (
                <label key={item} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="b2b-partner-bulk-service"
                    checked={service === item}
                    onChange={() => onPickService(item)}
                    className="h-4 w-4 shrink-0 border-zinc-500 bg-transparent text-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40"
                  />
                  <span className="text-[0.9rem] font-medium text-zinc-100">
                    <PackageMark title={getB2bCatalogPlan(item, locale).title} />
                    <span className="ml-1.5 text-zinc-500">({credits[item]})</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <p className="text-[0.78rem] leading-snug text-zinc-400">
          {t("bulkSummary", {
            valid: counts.valid,
            invalid: counts.invalid,
            duplicate: counts.duplicate,
            ordered: counts.alreadyOrdered,
          })}
        </p>
        <p className="text-[0.78rem] leading-snug text-zinc-300">
          {t("bulkCreditsLine", { used: creditPlan.used, from: creditPlan.from, to: creditPlan.to })}
        </p>
        {creditPlan.shortfall > 0 ? (
          <p className="text-[0.8125rem] font-medium leading-snug text-red-300">
            {t("bulkShortfall", { count: creditPlan.shortfall })}
          </p>
        ) : null}
        {formError ? <p className={styles.inlineFieldError}>{formError}</p> : null}

        <button
          type="button"
          className={styles.liquidCta}
          disabled={!creditPlan.canOrder || submitting}
          onClick={() => {
            if (!submitting) void onOrder();
          }}
        >
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>
            {submitting ? t("bulkOrderLoading") : t("bulkOrderCta", { count: counts.orderable })}
          </span>
        </button>
        <B2bPartnerBuyReports mode="secondary" dealerEnabled={dealerEnabled} prices={prices} />
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <label className="block min-w-0">
        <span className={LABEL_CLASS}>{t("bulkPasteLabel")}</span>
        <textarea
          className={`${styles.inlineInput} min-h-[8.5rem] resize-y font-mono uppercase tracking-wide`}
          value={paste}
          onChange={(event) => {
            setPaste(event.target.value.toUpperCase());
            setFormError("");
          }}
          autoComplete="off"
          spellCheck={false}
          aria-label={t("bulkPasteAria")}
        />
        <span className="mt-1.5 block text-[0.72rem] text-zinc-500">
          {t("bulkCounter", { count: pasteCount, max: BULK_VIN_MAX })}
        </span>
      </label>
      <div>
        <input
          ref={fileRef}
          id={fileId}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            void onFile(file);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="text-[0.78rem] font-medium text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
          onClick={() => fileRef.current?.click()}
        >
          {t("bulkUploadLink")}
        </button>
      </div>
      {formError ? <p className={styles.inlineFieldError}>{formError}</p> : null}
      <button
        type="button"
        className={styles.liquidCta}
        disabled={checking || pasteCount < 1}
        onClick={() => {
          if (!checking) void checkList(paste);
        }}
      >
        <span className={styles.liquidCtaShimmer} aria-hidden />
        <span className={styles.liquidCtaLabel}>{checking ? t("bulkCheckLoading") : t("bulkCheckCta")}</span>
      </button>
    </div>
  );
}
