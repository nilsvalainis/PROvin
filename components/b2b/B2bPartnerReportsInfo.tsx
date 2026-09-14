"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { B2bPartnerCatalog } from "@/components/b2b/B2bPartnerCatalog";
import type { B2bPartnerPublicProfile } from "@/lib/b2b-partner-account";

export function B2bPartnerReportsInfo() {
  const t = useTranslations("Partner");
  const [dealerEnabled, setDealerEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/partner/me", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { partner?: B2bPartnerPublicProfile };
        if (!cancelled) setDealerEnabled(data.partner?.dealerEnabled === true);
      } catch {
        /* keep default off */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1
        id="b2b-included-title"
        className="text-balance text-[1.25rem] font-semibold leading-snug tracking-[-0.02em] text-zinc-100"
      >
        {t("includedHeading")}
      </h1>
      <div className="mt-2.5 h-px w-full bg-white/10" aria-hidden />
      <B2bPartnerCatalog
        className="pt-6 sm:pt-8"
        plan={dealerEnabled ? undefined : "business"}
      />
    </div>
  );
}
