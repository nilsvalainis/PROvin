import { getMessages, getTranslations } from "next-intl/server";
import { FaqClient, type FaqItem } from "@/components/FaqClient";

/** BUJ — kā demo `band-c` sadaļa ar `Meta` ievadu + `Faq` tulkojumiem. */
export async function HomeFaqSection() {
  const tMeta = await getTranslations("Meta");
  const tFaq = await getTranslations("Faq");
  const messages = await getMessages();
  const raw = (messages as { Faq?: { items?: FaqItem[] } }).Faq?.items;
  const items = Array.isArray(raw) ? raw : [];

  return (
    <section
      id="biezi-jautajumi"
      className="demo-design-dir__section demo-design-dir__section--band-c home-body-ink py-16 sm:py-20"
      aria-labelledby="home-faq-heading"
    >
      <div className="demo-design-dir__shell">
        <p className="demo-design-dir__kicker">{tMeta("faqTitle")}</p>
        <h2 id="home-faq-heading" className="demo-design-dir__title mt-2 max-w-[48rem]">
          {tFaq("title")}
        </h2>
        <p className="demo-design-dir__body mt-3 max-w-[40rem]">{tMeta("faqDescription")}</p>
        <div className="mt-10">
          <FaqClient title={tFaq("title")} items={items} tone="dark" embedded />
        </div>
      </div>
    </section>
  );
}
