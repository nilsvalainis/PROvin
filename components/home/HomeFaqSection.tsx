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
        <h2
          id="home-faq-heading"
          className="demo-design-dir__title mx-auto max-w-[min(100%,48rem)] text-balance text-center"
        >
          {tFaq("title")}
        </h2>
        <p className="demo-design-dir__body mx-auto mt-3 max-w-[min(100%,40rem)] text-balance text-center sm:mt-4">
          {tMeta("faqDescription")}
        </p>
        <div className="mt-10">
          <FaqClient title={tFaq("title")} items={items} tone="dark" embedded />
        </div>
      </div>
    </section>
  );
}
