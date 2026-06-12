import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  CLIENT_COMMENT_CUSTOM_FIELD,
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
});
