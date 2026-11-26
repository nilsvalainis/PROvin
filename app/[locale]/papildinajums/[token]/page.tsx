import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderUpsellPayButton } from "@/components/OrderUpsellPayButton";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { formatEurFromCents, isOfferExpired, isUpsellToken } from "@/lib/order-upsell";
import { readUpsellByToken } from "@/lib/order-upsell-store";
import { normalizeUpsellLang, upsellPageCopy } from "@/lib/order-upsell-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { robots: { index: false, follow: false }, title: upsellPageCopy(locale).title };
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "";
  return `${user.slice(0, 1)}***@${domain}`;
}

export default async function OrderUpsellPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; locale: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { token, locale } = await params;
  const lang = normalizeUpsellLang(locale);
  const c = upsellPageCopy(lang);
  const sp = await searchParams;
  if (!isUpsellToken(token)) notFound();

  const found = await readUpsellByToken(token);
  if (found.state === "missing") notFound();

  const shell = "mx-auto max-w-lg px-4 py-16 text-[#1d1d1f]";

  if (found.state === "replaced") {
    return (
      <main className={shell}>
        <h1 className="text-2xl font-semibold">{c.replacedTitle}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">{c.replacedBody}</p>
      </main>
    );
  }

  const parent = await getCheckoutSessionDetail(found.parentSessionId);
  const vin = parent?.vin?.trim() || "";
  const email = maskEmail((parent?.customerEmail ?? parent?.customerDetailsEmail ?? "").trim());
  /** Apmaksu apstiprina tikai serveris; `?paid=1` nozīmē vien to, ka klients atgriezies no maksājuma lapas. */
  const paid = found.offer.status === "paid" || found.offer.status === "manual";
  const returnedFromCheckout = !paid && sp.paid === "1";
  const expired = found.offer.status === "open" && isOfferExpired(found.offer.expiresAt);

  if (paid) {
    return (
      <main className={shell}>
        <h1 className="text-2xl font-semibold">{c.paidTitle}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
          {c.paidBody}
          {vin ? ` VIN ${vin}.` : ""}
        </p>
      </main>
    );
  }

  if (returnedFromCheckout) {
    return (
      <main className={shell}>
        <h1 className="text-2xl font-semibold">{c.processingTitle}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
          {c.processingBody}
          {vin ? ` VIN ${vin}.` : ""}
        </p>
      </main>
    );
  }

  if (expired) {
    return (
      <main className={shell}>
        <h1 className="text-2xl font-semibold">{c.expiredTitle}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
          {c.expiredBody[0]}
          <a className="text-[#0061D2] underline" href={`https://www.provin.lv/${lang}`}>
            provin.lv
          </a>
          {c.expiredBody[1]}
        </p>
      </main>
    );
  }

  return (
    <main className={shell} lang={lang}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0061D2]">PROVIN</p>
      <h1 className="mt-2 text-2xl font-semibold">{c.title2}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
        {c.lead}
        {vin ? ` VIN ${vin}.` : ""}
        {email ? c.confirmTo(email) : ""}
      </p>
      <dl className="mt-6 space-y-2 text-[15px]">
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">{c.alreadyPaid}</dt>
          <dd className="font-medium">{formatEurFromCents(found.offer.priorCents)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">{c.now}</dt>
          <dd className="font-medium">{formatEurFromCents(found.offer.chargeCents)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-neutral-200 pt-2">
          <dt>{c.total}</dt>
          <dd className="font-semibold">{formatEurFromCents(found.offer.targetCents)}</dd>
        </div>
      </dl>
      <div className="mt-8">
        <OrderUpsellPayButton token={token} lang={lang} label={c.pay(formatEurFromCents(found.offer.chargeCents))} />
      </div>
    </main>
  );
}
