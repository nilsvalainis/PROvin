import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { homeFooterColumnClass } from "@/lib/home-layout";

type Pack = { title: string; price: string; unit: string; items: string[] };
type Step = { title: string; body: string };
type Faq = { q: string; a: string };

const KICKER =
  "text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#93c5fd]";

/**
 * /partneriem informācija zem hero (audits P8): paku karte ar cenām, 3 soļi, BUJ ar FAQPage shēmu,
 * saite uz Partneru sadarbības noteikumiem. Teksti `Partner.landing*` (4 valodas).
 */
/** Cenu karte paslēpta (Nils 28.10: jāpārstrādā); teksti `landingPacks*` paliek. */
const SHOW_PACKS = false;

export async function B2bPartnerLandingInfo({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Partner" });
  const packs = t.raw("landingPacks") as Pack[];
  const steps = t.raw("landingSteps") as Step[];
  const faq = t.raw("landingFaq") as Faq[];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section
      aria-labelledby={SHOW_PACKS ? "b2b-packs-heading" : "b2b-steps-heading"}
      className={`${homeFooterColumnClass} relative z-[3] pb-12 lg:pb-16`}
    >
      <JsonLd data={faqJsonLd} />

      {SHOW_PACKS ? (
        <>
          <h2 id="b2b-packs-heading" className={KICKER}>
            {t("landingPacksHeading")}
          </h2>
          <p className="mt-2 text-[0.8rem] leading-snug text-zinc-400">
            {t("landingLegalOnly")}
          </p>
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {packs.map((pack) => (
              <article
                key={pack.title}
                className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-5 lg:p-6"
              >
                <h3 className="text-[1rem] font-bold text-zinc-100">
                  {pack.title}
                </h3>
                <p className="mt-2 text-zinc-100">
                  <span className="text-[1.6rem] font-extrabold tracking-[-0.02em]">
                    {pack.price}
                  </span>{" "}
                  <span className="text-[0.8rem] text-zinc-400">
                    {pack.unit}
                  </span>
                </p>
                <ul className="mt-4 space-y-2">
                  {pack.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2.5 text-[0.84rem] leading-snug text-zinc-300"
                    >
                      <span aria-hidden className="text-[#2563EB]">
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="mt-3 text-[0.75rem] leading-snug text-zinc-500">
            {t("landingPacksNote")}
          </p>
          <a
            href="#b2b-partner-hero"
            className="mt-3 inline-flex min-h-11 items-center text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-[#93c5fd] underline-offset-2 hover:underline"
          >
            {t("landingPacksCta")}
          </a>
        </>
      ) : null}

      <h2
        id="b2b-steps-heading"
        className={`${KICKER} ${SHOW_PACKS ? "mt-10" : ""}`}
      >
        {t("landingStepsHeading")}
      </h2>
      <ol className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className="min-w-0 border-t border-white/10 pt-4"
          >
            <p className="text-[0.84rem] font-semibold text-zinc-100">
              {i + 1}. {step.title}
            </p>
            <p className="mt-1.5 text-[0.84rem] leading-relaxed text-zinc-400">
              {step.body}
            </p>
          </li>
        ))}
      </ol>

      <h2 className={`${KICKER} mt-10`}>{t("landingFaqHeading")}</h2>
      <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
        {faq.map((item) => (
          <details key={item.q} className="group py-3">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[0.88rem] font-semibold text-zinc-100">
              <h3 className="min-w-0">{item.q}</h3>
              <span
                aria-hidden
                className="text-zinc-500 transition group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-2 text-[0.84rem] leading-relaxed text-zinc-400">
              {item.a}
            </p>
          </details>
        ))}
      </div>

      <p className="mt-6 text-[0.8rem] text-zinc-400">
        <Link
          href="/partneriem/noteikumi"
          className="text-[#93c5fd] underline-offset-2 hover:underline"
        >
          {t("landingTermsLink")}
        </Link>
      </p>
    </section>
  );
}
