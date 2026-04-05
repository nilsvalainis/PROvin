"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminSavableTextField } from "@/components/admin/AdminSavableTextField";
import { OrderDetailWorkspace } from "@/components/admin/OrderDetailWorkspace";
import { formatMoneyEur } from "@/lib/format-money";

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

export function AdminOrderDetailView({ order }: { order: AdminOrderDetailClientModel }) {
  const dateFmt = new Intl.DateTimeFormat("lv-LV", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const [edits, setEdits] = useState<OrderEdits>({});
  const [hydrated, setHydrated] = useState(false);
  /** Palielinās pie „Atiestatīt…” — atsvaidzina Saglabāt/Labot iekšējos punktus */
  const [fieldUiRev, setFieldUiRev] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKeyOrderEdits(order.id));
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
  }, [order.id]);

  const persistEdits = useCallback(
    (next: OrderEdits) => {
      setEdits(next);
      try {
        localStorage.setItem(storageKeyOrderEdits(order.id), JSON.stringify(next));
      } catch {
        /* quota */
      }
    },
    [order.id],
  );

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

  const sectionClass = "rounded-lg border border-slate-200/80 bg-white p-2.5 shadow-sm";
  const sectionTitle = "text-xs font-semibold uppercase tracking-wide text-[var(--color-apple-text)]";
  const sectionHint = "mt-0.5 text-[10px] leading-snug text-[var(--color-provin-muted)]";
  const dlGrid = "mt-1.5 grid gap-1.5 text-[11px] sm:grid-cols-2";
  const dtClass = "text-[10px] text-[var(--color-provin-muted)]";
  const ddClass = "mt-0.5 text-[var(--color-apple-text)]";

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

      <div className="space-y-2.5">
        <section className={sectionClass}>
          <h2 className={sectionTitle}>Maksājums</h2>
          <p className={sectionHint}>
            No Stripe / sesijas — šeit nav rediģējams (grāmatvedības un maksājumu ieraksts).
          </p>
          <dl className={dlGrid}>
            <div>
              <dt className={dtClass}>Summa</dt>
              <dd className={`${ddClass} font-medium tabular-nums`}>
                {formatMoneyEur(order.amountTotal, order.currency)}
              </dd>
            </div>
            <div>
              <dt className={dtClass}>Laiks</dt>
              <dd className={ddClass}>{dateFmt.format(new Date(order.created * 1000))}</dd>
            </div>
            <div>
              <dt className={dtClass}>Statuss</dt>
              <dd className={ddClass}>{order.paymentStatus}</dd>
            </div>
          </dl>
        </section>

        <section className={sectionClass}>
          <h2 className={sectionTitle}>Transportlīdzeklis un sludinājums</h2>
          <p className={sectionHint}>
            VIN un saiti vari labot darba vajadzībām; izmaiņas saglabājas tikai šajā pārlūkā (localStorage).
          </p>
          <div className="mt-1.5 space-y-2">
            <AdminSavableTextField
              id="edit-vin"
              label="VIN"
              value={mergedVin}
              onChange={(v) => persistEdits({ ...edits, vin: v })}
              placeholder="17 zīmes…"
              mono
              resetVersion={orderFieldResetKey}
            />
            <div>
              <AdminSavableTextField
                id="edit-listing"
                label="Sludinājuma saite"
                value={mergedListing}
                onChange={(v) => persistEdits({ ...edits, listingUrl: v })}
                placeholder="https://…"
                inputType="url"
                resetVersion={orderFieldResetKey}
              />
              {mergedListing.trim() ? (
                <a
                  href={mergedListing.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-block text-[11px] font-medium text-[var(--color-provin-accent)] hover:underline"
                >
                  Atvērt saiti jaunā cilnē
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className={sectionTitle}>Klienta kontaktdati</h2>
          <p className={sectionHint}>
            No pasūtījuma — <strong className="font-medium text-[var(--color-apple-text)]">nav rediģējami</strong>{" "}
            (personas dati).
          </p>
          <dl className={dlGrid}>
            <div>
              <dt className={dtClass}>E-pasts</dt>
              <dd className={`${ddClass} break-all`}>
                {order.customerEmail ?? order.customerDetailsEmail ?? "—"}
              </dd>
            </div>
            <div>
              <dt className={dtClass}>Tālrunis</dt>
              <dd className={ddClass}>{order.phone ?? order.customerDetailsPhone ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className={dtClass}>Vārds, uzvārds</dt>
              <dd className={ddClass}>{order.customerName ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className={dtClass}>Vēlamā saziņa (no formas)</dt>
              <dd className={ddClass}>{order.contactMethod ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className={sectionClass}>
          <h2 className={sectionTitle}>Komentārs no klienta formas</h2>
          <p className={sectionHint}>
            Vari labot darba nolūkos (piemēram, atkārtoti iekopēt vai precizēt); oriģināls paliek serverī / Stripe.
          </p>
          <div className="mt-1.5">
            <AdminSavableTextField
              id="edit-notes"
              value={mergedNotes}
              onChange={(v) => persistEdits({ ...edits, notes: v })}
              placeholder="Klienta ziņojums…"
              multiline
              resetVersion={orderFieldResetKey}
            />
          </div>
        </section>

        <OrderDetailWorkspace
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
