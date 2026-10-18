"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Plus, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { B2B_LABEL_CLASS, B2B_WALLET_PRODUCT_COPY } from "@/components/b2b/b2b-partner-ui";
import { B2bPartnerDialog } from "@/components/b2b/B2bPartnerDialog";
import { B2bPartnerHome } from "@/components/b2b/B2bPartnerHome";
import { B2bPartnerTopupDialog } from "@/components/b2b/B2bPartnerTopupDialog";
import { Link, useRouter } from "@/i18n/navigation";
import type { B2bPartnerPriceOverrides } from "@/lib/b2b-partner-account";
import { rememberPendingPartnerArchiveRow } from "@/lib/b2b-partner-archive-rows";
import type { B2bCreditRemaining } from "@/lib/b2b-partner-credits";
import { isPartnerAuditPurpose, type B2bPartnerAuditPurpose } from "@/lib/b2b-partner-orders";
import {
  B2B_WALLET_PRODUCT_IDS,
  B2B_WALLET_PRODUCTS,
  B2B_WALLET_REPORT_LANGS,
  formatB2bWalletEuro,
  type B2bWalletProductId,
  type B2bWalletReportLang,
} from "@/lib/b2b-wallet";
import { resolveB2bWalletSampleUrl } from "@/lib/b2b-samples";
import type { B2bWalletView } from "@/lib/b2b-wallet-view";
import { trackMetaLead } from "@/lib/meta-pixel";
import { isIncompleteVinLength, isPlausibleListingUrl, isValidVin, sanitizeVinInput } from "@/lib/order-field-validation";
import { vinNeedsCheckDigitWarning } from "@/lib/vin-iso3779";

export type B2bLegacyCredits = {
  credits: B2bCreditRemaining;
  dealerEnabled: boolean;
  prices: B2bPartnerPriceOverrides | null;
};

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `buy_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function WalletHeader({
  balanceCents,
  canAfford,
  onTopup,
}: {
  balanceCents: number;
  canAfford: boolean;
  onTopup: () => void;
}) {
  const t = useTranslations("Partner");
  const amount = formatB2bWalletEuro(balanceCents);
  if (canAfford) {
    return (
      <div className="mb-6 flex justify-end">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] py-1 pl-4 pr-1 text-[0.8rem] font-medium text-zinc-200">
          <span>{t("walletBalancePill", { amount })}</span>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#2563EB] text-white transition-[filter] hover:brightness-110"
            title={t("walletTopupTooltip")}
            aria-label={t("walletTopupTooltip")}
            onClick={onTopup}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    );
  }
  return (
    <section
      className="mb-8 flex flex-col gap-4 rounded-[0.9rem] border border-[#2563EB]/60 bg-[#0d1424]/80 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-6"
      aria-live="polite"
    >
      <div className="min-w-0">
        <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">
          {t("walletBannerLabel")}
        </p>
        <p className="mt-1 text-[1.9rem] font-extrabold leading-tight tracking-[-0.02em] text-white">{amount}</p>
        <p className="mt-1.5 max-w-[30rem] text-[0.84rem] leading-snug text-zinc-300">{t("walletBannerLead")}</p>
      </div>
      <div className="w-full shrink-0 sm:w-[14rem]">
        <button type="button" className={styles.liquidCta} onClick={onTopup}>
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>{t("walletTopupCta")}</span>
        </button>
      </div>
    </section>
  );
}

/** Tas pats izskats kā „Jaunums” mājas lapas katalogā. */
function SoonBadge() {
  const t = useTranslations("Partner");
  return (
    <span className={styles.catalogPopularBadgeHeader} style={{ display: "inline-block", margin: 0 }}>
      {t("walletSampleSoon")}
    </span>
  );
}

function SampleLink({ product, reportLang }: { product: B2bWalletProductId; reportLang: B2bWalletReportLang }) {
  const t = useTranslations("Partner");
  const url = resolveB2bWalletSampleUrl(product, reportLang);
  const langSuffix = product === "dealer_pro" ? ` (${reportLang.toUpperCase()})` : "";
  const rowClass = "mt-2.5 inline-flex min-h-[22px] items-center gap-1.5 self-start text-[0.74rem] font-semibold";
  if (!url) {
    return (
      <span className={`${rowClass} cursor-not-allowed text-zinc-600`} aria-disabled="true">
        <FileText className="h-[15px] w-[15px] shrink-0" aria-hidden />
        {t("walletSample")}
        <SoonBadge />
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${rowClass} text-[#93c5fd] underline decoration-[#93c5fd]/35 underline-offset-[3px] transition-colors hover:text-white hover:decoration-white/60`}
      title={t("walletSampleAria")}
    >
      <FileText className="h-[15px] w-[15px] shrink-0" aria-hidden />
      {t("walletSample")}
      {langSuffix} (PDF)
    </a>
  );
}

function ProductCard({
  product,
  view,
  reportLang,
  onReportLang,
  onBuy,
}: {
  product: B2bWalletProductId;
  view: B2bWalletView;
  reportLang: B2bWalletReportLang;
  onReportLang: (lang: B2bWalletReportLang) => void;
  onBuy: () => void;
}) {
  const t = useTranslations("Partner");
  const copy = B2B_WALLET_PRODUCT_COPY[product];
  const price = view.prices[product];
  const affordable = view.balanceCents >= price.priceCents;
  const refundable = B2B_WALLET_PRODUCTS[product].refundOnNoData;

  return (
    <article className="flex min-w-0 flex-col rounded-[0.9rem] border border-white/10 bg-[rgb(20_20_20/0.72)] p-5 shadow-[0_18px_48px_-28px_rgba(0,0,0,0.8)]">
      <div className="flex min-h-[1.25rem] items-center gap-2.5">
        <p className="rounded-md bg-zinc-300/80 px-2 py-[0.3rem] text-[0.66rem] font-semibold leading-none tracking-[0.01em] text-zinc-800">
          {t(copy.tag)}
        </p>
        {copy.tagSoon ? <SoonBadge /> : null}
      </div>
      <h2 className="mt-4 text-[1.08rem] font-bold leading-snug tracking-[-0.01em] text-zinc-100">{t(copy.title)}</h2>
      <p className="mt-2 text-[0.82rem] leading-relaxed text-zinc-400">{t(copy.desc)}</p>

      {product === "dealer_pro" ? (
        <div className="mt-4">
          <p className={B2B_LABEL_CLASS}>{t("walletReportLang")}</p>
          <div
            className="inline-flex gap-0.5 rounded-lg border border-white/12 bg-white/[0.03] p-0.5"
            role="radiogroup"
            aria-label={t("walletReportLang")}
            onKeyDown={(event) => {
              const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
              if (!step) return;
              event.preventDefault();
              const langs = B2B_WALLET_REPORT_LANGS;
              const next = langs[(langs.indexOf(reportLang) + step + langs.length) % langs.length];
              onReportLang(next);
              event.currentTarget.querySelector<HTMLButtonElement>(`[data-lang="${next}"]`)?.focus();
            }}
          >
            {B2B_WALLET_REPORT_LANGS.map((lang) => {
              const active = lang === reportLang;
              return (
                <button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  data-lang={lang}
                  className={`h-7 w-11 rounded-md text-[0.66rem] font-semibold tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300/70 ${
                    active ? "bg-zinc-300/90 text-zinc-900" : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                  }`}
                  onClick={() => onReportLang(lang)}
                >
                  {lang.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-auto pt-6">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          {price.discountPct > 0 ? (
            <>
              <span
                className="text-[0.9rem] text-zinc-500 line-through"
                aria-label={t("walletOldPriceAria", { amount: formatB2bWalletEuro(price.defaultCents) })}
              >
                {formatB2bWalletEuro(price.defaultCents)}
              </span>
              <span className="text-[1.5rem] font-extrabold leading-none tracking-[-0.02em] text-white">
                {formatB2bWalletEuro(price.priceCents)}
              </span>
              <span
                className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[0.66rem] font-bold text-emerald-300"
                aria-label={t("walletDiscountAria", { pct: price.discountPct })}
              >
                -{price.discountPct}%
              </span>
            </>
          ) : (
            <span className="text-[1.5rem] font-extrabold leading-none tracking-[-0.02em] text-white">
              {formatB2bWalletEuro(price.priceCents)}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[0.7rem] leading-snug text-zinc-500">{t("walletDeductNote")}</p>
        <SampleLink product={product} reportLang={reportLang} />
        <p
          className={`mt-3 flex h-[18px] items-center gap-1.5 overflow-hidden whitespace-nowrap text-[0.7rem] leading-[18px] text-zinc-400${refundable ? "" : " invisible"}`}
          aria-hidden={refundable ? undefined : true}
        >
          <RotateCcw className="h-3 w-3 shrink-0 text-emerald-300" aria-hidden />
          <span className="truncate">{t("walletRefundNote")}</span>
        </p>
        <div className="mt-2.5">
          <button
            type="button"
            className={`${styles.liquidCta}${affordable ? "" : " opacity-45"}`}
            disabled={!affordable}
            onClick={onBuy}
          >
            <span className={styles.liquidCtaShimmer} aria-hidden />
            <span className={styles.liquidCtaLabel}>{affordable ? t("walletBuy") : t("walletInsufficient")}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function PurchaseDialog({
  product,
  view,
  reportLang,
  onClose,
  onPurchased,
}: {
  product: B2bWalletProductId | null;
  view: B2bWalletView;
  reportLang: B2bWalletReportLang;
  onClose: () => void;
  onPurchased: (args: { product: B2bWalletProductId; orderId: string; vin: string; balanceCents: number }) => void;
}) {
  const t = useTranslations("Partner");
  const router = useRouter();
  const [vin, setVin] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [auditPurpose, setAuditPurpose] = useState<B2bPartnerAuditPurpose | null>(null);
  const [vinError, setVinError] = useState("");
  const [listingError, setListingError] = useState("");
  const [purposeError, setPurposeError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  useEffect(() => {
    if (!product) return;
    setVin("");
    setListingUrl("");
    setAuditPurpose(null);
    setVinError("");
    setListingError("");
    setPurposeError("");
    setFormError("");
    setIdempotencyKey(newIdempotencyKey());
  }, [product]);

  if (!product) return null;
  const price = view.prices[product];
  const isBusiness = product === "business";

  const onSubmit = async () => {
    setVinError("");
    setListingError("");
    setPurposeError("");
    setFormError("");
    if (isBusiness && (!auditPurpose || !isPartnerAuditPurpose(auditPurpose))) {
      setPurposeError(t("auditPurposeError"));
      return;
    }
    if (!isValidVin(vin)) {
      setVinError(isIncompleteVinLength(vin) ? t("vinLengthError") : t("vinError"));
      return;
    }
    const listing = listingUrl.trim();
    if (isBusiness && listing && !isPlausibleListingUrl(listing)) {
      setListingError(t("listingError"));
      return;
    }
    setBusy(true);
    try {
      trackMetaLead();
      const res = await fetch("/api/partner/wallet/purchase", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          product,
          vin,
          ...(isBusiness ? { auditPurpose, ...(listing ? { listingUrl: listing } : {}) } : {}),
          ...(product === "dealer_pro" ? { reportLang } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        orderId?: string;
        balanceCents?: number;
      };
      if (res.status === 401) {
        router.replace("/partneriem");
        return;
      }
      if (res.status === 402 || data.error === "insufficient") {
        setFormError(t("walletInsufficient"));
        return;
      }
      if (data.error === "vin") {
        setVinError(t("vinError"));
        return;
      }
      if (data.error === "listing") {
        setListingError(t("listingError"));
        return;
      }
      if (data.error === "audit_purpose") {
        setPurposeError(t("auditPurposeError"));
        return;
      }
      if (!res.ok || !data.ok || !data.orderId) {
        setFormError(t("buyError"));
        setIdempotencyKey(newIdempotencyKey());
        return;
      }
      onPurchased({
        product,
        orderId: data.orderId,
        vin,
        balanceCents: typeof data.balanceCents === "number" ? data.balanceCents : view.balanceCents - price.priceCents,
      });
    } catch {
      setFormError(t("payNetwork"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <B2bPartnerDialog
      open
      onClose={busy ? () => {} : onClose}
      title={t(B2B_WALLET_PRODUCT_COPY[product].title)}
      closeLabel={t("buyCloseAria")}
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) void onSubmit();
        }}
      >
        <div className="rounded-[0.6rem] border border-white/10 px-4 py-3 text-[0.82rem] text-zinc-300">
          <p>{t("buyDialogPrice", { amount: formatB2bWalletEuro(price.priceCents) })}</p>
          <p className="mt-0.5 text-zinc-500">
            {t("buyBalanceAfter", { amount: formatB2bWalletEuro(Math.max(0, view.balanceCents - price.priceCents)) })}
          </p>
          {product === "dealer_pro" ? (
            <p className="mt-0.5 text-zinc-500">
              {t("walletReportLang")}: {reportLang.toUpperCase()}
            </p>
          ) : null}
        </div>

        {isBusiness ? (
          <fieldset className="min-w-0" disabled={busy}>
            <legend className={B2B_LABEL_CLASS}>{t("auditPurposeLabel")}</legend>
            <div className="flex flex-col gap-3" role="radiogroup" aria-label={t("auditPurposeAria")}>
              {(["client", "internal"] as const).map((purpose) => (
                <label key={purpose} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="b2b-wallet-audit-purpose"
                    checked={auditPurpose === purpose}
                    onChange={() => {
                      setAuditPurpose(purpose);
                      setPurposeError("");
                    }}
                    className="h-4 w-4 shrink-0 border-zinc-500 bg-transparent text-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40"
                  />
                  <span className="text-[0.9rem] font-medium text-zinc-100">
                    {purpose === "client" ? t("auditPurposeClient") : t("auditPurposeInternal")}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <label className="block min-w-0">
          <span className={B2B_LABEL_CLASS}>{t("vinLabel")}</span>
          <input
            type="text"
            className={`${styles.inlineInput} font-mono uppercase tracking-wide${vinError ? ` ${styles.inlineInputError}` : ""}`}
            value={vin}
            onChange={(event) => {
              setVin(sanitizeVinInput(event.target.value));
              setVinError("");
              setFormError("");
            }}
            onPaste={(event) => {
              event.preventDefault();
              setVin(sanitizeVinInput(event.clipboardData.getData("text")));
              setVinError("");
            }}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="characters"
            placeholder={t("vinPlaceholder")}
            aria-label={t("vinAria")}
            aria-invalid={vinError ? true : undefined}
            disabled={busy}
          />
        </label>

        {isBusiness ? (
          <label className="block min-w-0">
            <span className={B2B_LABEL_CLASS}>{t("listingLabel")}</span>
            <input
              type="url"
              className={`${styles.inlineInput}${listingError ? ` ${styles.inlineInputError}` : ""}`}
              value={listingUrl}
              onChange={(event) => {
                setListingUrl(event.target.value);
                setListingError("");
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder={t("listingPlaceholder")}
              aria-label={t("listingAria")}
              disabled={busy}
            />
          </label>
        ) : null}

        {purposeError ? <p className={styles.inlineFieldError}>{purposeError}</p> : null}
        {vinError ? <p className={styles.inlineFieldError}>{vinError}</p> : null}
        {!vinError && vinNeedsCheckDigitWarning(vin) ? (
          <p className={styles.inlineFieldError} role="status">
            {t("vinCheckDigitWarning")}
          </p>
        ) : null}
        {listingError ? <p className={styles.inlineFieldError}>{listingError}</p> : null}
        {formError ? <p className={styles.inlineFieldError}>{formError}</p> : null}

        <button type="submit" className={styles.liquidCta} disabled={busy}>
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>
            {busy ? t("buyLoading") : t("buyConfirm", { amount: formatB2bWalletEuro(price.priceCents) })}
          </span>
        </button>
        <p className="text-center text-[0.7rem] leading-snug text-zinc-500">{t("walletDeductNote")}</p>
      </form>
    </B2bPartnerDialog>
  );
}

export function B2bPartnerWalletHome({
  initialWallet,
  legacy,
}: {
  initialWallet: B2bWalletView;
  legacy: B2bLegacyCredits | null;
}) {
  const t = useTranslations("Partner");
  const router = useRouter();
  const [view, setView] = useState<B2bWalletView>(initialWallet);
  const [topupOpen, setTopupOpen] = useState(false);
  const [buying, setBuying] = useState<B2bWalletProductId | null>(null);
  const [reportLang, setReportLang] = useState<B2bWalletReportLang>("lv");
  const [topupPaid, setTopupPaid] = useState(false);
  const [buyOk, setBuyOk] = useState("");

  const canAfford = view.balanceCents >= view.cheapestCents;

  const reload = useCallback(async (): Promise<B2bWalletView | null> => {
    const res = await fetch("/api/partner/wallet", { credentials: "include", cache: "no-store" });
    if (res.status === 401) {
      router.replace("/partneriem");
      return null;
    }
    const data = (await res.json().catch(() => ({}))) as { wallet?: B2bWalletView };
    if (data.wallet) setView(data.wallet);
    return data.wallet ?? null;
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("topup") === "1") setTopupPaid(true);
  }, []);

  useEffect(() => {
    if (!topupPaid) return;
    const baseline = initialWallet.topupTotalCents;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      if (cancelled) return;
      try {
        const next = await reload();
        if (cancelled || (next && next.topupTotalCents > baseline)) return;
      } catch {
        /* webhook var kavēties; nākamais mēģinājums */
      }
      attempts += 1;
      if (attempts < 15 && !cancelled) window.setTimeout(() => void poll(), 2000);
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [topupPaid, initialWallet.topupTotalCents, reload]);

  const hasLegacyCredits = useMemo(
    () => Boolean(legacy && legacy.credits.business + legacy.credits.dealer > 0),
    [legacy],
  );

  return (
    <div>
      <h1 className="sr-only">{t("navHome")}</h1>
      <WalletHeader balanceCents={view.balanceCents} canAfford={canAfford} onTopup={() => setTopupOpen(true)} />

      {topupPaid ? (
        <p className="mb-5 text-[0.8125rem] font-medium leading-snug text-emerald-300" role="status">
          {t("topupPaidOk")}
        </p>
      ) : null}
      {buyOk ? (
        <p className="mb-5 text-[0.8125rem] font-medium leading-snug text-emerald-300" role="status">
          {buyOk}{" "}
          <Link href="/partneriem/konts/pasutijumi" className="text-[#93c5fd] underline-offset-2 hover:underline">
            {t("buyOpenOrders")}
          </Link>
        </p>
      ) : null}

      <section aria-label={t("walletProductsAria")} className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
        {B2B_WALLET_PRODUCT_IDS.map((product) => (
          <ProductCard
            key={product}
            product={product}
            view={view}
            reportLang={reportLang}
            onReportLang={setReportLang}
            onBuy={() => {
              setBuyOk("");
              setBuying(product);
            }}
          />
        ))}
      </section>
      <p className="mt-5 text-center text-[0.72rem] leading-snug text-zinc-500">{t("walletInvoiceNote")}</p>

      {hasLegacyCredits && legacy ? (
        <section className="mt-14 border-t border-white/10 pt-8" aria-label={t("walletLegacyCreditsHeading")}>
          <p className="mb-4 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {t("walletLegacyCreditsHeading")}
          </p>
          <B2bPartnerHome
            embedded
            initialCredits={legacy.credits}
            initialDealerEnabled={legacy.dealerEnabled}
            initialPrices={legacy.prices}
          />
        </section>
      ) : null}

      <B2bPartnerTopupDialog
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        balanceCents={view.balanceCents}
      />
      <PurchaseDialog
        product={buying}
        view={view}
        reportLang={reportLang}
        onClose={() => setBuying(null)}
        onPurchased={({ product, orderId, vin, balanceCents }) => {
          setBuying(null);
          setView((prev) => ({ ...prev, balanceCents }));
          rememberPendingPartnerArchiveRow({
            id: orderId,
            createdAt: new Date().toISOString(),
            vin,
            invoiceNumber: "-",
            amountLabel: formatB2bWalletEuro(view.prices[product].priceCents),
            amountKind: "money",
            plan: B2B_WALLET_PRODUCTS[product].plan,
            reportHref: null,
            invoiceHref: null,
            status: "received",
            kind: "order",
            walletProduct: product,
          });
          if (product === "dealer_raw") {
            router.push(`/partneriem/konts/dati/${encodeURIComponent(orderId)}`);
            return;
          }
          setBuyOk(t("buyOk"));
          void reload().catch(() => {});
        }}
      />
    </div>
  );
}
