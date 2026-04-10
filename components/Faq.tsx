import { ChevronDown } from "lucide-react";
import { getMessages, getTranslations } from "next-intl/server";
import { homeSectionTitleClass } from "@/lib/home-layout";

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
      <div className="mx-auto min-w-0 max-w-[680px]">
        <div className="text-center">
          <h2 id="faq-heading" className={homeSectionTitleClass}>
            {t("title")}
          </h2>
        </div>

        <div className="divide-y divide-[#ececec]">
          {items.map((item) => (
            <details
              key={item.id}
              className="group border-0 bg-transparent shadow-none open:bg-transparent"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 py-4 text-left sm:gap-4 sm:py-[1.125rem] [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1 text-[15px] font-medium leading-snug tracking-tight text-[#1a1a1a] sm:text-[16px] sm:leading-snug">
                  {item.q}
                </span>
                <ChevronDown
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#a3a3a3] transition-transform duration-200 ease-out group-open:rotate-180"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </summary>
              <p className="max-w-[65ch] pb-4 pr-2 text-[14px] font-normal leading-[1.75] text-[#6b7280] sm:pb-5 sm:pr-6 sm:text-[15px] sm:leading-[1.75]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
