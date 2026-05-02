"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { DEFAULT_PDF_VISIBILITY, type PdfVisibilitySettings } from "@/lib/pdf-visibility";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import { META_ORDER_LUCIDE } from "@/lib/admin-lucide-registry";
import { AdminSavableTextField } from "@/components/admin/AdminSavableTextField";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { AdminCollapsedMenuButton } from "@/components/admin/AdminCollapsedMenuButton";
import { ConsultationDetailWorkspace } from "@/components/admin/ConsultationDetailWorkspace";
import { formatMoneyEur } from "@/lib/format-money";
import { SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS } from "@/lib/admin-source-blocks";
import type { ConsultationDraftState } from "@/lib/admin-consultation-draft-types";
import { consultationDraftHasOrderEdits } from "@/lib/admin-consultation-draft-types";
import type { AdminOrderDetailClientModel } from "@/components/admin/AdminOrderDetailView";

type ConsultationEdits = {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  internalComment?: string;
};

function storageKeyConsultationEdits(sessionId: string) {
  return `provin-admin-consultation-edits-v1-${sessionId}`;
}

function initialEditsFromServerDraft(serverDraft: ConsultationDraftState | null): ConsultationEdits {
  const fromServer = serverDraft?.orderEdits;
  if (!consultationDraftHasOrderEdits(fromServer)) return {};
  return {
    ...(typeof fromServer!.customerName === "string" ? { customerName: fromServer!.customerName } : {}),
    ...(typeof fromServer!.customerEmail === "string" ? { customerEmail: fromServer!.customerEmail } : {}),
    ...(typeof fromServer!.customerPhone === "string" ? { customerPhone: fromServer!.customerPhone } : {}),
    ...(typeof fromServer!.notes === "string" ? { notes: fromServer!.notes } : {}),
    ...(typeof fromServer!.internalComment === "string" ? { internalComment: fromServer!.internalComment } : {}),
  };
}

export function AdminConsultationDetailView({
  order,
  serverConsultationDraft,
  serverWorkspaceJson,
  consultationDraftPersistenceEnabled,
}: {
  order: AdminOrderDetailClientModel;
  serverConsultationDraft: ConsultationDraftState | null;
  serverWorkspaceJson: string | null;
  consultationDraftPersistenceEnabled: boolean;
}) {
  const dateFmt = new Intl.DateTimeFormat("lv-LV", { dateStyle: "long", timeStyle: "short" });
  const [edits, setEdits] = useState<ConsultationEdits>(() => initialEditsFromServerDraft(serverConsultationDraft));
  const [hydrated, setHydrated] = useState(false);
  const [orderEditsAutosaveFlash, setOrderEditsAutosaveFlash] = useState(false);
  const [orderEditsSaveServerOk, setOrderEditsSaveServerOk] = useState(true);
  const skipOrderEditsAutosaveFlash = useRef(true);
  const [pdfVisibility, setPdfVisibility] = useState<PdfVisibilitySettings>(() =>
    serverConsultationDraft?.workspace?.pdfVisibility
      ? { ...DEFAULT_PDF_VISIBILITY, ...serverConsultationDraft.workspace.pdfVisibility }
      : DEFAULT_PDF_VISIBILITY,
  );
  const patchPdfVisibility = useCallback((patch: Partial<PdfVisibilitySettings>) => {
    setPdfVisibility((prev) => ({ ...prev, ...patch }));
  }, []);
  const [adminDark, setAdminDark] = useState(false);

  /** Tāpat kā audita pasūtījumā: neapķīlāt `edits` pie `router.refresh()` (vecāks melnraksts vs. autosaglabāšana). */
  useEffect(() => {
    const fromServer = serverConsultationDraft?.orderEdits;
    if (consultationDraftHasOrderEdits(fromServer)) {
      setEdits(initialEditsFromServerDraft(serverConsultationDraft));
      try {
        localStorage.setItem(storageKeyConsultationEdits(order.id), JSON.stringify(fromServer));
      } catch {
        /* quota */
      }
      setHydrated(true);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKeyConsultationEdits(order.id));
      if (raw) {
        const p = JSON.parse(raw) as Record<string, unknown>;
        setEdits({
          ...(typeof p.customerName === "string" ? { customerName: p.customerName } : {}),
          ...(typeof p.customerEmail === "string" ? { customerEmail: p.customerEmail } : {}),
          ...(typeof p.customerPhone === "string" ? { customerPhone: p.customerPhone } : {}),
          ...(typeof p.notes === "string" ? { notes: p.notes } : {}),
          ...(typeof p.internalComment === "string" ? { internalComment: p.internalComment } : {}),
        });
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  useEffect(() => {
    skipOrderEditsAutosaveFlash.current = true;
  }, [order.id]);

  useEffect(() => {
    try {
      const s = localStorage.getItem("provin-admin-dark");
      if (s === "1") setAdminDark(true);
      else if (s === "0") setAdminDark(false);
      else setAdminDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    } catch {
      setAdminDark(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          localStorage.setItem(storageKeyConsultationEdits(order.id), JSON.stringify(edits));
        } catch {
          /* quota */
        }
        let srvOk = !consultationDraftPersistenceEnabled;
        if (consultationDraftPersistenceEnabled) {
          try {
            const res = await fetch("/api/admin/consultation-draft", {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: order.id, orderEdits: edits }),
            });
            srvOk = res.ok;
          } catch {
            srvOk = false;
          }
        }
        if (skipOrderEditsAutosaveFlash.current) {
          skipOrderEditsAutosaveFlash.current = false;
        } else {
          setOrderEditsSaveServerOk(srvOk);
          setOrderEditsAutosaveFlash(true);
        }
      })();
    }, 800);
    return () => window.clearTimeout(t);
  }, [edits, hydrated, order.id, consultationDraftPersistenceEnabled]);

  useEffect(() => {
    if (!orderEditsAutosaveFlash) return;
    const u = window.setTimeout(() => setOrderEditsAutosaveFlash(false), 1400);
    return () => window.clearTimeout(u);
  }, [orderEditsAutosaveFlash]);

  const persistEdits = useCallback((patch: Partial<ConsultationEdits>) => {
    setEdits((prev) => ({ ...prev, ...patch }));
  }, []);

  const mergedCustomerName =
    edits.customerName !== undefined ? edits.customerName : (order.customerName ?? "");
  const mergedCustomerEmail =
    edits.customerEmail !== undefined
      ? edits.customerEmail
      : (order.customerEmail ?? order.customerDetailsEmail ?? "");
  const mergedCustomerPhone =
    edits.customerPhone !== undefined
      ? edits.customerPhone
      : (order.phone ?? order.customerDetailsPhone ?? "");
  const mergedNotes = edits.notes !== undefined ? edits.notes : (order.notes ?? "");
  const mergedInternalComment =
    edits.internalComment !== undefined ? edits.internalComment : (order.internalComment ?? "");

  const orderFieldResetKey = `${order.id}-${hydrated ? 1 : 0}`;
  const metaAccordionShellClass =
    "rounded-xl border-0 bg-transparent shadow-[0_2px_22px_rgba(15,23,42,0.055)]";
  const sectionTitle = `font-medium uppercase tracking-wide text-[var(--color-provin-muted)] ${SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS}`;
  const metaLabel = "text-[9px] font-medium text-[var(--color-provin-muted)]";
  const metaValue = "text-[11px] text-[var(--color-apple-text)]";
  const metaStack = "mt-1 flex flex-col gap-1 text-[11px]";

  const dashboardSlot = (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-stretch sm:gap-4">
        <section className="min-w-0">
          <AdminCollapsibleShell
            sessionId={order.id}
            blockId="consultation-meta-payment"
            className={metaAccordionShellClass}
            header={
              <h2 className={`${sectionTitle} flex flex-wrap items-center gap-x-2 gap-y-0 px-2 py-2`}>
                <AdminProvinLucide icon={META_ORDER_LUCIDE.payment} />
                Maksājums
              </h2>
            }
            headerActions={
              <AdminPdfIncludeToggle
                checked={pdfVisibility.payment}
                onChange={(next) => patchPdfVisibility({ payment: next })}
              />
            }
          >
            <div className="space-y-1 px-2 pb-2">
              <dl className={metaStack}>
                <div className="min-w-0">
                  <dt className={metaLabel}>Summa</dt>
                  <dd className={`${metaValue} font-medium tabular-nums`}>
                    {formatMoneyEur(order.amountTotal, order.currency)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className={metaLabel}>Laiks</dt>
                  <dd className={metaValue}>{dateFmt.format(new Date(order.created * 1000))}</dd>
                </div>
                <div className="min-w-0">
                  <dt className={metaLabel}>Statuss</dt>
                  <dd className={metaValue}>{order.paymentStatus}</dd>
                </div>
              </dl>
            </div>
          </AdminCollapsibleShell>
        </section>

        <section className="min-w-0">
          <AdminCollapsibleShell
            sessionId={order.id}
            blockId="consultation-meta-client"
            className={metaAccordionShellClass}
            header={
              <h2 className={`${sectionTitle} flex flex-wrap items-center gap-x-2 gap-y-0 px-2 py-2`}>
                <AdminProvinLucide icon={META_ORDER_LUCIDE.client} />
                <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0">
                  <span>Klients</span>
                  {orderEditsAutosaveFlash ? (
                    <span
                      className={`text-[10px] font-semibold normal-case tracking-normal ${
                        consultationDraftPersistenceEnabled && !orderEditsSaveServerOk
                          ? "text-amber-800"
                          : "text-emerald-700"
                      }`}
                      role="status"
                    >
                      {!consultationDraftPersistenceEnabled
                        ? "Saglabāts"
                        : orderEditsSaveServerOk
                          ? "Saglabāts serverī"
                          : "Saglabāts lokāli (serveris nav pieejams)"}
                    </span>
                  ) : null}
                </span>
              </h2>
            }
            headerActions={
              <AdminPdfIncludeToggle
                checked={pdfVisibility.client}
                onChange={(next) => patchPdfVisibility({ client: next })}
              />
            }
          >
            <div className="space-y-1 px-2 pb-2">
              <AdminSavableTextField
                id="consultation-edit-name"
                label="Vārds, uzvārds"
                value={mergedCustomerName}
                onChange={(v) => persistEdits({ customerName: v })}
                placeholder="Klienta vārds"
                compact
                hideToolbar
                resetVersion={orderFieldResetKey}
              />
              <AdminSavableTextField
                id="consultation-edit-email"
                label="E-pasts"
                value={mergedCustomerEmail}
                onChange={(v) => persistEdits({ customerEmail: v })}
                placeholder="epasts@piemers.lv"
                compact
                hideToolbar
                resetVersion={orderFieldResetKey}
              />
              <AdminSavableTextField
                id="consultation-edit-phone"
                label="Tālrunis"
                value={mergedCustomerPhone}
                onChange={(v) => persistEdits({ customerPhone: v })}
                placeholder="+371…"
                compact
                hideToolbar
                resetVersion={orderFieldResetKey}
              />
            </div>
          </AdminCollapsibleShell>
        </section>
      </div>

      <section className="min-w-0">
        <AdminCollapsibleShell
          sessionId={order.id}
          blockId="consultation-meta-notes"
          className={metaAccordionShellClass}
          header={
            <h2 className={`${sectionTitle} flex flex-wrap items-center gap-x-2 gap-y-0 px-2 py-2`}>
              <AdminProvinLucide icon={META_ORDER_LUCIDE.notes} />
              Klienta komentārs (no pieteikuma)
            </h2>
          }
          headerActions={
            <AdminPdfIncludeToggle
              checked={pdfVisibility.notes}
              onChange={(next) => patchPdfVisibility({ notes: next })}
            />
          }
        >
          <div className="space-y-1 px-2 pb-2">
            <AdminSavableTextField
              id="consultation-edit-notes"
              value={mergedNotes}
              onChange={(v) => persistEdits({ notes: v })}
              placeholder="Sākotnējais ziņojums no formas…"
              multiline
              multilineRich
              compact
              hideToolbar
              minHeightClass="min-h-[56px]"
              resetVersion={orderFieldResetKey}
            />
          </div>
        </AdminCollapsibleShell>
      </section>

      <section className="min-w-0">
        <AdminCollapsibleShell
          sessionId={order.id}
          blockId="consultation-internal"
          className={metaAccordionShellClass}
          header={
            <h2 className={`${sectionTitle} flex flex-wrap items-center gap-x-2 gap-y-0 px-2 py-2`}>
              Iekšējā piezīme
            </h2>
          }
        >
          <div className="space-y-1 px-2 pb-2">
            <AdminSavableTextField
              id="consultation-internal-comment"
              value={mergedInternalComment}
              onChange={(v) => persistEdits({ internalComment: v })}
              placeholder="Tikai adminam…"
              multiline
              multilineRich
              compact
              hideToolbar
              minHeightClass="min-h-[48px]"
              resetVersion={orderFieldResetKey}
            />
          </div>
        </AdminCollapsibleShell>
      </section>
    </>
  );

  return (
    <div
      className={`admin-order-page min-h-screen bg-[var(--color-canvas)] text-[var(--color-apple-text)] transition-[background-color,color] duration-200 ${adminDark ? "dark" : ""}`}
    >
      <div className="mx-auto w-full max-w-[min(76.8rem,calc(100vw-1.25rem))] px-3 pt-0 sm:px-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <AdminCollapsedMenuButton />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link
              href="/admin/konsultacijas"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200/90 bg-white px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-provin-accent)] shadow-sm transition hover:border-[var(--color-provin-accent)]/30 hover:bg-[var(--color-provin-accent-soft)]/50"
            >
              <span aria-hidden>←</span> Konsultācijas
            </Link>
            {order.paymentStatus === "paid" && order.amountTotal != null ? (
              <a
                href={`/api/admin/invoice/${encodeURIComponent(order.id)}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200/90 bg-white px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-apple-text)] shadow-sm transition hover:border-[var(--color-provin-accent)]/35 hover:bg-slate-50"
              >
                Rēķins
              </a>
            ) : null}
          </div>
        </div>

        {order.isDemo ? (
          <div className="mb-3 rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50/95 to-white px-3 py-2.5 text-sm text-amber-950 shadow-sm ring-1 ring-amber-100/80">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800/90">Parauga konsultācija</p>
            <p className="mt-2 leading-relaxed text-amber-950/90">
              Šī ir parauga PROVIN SELECT ieraksts — nav īsts Stripe maksājums.
            </p>
          </div>
        ) : null}

        <header className="mb-3 border-b border-[var(--admin-border-subtle)] pb-2">
          <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
            PROVIN SELECT · stratēģiskā konsultācija
          </p>
          <h1 className="mt-0.5 font-mono text-base font-medium tracking-tight text-[var(--color-apple-text)] sm:text-xl">
            {order.id}
          </h1>
        </header>

        <ConsultationDetailWorkspace
          orderDraftPersistenceEnabled={consultationDraftPersistenceEnabled}
          serverWorkspaceJson={serverWorkspaceJson}
          pdfVisibility={pdfVisibility}
          onPdfVisibilityChange={patchPdfVisibility}
          clientDashboardSlot={dashboardSlot}
          clientTabLevelInputs={{
            customerName: mergedCustomerName,
            customerEmail: mergedCustomerEmail,
            customerPhone: mergedCustomerPhone,
          }}
          payload={{
            sessionId: order.id,
            isDemo: Boolean(order.isDemo),
            created: order.created,
            amountTotal: order.amountTotal,
            currency: order.currency,
            paymentStatus: order.paymentStatus,
            customerEmail: mergedCustomerEmail.trim() || null,
            customerPhone: mergedCustomerPhone.trim() || null,
            customerName: mergedCustomerName.trim() || null,
            contactMethod: order.contactMethod ?? null,
            notes: mergedNotes.trim() ? mergedNotes : null,
          }}
        />
      </div>
    </div>
  );
}
