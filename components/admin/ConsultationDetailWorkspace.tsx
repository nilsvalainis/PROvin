"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminCsddSourceBlock } from "@/components/admin/AdminCsddSourceBlock";
import { AdminLtabSourceBlock } from "@/components/admin/AdminLtabSourceBlock";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
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
import { csddTrafficLevel, ltabTrafficLevel } from "@/lib/admin-block-traffic-status";
import { buildSelectConsultationDocumentHtml } from "@/lib/select-consultation-report-html";

const sectionTitle = `font-medium uppercase tracking-wide text-[var(--color-provin-muted)] ${SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS}`;
const metaAccordionShellClass =
  "rounded-xl bg-[var(--admin-surface-elevated)] shadow-sm ring-1 ring-[var(--admin-border-subtle)]";
const bulkTextareaClass =
  "w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] placeholder:text-[var(--admin-field-placeholder)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

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
}: {
  orderDraftPersistenceEnabled: boolean;
  serverWorkspaceJson: string | null;
  payload: ConsultationWorkspaceOrderPayload;
  pdfVisibility: PdfVisibilitySettings;
  onPdfVisibilityChange: (patch: Partial<PdfVisibilitySettings>) => void;
}) {
  const [ws, setWs] = useState<ConsultationDraftWorkspaceBody>(() =>
    parseWorkspaceFromServerJson(serverWorkspaceJson),
  );
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

  const slotSections = useMemo(() => {
    return ws.slots.map((slot, idx) => {
      const blocks = mergeSourceBlocksWithDefaults(slot.sourceBlocks as WorkspaceSourceBlocks);
      const trafficCsdd = csddTrafficLevel(blocks.csdd);
      const trafficLtab = ltabTrafficLevel(blocks.ltab);
      const n = idx + 1;
      return (
        <section key={idx} id={`consultation-slot-${idx}`} className="min-w-0">
          <AdminCollapsibleShell
            sessionId={payload.sessionId}
            blockId={`consultation-slot-${idx}`}
            className={metaAccordionShellClass}
            header={
              <h2 className={`${sectionTitle} flex flex-wrap items-center gap-x-2 gap-y-0 px-2 py-2`}>
                Nr. {n}
              </h2>
            }
          >
            <div className="space-y-3 px-2 pb-3">
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
          </AdminCollapsibleShell>
        </section>
      );
    });
  }, [payload.sessionId, updateSlotField, updateSourceBlock, ws.slots, pdfVisibility, onPdfVisibilityChange]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[min(76.8rem,calc(100vw-1.25rem))] space-y-3 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          Darba zona — PROVIN SELECT
        </p>
        <button
          type="button"
          onClick={() => void openPdf()}
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-800/40 bg-[#22C55E] px-3 py-2 text-[11px] font-semibold tracking-tight text-white shadow-sm transition hover:bg-[#16a34a]"
        >
          Ģenerēt PDF
        </button>
      </div>
      {slotSections}
      <section className="min-w-0">
        <AdminCollapsibleShell
          sessionId={payload.sessionId}
          blockId="consultation-iriss"
          className={metaAccordionShellClass}
          header={
            <h2 className={`${sectionTitle} flex flex-wrap items-center gap-x-2 gap-y-0 px-2 py-2`}>
              Kopsavilkums — Approved by IRISS
            </h2>
          }
          headerActions={
            <AdminPdfIncludeToggle
              checked={pdfVisibility.iriss}
              onChange={(next) => onPdfVisibilityChange({ iriss: next })}
            />
          }
        >
          <div className="px-2 pb-3">
            <textarea
              className={`${bulkTextareaClass} min-h-[140px]`}
              value={ws.irissApproved}
              onChange={(e) => setWs((p) => ({ ...p, irissApproved: e.target.value }))}
              placeholder="Galīgais kopsavilkums / IRISS apstiprinājums…"
            />
          </div>
        </AdminCollapsibleShell>
      </section>
    </div>
  );
}
