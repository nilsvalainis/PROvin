"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SectionLineIcon } from "@/components/icons/SectionLineIcon";
import { AdminListingUrlEndAdornment } from "@/components/admin/AdminListingUrlToolbar";
import { AdminSavableTextField } from "@/components/admin/AdminSavableTextField";
import { AdminVinCopyButton, AdminVinServiceLinkRow } from "@/components/admin/AdminVinClipboardAndLinks";
import { OrderDetailWorkspace } from "@/components/admin/OrderDetailWorkspace";
import { formatMoneyEur } from "@/lib/format-money";
import { SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS } from "@/lib/admin-source-blocks";
import type { OrderDraftState } from "@/lib/admin-order-draft-types";
import { orderDraftHasOrderEdits } from "@/lib/admin-order-draft-types";

/** Servera pasūtījums, serializējams uz klientu (bez server-only importiem). */
export type AdminOrderDetailClientModel = {
  id: string;
  created: number;
  amountTotal: number | null;
  currency: string | null;
  paymentStatus: string;
  customerEmail: string | null;
  customerDetailsEmail: string | null;
  phone: string | null;
  customerDetailsPhone: string | null;
  customerName: string | null;
  contactMethod: string | null;
  vin: string | null;
  listingUrl: string | null;
  notes: string | null;
  internalComment?: string | null;
  attachments?: { label: string; fileName: string }[];
  isDemo?: boolean;
};

type OrderEdits = {
  vin?: string;
  listingUrl?: string;
  notes?: string;
};

function storageKeyOrderEdits(sessionId: string) {
  return `provin-admin-order-edits-v1-${sessionId}`;
}

export function AdminOrderDetailView({
  order,
  serverOrderDraft,
  serverWorkspaceJson,
  orderDraftPersistenceEnabled,
}: {
  order: AdminOrderDetailClientModel;
  serverOrderDraft: OrderDraftState | null;
  serverWorkspaceJson: string | null;
  orderDraftPersistenceEnabled: boolean;
}) {
  const dateFmt = new Intl.DateTimeFormat("lv-LV", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const [edits, setEdits] = useState<OrderEdits>({});
  const [hydrated, setHydrated] = useState(false);
  /** Palielinās pie „Atiestatīt…” — atsvaidzina Saglabāt/Labot iekšējos punktus */
  const [fieldUiRev, setFieldUiRev] = useState(0);
  const [vinCopyFlash, setVinCopyFlash] = useState(false);
  const [listingCopyFlash, setListingCopyFlash] = useState(false);
  const [orderEditsAutosaveFlash, setOrderEditsAutosaveFlash] = useState(false);
  const [orderEditsSaveServerOk, setOrderEditsSaveServerOk] = useState(true);
  const skipOrderEditsAutosaveFlash = useRef(true);

  useEffect(() => {
    const key = storageKeyOrderEdits(order.id);
    const fromServer = serverOrderDraft?.orderEdits;
    if (orderDraftHasOrderEdits(fromServer)) {
      setEdits({
        ...(typeof fromServer!.vin === "string" ? { vin: fromServer!.vin } : {}),
        ...(typeof fromServer!.listingUrl === "string" ? { listingUrl: fromServer!.listingUrl } : {}),
        ...(typeof fromServer!.notes === "string" ? { notes: fromServer!.notes } : {}),
      });
      try {
        localStorage.setItem(key, JSON.stringify(fromServer));
      } catch {
        /* quota */
      }
      setHydrated(true);
      return;
    }
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const p = JSON.parse(raw) as Record<string, unknown>;
        if (p && typeof p === "object") {
          setEdits({
            ...(typeof p.vin === "string" ? { vin: p.vin } : {}),
            ...(typeof p.listingUrl === "string" ? { listingUrl: p.listingUrl } : {}),
            ...(typeof p.notes === "string" ? { notes: p.notes } : {}),
          });
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [order.id, serverOrderDraft]);

  useEffect(() => {
    skipOrderEditsAutosaveFlash.current = true;
  }, [order.id]);

  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          localStorage.setItem(storageKeyOrderEdits(order.id), JSON.stringify(edits));
        } catch {
          /* quota */
        }
        let srvOk = !orderDraftPersistenceEnabled;
        if (orderDraftPersistenceEnabled) {
          try {
            const res = await fetch("/api/admin/order-draft", {
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
  }, [edits, hydrated, order.id, orderDraftPersistenceEnabled]);

  useEffect(() => {
    if (!orderEditsAutosaveFlash) return;
    const u = window.setTimeout(() => setOrderEditsAutosaveFlash(false), 1400);
    return () => window.clearTimeout(u);
  }, [orderEditsAutosaveFlash]);

  const persistEdits = useCallback((next: OrderEdits) => {
    setEdits(next);
  }, []);

  const flushOrderEditsToStorage = useCallback(() => {
    try {
      localStorage.setItem(storageKeyOrderEdits(order.id), JSON.stringify(edits));
    } catch {
      /* quota */
    }
  }, [edits, order.id]);

  useEffect(() => {
    const onUnload = () => flushOrderEditsToStorage();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [flushOrderEditsToStorage]);

  const mergedVin = edits.vin !== undefined ? edits.vin : (order.vin ?? "");
  const mergedListing = edits.listingUrl !== undefined ? edits.listingUrl : (order.listingUrl ?? "");
  const mergedNotes = edits.notes !== undefined ? edits.notes : (order.notes ?? "");

  const resetToServer = () => {
    setEdits({});
    setFieldUiRev((n) => n + 1);
    try {
      localStorage.removeItem(storageKeyOrderEdits(order.id));
    } catch {
      /* ignore */
    }
  };

  const orderFieldResetKey = `${order.id}-${hydrated ? 1 : 0}-${fieldUiRev}`;

  const sectionClass =
    "rounded-lg border border-slate-200/90 bg-slate-50/40 p-2 shadow-sm";
  const sectionTitle = `font-bold uppercase tracking-wide text-[var(--color-apple-text)] ${SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS}`;
  const sectionHint = "mt-0.5 text-[10px] leading-tight text-[var(--color-provin-muted)]";
  const metaLabel = "text-[10px] font-medium text-[var(--color-provin-muted)]";
  const metaValue = "text-[11px] text-[var(--color-apple-text)]";
  /** Šaurā kolonnā — vertikāls saraksts (kopīgs ar xl 3-kolonnu režģi). */
  const metaStack = "mt-1 flex flex-col gap-1 text-[11px]";

  return (
    <div className="w-full max-w-none">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-3.5 py-2 text-sm font-medium text-[var(--color-provin-accent)] shadow-sm transition hover:border-[var(--color-provin-accent)]/30 hover:bg-[var(--color-provin-accent-soft)]/50"
        >
          <span aria-hidden>←</span> Visi pasūtījumi
        </Link>
        {hydrated ? (
          <button
            type="button"
            onClick={resetToServer}
            className="text-xs font-medium text-[var(--color-provin-muted)] underline decoration-slate-300 underline-offset-2 hover:text-[var(--color-apple-text)]"
          >
            Atiestatīt rediģētos laukus (izņemot tavu iekšējo komentāru un portfeli)
          </button>
        ) : null}
      </div>

      {order.isDemo ? (
        <div className="mb-3 rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50/95 to-white px-3 py-2.5 text-sm text-amber-950 shadow-sm ring-1 ring-amber-100/80">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800/90">Parauga pasūtījums</p>
          <p className="mt-2 leading-relaxed text-amber-950/90">
            {order.paymentStatus === "unpaid" ? (
              <>
                Šis paraugs imitē klientu, kas vēl <strong className="font-semibold">nav pabeidzis maksājumu</strong>{" "}
                Stripe Checkout — nav īsts neapmaksāts sesijas ieraksts, bet tā pati informācija (VIN, kontakti,
                komentāri, pielikumu saraksts), ko redzēsi pēc turpmākās integrācijas.
              </>
            ) : (
              <>
                Šī ir parauga datu kopa — nav īsts Stripe maksājums. Tā parāda, kā izskatīsies tavi
                komentāri un pielikumu saraksts pēc turpmākās integrācijas.
              </>
            )}
          </p>
        </div>
      ) : null}

      <header className="mb-4 border-b border-slate-200/60 pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          Pasūtījums
        </p>
        <h1 className="mt-0.5 font-mono text-xl font-semibold tracking-tight text-[var(--color-apple-text)] sm:text-2xl">
          {mergedVin.trim() || "—"}
        </h1>
        <p className="mt-1 font-mono text-[11px] text-[var(--color-provin-muted)]">{order.id}</p>
      </header>

      <div className="space-y-1.5">
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2 xl:grid-cols-4 xl:items-stretch">
          <section className={`${sectionClass} min-w-0`}>
            <h2 className={`${sectionTitle} flex flex-wrap items-center gap-x-2 gap-y-0`}>
              <SectionLineIcon id="wallet" />
              Maksājums
            </h2>
            <p className={sectionHint}>No Stripe / sesijas — nav rediģējams.</p>
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
          </section>

          <section className={`${sectionClass} min-w-0`}>
            <h2 className={`${sectionTitle} flex flex-wrap items-center gap-x-2 gap-y-0`}>
              <SectionLineIcon id="car" />
              <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <span>Transportlīdzeklis un sludinājums</span>
              {orderEditsAutosaveFlash ? (
                <span
                  className={`text-[10px] font-semibold normal-case tracking-normal ${
                    orderDraftPersistenceEnabled && !orderEditsSaveServerOk ? "text-amber-800" : "text-emerald-700"
                  }`}
                  role="status"
                >
                  {!orderDraftPersistenceEnabled
                    ? "Saglabāts"
                    : orderEditsSaveServerOk
                      ? "Saglabāts serverī"
                      : "Saglabāts lokāli (serveris nav pieejams)"}
                </span>
              ) : null}
              </span>
            </h2>
            <p className={sectionHint}>
              VIN un saite — auto pēc ~0,8 s (localStorage
              {orderDraftPersistenceEnabled ? " + JSON serverī" : ""}). CV / Tirgus — Tampermonkey{" "}
              <span className="font-mono text-[9px]">GM_setValue</span> no{" "}
              <span className="font-mono text-[9px]">data-provin-handoff-*</span>; AR —{" "}
              <span className="whitespace-nowrap">?vin=</span>.
            </p>
            <div className="mt-1 flex min-h-0 min-w-0 max-w-full flex-col gap-2">
              <div
                className={`min-w-0 max-w-full overflow-hidden rounded-md px-0.5 py-0.5 transition-[box-shadow,background-color] duration-500 ease-out ${
                  vinCopyFlash
                    ? "bg-emerald-50/90 shadow-[inset_0_0_0_2px_rgb(16,185,129)]"
                    : ""
                }`}
              >
                <AdminSavableTextField
                  id="edit-vin"
                  label="VIN"
                  value={mergedVin}
                  onChange={(v) => persistEdits({ ...edits, vin: v })}
                  placeholder="17 zīmes…"
                  mono
                  compact
                  resetVersion={orderFieldResetKey}
                  endAdornment={
                    <AdminVinCopyButton
                      value={mergedVin}
                      onCopied={() => {
                        setVinCopyFlash(true);
                        window.setTimeout(() => setVinCopyFlash(false), 500);
                      }}
                    />
                  }
                />
                <AdminVinServiceLinkRow vin={mergedVin} />
              </div>
              <div
                className={`min-w-0 max-w-full overflow-hidden rounded-md px-0.5 py-0.5 transition-[box-shadow,background-color] duration-500 ease-out ${
                  listingCopyFlash
                    ? "bg-emerald-50/90 shadow-[inset_0_0_0_2px_rgb(16,185,129)]"
                    : ""
                }`}
              >
                <AdminSavableTextField
                  id="edit-listing"
                  label="Sludinājuma saite"
                  value={mergedListing}
                  onChange={(v) => persistEdits({ ...edits, listingUrl: v })}
                  placeholder="https://…"
                  inputType="url"
                  compact
                  resetVersion={orderFieldResetKey}
                  endAdornment={
                    <AdminListingUrlEndAdornment
                      listingUrl={mergedListing}
                      onCopySuccess={() => {
                        setListingCopyFlash(true);
                        window.setTimeout(() => setListingCopyFlash(false), 500);
                      }}
                    />
                  }
                />
                {mergedListing.trim() ? (
                  <a
                    href={mergedListing.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex text-[10px] font-medium text-[var(--color-provin-accent)] hover:underline"
                  >
                    Atvērt jaunā cilnē →
                  </a>
                ) : null}
              </div>
            </div>
          </section>

          <section className={`${sectionClass} min-w-0`}>
            <h2 className={`${sectionTitle} flex flex-wrap items-center gap-x-2 gap-y-0`}>
              <SectionLineIcon id="user" />
              Klienta dati
            </h2>
            <p className={sectionHint}>
              No pasūtījuma — <strong className="font-medium text-[var(--color-apple-text)]">nav rediģējami</strong>.
            </p>
            <dl className={metaStack}>
              <div className="min-w-0">
                <dt className={metaLabel}>E-pasts</dt>
                <dd className={`${metaValue} break-all`}>
                  {order.customerEmail ?? order.customerDetailsEmail ?? "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className={metaLabel}>Tālrunis</dt>
                <dd className={metaValue}>{order.phone ?? order.customerDetailsPhone ?? "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className={metaLabel}>Vārds, uzvārds</dt>
                <dd className={metaValue}>{order.customerName ?? "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className={metaLabel}>Vēlamā saziņa (no formas)</dt>
                <dd className={metaValue}>{order.contactMethod ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <div
            id={`admin-portfolio-slot-${order.id}`}
            className="min-h-0 min-w-0 lg:min-h-[1px]"
          />
        </div>

        <section className={sectionClass}>
          <h2 className={`${sectionTitle} flex flex-wrap items-center gap-x-2 gap-y-0`}>
            <SectionLineIcon id="messageSquare" />
            <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <span>Klienta komentārs</span>
            {orderEditsAutosaveFlash ? (
              <span
                className={`text-[10px] font-semibold normal-case tracking-normal ${
                  orderDraftPersistenceEnabled && !orderEditsSaveServerOk ? "text-amber-800" : "text-emerald-700"
                }`}
                role="status"
              >
                {!orderDraftPersistenceEnabled
                  ? "Saglabāts"
                  : orderEditsSaveServerOk
                    ? "Saglabāts serverī"
                    : "Saglabāts lokāli (serveris nav pieejams)"}
              </span>
            ) : null}
            </span>
          </h2>
          <p className={sectionHint}>
            {orderDraftPersistenceEnabled
              ? "Melnraksts serverī (JSON) + kopija pārlūkā; oriģinālais klienta teksts — Stripe."
              : "Tikai pārlūkā; oriģināls — serverī / Stripe."}
          </p>
          <div className="mt-1">
            <AdminSavableTextField
              id="edit-notes"
              value={mergedNotes}
              onChange={(v) => persistEdits({ ...edits, notes: v })}
              placeholder="Klienta ziņojums…"
              multiline
              compact
              minHeightClass="min-h-[72px]"
              resetVersion={orderFieldResetKey}
            />
          </div>
        </section>

        <OrderDetailWorkspace
          portfolioPortalDomId={`admin-portfolio-slot-${order.id}`}
          serverWorkspaceJson={serverWorkspaceJson}
          orderDraftPersistenceEnabled={orderDraftPersistenceEnabled}
          payload={{
            sessionId: order.id,
            isDemo: Boolean(order.isDemo),
            vin: mergedVin.trim() || null,
            created: order.created,
            amountTotal: order.amountTotal,
            currency: order.currency,
            paymentStatus: order.paymentStatus,
            listingUrl: mergedListing.trim() || null,
            customerEmail: order.customerEmail ?? order.customerDetailsEmail,
            customerPhone: order.phone ?? order.customerDetailsPhone,
            customerName: order.customerName,
            contactMethod: order.contactMethod,
            notes: mergedNotes.trim() ? mergedNotes : null,
            serverInternalComment: order.internalComment ?? null,
            serverAttachments: order.attachments ?? [],
          }}
        />
      </div>
    </div>
  );
}
