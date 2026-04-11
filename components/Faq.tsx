import { getMessages, getTranslations } from "next-intl/server";
import { FaqClient, type FaqItem } from "@/components/FaqClient";

export async function Faq({ tone = "dark" }: { tone?: "light" | "dark" | "silver" }) {
  const t = await getTranslations("Faq");
  const messages = await getMessages();
  const items = (messages as { Faq: { items: FaqItem[] } }).Faq.items;

  return <FaqClient title={t("title")} items={items} tone={tone} />;
}
