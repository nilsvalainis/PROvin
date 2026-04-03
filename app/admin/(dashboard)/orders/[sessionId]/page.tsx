import Link from "next/link";
import { notFound } from "next/navigation";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { formatMoneyEur } from "@/lib/format-money";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ sessionId: string }> };

export default async function AdminOrderDetailPage({ params }: Props) {
  const { sessionId } = await params;
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order) {
    notFound();
  }

  const dateFmt = new Intl.DateTimeFormat("lv-LV", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-sm font-medium text-[var(--color-provin-accent)] hover:underline"
        >
          ← Visi pasūtījumi
        </Link>
      </div>

      {order.isDemo ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Demonstrācijas pasūtījums</p>
          <p className="mt-1 text-amber-900/90">
            Šī ir parauga datu kopa — nav īsts Stripe maksājums. Tā parāda, kā izskatīsies tavi
            komentāri un pielikumu saraksts pēc turpmākās integrācijas.
          </p>
        </div>
      ) : null}

      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
          Pasūtījums
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-apple-text)]">
          {order.vin ?? "—"}
        </h1>
        <p className="mt-1 font-mono text-xs text-[var(--color-provin-muted)]">{order.id}</p>
      </header>

      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Maksājums</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
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

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Transportlīdzeklis un sludinājums</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[var(--color-provin-muted)]">VIN</dt>
              <dd className="mt-0.5 font-mono text-[var(--color-apple-text)]">{order.vin ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-provin-muted)]">Sludinājuma saite</dt>
              <dd className="mt-0.5 break-all">
                {order.listingUrl ? (
                  <a
                    href={order.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-provin-accent)] hover:underline"
                  >
                    {order.listingUrl}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Kontakti</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
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
          </dl>
        </section>

        {order.notes ? (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Komentārs no formas</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-apple-text)]">
              {order.notes}
            </p>
          </section>
        ) : null}

        {order.internalComment ? (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Tavs komentārs (apstrāde)</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-apple-text)]">
              {order.internalComment}
            </p>
            <p className="mt-3 text-xs text-[var(--color-provin-muted)]">
              Vēlāk šo lauku varēsi rediģēt un saglabāt — šobrīd demo parāda tikai izskatu.
            </p>
          </section>
        ) : null}

        {order.attachments && order.attachments.length > 0 ? (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Pielikumi / avoti</h2>
            <p className="mt-1 text-xs text-[var(--color-provin-muted)]">
              Demonstrācija — faili vēl nav augšupielādēti; šī ir saraksta izskata paraugs.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {order.attachments.map((a) => (
                <li
                  key={a.fileName}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                >
                  <span className="text-[var(--color-apple-text)]">{a.label}</span>
                  <span className="font-mono text-xs text-[var(--color-provin-muted)]">{a.fileName}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl border border-dashed border-[var(--color-provin-accent)]/35 bg-[var(--color-provin-accent-soft)]/40 p-5">
          <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Turpmākā apstrāde</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-provin-muted)]">
            Šeit drīzumā varēsi augšupielādēt īstus PDF, saglabāt komentārus datubāzē, ģenerēt AI
            kopsavilkumu un PDF klientam. Demo pasūtījums jau parāda plānoto izkārtojumu augšā.
          </p>
        </section>
      </div>
    </div>
  );
}
