"use client";

import { Fragment } from "react";
import { ClipboardPenLine, CreditCard, ScrollText } from "lucide-react";
import { homeContentMaxClass } from "@/lib/home-layout";

type Step = { n: string; title: string; body: string };

const stepIconClass =
  "h-[1.68rem] w-[1.68rem] shrink-0 text-[#6b7280] transition-colors group-hover:text-[#0061D2] [stroke-width:1.5] max-[360px]:h-[1.4rem] max-[360px]:w-[1.4rem] sm:h-[2.3625rem] sm:w-[2.3625rem]";

const stepIconClassDark =
  "h-[1.68rem] w-[1.68rem] shrink-0 text-zinc-500 transition-colors group-hover:text-[#0061D2] [stroke-width:1.5] max-[360px]:h-[1.4rem] max-[360px]:w-[1.4rem] sm:h-[2.3625rem] sm:w-[2.3625rem]";

export function HowItWorksClient({ steps, tone = "light" }: { steps: Step[]; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  const dash = dark ? "border-zinc-600" : "border-[#d1d5db]";
  const title = dark ? "text-zinc-100" : "text-[#1d1d1f]";
  const body = dark ? "text-zinc-400" : "text-[#86868b]";

  return (
    <section className="relative z-10 overflow-visible bg-transparent">
      <div className="relative px-4 py-4 sm:px-6 sm:py-4">
        <div className={`relative ${homeContentMaxClass}`}>
          <div className="flex h-10 items-center justify-center sm:h-11" aria-hidden>
            <div className={`h-8 w-px border-l border-dashed ${dash}`} />
          </div>
          <div className="relative mx-auto w-full min-w-0 max-w-lg md:max-w-none">
            <div className="w-full sm:mx-auto sm:w-4/5">
              <div className="flex flex-row items-center justify-center gap-0 px-0.5">
                {steps.map((s, i) => (
                  <Fragment key={`icon-${s.n}`}>
                    <div className="group flex min-w-0 flex-1 basis-0 justify-center">
                      <StepIcon n={s.n} dark={dark} />
                    </div>
                    {i < steps.length - 1 ? (
                      <div
                        key={`conn-${s.n}`}
                        className={`mx-1 min-h-0 min-w-[0.65rem] flex-1 border-t border-dashed ${dash} sm:mx-2 sm:min-w-[1.25rem]`}
                        aria-hidden
                      />
                    ) : null}
                  </Fragment>
                ))}
              </div>
              <div className="mt-2 flex flex-row justify-center gap-0 px-0.5 sm:mt-3 sm:gap-1">
                {steps.map((s) => (
                  <div key={`text-${s.n}`} className="min-w-0 flex-1 basis-0 px-0.5 text-center sm:px-1">
                    <h3 className={`text-[9px] font-medium uppercase tracking-[0.1em] sm:text-[10px] ${title}`}>
                      {s.title}
                    </h3>
                    {s.body.trim() ? (
                      <p
                        className={`mt-1.5 text-[10px] font-normal leading-snug sm:mt-2 sm:text-[11px] sm:leading-relaxed ${body}`}
                      >
                        {s.body}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StepIcon({ n, dark }: { n: string; dark?: boolean }) {
  const cls = dark ? stepIconClassDark : stepIconClass;
  if (n === "1") {
    return <ClipboardPenLine className={cls} aria-hidden strokeWidth={1.5} />;
  }
  if (n === "2") {
    return <CreditCard className={cls} aria-hidden strokeWidth={1.5} />;
  }
  return <ScrollText className={cls} aria-hidden strokeWidth={1.5} />;
}
