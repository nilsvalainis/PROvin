"use client";

import { ChevronDown } from "lucide-react";
import { homeFaqMaxClass, homeSectionTitleClass, homeSectionTitleSilverClass } from "@/lib/home-layout";

export type FaqItem = { id: string; q: string; a: string };

type FaqClientProps = {
  title: string;
  items?: FaqItem[];
  tone?: "light" | "dark" | "silver";
  /**
   * `true` — tikai BUJ saraksts; vecāks satur `section` + virsrakstus (sākumlapas design-direction).
   * Der tikai `tone="dark"`.
   */
  embedded?: boolean;
};

/** BUJ tekstam viena krāsa — bez PROVIN wordmark krāsu izmaiņām. */
const FAQ_TEXT_DARK = "text-[#e4e7ec]";
const FAQ_TEXT_LIGHT = "text-[#1a1a1a]";
const FAQ_TEXT_SILVER = "text-[#050505]";

function FaqAnswer({ text, className }: { text: string; className: string }) {
  return <p className={`${className} whitespace-pre-line`}>{text}</p>;
}

export function FaqClient({ title, items = [], tone = "dark", embedded = false }: FaqClientProps) {
  if (tone === "silver") {
    return (
      <section
        id="biezi-jautajumi"
        className="scroll-mt-16 bg-transparent px-4 py-10 sm:px-6 sm:py-14"
        aria-labelledby="faq-heading"
      >
        <div className={homeFaqMaxClass}>
          <div className="text-center">
            <h2 id="faq-heading" className={homeSectionTitleSilverClass}>
              {title}
            </h2>
          </div>

          <div className="divide-y divide-[#050505]/12">
            {items.map((item) => (
              <details
                key={item.id}
                className="group border-0 bg-transparent shadow-none open:bg-transparent"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 py-4 text-left sm:gap-4 sm:py-[1.125rem] [&::-webkit-details-marker]:hidden">
                  <span
                    className={`min-w-0 flex-1 text-[15px] font-medium leading-snug tracking-tight sm:text-[16px] sm:leading-snug ${FAQ_TEXT_SILVER}`}
                  >
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`mt-0.5 h-4 w-4 shrink-0 transition-transform duration-200 ease-out group-open:rotate-180 ${FAQ_TEXT_SILVER}`}
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </summary>
                <FaqAnswer
                  text={item.a}
                  className={`max-w-[65ch] pb-4 pr-2 text-[14px] font-normal leading-[1.75] sm:pb-5 sm:pr-6 sm:text-[15px] sm:leading-[1.75] ${FAQ_TEXT_SILVER}`}
                />
              </details>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (tone === "light") {
    return (
      <section
        id="biezi-jautajumi"
        className="scroll-mt-16 bg-white px-4 py-10 sm:px-6 sm:py-14"
        aria-labelledby="faq-heading"
      >
        <div className={homeFaqMaxClass}>
          <div className="text-center">
            <h2 id="faq-heading" className={homeSectionTitleClass}>
              {title}
            </h2>
          </div>

          <div className="divide-y divide-[#ececec]">
            {items.map((item) => (
              <details
                key={item.id}
                className="group border-0 bg-transparent shadow-none open:bg-transparent"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 py-4 text-left sm:gap-4 sm:py-[1.125rem] [&::-webkit-details-marker]:hidden">
                  <span
                    className={`min-w-0 flex-1 text-[15px] font-medium leading-snug tracking-tight sm:text-[16px] sm:leading-snug ${FAQ_TEXT_LIGHT}`}
                  >
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`mt-0.5 h-4 w-4 shrink-0 transition-transform duration-200 ease-out group-open:rotate-180 ${FAQ_TEXT_LIGHT}`}
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </summary>
                <FaqAnswer
                  text={item.a}
                  className={`max-w-[65ch] pb-4 pr-2 text-[14px] font-normal leading-[1.75] sm:pb-5 sm:pr-6 sm:text-[15px] sm:leading-[1.75] ${FAQ_TEXT_LIGHT}`}
                />
              </details>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const faqItems = items.map((item) => (
    <div key={item.id} className="demo-design-dir__faq-item">
      <details className="group border-0 bg-transparent shadow-none open:bg-transparent">
        <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-3 px-4 py-4 text-left sm:min-h-0 sm:gap-4 sm:px-5 sm:py-[1.125rem] [&::-webkit-details-marker]:hidden">
          <span
            className={`min-w-0 flex-1 text-[15px] font-medium leading-snug tracking-tight sm:text-[16px] sm:leading-snug ${FAQ_TEXT_DARK}`}
          >
            {item.q}
          </span>
          <ChevronDown
            className={`mt-0.5 h-4 w-4 shrink-0 transition-transform duration-200 ease-out group-open:rotate-180 ${FAQ_TEXT_DARK}`}
            strokeWidth={1.5}
            aria-hidden
          />
        </summary>
        <FaqAnswer
          text={item.a}
          className={`max-w-[65ch] px-4 pb-4 pr-2 text-[14px] font-normal leading-[1.75] sm:px-5 sm:pb-5 sm:pr-6 sm:text-[15px] sm:leading-[1.75] ${FAQ_TEXT_DARK}`}
        />
      </details>
    </div>
  ));

  if (embedded) {
    return <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-3">{faqItems}</div>;
  }

  return (
    <section
      id="biezi-jautajumi"
      className="home-body-ink scroll-mt-16 bg-transparent py-10 sm:py-14"
      aria-labelledby="faq-heading"
    >
      <div className="demo-design-dir__shell">
        <div className={homeFaqMaxClass}>
          <div className="text-center">
            <h2 id="faq-heading" className={homeSectionTitleClass}>
              {title}
            </h2>
          </div>
          <div className="flex flex-col gap-3">{faqItems}</div>
        </div>
      </div>
    </section>
  );
}
