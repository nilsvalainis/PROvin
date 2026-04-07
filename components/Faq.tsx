import { getMessages, getTranslations } from "next-intl/server";
import { NavChevronDown } from "@/components/NavChevron";
import { homeSectionEyebrowClass } from "@/lib/home-layout";

type FaqItem = { id: string; q: string; a: string };

export async function Faq() {
  const t = await getTranslations("Faq");
  const messages = await getMessages();
  const items = (messages as { Faq: { items: FaqItem[] } }).Faq.items;

  return (
    <section
      id="biezi-jautajumi"
      className="scroll-mt-16 bg-white px-4 py-10 sm:px-6 sm:py-14"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto min-w-0 max-w-[720px]">
        <div className="text-center">
          <h2 id="faq-heading" className={`${homeSectionEyebrowClass} text-balance`}>
            {t("title")}
          </h2>
        </div>

        <div className="mt-10 space-y-3">
          {items.map((item) => (
            <details
              key={item.id}
              className="provin-lift group rounded-xl border border-black/[0.06] bg-[#fbfbfd] px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:px-5 sm:py-4"
            >
              <summary className="cursor-pointer list-none text-left text-[15px] font-semibold leading-snug text-[#1d1d1f] sm:text-[16px] [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-3">
                  <span className="transition-colors group-hover:text-provin-accent">{item.q}</span>
                  <span
                    className="mt-0.5 shrink-0 text-provin-accent transition group-open:rotate-180"
                    aria-hidden
                  >
                    <NavChevronDown />
                  </span>
                </span>
              </summary>
              <p className="mt-3 max-w-[65ch] border-t border-black/[0.06] pt-3 text-[14px] font-normal leading-relaxed text-[#6e6e73] sm:text-[15px]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
