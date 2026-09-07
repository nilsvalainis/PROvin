"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { B2bPartnerPackPicker } from "@/components/b2b/B2bPartnerPackPicker";

type BuyMode = "primary" | "secondary";

export function B2bPartnerBuyReports({ mode = "primary" }: { mode?: BuyMode }) {
  const t = useTranslations("Partner");
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const panelId = useId();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open || !desktop) {
      document.body.style.overflow = "";
      return;
    }

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, desktop]);

  const toggle = () => setOpen((prev) => !prev);
  const close = () => setOpen(false);

  return (
    <>
      {mode === "primary" ? (
        <button
          type="button"
          className={`${styles.liquidCta} mt-4 flex w-full items-center justify-center`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
        >
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>
            {t("buyPacksCta")}
            {!desktop ? (
              <span className="ml-1.5" aria-hidden>
                {open ? "▴" : "▾"}
              </span>
            ) : null}
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="mt-4 self-start text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 transition-colors hover:text-zinc-200"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
        >
          {t("buyPacksCta")}
          {!desktop ? (
            <span className="ml-1.5" aria-hidden>
              {open ? "▴" : "▾"}
            </span>
          ) : null}
        </button>
      )}

      {open && !desktop ? (
        <div
          id={panelId}
          className="mt-4 rounded-[0.85rem] border border-white/14 bg-white/[0.03] p-3.5"
        >
          <B2bPartnerPackPicker variant="panel" />
        </div>
      ) : null}

      {open && desktop ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            aria-label={t("buyCloseAria")}
            onClick={close}
          />
          <aside
            id={panelId}
            className="absolute inset-y-0 right-0 flex w-full max-w-[42rem] flex-col overflow-y-auto border-l border-white/14 bg-gradient-to-b from-[#121212] to-[#0a0a0a] px-5 py-5 shadow-[-24px_0_48px_rgb(0_0_0_/_0.45)]"
            role="dialog"
            aria-modal="true"
            aria-label={t("buyPanelTitle")}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#93c5fd]">
                {t("buyPanelTitle")}
              </h2>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[1.05rem] leading-none text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
                aria-label={t("buyCloseAria")}
                onClick={close}
              >
                ✕
              </button>
            </div>
            <B2bPartnerPackPicker variant="panel" />
          </aside>
        </div>
      ) : null}
    </>
  );
}
