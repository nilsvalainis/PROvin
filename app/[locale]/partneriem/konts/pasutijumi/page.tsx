import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "PROVIN partneriem",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function querySuffix(searchParams: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && value) q.set(key, value);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default async function PartneriemOrdersRedirectPage({ params, searchParams }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/partneriem/konts/profils${querySuffix(await searchParams)}`);
}
