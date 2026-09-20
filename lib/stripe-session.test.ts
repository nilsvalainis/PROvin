import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  CLIENT_COMMENT_CUSTOM_FIELD,
  getCheckoutIntakeCustomFields,
  getClientCommentCustomField,
  getHeardAboutCustomField,
  stripeCheckoutLocale,
  formatStripeCheckoutAddress,
  getCheckoutLineFromSession,
  getOrderFieldsFromSession,
} from "@/lib/stripe-session";

function sessionWith(opts: {
  metadata?: Record<string, string>;
  clientComment?: string;
  heardAbout?: string;
}): Stripe.Checkout.Session {
  const custom_fields: Array<Record<string, unknown>> = [];
  if (opts.heardAbout) {
    custom_fields.push({
      key: "heard_about",
      type: "dropdown",
      dropdown: { value: opts.heardAbout },
    });
  }
  if (opts.clientComment) {
    custom_fields.push({
      key: "client_comment",
      type: "text",
      text: { value: opts.clientComment },
    });
  }
  return {
    metadata: opts.metadata ?? {},
    custom_fields,
  } as unknown as Stripe.Checkout.Session;
}

describe("stripe-session — Komentārs un avots", () => {
  it("custom field config: optional text 'Komentārs'", () => {
    expect(CLIENT_COMMENT_CUSTOM_FIELD.key).toBe("client_comment");
    expect(CLIENT_COMMENT_CUSTOM_FIELD.label.custom).toBe("Komentārs");
    expect(CLIENT_COMMENT_CUSTOM_FIELD.optional).toBe(true);
    expect(CLIENT_COMMENT_CUSTOM_FIELD.type).toBe("text");
    expect(stripeCheckoutLocale()).toBe("lv");
    expect(stripeCheckoutLocale("lv")).toBe("lv");
    expect(stripeCheckoutLocale("en")).toBe("en");
    expect(stripeCheckoutLocale("de")).toBe("de");
    expect(stripeCheckoutLocale("ru")).toBe("ru");
    expect(getClientCommentCustomField("en").label.custom).toBe("Comment");
    expect(getClientCommentCustomField("de").label.custom).toBe("Kommentar");
  });

  it("heard-about dropdown has social options plus Cits, no audit purpose", () => {
    const field = getHeardAboutCustomField("lv");
    expect(field.key).toBe("heard_about");
    expect(field.type).toBe("dropdown");
    expect(field.optional).toBe(true);
    expect(field.label.custom).toBe("Kur uzzinājāt par mums?");
    expect(field.dropdown?.options.map((o) => o.value)).toEqual([
      "tiktok",
      "instagram",
      "facebook",
      "youtube",
      "google",
      "other",
    ]);
    expect(getCheckoutIntakeCustomFields("lv")).toHaveLength(2);
  });

  it("reads Stripe page comment into notes when form notes are empty", () => {
    const s = sessionWith({ clientComment: "VIN ir no tehniskās pases, ne sludinājuma." });
    expect(getOrderFieldsFromSession(s).notes).toBe("VIN ir no tehniskās pases, ne sludinājuma.");
  });

  it("prefixes heard-about into notes for the operator", () => {
    const s = sessionWith({
      heardAbout: "instagram",
      clientComment: "Pārbaudiet negadījumus.",
    });
    const fields = getOrderFieldsFromSession(s);
    expect(fields.heardAbout).toBe("Instagram");
    expect(fields.notes).toBe("Kur uzzināja: Instagram\n\nPārbaudiet negadījumus.");
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
