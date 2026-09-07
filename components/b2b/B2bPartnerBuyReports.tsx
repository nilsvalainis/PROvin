"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { B2bPartnerPackPicker } from "@/components/b2b/B2bPartnerPackPicker";

type BuyMode = "primary" | "secondary";

export function B2bPartnerBuyReports({ mode = "primary" }: { mode?: BuyMode }) {
  const t = useTranslations("Partner");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggle = () => setOpen((prev) => !prev);

  return (
    <>
      {mode === "primary" ? (
        <button
          type="button"
          className={`${styles.liquidCta} mt-4 flex w-full items-center justify-center`}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={toggle}
        >
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>
            {t("buyPacksCta")}
            <span className="ml-1.5" aria-hidden>
              {open ? "▴" : "▾"}
            </span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="mt-4 self-start text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 transition-colors hover:text-zinc-200"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={toggle}
        >
          {t("buyPacksCta")}
          <span className="ml-1.5" aria-hidden>
            {open ? "▴" : "▾"}
          </span>
        </button>
      )}

      {open ? (
        <div
          id={panelId}
          className="mt-4 w-full max-w-[45rem] rounded-[0.85rem] border border-white/14 bg-white/[0.03] p-3.5"
        >
          <B2bPartnerPackPicker variant="panel" />
        </div>
      ) : null}
    </>
  );
}
