import { ChevronDown } from "lucide-react";
import { getMessages, getTranslations } from "next-intl/server";
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

        <div className="mt-10 divide-y divide-[#e5e7eb]">
          {items.map((item) => (
            <details
              key={item.id}
              className="group border-0 bg-transparent shadow-none transition-all duration-300 ease-in-out open:bg-black/[0.02]"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 pl-1 pr-1 text-left transition-all duration-300 ease-in-out sm:py-5 sm:pl-2 sm:pr-2 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1 text-[1.1rem] font-semibold leading-snug tracking-tight text-[#1d1d1f] transition-colors duration-300 group-hover:text-provin-accent sm:leading-snug">
                  {item.q}
                </span>
                <ChevronDown
                  className="mt-1 h-4 w-4 shrink-0 text-[#9ca3af] transition-transform duration-300 ease-in-out group-open:rotate-180 group-open:text-provin-accent"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </summary>
              <p className="max-w-[65ch] pb-5 pl-1 pr-10 text-[14px] font-normal leading-relaxed text-[#6b7280] transition-colors duration-300 sm:pb-6 sm:pl-2 sm:text-[15px] sm:leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
