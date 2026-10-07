import { getMessages, getTranslations } from "next-intl/server";
import { FaqClient, type FaqItem } from "@/components/FaqClient";

export async function Faq({
  tone = "dark",
  headingAs = "h2",
}: {
  tone?: "light" | "dark" | "silver";
  headingAs?: "h1" | "h2";
}) {
  const t = await getTranslations("Faq");
  const messages = await getMessages();
  const raw = (messages as { Faq?: { items?: FaqItem[] } }).Faq?.items;
  const items = Array.isArray(raw) ? raw : [];

  return <FaqClient title={t("title")} items={items} tone={tone} headingAs={headingAs} />;
}
