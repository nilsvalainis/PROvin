"use client";

import { useEffect } from "react";

type Step = "paste" | "list" | "result";

const VINS = ["WVWZZZ1KZBW123456", "WBA8E9C50GK123456", "YV1MZ84BDK2123456", "WBA8E9C50GK123456", "TMBJJ7NE8L0123"];

const ROWS = [
  { index: 0, raw: VINS[0], vin: VINS[0], kind: "valid", charCount: 17 },
  { index: 1, raw: VINS[1], vin: VINS[1], kind: "valid", charCount: 17 },
  {
    index: 2,
    raw: VINS[2],
    vin: VINS[2],
    kind: "already_ordered",
    charCount: 17,
    alreadyOrderedLabel: "12.09.2026",
    orderId: "demo_old",
  },
  { index: 3, raw: VINS[3], vin: VINS[3], kind: "duplicate", charCount: 17 },
  { index: 4, raw: VINS[4], vin: "", kind: "invalid", charCount: 14 },
];

const PRICES: Record<string, number> = { business: 7999, dealer_raw: 1999, dealer_pro: 2499 };

function fakeFetch(original: typeof fetch): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/partner/orders/bulk-check")) {
      return Response.json({ ok: true, rows: ROWS, truncated: false });
    }
    if (url.includes("/api/partner/wallet/bulk")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { product?: string; items?: { vin: string }[] };
      const items = body.items ?? [];
      const row = (vin: string, i: number) => ({
        vin,
        orderId: `demo_${i}`,
        duplicate: false,
        order: {
          id: `demo_${i}`,
          createdAt: new Date().toISOString(),
          vin,
          invoiceNumber: "-",
          amountLabel: "-",
          amountKind: "money",
          plan: "business",
          status: i === 0 ? "processing" : "received",
          kind: "order",
          walletProduct: body.product,
        },
      });
      return Response.json({
        ok: true,
        accepted: items.slice(0, 1).map((item, i) => row(item.vin, i)),
        failed: items.slice(1).map((item) => ({ vin: item.vin, error: "queue_failed", refunded: true })),
        skipped: [],
        balanceCents: 5000,
        chargedCents: PRICES[body.product ?? "business"] ?? 0,
      });
    }
    if (url.includes("/api/partner/wallet")) {
      return Response.json({ ok: true });
    }
    return original(input, init);
  };
}

function setNativeValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** Tikai lokālajam ekrānuzņēmumam: atver īsto pirkuma logu un izspēlē Vairāki VIN plūsmu ar viltotu API. */
export function BulkVinPreviewDriver({ step, card }: { step: Step; card: number }) {
  useEffect(() => {
    const original = window.fetch;
    window.fetch = fakeFetch(original);
    let cancelled = false;
    void (async () => {
      await wait(400);
      const cards = document.querySelectorAll("article");
      const buy = cards[card]?.querySelectorAll<HTMLButtonElement>("button");
      buy?.[buy.length - 1]?.click();
      await wait(300);
      const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
      dialog()?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]?.click();
      await wait(300);
      const area = dialog()?.querySelector("textarea");
      if (area) setNativeValue(area, VINS.join("\n"));
      if (cancelled || step === "paste") return;
      await wait(200);
      const ctas = () => Array.from(dialog()?.querySelectorAll<HTMLButtonElement>("button") ?? []);
      ctas().find((b) => b.className.includes("liquidCta"))?.click();
      await wait(600);
      const all = dialog()?.querySelector<HTMLInputElement>('input[type="checkbox"]');
      all?.click();
      await wait(200);
      dialog()?.querySelector<HTMLInputElement>('input[type="radio"]')?.click();
      if (cancelled || step === "list") return;
      await wait(300);
      ctas().find((b) => b.className.includes("liquidCta"))?.click();
    })();
    return () => {
      cancelled = true;
      window.fetch = original;
    };
  }, [step, card]);
  return null;
}
