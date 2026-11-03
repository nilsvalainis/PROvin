"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import type { FaqItem } from "@/components/FaqClient";

type Props = {
  title: string;
  items: FaqItem[];
  links: { href: string; label: string }[];
};

/**
 * BUJ lapa T1 (03.11): pa kreisi pielīpošs virsraksts un saites, pa labi kompakts akordeons.
 * Atbildes vienmēr ir DOM (FAQPage shēmai un meklētājiem), aizvērtas tikai vizuāli.
 */
export function FaqPageT1({ title, items, links }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section id="biezi-jautajumi" className="scroll-mt-16 bg-transparent pb-6 pt-6 sm:pt-8" aria-labelledby="faq-heading">
      <div className="mx-auto grid w-full max-w-[75rem] gap-7 px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16 lg:px-10">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <h1 id="faq-heading" className="text-[28px] font-extrabold leading-[1.12] tracking-[-0.03em] text-white [text-wrap:balance] sm:text-[30px]">
            {title}
          </h1>
          <nav className="mt-7 hidden flex-col items-start gap-3 lg:flex">
            {links.map((l) => (
              <Link key={l.label} href={l.href} className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#5c9dff] no-underline transition hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="border-t border-white/[0.08] lg:mt-[58px]">
          {items.map((item, i) => {
            const isOpen = open === item.id;
            const panelId = `faq-a-${item.id}`;
            return (
              <div
                key={item.id}
                data-faq-row
                style={{ ["--j" as string]: i }}
                className={`provin-faq-row group relative border-b border-white/[0.08] transition-colors hover:bg-white/[0.025] ${isOpen ? "is-open bg-white/[0.025]" : ""}`}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : item.id)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-3.5 py-[13px] text-left"
                >
                  <span className={`provin-faq-q text-[15px] font-semibold leading-[1.4] ${isOpen ? "text-white" : "text-zinc-300"}`}>{item.q}</span>
                  <span aria-hidden className="provin-faq-plus" />
                </button>
                <div id={panelId} role="region" className="provin-faq-panel">
                  <div>
                    <p className="whitespace-pre-line px-5 pb-4 pr-11 text-[14px] leading-[1.6] text-zinc-400">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <nav className="mt-6 flex flex-col items-start gap-3 lg:hidden">
            {links.map((l) => (
              <Link key={l.label} href={l.href} className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#5c9dff] no-underline transition hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}
