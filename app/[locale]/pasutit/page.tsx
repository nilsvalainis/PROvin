import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PasutitRedirect } from "./pasutit-redirect";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Order" });
  return {
    title: t("sectionTitle"),
    description:
      "Pasūtījuma forma: VIN, sludinājuma saite, saziņas dati. Droša apmaksa ar Stripe.",
  };
}

export default function PasutitPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[720px] px-4 py-16 text-center text-[15px] font-normal text-[#86868b]">
          …
        </div>
      }
    >
      <PasutitRedirect />
    </Suspense>
  );
}
