import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProvinSelectSection } from "@/components/home/ProvinSelectSection";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ProvinSelect" });
  return {
    title: t("formTitle"),
    description: t("lead"),
  };
}

export default function ProvinSelectPieteikumsPage() {
  return (
    <div className="demo-design-dir min-w-0 text-white">
      <ProvinSelectSection variant="standalone" />
    </div>
  );
}
