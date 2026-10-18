"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { B2B_LABEL_CLASS, B2B_SECONDARY_BUTTON_CLASS } from "@/components/b2b/b2b-partner-ui";
import { B2bPartnerDialog } from "@/components/b2b/B2bPartnerDialog";
import {
  B2B_WALLET_TOPUP_MAX_CENTS,
  B2B_WALLET_TOPUP_MIN_CENTS,
  B2B_WALLET_TOPUP_PRESETS_CENTS,
  formatB2bWalletEuro,
  isValidB2bWalletTopupCents,
  parseB2bEuroInput,
} from "@/lib/b2b-wallet";

export function B2bPartnerTopupDialog({
  open,
  onClose,
  balanceCents,
}: {
  open: boolean;
  onClose: () => void;
  balanceCents: number;
}) {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const [preset, setPreset] = useState<number | null>(B2B_WALLET_TOPUP_PRESETS_CENTS[1] ?? null);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPreset(B2B_WALLET_TOPUP_PRESETS_CENTS[1] ?? null);
    setCustom("");
    setError("");
    setBusy(false);
  }, [open]);

  const customCents = custom.trim() ? parseB2bEuroInput(custom) : null;
  const amountCents =
    custom.trim() !== ""
      ? typeof customCents === "number"
        ? customCents
        : null
      : preset;
  const valid = isValidB2bWalletTopupCents(amountCents);
  const rangeError = t("topupAmountError", {
    min: formatB2bWalletEuro(B2B_WALLET_TOPUP_MIN_CENTS),
    max: formatB2bWalletEuro(B2B_WALLET_TOPUP_MAX_CENTS),
  });

  const onPay = async () => {
    if (!valid || amountCents == null) {
      setError(rangeError);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout/partner/topup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents, locale }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setError(data.error === "amount" ? rangeError : t("payError"));
    } catch {
      setError(t("payNetwork"));
    }
    setBusy(false);
  };

  return (
    <B2bPartnerDialog
      open={open}
      onClose={busy ? () => {} : onClose}
      title={t("topupTitle")}
      closeLabel={t("topupCancel")}
    >
      <form
        className="flex flex-col gap-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) void onPay();
        }}
      >
        <p className="-mt-3 text-[0.82rem] text-zinc-400">
          {t("topupCurrent", { amount: formatB2bWalletEuro(balanceCents) })}
        </p>

        <div>
          <p className={B2B_LABEL_CLASS}>{t("topupChoose")}</p>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("topupChoose")}>
            {B2B_WALLET_TOPUP_PRESETS_CENTS.map((cents) => {
              const active = custom.trim() === "" && preset === cents;
              return (
                <button
                  key={cents}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={busy}
                  className={
                    active
                      ? "min-h-[44px] rounded-[0.6rem] border border-[#2563EB] bg-[#2563EB]/15 text-[0.9rem] font-semibold text-white"
                      : "min-h-[44px] rounded-[0.6rem] border border-white/12 text-[0.9rem] font-semibold text-zinc-300 transition-colors hover:border-white/30 hover:text-white"
                  }
                  onClick={() => {
                    setPreset(cents);
                    setCustom("");
                    setError("");
                  }}
                >
                  {Math.round(cents / 100)} €
                </button>
              );
            })}
          </div>
        </div>

        <label className="block min-w-0">
          <span className={B2B_LABEL_CLASS}>{t("topupCustom")}</span>
          <input
            type="text"
            inputMode="decimal"
            className={`${styles.inlineInput}${custom.trim() && !valid ? ` ${styles.inlineInputError}` : ""}`}
            value={custom}
            onChange={(event) => {
              setCustom(event.target.value.replace(/[^\d.,]/g, "").slice(0, 10));
              setError("");
            }}
            placeholder={t("topupCustomPlaceholder")}
            aria-label={t("topupCustom")}
            disabled={busy}
          />
        </label>

        <dl className="flex flex-col gap-1.5 border-t border-white/10 pt-4 text-[0.84rem]">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-zinc-400">{t("topupSummaryAdd")}</dt>
            <dd className="font-semibold text-zinc-100">{valid && amountCents != null ? formatB2bWalletEuro(amountCents) : "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-zinc-400">{t("topupSummaryAfter")}</dt>
            <dd className="font-semibold text-zinc-100">
              {valid && amountCents != null ? formatB2bWalletEuro(balanceCents + amountCents) : "-"}
            </dd>
          </div>
        </dl>

        {error || (custom.trim() && !valid) ? (
          <p className={styles.inlineFieldError}>{error || rangeError}</p>
        ) : null}

        <div className="flex flex-col gap-3">
          <button type="submit" className={styles.liquidCta} disabled={busy || !valid}>
            <span className={styles.liquidCtaShimmer} aria-hidden />
            <span className={styles.liquidCtaLabel}>
              {busy
                ? t("topupPayLoading")
                : t("topupPay", { amount: valid && amountCents != null ? formatB2bWalletEuro(amountCents) : "" }).trim()}
            </span>
          </button>
          <p className="text-center text-[0.7rem] leading-snug text-zinc-500">{t("topupSecure")}</p>
          <button type="button" className={B2B_SECONDARY_BUTTON_CLASS} onClick={onClose} disabled={busy}>
            {t("topupCancel")}
          </button>
        </div>
      </form>
    </B2bPartnerDialog>
  );
}
