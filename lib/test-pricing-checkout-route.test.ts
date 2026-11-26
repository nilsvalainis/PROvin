/**
 * `/api/checkout/test-pricing`: tikai publiskie plāni, avota lapa pēc saraksta, piekrišana un VIN vienmēr.
 * Stripe aizstāts - nekas netiek sūtīts.
 */
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ created: [] as Record<string, unknown>[] }));

vi.mock("@/lib/meta-capi", () => ({
  checkoutMetaClientFields: () => ({}),
  notifyMetaInitiateCheckout: async () => undefined,
  resolveInitiateCheckoutValueEur: () => 0,
  stripeMetaCapiMetadataFromRequest: () => ({}),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          state.created.push(params);
          return { id: "cs_test_1", url: "https://checkout.stripe.test/1", amount_total: 0 };
        },
      },
    },
  }),
}));

import { POST } from "@/app/api/checkout/test-pricing/route";
import { publicTestPricingPlanIds } from "@/lib/test-pricing-checkout-guard";
import { getTp5StripeCheckoutProduct } from "@/lib/test-pricing-5-inline-checkout";

const VIN = "WBAFF41030L065449";
let ipSeq = 0;

function post(body: Record<string, unknown>): Promise<Response> {
  ipSeq += 1;
  return POST(
    new Request("http://localhost/api/checkout/test-pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${ipSeq}` },
      body: JSON.stringify(body),
    }),
  );
}

const valid = { planId: "premium", locale: "lv", vin: VIN, withdrawalConsent: true, sourcePage: "home-pricing" };

beforeEach(() => {
  state.created.length = 0;
});

describe("test-pricing checkout robežas", () => {
  it("publisks plāns ar VIN, piekrišanu un zināmu avotu izveido sesiju ar ievadi metadatos", async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(state.created).toHaveLength(1);
    const params = state.created[0] as { metadata: Record<string, string>; consent_collection?: unknown };
    expect(params.metadata).toMatchObject({ vin: VIN, source_page: "home-pricing", withdrawal_waiver_ack: "true" });
  });

  it("paslēptais MINI (19,99 €) ar nezināmu avotu netiek pārdots", async () => {
    const res = await post({ planId: "mini", locale: "lv", sourcePage: "kaut-kas" });
    expect(res.status).toBe(404);
    expect(state.created).toHaveLength(0);
  });

  it("paslēptie plāni netiek pārdoti arī ar derīgu ievadi", async () => {
    for (const planId of ["mini", "plus", "koreaUsa"]) {
      const res = await post({ ...valid, planId });
      expect(res.status, planId).toBe(404);
    }
    expect(state.created).toHaveLength(0);
  });

  it("nezināms avots tiek noraidīts (agrāk Stripe lapa bez VIN pārbaudes)", async () => {
    const res = await post({ ...valid, sourcePage: "landing-x" });
    expect(res.status).toBe(400);
    expect(state.created).toHaveLength(0);
  });

  it("bez piekrišanas netiek izveidota sesija", async () => {
    const res = await post({ ...valid, withdrawalConsent: undefined });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("Apstiprini");
    expect(state.created).toHaveLength(0);
  });

  it("bez VIN vai ar nederīgu VIN netiek izveidota sesija", async () => {
    expect((await post({ ...valid, vin: "" })).status).toBe(400);
    expect((await post({ ...valid, vin: "ABC" })).status).toBe(400);
    expect(state.created).toHaveLength(0);
  });
});

describe("„no X €” teksti = lētākais publiskais produkts", () => {
  const cheapest = Math.min(
    ...publicTestPricingPlanIds().map((id) => getTp5StripeCheckoutProduct(id, "lv")?.amountCents ?? Infinity),
  );
  const lv = `${(cheapest / 100).toFixed(2).replace(".", ",")} €`;
  const en = `€${(cheapest / 100).toFixed(2)}`;

  const read = (locale: string, ns: string) =>
    JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", locale, `${ns}.json`), "utf8")) as Record<
      string,
      Record<string, string>
    >;

  it("lētākā publiskā cena ir 24,99 € (dīlera dati), MINI paslēpts", () => {
    expect(publicTestPricingPlanIds()).not.toContain("plus");
    expect(lv).toBe("24,99 €");
  });

  it.each(["lv", "ru", "de", "en"])("%s: hero, order un pricing CTA", (locale) => {
    const price = locale === "en" ? en : lv;
    const hero = read(locale, "hero");
    const heroCtas = Object.values(hero).flatMap((ns) =>
      typeof ns === "object" ? [ns.cta, ns.heroMobileOrderCta].filter(Boolean) : [],
    );
    const ctas = [...heroCtas, ...Object.values(read(locale, "order")).map((ns) => ns.heroOrderCta), ...Object.values(read(locale, "pricing")).map((ns) => ns.comparisonAuditCta)].filter(
      (v): v is string => typeof v === "string" && /\d/.test(v),
    );
    expect(ctas.length).toBeGreaterThanOrEqual(4);
    for (const cta of ctas) expect(cta).toContain(price);
  });
});

describe("Black Friday checkout (serveris nosaka cenu)", () => {
  const dealer = { ...valid, planId: "dealer" };

  it("slēdzis ieslēgts un laiks intervālā: dīlera dati 17,49 € ar promo=bf2026", async () => {
    vi.stubEnv("PROMO_BF_ENABLED", "1");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-28T10:00:00Z"));
    try {
      const res = await post({ ...dealer, promo: "none", unitAmount: 1 });
      expect(res.status).toBe(200);
      const params = state.created[0] as {
        line_items: Array<{ price_data?: { unit_amount: number } }>;
        metadata: Record<string, string>;
      };
      expect(params.line_items[0]?.price_data?.unit_amount).toBe(1749);
      expect(params.metadata.promo).toBe("bf2026");
      expect(params.metadata.checkout_line).toBe("dealer");
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });

  it("AUDITS akcijas laikā paliek parastajā cenā", async () => {
    vi.stubEnv("PROMO_BF_ENABLED", "1");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-28T10:00:00Z"));
    try {
      await post(valid);
      const params = state.created[0] as { line_items: Array<{ price_data?: { unit_amount: number } }>; metadata: Record<string, string> };
      expect(params.line_items[0]?.price_data?.unit_amount).toBe(9999);
      expect(params.metadata.promo).toBeUndefined();
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });

  it("slēdzis izslēgts vai pēc beigām: dīlera dati 24,99 €, bez promo", async () => {
    for (const [env, when] of [["", "2026-11-28T10:00:00Z"], ["1", "2026-12-02T10:00:00Z"]] as const) {
      state.created.length = 0;
      vi.stubEnv("PROMO_BF_ENABLED", env);
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(when));
      try {
        await post(dealer);
        const params = state.created[0] as { line_items: Array<{ price_data?: { unit_amount: number } }>; metadata: Record<string, string> };
        expect(params.line_items[0]?.price_data?.unit_amount, when).toBe(2499);
        expect(params.metadata.promo).toBeUndefined();
      } finally {
        vi.useRealTimers();
        vi.unstubAllEnvs();
      }
    }
  });

  it("klients nevar ielikt promo metadata caur sīkdatni/ķermeni", async () => {
    const res = await POST(
      new Request("http://localhost/api/checkout/test-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.9.9.9" },
        body: JSON.stringify({ ...dealer, metadata: { promo: "bf2026" } }),
      }),
    );
    expect(res.status).toBe(200);
    const params = state.created[0] as { metadata: Record<string, string> };
    expect(params.metadata.promo).toBeUndefined();
  });
});
