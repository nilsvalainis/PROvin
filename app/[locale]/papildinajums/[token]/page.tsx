import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderUpsellPayButton } from "@/components/OrderUpsellPayButton";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { formatEurFromCents, isOfferExpired, isUpsellToken } from "@/lib/order-upsell";
import { readUpsellByToken } from "@/lib/order-upsell-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "PROVIN papildinājums",
};

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "";
  return `${user.slice(0, 1)}***@${domain}`;
}

export default async function OrderUpsellPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  if (!isUpsellToken(token)) notFound();

  const found = await readUpsellByToken(token);
  if (found.state === "missing") notFound();

  const shell = "mx-auto max-w-lg px-4 py-16 text-[#1d1d1f]";

  if (found.state === "replaced") {
    return (
      <main className={shell}>
        <h1 className="text-2xl font-semibold">Šī saite ir nomainīta</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
          Palūdziet jaunu apmaksas saiti, rakstot uz info@provin.lv.
        </p>
      </main>
    );
  }

  const parent = await getCheckoutSessionDetail(found.parentSessionId);
  const vin = parent?.vin?.trim() || "";
  const email = maskEmail((parent?.customerEmail ?? parent?.customerDetailsEmail ?? "").trim());
  const paid = found.offer.status === "paid" || found.offer.status === "manual" || sp.paid === "1";
  const expired = found.offer.status === "open" && isOfferExpired(found.offer.expiresAt);

  if (paid) {
    return (
      <main className={shell}>
        <h1 className="text-2xl font-semibold">Papildu apmaksa saņemta</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
          Pasūtījums tiek papildināts. Sagatavošana aizņem līdz 48 stundām. Jau nosūtītie materiāli paliek spēkā.
          {vin ? ` VIN ${vin}.` : ""}
        </p>
      </main>
    );
  }

  if (expired) {
    return (
      <main className={shell}>
        <h1 className="text-2xl font-semibold">Piedāvājuma termiņš ir beidzies</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
          Šī saite vairs nav derīga. Jaunu pasūtījumu var izveidot vietnē{" "}
          <a className="text-[#0061D2] underline" href="https://provin.lv">
            provin.lv
          </a>
          .
        </p>
      </main>
    );
  }

  return (
    <main className={shell}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0061D2]">PROVIN</p>
      <h1 className="mt-2 text-2xl font-semibold">Papildināt esošo pasūtījumu</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
        Šī apmaksa papildina jau esošo pasūtījumu. Jaunu pasūtījumu neveido.
        {vin ? ` VIN ${vin}.` : ""}
        {email ? ` Apstiprinājums aizies uz ${email}.` : ""}
      </p>
      <dl className="mt-6 space-y-2 text-[15px]">
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Jau samaksāts</dt>
          <dd className="font-medium">{formatEurFromCents(found.offer.priorCents)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Tagad</dt>
          <dd className="font-medium">{formatEurFromCents(found.offer.chargeCents)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-neutral-200 pt-2">
          <dt>Kopā</dt>
          <dd className="font-semibold">{formatEurFromCents(found.offer.targetCents)}</dd>
        </div>
      </dl>
      <div className="mt-8">
        <OrderUpsellPayButton token={token} label={`Apmaksāt ${formatEurFromCents(found.offer.chargeCents)}`} />
      </div>
    </main>
  );
}
