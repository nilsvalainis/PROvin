import type { Metadata } from "next";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DemoCrossDemoNav } from "@/components/demo/DemoStudioQuickLinks";
import { orderSectionHref } from "@/lib/paths";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Demo — Scandinavian clean full landing",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ locale: string }> };

type HeroPillar = { title: string; body?: string };
type PricingGridItem = { title: string; body: string; href?: boolean };
type FaqItem = { id: string; q: string; a: string };

type DemoMessagesShape = {
  Hero?: { pillars?: HeroPillar[] };
  Pricing?: { grid?: PricingGridItem[] };
  Faq?: { items?: FaqItem[] };
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function ScandinavianFullDemoPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [tHero, tMeta, tPricing, tIriss, tFaq, messages] = await Promise.all([
    getTranslations("Hero"),
    getTranslations("Meta"),
    getTranslations("Pricing"),
    getTranslations("Iriss"),
    getTranslations("Faq"),
    getMessages(),
  ]);

  const currentLocale = await getLocale();
  const orderHref = orderSectionHref(currentLocale);
  const data = messages as DemoMessagesShape;

  const pillars = Array.isArray(data.Hero?.pillars) ? data.Hero?.pillars : [];
  const pricingGrid = Array.isArray(data.Pricing?.grid) ? data.Pricing?.grid : [];
  const faqItems = Array.isArray(data.Faq?.items) ? data.Faq?.items : [];

  return (
    <div className="min-w-0 bg-[#f3f6f4] text-[#1e2a24]">
      <DemoCrossDemoNav />

      <div className="border-b border-[#d8dfda] bg-[#eaf0ec]">
        <header className="mx-auto max-w-[min(70rem,calc(100vw-2rem))] px-4 py-10 sm:px-6 sm:py-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4b5f56]">Demo · concept-29 adaptation</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#18221d] sm:text-4xl">Scandinavian clean — pilns A–Z demo</h1>
          <p className="mt-4 max-w-[46rem] text-[15px] leading-relaxed text-[#31413a]">
            Šis ir pilns landing demo ar esošo PROVIN saturu, bet noformēts mierīgā `concept-29` estētikā: skaidra hierarhija, atturīga tipogrāfija,
            vieglas virsmas un sakārtots ritms visā lapā.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-[12px]">
            <Link
              href="/demo/static-concepts"
              className="rounded-full border border-[#bccac2] bg-white px-4 py-2 font-medium text-[#244035] transition hover:border-[#8ea89b] hover:bg-[#f6faf7]"
            >
              Statiskie landing koncepti
            </Link>
            <a
              href="/concept-demos/concept-29/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[#bccac2] bg-white px-4 py-2 font-medium text-[#244035] transition hover:border-[#8ea89b] hover:bg-[#f6faf7]"
            >
              Atvērt originālo concept-29
            </a>
          </div>
        </header>
      </div>

      <main className="mx-auto max-w-[min(70rem,calc(100vw-2rem))] px-4 py-10 sm:px-6 sm:py-14">
        <section className="rounded-[1.5rem] border border-[#d7e1db] bg-white px-5 py-8 shadow-[0_10px_34px_rgba(21,34,28,0.06)] sm:px-8 sm:py-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#5e7268]">{tHero("approved")}</p>
          <h2 className="mt-4 text-balance text-3xl font-semibold leading-[1.06] tracking-[-0.02em] text-[#18221d] sm:text-5xl">
            <span>{tHero("h1Vin")}</span> <span>{tHero("h1Un")}</span> <span>{tHero("h1Sludinajuma")}</span>
            <span className="block">{tHero("h1Line2")}</span>
          </h2>
          <p className="mt-4 text-[14px] font-medium uppercase tracking-[0.08em] text-[#50645a] sm:text-[15px]">{tHero("h2")}</p>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-[#31413a]">{tMeta("homeIntroBody")}</p>
          <div className="mt-7">
            <Link
              href={orderHref}
              className="inline-flex items-center justify-center rounded-full border border-[#9bb8a9] bg-[#eaf4ee] px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#1f3b31] transition hover:border-[#6f907f] hover:bg-[#deefe5]"
            >
              {tHero("cta")}
            </Link>
          </div>
        </section>

        <section className="mt-8">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#4f6459]">Pakalpojuma pīlāri</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((pillar) => (
              <li key={pillar.title} className="rounded-xl border border-[#d7e1db] bg-white p-4 shadow-[0_6px_22px_rgba(21,34,28,0.05)]">
                <p className="whitespace-pre-line text-[12px] font-semibold uppercase leading-snug tracking-[0.08em] text-[#22362d]">{pillar.title}</p>
                {pillar.body ? <p className="mt-2 text-[13px] leading-relaxed text-[#52665c]">{pillar.body}</p> : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 rounded-[1.25rem] border border-[#d7e1db] bg-white p-5 sm:p-7">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#4f6459]">{tPricing("workTitle")}</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {pricingGrid.map((item) => (
              <li key={item.title} className="rounded-xl border border-[#e2e9e4] bg-[#f8fbf9] p-4">
                <p className="text-[15px] font-medium leading-snug text-[#1e2a24]">{item.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#4a5f55]">{item.body}</p>
                {item.href ? <p className="mt-2 text-[12px] font-medium text-[#2f5b49]">{tPricing("irissLink")}</p> : null}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] leading-snug text-[#4a5f55]">{tPricing("autoRecordsFootnote")}</p>
        </section>

        <section className="mt-10 rounded-[1.25rem] border border-[#d7e1db] bg-white p-5 sm:p-7">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#4f6459]">{tIriss("title")}</h3>
          <p className="mt-2 text-[14px] uppercase tracking-[0.08em] text-[#55685f]">{tIriss("subtitle")}</p>
          <div className="mt-5 space-y-5">
            <article>
              <h4 className="text-[15px] font-semibold leading-snug text-[#1f2f28]">{tIriss("block1Heading")}</h4>
              <p className="mt-2 text-[14px] leading-relaxed text-[#4a5f55]">{tIriss("block1Body")}</p>
            </article>
            <article>
              <h4 className="text-[15px] font-semibold leading-snug text-[#1f2f28]">{tIriss("block2Heading")}</h4>
              <p className="mt-2 text-[14px] leading-relaxed text-[#4a5f55]">{tIriss("block2Body")}</p>
            </article>
            <article>
              <h4 className="text-[15px] font-semibold leading-snug text-[#1f2f28]">{tIriss("block3Heading")}</h4>
              <p className="mt-2 text-[14px] leading-relaxed text-[#4a5f55]">{tIriss("block3Body")}</p>
            </article>
          </div>
        </section>

        <section className="mt-10 rounded-[1.25rem] border border-[#d7e1db] bg-white p-5 sm:p-7">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#4f6459]">{tFaq("title")}</h3>
          <div className="mt-4 space-y-3">
            {faqItems.map((item) => (
              <article key={item.id} className="rounded-xl border border-[#e2e9e4] bg-[#f8fbf9] p-4">
                <h4 className="text-[15px] font-medium leading-snug text-[#1f2f28]">{item.q}</h4>
                <p className="mt-2 text-[14px] leading-relaxed text-[#4a5f55]">{item.a}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 border-t border-[#d0dad4] pt-8">
          <p className="max-w-[52ch] text-[14px] leading-relaxed text-[#455b51]">
            Demo mērķis: parādīt, kā esošais PROVIN saturs var strādāt mierīgā skandināvu estētikā ar augstu lasāmību un skaidru informācijas secību.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={orderHref}
              className="rounded-full border border-[#9bb8a9] bg-[#eaf4ee] px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#1f3b31] transition hover:border-[#6f907f] hover:bg-[#deefe5]"
            >
              {tHero("cta")}
            </Link>
            <Link
              href="/demo"
              className="rounded-full border border-[#bccac2] bg-white px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#2a463b] transition hover:border-[#8ea89b] hover:bg-[#f6faf7]"
            >
              Atpakaļ uz demo studiju
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
