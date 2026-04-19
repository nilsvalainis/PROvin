"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutDashboard, ListChecks, ListOrdered } from "lucide-react";
import { AdminCsddSourceBlock } from "@/components/admin/AdminCsddSourceBlock";
import { AdminLtabSourceBlock } from "@/components/admin/AdminLtabSourceBlock";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { DEFAULT_PDF_VISIBILITY, mergePdfVisibility, type PdfVisibilitySettings } from "@/lib/pdf-visibility";
import {
  CONSULTATION_SLOT_COUNT,
  defaultConsultationWorkspace,
  type ConsultationDraftWorkspaceBody,
} from "@/lib/admin-consultation-draft-types";
import {
  mergeSourceBlocksWithDefaults,
  SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { csddTrafficLevel, ltabTrafficLevel, type TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import {
  consultationClientTabLevel,
  consultationSlotTabLevel,
  consultationSummaryTabLevel,
} from "@/lib/consultation-tab-status";
import { buildSelectConsultationDocumentHtml } from "@/lib/select-consultation-report-html";
import { workspaceWizardProgressPct } from "@/lib/admin-workspace-progress";

const ADMIN_CONTENT_MAX = "max-w-[min(76.8rem,calc(100vw-1.25rem))]";
const WIZARD_STEP_DOT: Record<TrafficFillLevel, string> = {
  empty: "bg-zinc-400",
  partial: "bg-amber-400",
  complete: "bg-emerald-500",
};

const sectionTitle = `font-medium uppercase tracking-wide text-[var(--color-provin-muted)] ${SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS}`;
const bulkTextareaClass =
  "w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] placeholder:text-[var(--admin-field-placeholder)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const CONSULTATION_WIZARD_STEP_COUNT = 1 + CONSULTATION_SLOT_COUNT + 1;

function parseWorkspaceFromServerJson(json: string | null): ConsultationDraftWorkspaceBody {
  if (!json) return defaultConsultationWorkspace();
  try {
    const p = JSON.parse(json) as Record<string, unknown>;
    const base = defaultConsultationWorkspace();
    if (typeof p.irissApproved === "string") base.irissApproved = p.irissApproved;
    base.previewConfirmed = Boolean(p.previewConfirmed);
    if (p.pdfVisibility) base.pdfVisibility = mergePdfVisibility(p.pdfVisibility);
    const slots = Array.isArray(p.slots) ? p.slots : [];
    for (let i = 0; i < CONSULTATION_SLOT_COUNT; i++) {
      const s = slots[i];
      if (!s || typeof s !== "object") continue;
      const o = s as Record<string, unknown>;
      base.slots[i] = {
        listingUrl: typeof o.listingUrl === "string" ? o.listingUrl : "",
        salePrice: typeof o.salePrice === "string" ? o.salePrice : "",
        sourceBlocks: mergeSourceBlocksWithDefaults(
          o.sourceBlocks && typeof o.sourceBlocks === "object" ? o.sourceBlocks : {},
        ),
        ieteikumiApskatei: typeof o.ieteikumiApskatei === "string" ? o.ieteikumiApskatei : "",
        cenasAtbilstiba: typeof o.cenasAtbilstiba === "string" ? o.cenasAtbilstiba : "",
        kopsavilkums: typeof o.kopsavilkums === "string" ? o.kopsavilkums : "",
      };
    }
    return base;
  } catch {
    return defaultConsultationWorkspace();
  }
}

export type ConsultationWorkspaceOrderPayload = {
  sessionId: string;
  isDemo: boolean;
  created: number;
  amountTotal: number | null;
  currency: string | null;
  paymentStatus: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerName: string | null;
  contactMethod: string | null;
  notes: string | null;
};

export function ConsultationDetailWorkspace({
  orderDraftPersistenceEnabled,
  serverWorkspaceJson,
  payload,
  pdfVisibility: pdfVisibilityProp,
  onPdfVisibilityChange,
  clientDashboardSlot,
  clientTabLevelInputs,
}: {
  orderDraftPersistenceEnabled: boolean;
  serverWorkspaceJson: string | null;
  payload: ConsultationWorkspaceOrderPayload;
  pdfVisibility: PdfVisibilitySettings;
  onPdfVisibilityChange: (patch: Partial<PdfVisibilitySettings>) => void;
  /** Cilne „Klients” — maksājums, klienta dati, komentāri (no vecākā). */
  clientDashboardSlot: ReactNode;
  clientTabLevelInputs: { customerName: string; customerEmail: string; customerPhone: string };
}) {
  const [ws, setWs] = useState<ConsultationDraftWorkspaceBody>(() =>
    parseWorkspaceFromServerJson(serverWorkspaceJson),
  );
  const [consultationStep, setConsultationStep] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstHydrate = useRef(true);

  useEffect(() => {
    setWs(parseWorkspaceFromServerJson(serverWorkspaceJson));
  }, [serverWorkspaceJson]);

  const persistWorkspace = useCallback(
    async (body: ConsultationDraftWorkspaceBody, pdfVis: PdfVisibilitySettings) => {
      if (!orderDraftPersistenceEnabled) return;
      try {
        await fetch("/api/admin/consultation-draft", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: payload.sessionId,
            workspace: {
              slots: body.slots,
              irissApproved: body.irissApproved,
              previewConfirmed: body.previewConfirmed,
              pdfVisibility: pdfVis,
            },
          }),
        });
      } catch {
        /* ignore */
      }
    },
    [orderDraftPersistenceEnabled, payload.sessionId],
  );

  useEffect(() => {
    if (skipFirstHydrate.current) {
      skipFirstHydrate.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persistWorkspace(ws, pdfVisibilityProp);
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [ws, pdfVisibilityProp, persistWorkspace]);

  const updateSlotField = useCallback(
    (slotIdx: number, key: keyof ConsultationDraftWorkspaceBody["slots"][0], value: string) => {
      setWs((prev) => {
        const slots = prev.slots.map((s, j) => (j === slotIdx ? { ...s, [key]: value } : s));
        return { ...prev, slots };
      });
    },
    [],
  );

  const updateSourceBlock = useCallback(
    (slotIdx: number, key: keyof WorkspaceSourceBlocks, val: WorkspaceSourceBlocks[keyof WorkspaceSourceBlocks]) => {
      setWs((prev) => {
        const slots = prev.slots.map((s, j) => {
          if (j !== slotIdx) return s;
          const blocks = mergeSourceBlocksWithDefaults(s.sourceBlocks as WorkspaceSourceBlocks);
          return { ...s, sourceBlocks: { ...blocks, [key]: val } };
        });
        return { ...prev, slots };
      });
    },
    [],
  );

  const openPdf = useCallback(() => {
    const dateFmt = new Intl.DateTimeFormat("lv-LV", { dateStyle: "long", timeStyle: "short" });
    const html = buildSelectConsultationDocumentHtml({
      order: {
        created: payload.created,
        amountTotal: payload.amountTotal,
        currency: payload.currency,
        paymentStatus: payload.paymentStatus,
        customerEmail: payload.customerEmail,
        customerName: payload.customerName,
        phone: payload.customerPhone,
        contactMethod: payload.contactMethod,
        notes: payload.notes,
      },
      workspace: ws,
      dateFmt,
    });
    const w = window.open("", "_blank");
    if (!w) {
      alert("Atļauj uznirstošo logu PDF drukai.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    const printTitle = "PROVIN_SELECT_Konsultacija.pdf";
    const schedulePrint = () => {
      try {
        w.document.title = printTitle;
        w.focus();
        w.print();
      } catch {
        /* ignore */
      }
    };
    w.addEventListener("load", () => window.setTimeout(schedulePrint, 450), { once: true });
    window.setTimeout(schedulePrint, 900);
  }, [payload, ws]);

  const pdfVisibility = pdfVisibilityProp ?? DEFAULT_PDF_VISIBILITY;

  const consultationStepsUi = useMemo(
    () => [
      { label: "Klients", Icon: LayoutDashboard },
      ...Array.from({ length: CONSULTATION_SLOT_COUNT }, (_, i) => ({
        label: `Nr. ${i + 1}`,
        Icon: ListOrdered,
      })),
      { label: "Kopsavilkums", Icon: ListChecks },
    ],
    [],
  );

  const consultationStepLevels = useMemo((): TrafficFillLevel[] => {
    const clientLvl = consultationClientTabLevel(clientTabLevelInputs);
    const slotLvls = ws.slots.map((s) => consultationSlotTabLevel(s));
    const sumLvl = consultationSummaryTabLevel(ws.irissApproved);
    return [clientLvl, ...slotLvls, sumLvl];
  }, [clientTabLevelInputs, ws.slots, ws.irissApproved]);

  const consultationProgressPct = useMemo(
    () => workspaceWizardProgressPct(consultationStepLevels),
    [consultationStepLevels],
  );

  const flushPersist = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    void persistWorkspace(ws, pdfVisibilityProp);
  }, [persistWorkspace, ws, pdfVisibilityProp]);

  const goStep = useCallback(
    (idx: number) => {
      flushPersist();
      setConsultationStep(idx);
    },
    [flushPersist],
  );

  const renderSlotPanel = (idx: number) => {
    const slot = ws.slots[idx]!;
    const blocks = mergeSourceBlocksWithDefaults(slot.sourceBlocks as WorkspaceSourceBlocks);
    const trafficCsdd = csddTrafficLevel(blocks.csdd);
    const trafficLtab = ltabTrafficLevel(blocks.ltab);
    const n = idx + 1;
    return (
      <div className="min-w-0 space-y-3 rounded-xl bg-[var(--admin-surface-elevated)] p-3 shadow-sm ring-1 ring-[var(--admin-border-subtle)]">
        <h2 className={`${sectionTitle} px-0.5`}>Nr. {n}</h2>
        <label className="block text-[10px] font-medium text-[var(--color-provin-muted)]">
          Sludinājuma links
          <input
            type="url"
            className="mt-0.5 w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] text-[var(--admin-field-text)]"
            value={slot.listingUrl}
            onChange={(e) => updateSlotField(idx, "listingUrl", e.target.value)}
          />
        </label>
        <label className="block text-[10px] font-medium text-[var(--color-provin-muted)]">
          Pārdošanas cena
          <input
            type="text"
            className="mt-0.5 w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] text-[var(--admin-field-text)]"
            value={slot.salePrice}
            onChange={(e) => updateSlotField(idx, "salePrice", e.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
          <AdminPdfIncludeToggle
            checked={pdfVisibility.csdd}
            onChange={(next) => onPdfVisibilityChange({ csdd: next })}
          />
          <span className="text-[9px] font-medium text-[var(--color-provin-muted)]">CSDD PDF</span>
          <AdminPdfIncludeToggle
            checked={pdfVisibility.ltab}
            onChange={(next) => onPdfVisibilityChange({ ltab: next })}
          />
          <span className="text-[9px] font-medium text-[var(--color-provin-muted)]">LTAB PDF</span>
        </div>
        <AdminCsddSourceBlock
          value={blocks.csdd}
          readOnly={false}
          onChange={(next) => updateSourceBlock(idx, "csdd", next)}
          trafficFillLevel={trafficCsdd}
          pdfIncludeBlock={pdfVisibility.csdd}
          onPdfIncludeBlockChange={(next) => onPdfVisibilityChange({ csdd: next })}
          pdfIncludeMileageTable={pdfVisibility.csddMileageTable}
          onPdfIncludeMileageTableChange={(next) => onPdfVisibilityChange({ csddMileageTable: next })}
          sessionId={payload.sessionId}
        />
        <AdminLtabSourceBlock
          value={blocks.ltab}
          readOnly={false}
          onChange={(next) => updateSourceBlock(idx, "ltab", next)}
          trafficFillLevel={trafficLtab}
          sessionId={payload.sessionId}
          pdfInclude={pdfVisibility.ltab}
          onPdfIncludeChange={(next) => onPdfVisibilityChange({ ltab: next })}
        />
        <label className="block text-[10px] font-medium text-[var(--color-provin-muted)]">
          IETEIKUMI KLĀTIENES APSKATEI
          <textarea
            className={`${bulkTextareaClass} mt-0.5 min-h-[72px]`}
            value={slot.ieteikumiApskatei}
            onChange={(e) => updateSlotField(idx, "ieteikumiApskatei", e.target.value)}
          />
        </label>
        <label className="block text-[10px] font-medium text-[var(--color-provin-muted)]">
          CENAS ATBILSTĪBA
          <textarea
            className={`${bulkTextareaClass} mt-0.5 min-h-[72px]`}
            value={slot.cenasAtbilstiba}
            onChange={(e) => updateSlotField(idx, "cenasAtbilstiba", e.target.value)}
          />
        </label>
        <label className="block text-[10px] font-medium text-[var(--color-provin-muted)]">
          KOPSAVILKUMS
          <textarea
            className={`${bulkTextareaClass} mt-0.5 min-h-[72px]`}
            value={slot.kopsavilkums}
            onChange={(e) => updateSlotField(idx, "kopsavilkums", e.target.value)}
          />
        </label>
      </div>
    );
  };

  const slotIndexForStep = consultationStep >= 1 && consultationStep <= CONSULTATION_SLOT_COUNT ? consultationStep - 1 : -1;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[min(76.8rem,calc(100vw-1.25rem))] space-y-0 pb-16">
      <nav
        className="sticky top-0 z-30 -mx-1 border-b border-[var(--admin-border-subtle)] bg-[var(--admin-nav-bg)] px-1 py-1.5 backdrop-blur-sm"
        aria-label="Konsultācijas sadaļas"
      >
        <div className={`mx-auto flex w-full min-w-0 flex-wrap items-center gap-2 ${ADMIN_CONTENT_MAX}`}>
          <div className="flex min-w-0 flex-1 flex-wrap items-stretch gap-1 sm:gap-1.5">
            {consultationStepsUi.map(({ label, Icon }, idx) => {
              const lvl = consultationStepLevels[idx] ?? "empty";
              const active = consultationStep === idx;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => goStep(idx)}
                  className={`flex min-w-0 max-w-[7.5rem] flex-1 flex-col items-center gap-0.5 rounded-lg border px-1 py-1 text-center transition sm:max-w-none sm:flex-row sm:justify-start sm:gap-1.5 sm:px-2 ${
                    active
                      ? "border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/35"
                      : "border-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-black/[0.06] text-[var(--color-provin-muted)] dark:bg-white/10">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    <span
                      className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-[var(--admin-surface-elevated)] ${WIZARD_STEP_DOT[lvl]}`}
                      title={`Aizpildījums: ${lvl}`}
                    />
                  </span>
                  <span
                    className={`line-clamp-2 w-full text-[9px] font-semibold uppercase leading-tight tracking-tight sm:line-clamp-1 sm:text-left ${
                      active ? "text-[var(--color-apple-text)]" : "text-[var(--color-provin-muted)]"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => void openPdf()}
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-emerald-800/40 bg-[#22C55E] px-3 py-2 text-[11px] font-semibold tracking-tight text-white shadow-sm transition hover:bg-[#16a34a]"
          >
            Ģenerēt PDF
          </button>
        </div>
        <div className={`mx-auto mt-2 px-1 ${ADMIN_CONTENT_MAX}`}>
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/10"
            role="progressbar"
            aria-valuenow={consultationProgressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Aizpildījuma progress"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out dark:bg-emerald-400"
              style={{ width: `${consultationProgressPct}%` }}
            />
          </div>
          <p className="mt-0.5 text-end text-[9px] font-medium tabular-nums text-[var(--color-provin-muted)]">
            {consultationProgressPct}%
          </p>
        </div>
      </nav>

      <div className={`mx-auto w-full min-w-0 space-y-3 px-1 pt-3 ${ADMIN_CONTENT_MAX}`}>
        {consultationStep === 0 ? <div className="space-y-3">{clientDashboardSlot}</div> : null}

        {slotIndexForStep >= 0 ? renderSlotPanel(slotIndexForStep) : null}

        {consultationStep === CONSULTATION_WIZARD_STEP_COUNT - 1 ? (
          <div className="min-w-0 space-y-2 rounded-xl bg-[var(--admin-surface-elevated)] p-3 shadow-sm ring-1 ring-[var(--admin-border-subtle)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={`${sectionTitle}`}>Approved by IRISS</h2>
              <AdminPdfIncludeToggle
                checked={pdfVisibility.iriss}
                onChange={(next) => onPdfVisibilityChange({ iriss: next })}
              />
            </div>
            <textarea
              className={`${bulkTextareaClass} min-h-[140px]`}
              value={ws.irissApproved}
              onChange={(e) => setWs((p) => ({ ...p, irissApproved: e.target.value }))}
              placeholder="Galīgais kopsavilkums / IRISS apstiprinājums…"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
