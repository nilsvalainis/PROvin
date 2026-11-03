"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { B2bPartnerQuoteDialog } from "@/components/b2b/B2bPartnerQuoteDialog";

/** „Vēl neesat partneris? Saņemt cenu piedāvājumu” - ārpus ieejas kartītes (Partneriem v3). */
export function B2bQuoteCta({ className = "" }: { className?: string }) {
  const t = useTranslations("Partner");
  const [open, setOpen] = useState(false);
  return (
    <div className={`b2b-quote ${className}`.trim()}>
      <p className="b2b-quote-q">{t("quoteDivider")}</p>
      <button type="button" className="b2b-quote-btn provin-press" onClick={() => setOpen(true)}>
        {t("quoteCta")}
      </button>
      <B2bPartnerQuoteDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
