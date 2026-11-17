import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { OperatorPasutitForm } from "@/components/OperatorPasutitForm";
import { operatorOrderConfigured, verifyOperatorOrderKey } from "@/lib/operator-order-auth";
import { homePath } from "@/lib/paths";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ key?: string; atcelts?: string; vin?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const key = typeof sp.key === "string" ? sp.key : "";
  if (verifyOperatorOrderKey(key)) {
    const t = await getTranslations({ locale, namespace: "Order" });
    return {
      title: t("operatorPageTitle"),
      robots: { index: false, follow: false },
    };
  }
  const t = await getTranslations({ locale, namespace: "Order" });
  return {
    title: t("metaTitle"),
    description:
      "Pasūtījuma forma: VIN, sludinājuma saite, saziņas dati. Droša apmaksa ar Stripe.",
    robots: { index: false, follow: false },
  };
}

export default async function PasutitPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const key = typeof sp.key === "string" ? sp.key.trim() : "";

  if (key) {
    if (!operatorOrderConfigured() || !verifyOperatorOrderKey(key)) {
      notFound();
    }
    return (
      <Suspense
        fallback={
          <div className="mx-auto max-w-[720px] px-4 py-16 text-center text-[15px] font-normal text-[#86868b]">
            …
          </div>
        }
      >
        <OperatorPasutitForm operatorKey={key} />
      </Suspense>
    );
  }

  /** Vecās saites uz /pasutit: servera pāradresācija uz sākumlapas formu (bez starpekrāna). */
  const q = new URLSearchParams();
  if (sp.atcelts === "1") q.set("atcelts", "1");
  if (typeof sp.vin === "string" && sp.vin.trim()) q.set("vin", sp.vin.trim());
  const qs = q.toString();
  redirect(`${homePath(locale)}${qs ? `?${qs}` : ""}#home-hero`);
}
