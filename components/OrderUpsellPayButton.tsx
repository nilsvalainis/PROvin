"use client";

import { useState } from "react";

export function OrderUpsellPayButton({ token, label }: { token: string; label: string }) {
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
            body: JSON.stringify({ token }),
          })
            .then(async (res) => {
              const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
              if (!res.ok || !data.url) {
                setError("Apmaksas saiti šobrīd neizdevās atvērt. Uzrakstiet uz info@provin.lv.");
                setBusy(false);
                return;
              }
              window.location.href = data.url;
            })
            .catch(() => {
              setError("Tīkla kļūda. Mēģiniet vēlreiz.");
              setBusy(false);
            });
        }}
      >
        {busy ? "Atver…" : label}
      </button>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
