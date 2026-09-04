import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  CLIENT_COMMENT_CUSTOM_FIELD,
  formatStripeCheckoutAddress,
  getCheckoutLineFromSession,
  getOrderFieldsFromSession,
} from "@/lib/stripe-session";

function sessionWith(opts: {
  metadata?: Record<string, string>;
  clientComment?: string;
}): Stripe.Checkout.Session {
  return {
    metadata: opts.metadata ?? {},
    custom_fields: opts.clientComment
      ? [
          {
            key: "client_comment",
            type: "text",
            text: { value: opts.clientComment },
          },
        ]
      : [],
  } as unknown as Stripe.Checkout.Session;
}

describe("stripe-session — Klienta komentārs", () => {
  it("custom field config: optional text 'Klienta komentārs'", () => {
    expect(CLIENT_COMMENT_CUSTOM_FIELD.key).toBe("client_comment");
    expect(CLIENT_COMMENT_CUSTOM_FIELD.label.custom).toBe("Klienta komentārs");
    expect(CLIENT_COMMENT_CUSTOM_FIELD.optional).toBe(true);
    expect(CLIENT_COMMENT_CUSTOM_FIELD.type).toBe("text");
  });

  it("reads Stripe page comment into notes when form notes are empty", () => {
    const s = sessionWith({ clientComment: "VIN ir no tehniskās pases, ne sludinājuma." });
    expect(getOrderFieldsFromSession(s).notes).toBe("VIN ir no tehniskās pases, ne sludinājuma.");
  });

  it("merges form notes with Stripe page comment", () => {
    const s = sessionWith({
      metadata: { notes: "Formas piezīme." },
      clientComment: "Papildu komentārs no Stripe lapas.",
    });
    expect(getOrderFieldsFromSession(s).notes).toBe(
      "Formas piezīme.\n\nPapildu komentārs no Stripe lapas.",
    );
  });

  it("keeps plain form notes when no Stripe comment entered", () => {
    const s = sessionWith({ metadata: { notes: "Tikai formas piezīme." } });
    expect(getOrderFieldsFromSession(s).notes).toBe("Tikai formas piezīme.");
    expect(getOrderFieldsFromSession(sessionWith({})).notes).toBeNull();
  });

  it("reads company requisites from metadata for the invoice", () => {
    const s = sessionWith({
      metadata: {
        company_name: "SIA Demo Auto",
        company_reg: "40103123456",
        company_address: "Brīvības iela 1, Rīga",
        customer_name: "Jānis Bērziņš",
      },
    });
    const fields = getOrderFieldsFromSession(s);
    expect(fields.companyName).toBe("SIA Demo Auto");
    expect(fields.companyReg).toBe("40103123456");
    expect(fields.companyAddress).toBe("Brīvības iela 1, Rīga");
    expect(fields.customerName).toBe("Jānis Bērziņš");
  });
});

describe("stripe-session - checkout line", () => {
  it("reads business and dealer partner lines", () => {
    expect(getCheckoutLineFromSession(sessionWith({ metadata: { checkout_line: "business" } }))).toBe(
      "business",
    );
    expect(getCheckoutLineFromSession(sessionWith({ metadata: { checkout_line: "dealer" } }))).toBe(
      "dealer",
    );
  });
});

describe("stripe-session — billing address", () => {
  it("formats Stripe checkout address as one line", () => {
    expect(
      formatStripeCheckoutAddress({
        line1: "Brīvības iela 1",
        line2: "",
        city: "Rīga",
        postal_code: "LV-1010",
        country: "LV",
        state: "",
      }),
    ).toBe("Brīvības iela 1, LV-1010 Rīga, LV");
  });
});
