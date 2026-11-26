"use client";

import { useState } from "react";
import { followStripeCheckoutUrl } from "@/lib/meta-pixel";
import { upsellPageCopy } from "@/lib/order-upsell-i18n";

export function OrderUpsellPayButton({ token, label, lang = "lv" }: { token: string; label: string; lang?: string }) {
  const c = upsellPageCopy(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        className="inline-flex rounded-full bg-[#0061D2] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        onClick={() => {
          setBusy(true);
          setError(null);
          void fetch("/api/checkout/upsell", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, lang }),
          })
            .then(async (res) => {
              const data = (await res.json().catch(() => ({}))) as {
                url?: string;
                eventId?: string;
                value?: number;
                error?: string;
              };
              if (!res.ok || !followStripeCheckoutUrl(data)) {
                setError(c.errOpen);
                setBusy(false);
                return;
              }
            })
            .catch(() => {
              setError(c.errNetwork);
              setBusy(false);
            });
        }}
      >
        {busy ? c.opening : label}
      </button>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
