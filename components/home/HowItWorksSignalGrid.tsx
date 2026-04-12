import { ClipboardPenLine, CreditCard, ScrollText, type LucideIcon } from "lucide-react";
import { getMessages, getTranslations } from "next-intl/server";

type Step = { n: string; title: string; body: string };

const STEP_ICONS: LucideIcon[] = [ClipboardPenLine, CreditCard, ScrollText];

function iconIndexForStep(n: string) {
  const v = parseInt(n, 10);
  return Number.isFinite(v) && v >= 1 ? Math.min(v - 1, STEP_ICONS.length - 1) : 0;
}

/**
 * Kā demo „signāli” — trīs kartes ar soļu tekstiem + Lucide ikonām (`HowItWorks.steps`).
 */
export async function HowItWorksSignalGrid() {
  const tOrder = await getTranslations("Order");
  const tHero = await getTranslations("Hero");
  const messages = await getMessages();
  const raw = (messages as { HowItWorks?: { steps?: Step[] } }).HowItWorks?.steps;
  const steps = Array.isArray(raw) ? raw : [];

  return (
    <div className="demo-design-dir__shell">
      <p className="demo-design-dir__kicker">{tOrder("summaryNote")}</p>
      <h2 className="demo-design-dir__title mt-2 max-w-[48rem]">{tHero("h2")}</h2>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-5 lg:gap-8">
        {steps.map((s) => {
          const Icon = STEP_ICONS[iconIndexForStep(s.n)] ?? STEP_ICONS[0];
          const iconProps = { className: "h-[1.05rem] w-[1.05rem] shrink-0", strokeWidth: 1.5 } as const;

          return (
            <div
              key={`${s.title}-${s.n}`}
              className="group demo-design-dir__card relative flex min-h-[11.5rem] flex-col items-center gap-3 overflow-hidden p-6 text-center sm:min-h-[12rem] sm:gap-4 sm:p-7"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden
                style={{
                  background:
                    "radial-gradient(ellipse 90% 55% at 50% 0%, rgb(0 102 255 / 0.14), transparent 62%)",
                }}
              />
              <div className="demo-design-dir__flow-node relative z-[1] mx-auto">
                <Icon {...iconProps} aria-hidden />
              </div>
              <p className="relative z-[1] whitespace-pre-line text-[11px] font-semibold uppercase leading-snug tracking-[0.12em] text-white/90 sm:text-[11.5px]">
                {s.title}
              </p>
              {s.body?.trim() ? (
                <p className="relative z-[1] text-center text-[12px] leading-relaxed text-[rgb(200_205_215/0.78)] sm:text-[13px]">
                  {s.body}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
