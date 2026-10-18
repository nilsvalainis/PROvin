import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "PROVIN partneriem",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ locale: string }> };

export default async function PartneriemPacksRedirectPage({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/partneriem/konts`);
}
