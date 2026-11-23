/**
 * Izsoļu arhīva izvēles lapa (makets 3. solis, variants A - e-pastu stilā). Tīra SSR prezentācija,
 * bez JavaScript: izvēle ir parasta forma (POST), lai to fiksē tikai poga «Apstiprināt».
 * Bez klienta personas datiem.
 */
import {
  AUCTION_ARCHIVE_API_PREFIX,
  AUCTION_ARCHIVE_COPY,
  auctionArchivePublicPath,
  formatEurCents,
  isAuctionArchiveChoiceOpen,
  type AuctionArchiveChoice,
  type AuctionArchiveOfferDoc,
} from "@/lib/auction-archive-offer";
import type { AppLocale } from "@/i18n/locales";

const BLUE = "#0061D2";

export type AuctionArchiveChoiceViewModel = {
  locale: AppLocale;
  token: string;
  title: string;
  vin: string;
  auctions: number;
  photos: number;
  refundLabel: string;
  /** form - izvēles forma; thanks - izvēle saņemta; closed - PDF nosūtīts / atmaksa veikta. */
  mode: "form" | "thanks" | "closed";
  choice: AuctionArchiveChoice | null;
  closedKind?: "archive" | "refund";
  notice?: "pick" | "err" | null;
};

/** Tīra funkcija: piedāvājums → lapas skats (testējama bez servera). */
export function auctionArchiveChoiceView(
  doc: AuctionArchiveOfferDoc,
  args: { locale: AppLocale; token: string; change: boolean; notice: string },
): AuctionArchiveChoiceViewModel {
  const base = {
    locale: args.locale,
    token: args.token,
    title: doc.summary.title,
    vin: doc.summary.vin,
    auctions: doc.summary.auctions.length,
    photos: Math.max(doc.summary.photoCount, doc.photos.length),
    refundLabel: formatEurCents(doc.paidCents),
    choice: doc.choice ?? null,
    notice: args.notice === "pick" || args.notice === "err" ? args.notice : null,
  } as const;
  if (doc.status === "archive_sent") return { ...base, mode: "closed", closedKind: "archive" };
  if (doc.status === "refunded") return { ...base, mode: "closed", closedKind: "refund" };
  if (doc.choice && isAuctionArchiveChoiceOpen(doc.status) && doc.status !== "pending" && !args.change && args.notice !== "pick") {
    return { ...base, mode: "thanks" };
  }
  return { ...base, mode: "form" };
}

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
  const t = AUCTION_ARCHIVE_COPY[locale];
  return (
    <p className="mt-6 border-t border-[#e4e7eb] pt-4 text-[13px] leading-5 text-[#646b76]">
      {t.contacts}:{" "}
      <a className="text-[#0061D2] underline" href="mailto:info@provin.lv">
        info@provin.lv
      </a>{" "}
      ·{" "}
      <a className="text-[#0061D2] underline" href="tel:+37129502039">
        +371 29 502 039
      </a>
    </p>
  );
}

export function AuctionArchiveInvalidView({ locale = "lv" }: { locale?: AppLocale }) {
  const t = AUCTION_ARCHIVE_COPY[locale];
  return (
    <Shell>
      <h1 className="text-[22px] font-bold leading-7 tracking-[-0.3px] text-[#16181d]">{t.invalidTitle}</h1>
      <p className="mt-2 text-[15px] leading-6 text-[#646b76]">{t.invalidBody}</p>
      <Contacts locale={locale} />
    </Shell>
  );
}

function CarLine({ title, vin }: { title: string; vin: string }) {
  if (!title && !vin) return null;
  return (
    <p className="mt-1 text-[13px] leading-5 text-[#646b76] [overflow-wrap:anywhere]">
      {title}
      {title && vin ? " · " : ""}
      {vin ? (
        <>
          VIN <span className="font-mono tracking-[0.3px]">{vin}</span>
        </>
      ) : null}
    </p>
  );
}

export function AuctionArchiveChoicePageView({ view }: { view: AuctionArchiveChoiceViewModel }) {
  const t = AUCTION_ARCHIVE_COPY[view.locale];
  const refund = view.refundLabel || t.refundFallback;
  const changeHref = `${auctionArchivePublicPath(view.locale, view.token)}?mainit=1`;

  if (view.mode === "closed") {
    return (
      <Shell>
        <h1 className="text-[20px] font-bold leading-[26px] tracking-[-0.3px] text-[#16181d]">
          {view.closedKind === "refund" ? t.thanksRefundTitle : t.thanksArchiveTitle}
        </h1>
        <CarLine title={view.title} vin={view.vin} />
        <p data-choice-closed className="mt-3 text-[15px] leading-6 text-[#16181d]">
          {view.closedKind === "refund" ? t.closedRefund : t.closedArchive}
        </p>
        <Contacts locale={view.locale} />
      </Shell>
    );
  }

  if (view.mode === "thanks" && view.choice) {
    const archive = view.choice === "archive";
    return (
      <Shell>
        <section
          data-choice-thanks={view.choice}
          className={`rounded-[14px] border px-4 py-4 ${archive ? "border-[#cfe9d8] bg-[#eefaf2]" : "border-[#dbe6fb] bg-[#eef4ff]"}`}
        >
          <h1 className="text-[20px] font-bold leading-[26px] tracking-[-0.3px] text-[#16181d]">
            {archive ? t.thanksArchiveTitle : t.thanksRefundTitle}
          </h1>
          <p className="mt-1.5 text-[15px] leading-6 text-[#16181d]">{archive ? t.thanksArchiveBody : t.thanksRefundBody(refund)}</p>
        </section>
        <CarLine title={view.title} vin={view.vin} />
        <a
          href={changeHref}
          rel="nofollow noreferrer"
          className="mt-5 flex min-h-[48px] w-full items-center justify-center rounded-[12px] border border-[#cfd4db] bg-white px-5 text-[15px] font-semibold text-[#16181d]"
        >
          {t.change}
        </a>
        <p className="mt-2 text-center text-[12px] leading-4 text-[#646b76]">{archive ? t.changeHintArchive : t.changeHintRefund}</p>
        <Contacts locale={view.locale} />
      </Shell>
    );
  }

  const card =
    "flex cursor-pointer items-start gap-3 rounded-[14px] border border-[#cfd4db] bg-white px-4 py-3.5 has-[:checked]:border-[#0061D2] has-[:checked]:bg-[#eef4ff]";
  return (
    <Shell>
      <h1 className="text-[22px] font-bold leading-7 tracking-[-0.3px] text-[#16181d]">{t.heading}</h1>
      <CarLine title={view.title} vin={view.vin} />
      <form method="post" action={`${AUCTION_ARCHIVE_API_PREFIX}/${view.token}`} className="mt-5 flex flex-col gap-2.5" data-choice-form>
        <input type="hidden" name="locale" value={view.locale} />
        <label className={card}>
          <input
            type="radio"
            name="choice"
            value="archive"
            defaultChecked={view.choice === "archive"}
            className="mt-1 h-5 w-5 shrink-0 accent-[#0061D2]"
          />
          <span>
            <span className="block text-[16px] font-semibold leading-6 text-[#16181d]">{t.optArchive}</span>
            <span className="mt-0.5 block text-[13px] leading-5 text-[#646b76]">
              {t.optArchiveHint(t.auctions(view.auctions), t.photos(view.photos))}
            </span>
          </span>
        </label>
        <label className={card}>
          <input
            type="radio"
            name="choice"
            value="refund"
            defaultChecked={view.choice === "refund"}
            className="mt-1 h-5 w-5 shrink-0 accent-[#0061D2]"
          />
          <span>
            <span className="block text-[16px] font-semibold leading-6 text-[#16181d]">{t.optRefund(refund)}</span>
            <span className="mt-0.5 block text-[13px] leading-5 text-[#646b76]">
              {view.refundLabel ? `${view.refundLabel} ${t.optRefundHint}` : t.optRefundHint}
            </span>
          </span>
        </label>
        {view.notice === "pick" ? <p className="text-[13px] text-[#b42318]">{t.pickOne}</p> : null}
        {view.notice === "err" ? <p className="text-[13px] text-[#b42318]">{t.invalidBody}</p> : null}
        <button
          type="submit"
          className="mt-2 flex min-h-[52px] w-full items-center justify-center rounded-[12px] px-5 text-[16px] font-semibold text-white"
          style={{ backgroundColor: BLUE }}
        >
          {t.confirm}
        </button>
      </form>
      <Contacts locale={view.locale} />
    </Shell>
  );
}
