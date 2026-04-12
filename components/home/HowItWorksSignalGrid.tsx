import { getMessages, getTranslations } from "next-intl/server";

type Step = { n: string; title: string; body: string };

/**
 * Kā demo „signāli” — trīs `demo-design-dir__card` no `HowItWorks.steps` (bez jauniem tekstiem).
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
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="demo-design-dir__card p-6 text-center">
            <p className="demo-design-dir__kicker text-[9px]">{s.n}</p>
            <p className="mt-4 whitespace-pre-line text-[11px] font-semibold uppercase tracking-[0.12em] text-white/88">
              {s.title}
            </p>
            {s.body?.trim() ? <p className="demo-design-dir__body mt-4 text-center text-[13px]">{s.body}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
