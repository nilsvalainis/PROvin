/**
 * Klienta atskaites lapa (variants A - e-pastu stilā: gaiša kartīte, PROVIN zils).
 * Tīra prezentācija (SSR), bez klienta personas datiem.
 */
import {
  CLIENT_REPORT_LINK_COPY,
  CLIENT_REPORT_PRODUCT_LABEL,
} from "@/lib/client-report-link";
import type { ClientReportLinkView } from "@/lib/client-report-link-page";
import type { AppLocale } from "@/i18n/locales";

const BLUE = "#0061D2";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4 py-6 sm:py-12">
      <div className="mb-4 px-1 text-[15px] font-bold tracking-[0.16em] text-[#0066ff]">PROVIN</div>
      <div className="rounded-[18px] border border-[#e4e7eb] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-7">
        {children}
      </div>
    </main>
  );
}

function Contacts({ locale }: { locale: AppLocale }) {
  const t = CLIENT_REPORT_LINK_COPY[locale];
  return (
    <div className="mt-6 border-t border-[#e4e7eb] pt-4 text-[13px] leading-5 text-[#646b76]">
      <p className="font-semibold text-[#16181d]">{t.contacts}</p>
      <p className="mt-1">
        <a className="text-[#0061D2] underline" href="mailto:info@provin.lv">
          info@provin.lv
        </a>{" "}
        ·{" "}
        <a className="text-[#0061D2] underline" href="tel:+37129502039">
          +371 29 502 039
        </a>
      </p>
      <p className="mt-1">provin.lv</p>
    </div>
  );
}

export function ClientReportLinkInvalidView({ locale = "lv" }: { locale?: AppLocale }) {
  const t = CLIENT_REPORT_LINK_COPY[locale];
  return (
    <Shell>
      <h1 className="text-[22px] font-bold leading-7 tracking-[-0.3px] text-[#16181d]">{t.invalidTitle}</h1>
      <p className="mt-2 text-[15px] leading-6 text-[#646b76]">{t.invalidBody}</p>
      <Contacts locale={locale} />
    </Shell>
  );
}

export function ClientReportLinkPageView({ view }: { view: ClientReportLinkView }) {
  const t = CLIENT_REPORT_LINK_COPY[view.locale];
  const meta = [view.vin ? `VIN ${view.vin}` : "", view.date].filter(Boolean);
  return (
    <Shell>
      <section
        data-report-status
        className="rounded-[14px] border border-[#dbe6fb] bg-[#eef4ff] px-4 py-4"
        aria-label={t.ready}
      >
        <p className="text-[12px] font-semibold uppercase leading-4 tracking-[0.6px] text-[#646b76]">
          {CLIENT_REPORT_PRODUCT_LABEL[view.product][view.locale]}
        </p>
        <h1 className="mt-0.5 text-[20px] font-bold leading-[26px] tracking-[-0.3px] text-[#16181d]">{t.ready}</h1>
        {meta.length ? (
          <p className="mt-1.5 text-[13px] leading-5 text-[#646b76] [overflow-wrap:anywhere]">
            {view.vin ? (
              <>
                VIN <span className="font-mono tracking-[0.3px]">{view.vin}</span>
                {view.date ? ` · ${view.date}` : ""}
              </>
            ) : (
              view.date
            )}
          </p>
        ) : null}
      </section>

      {view.facts.length ? (
        <div data-report-facts className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${view.facts.length}, minmax(0, 1fr))` }}>
          {view.facts.map((f, i) => (
            <div key={i} className="rounded-[10px] bg-[#f6f7f9] px-3 py-3">
              <p className="text-[22px] font-bold leading-7 tracking-[-0.3px] text-[#16181d]">{f.value}</p>
              <p className="mt-0.5 text-[12px] leading-4 text-[#646b76]">{f.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2.5">
        <a
          href={view.pdfHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[52px] w-full items-center justify-center rounded-[12px] px-5 text-[16px] font-semibold text-white"
          style={{ backgroundColor: BLUE }}
        >
          {t.open}
        </a>
        <a
          href={view.downloadHref}
          rel="noopener noreferrer"
          className="flex min-h-[52px] w-full items-center justify-center rounded-[12px] border border-[#cfd4db] bg-white px-5 text-[16px] font-semibold text-[#16181d]"
        >
          {t.download}
        </a>
      </div>

      {view.offer ? (
        <section data-report-offer className="mt-6 rounded-[14px] border border-[#dbe6fb] bg-[#eef4ff] p-4">
          <p className="text-[12px] font-semibold uppercase leading-4 tracking-[0.6px] text-[#646b76]">{t.offerEyebrow}</p>
          <h2 className="mt-0.5 text-[18px] font-bold leading-6 text-[#16181d]">{t.offerTitle}</h2>
          <p className="mt-1.5 text-[14px] leading-5 text-[#646b76]">{t.offerLead}</p>
          <dl className="mt-3 space-y-1.5 text-[14px]">
            <div className="flex justify-between gap-3">
              <dt className="text-[#646b76]">{t.offerPaid}</dt>
              <dd className="font-medium text-[#16181d]">{view.offer.priorLabel}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#646b76]">{t.offerCharge}</dt>
              <dd className="font-medium text-[#16181d]">{view.offer.chargeLabel}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-[#dbe6fb] pt-1.5">
              <dt className="text-[#16181d]">{t.offerTotal}</dt>
              <dd className="font-semibold text-[#16181d]">{view.offer.totalLabel}</dd>
            </div>
          </dl>
          <a
            href={view.offer.href}
            rel="noopener noreferrer"
            className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-[12px] px-5 text-[15px] font-semibold text-white"
            style={{ backgroundColor: BLUE }}
          >
            {t.offerCta(view.offer.chargeLabel)}
          </a>
          <p className="mt-2 text-center text-[12px] leading-4 text-[#646b76]">
            {[view.offer.validUntil ? t.offerValidUntil(view.offer.validUntil) : "", t.offerSameOrder]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </section>
      ) : null}

      <Contacts locale={view.locale} />
    </Shell>
  );
}
