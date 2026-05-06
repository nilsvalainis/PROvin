import { getMessages, getTranslations } from "next-intl/server";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { FaqClient, type FaqItem } from "@/components/FaqClient";
import { homeEditorialSectionBodyLeadClass, homeEditorialSectionTitleClass } from "@/lib/home-layout";
import { renderProvinText } from "@/lib/provin-wordmark";

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
        <div className="text-center">
          <h2 id="home-faq-heading" className={homeEditorialSectionTitleClass}>
            {tFaq("title")}
          </h2>
          <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          <p className={homeEditorialSectionBodyLeadClass}>{renderProvinText(tMeta("faqDescription"))}</p>
        </div>
        <div className="mt-10">
          <FaqClient title={tFaq("title")} items={items} tone="dark" embedded />
        </div>
      </div>
    </section>
  );
}
