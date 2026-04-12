import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { DesignDirectionLayoutDemo } from "@/components/demo/DesignDirectionLayoutDemo";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Demo: layout un stila virziens",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function DesignDirectionDemoPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-w-0 bg-[#030304]">
      <DesignDirectionLayoutDemo />
    </div>
  );
}
