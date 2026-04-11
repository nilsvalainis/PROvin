"use client";

import { Fragment } from "react";
import { ClipboardPenLine, CreditCard, ScrollText } from "lucide-react";
import { homeContentMaxClass } from "@/lib/home-layout";

type Step = { n: string; title: string; body: string };

const stepIconClass =
  "h-8 w-8 shrink-0 text-[#6b7280] transition-colors group-hover:text-[#0061D2] [stroke-width:1.5] sm:h-[2.3625rem] sm:w-[2.3625rem]";

const stepIconClassDark =
  "h-8 w-8 shrink-0 text-zinc-500 transition-colors group-hover:text-[#0061D2] [stroke-width:1.5] sm:h-[2.3625rem] sm:w-[2.3625rem]";

const stepIconClassSilver =
  "h-8 w-8 shrink-0 text-[#0066ff] transition-opacity group-hover:opacity-90 [stroke-width:1.5] sm:h-[2.3625rem] sm:w-[2.3625rem]";

const ICON_ROW_H = "h-11";

export function HowItWorksClient({
  steps,
  tone = "light",
  variant = "default",
}: {
  steps: Step[];
  tone?: "light" | "dark";
  variant?: "default" | "silver";
}) {
  const dark = tone === "dark";
  const silver = variant === "silver";

  const dash = silver ? "border-[#050505]/14" : dark ? "border-zinc-600" : "border-[#d1d5db]";
  const title = silver ? "text-[#050505]" : dark ? "text-zinc-100" : "text-[#1d1d1f]";
  const body = silver ? "text-[#050505]" : dark ? "text-zinc-400" : "text-[#86868b]";

  return (
    <section className="home-body-ink relative z-10 overflow-x-hidden bg-transparent">
      <div className="relative px-3 py-5 sm:px-6 sm:py-4">
        <div className={`relative ${homeContentMaxClass}`}>
          <div className={`flex ${ICON_ROW_H} items-center justify-center`} aria-hidden>
            <div className={`h-8 w-px border-l border-dashed ${dash}`} />
          </div>
          <div className="relative mx-auto w-full min-w-0 max-w-lg md:max-w-none">
            <div className="w-full sm:mx-auto sm:w-4/5">
              <div className="flex flex-row items-start justify-center gap-0 px-1 sm:px-0.5">
                {steps.map((s, i) => (
                  <Fragment key={`step-${s.n}`}>
                    <article className="group flex min-w-0 flex-1 basis-0 flex-col items-center text-center">
                      <div className={`flex w-full ${ICON_ROW_H} shrink-0 items-center justify-center`}>
                        <StepIcon n={s.n} dark={dark} silver={silver} />
                      </div>
                      <h3
                        className={`mt-2 w-full text-balance text-[10px] font-medium uppercase leading-snug tracking-[0.08em] sm:mt-2.5 sm:text-[10px] sm:tracking-[0.1em] ${title}`}
                      >
                        {s.title}
                      </h3>
                      {s.body.trim() ? (
                        <p
                          className={`mt-1.5 w-full text-balance text-[10px] font-normal leading-snug sm:mt-2 sm:text-[11px] sm:leading-relaxed ${body}`}
                        >
                          {s.body}
                        </p>
                      ) : null}
                    </article>
                    {i < steps.length - 1 ? (
                      <div
                        key={`conn-${s.n}`}
                        className={`mx-0.5 flex min-h-0 min-w-[0.5rem] flex-1 items-center sm:mx-2 sm:min-w-[1.25rem] ${ICON_ROW_H}`}
                        aria-hidden
                      >
                        <div className={`h-0 w-full border-t border-dashed ${dash}`} />
                      </div>
                    ) : null}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StepIcon({ n, dark, silver }: { n: string; dark?: boolean; silver?: boolean }) {
  const cls = silver ? stepIconClassSilver : dark ? stepIconClassDark : stepIconClass;
  if (n === "1") {
    return <ClipboardPenLine className={cls} aria-hidden strokeWidth={1.5} />;
  }
  if (n === "2") {
    return <CreditCard className={cls} aria-hidden strokeWidth={1.5} />;
  }
  return <ScrollText className={cls} aria-hidden strokeWidth={1.5} />;
}
