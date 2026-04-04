"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminSavableAttachmentRow } from "@/components/admin/AdminSavableAttachmentRow";
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
  /** Ja masīvs definēts ( arī tukšs), aizstāj servera pielikumu sarakstu. */
  attachments?: { label: string; fileName: string }[] | null;
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
        const p = JSON.parse(raw) as OrderEdits;
        if (p && typeof p === "object") setEdits(p);
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
  const serverAttachments = order.attachments ?? [];
  const mergedAttachments =
    edits.attachments !== undefined && edits.attachments !== null ? edits.attachments : serverAttachments;

  const resetToServer = () => {
    setEdits({});
    setFieldUiRev((n) => n + 1);
    try {
      localStorage.removeItem(storageKeyOrderEdits(order.id));
    } catch {
      /* ignore */
    }
  };

  const addAttachmentRow = () => {
    const base = [...mergedAttachments, { label: "", fileName: "" }];
    persistEdits({ ...edits, attachments: base });
  };

  const removeAttachmentRow = (index: number) => {
    const base = mergedAttachments.filter((_, i) => i !== index);
    persistEdits({ ...edits, attachments: base });
  };

  const orderFieldResetKey = `${order.id}-${hydrated ? 1 : 0}-${fieldUiRev}`;

  const card =
    "rounded-xl border border-slate-200/70 bg-white p-3 shadow-[0_1px_12px_rgba(15,23,42,0.05)] sm:p-3.5";

  return (
    <div className="mx-auto max-w-3xl">
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
        <section className={card}>
          <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Maksājums</h2>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-provin-muted)]">
            No Stripe / sesijas — šeit nav rediģējams (grāmatvedības un maksājumu ieraksts).
          </p>
          <dl className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--color-provin-muted)]">Summa</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-[var(--color-apple-text)]">
                {formatMoneyEur(order.amountTotal, order.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-provin-muted)]">Laiks</dt>
              <dd className="mt-0.5 text-[var(--color-apple-text)]">
                {dateFmt.format(new Date(order.created * 1000))}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-provin-muted)]">Statuss</dt>
              <dd className="mt-0.5 text-[var(--color-apple-text)]">{order.paymentStatus}</dd>
            </div>
          </dl>
        </section>

        <section className={card}>
          <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Transportlīdzeklis un sludinājums</h2>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-provin-muted)]">
            VIN un saiti vari labot darba vajadzībām; izmaiņas saglabājas tikai šajā pārlūkā (localStorage).
          </p>
          <div className="mt-2 space-y-2.5">
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
                  className="mt-2 inline-block text-sm text-[var(--color-provin-accent)] hover:underline"
                >
                  Atvērt saiti jaunā cilnē
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section className={card}>
          <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Klienta kontaktdati</h2>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-provin-muted)]">
            No pasūtījuma — <strong className="font-medium text-[var(--color-apple-text)]">nav rediģējami</strong>{" "}
            (personas dati).
          </p>
          <dl className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--color-provin-muted)]">E-pasts</dt>
              <dd className="mt-0.5 break-all text-[var(--color-apple-text)]">
                {order.customerEmail ?? order.customerDetailsEmail ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-provin-muted)]">Tālrunis</dt>
              <dd className="mt-0.5 text-[var(--color-apple-text)]">
                {order.phone ?? order.customerDetailsPhone ?? "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--color-provin-muted)]">Vārds, uzvārds</dt>
              <dd className="mt-0.5 text-[var(--color-apple-text)]">{order.customerName ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--color-provin-muted)]">Vēlamā saziņa (no formas)</dt>
              <dd className="mt-0.5 text-[var(--color-apple-text)]">{order.contactMethod ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className={card}>
          <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Komentārs no klienta formas</h2>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-provin-muted)]">
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

        <section className={card}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Atsauces / pielikumi (no sistēmas)</h2>
            <button
              type="button"
              onClick={addAttachmentRow}
              className="text-xs font-medium text-[var(--color-provin-accent)] hover:underline"
            >
              + rinda
            </button>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-provin-muted)]">
            Nosaukumi darba kārtībai; īstus failus glabā zem „Papildu faili”. Rindas vari pielabot vai dzēst.
          </p>
          {mergedAttachments.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {mergedAttachments.map((a, i) => (
                <AdminSavableAttachmentRow
                  key={`${order.id}-att-${i}-${orderFieldResetKey}`}
                  index={i}
                  row={a}
                  onChangeRow={(next) => {
                    const base = [...mergedAttachments];
                    base[i] = next;
                    persistEdits({ ...edits, attachments: base });
                  }}
                  onRemove={() => removeAttachmentRow(i)}
                  resetVersion={orderFieldResetKey}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-2.5 text-sm text-[var(--color-provin-muted)]">
              Nav rindu — spied „+ rinda” vai atiestatīt, lai ielādētu servera sarakstu.
            </p>
          )}
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
            serverAttachments: mergedAttachments,
          }}
        />
      </div>
    </div>
  );
}
