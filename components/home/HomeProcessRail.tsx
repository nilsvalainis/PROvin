"use client";

import { useTranslations } from "next-intl";

export function HomeProcessRail() {
  const t = useTranslations("HomeProcess");

  const steps = [
    { n: "01", label: t("rail01") },
    { n: "02", label: t("rail02") },
    { n: "03", label: t("rail03") },
  ] as const;

  return (
    <aside
      className="pointer-events-none fixed left-8 top-1/2 z-50 hidden -translate-y-1/2 lg:flex lg:flex-row lg:items-stretch lg:gap-4"
      aria-hidden
    >
      <div className="flex min-h-0 flex-col gap-6">
        {steps.map((s) => (
          <p key={s.n} className="home-rail-label max-w-[10rem] text-left sm:max-w-[11rem]">
            <span className="font-[family-name:var(--font-inter)] text-[10px] font-medium tabular-nums tracking-[0.38em] text-white/60 sm:text-[11px] sm:tracking-[0.42em]">
              {s.n}
            </span>
            <span
              className="mx-1.5 font-[family-name:var(--font-inter)] text-[10px] text-white/25 sm:text-[11px]"
              aria-hidden
            >
              /
            </span>
            <span className="font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase leading-tight tracking-[0.22em] text-white/45 sm:text-[11px] sm:tracking-[0.24em]">
              {s.label}
            </span>
          </p>
        ))}
      </div>
      <div className="my-0 shrink-0 self-stretch bg-white/[0.12]" style={{ width: "0.5px" }} aria-hidden />
    </aside>
  );
}
