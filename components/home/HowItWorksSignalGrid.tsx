import { ChevronDown, ChevronRight, ClipboardPenLine, CreditCard, ScrollText, type LucideIcon } from "lucide-react";
import { Fragment } from "react";
import { getMessages, getTranslations } from "next-intl/server";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";

type Step = { n: string; title: string; body: string };

const STEP_ICONS: LucideIcon[] = [ClipboardPenLine, CreditCard, ScrollText];

function iconIndexForStep(n: string) {
  const v = parseInt(n, 10);
  return Number.isFinite(v) && v >= 1 ? Math.min(v - 1, STEP_ICONS.length - 1) : 0;
}

/** Vertikālais savienotājs — sliede + bultiņa lejup (tikai zem `sm`). */
function HowItWorksConnectorMobile() {
  return (
    <div className="flex w-full flex-col items-center gap-2 py-1 sm:hidden" aria-hidden>
      <div className="w-full max-w-[14rem]">
        <DiagnosticScanLine variant="rail" className="w-full" />
      </div>
      <ChevronDown className="h-4 w-4 shrink-0 text-[rgb(130_190_255/0.82)]" strokeWidth={1.35} />
    </div>
  );
}

/** Horizontālais savienotājs — sliede ar zilu impulsu + tieva bultiņa (≥ sm). */
function HowItWorksConnectorDesktop() {
  return (
    <div
      className="relative hidden min-h-[2.75rem] min-w-0 flex-1 flex-col justify-center px-0.5 sm:flex lg:min-h-[3rem] lg:px-2"
      aria-hidden
    >
      <div className="relative w-full">
        <DiagnosticScanLine variant="rail" className="w-full" />
        <ChevronRight
          className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-[rgb(130_190_255/0.9)] lg:h-6 lg:w-6"
          strokeWidth={1.25}
        />
      </div>
    </div>
  );
}

/**
 * Trīs soļu bloki — bez kartes rāmja; lielas ikonas; starp soļiem tieva sliede + zils impulss (kā pasūtījuma forma).
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
      <div className="mt-10 flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between sm:gap-2 lg:gap-5">
        {steps.map((s, i) => {
          const Icon = STEP_ICONS[iconIndexForStep(s.n)] ?? STEP_ICONS[0];

          return (
            <Fragment key={`${s.title}-${s.n}`}>
              <div className="group relative flex min-h-0 flex-1 flex-col items-center gap-3 px-2 text-center sm:min-w-0 sm:max-w-[min(100%,17rem)] sm:gap-4 lg:max-w-xs">
                <div
                  className="pointer-events-none absolute inset-0 -inset-x-1 -inset-y-1 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  aria-hidden
                  style={{
                    background:
                      "radial-gradient(ellipse 90% 55% at 50% 0%, rgb(0 102 255 / 0.12), transparent 62%)",
                  }}
                />
                <Icon
                  className="relative z-[1] h-12 w-12 shrink-0 text-[rgb(130_190_255/0.95)] sm:h-14 sm:w-14 lg:h-16 lg:w-16"
                  strokeWidth={1.1}
                  aria-hidden
                />
                <p className="relative z-[1] whitespace-pre-line text-[11px] font-semibold uppercase leading-snug tracking-[0.12em] text-white/90 sm:text-[11.5px]">
                  {s.title}
                </p>
                {s.body?.trim() ? (
                  <p className="relative z-[1] text-center text-[12px] leading-relaxed text-[rgb(200_205_215/0.78)] sm:text-[13px]">
                    {s.body}
                  </p>
                ) : null}
              </div>
              {i < steps.length - 1 ? (
                <Fragment key={`how-it-works-conn-${s.n}`}>
                  <HowItWorksConnectorMobile />
                  <HowItWorksConnectorDesktop />
                </Fragment>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
