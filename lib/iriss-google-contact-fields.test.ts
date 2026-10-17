import { describe, expect, it } from "vitest";
import {
  applyGoogleContactSync,
  clientContactFieldsChanged,
  orderHasClientContact,
  shouldSyncGoogleContact,
} from "@/lib/iriss-google-contact-fields";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { irissGoogleContactBadge } from "@/lib/iriss-google-contact-ui";

describe("google contact fields", () => {
  it("detects contact presence and changes", () => {
    const empty = emptyIrissPasutijums("id", "2026-10-17T00:00:00.000Z");
    expect(orderHasClientContact(empty)).toBe(false);
    const withPhone = { ...empty, phone: "+37120000000" };
    expect(orderHasClientContact(withPhone)).toBe(true);
    expect(clientContactFieldsChanged(empty, withPhone)).toBe(true);
    expect(shouldSyncGoogleContact(empty, withPhone)).toBe(true);
    const saved = { ...withPhone, googleContactResourceName: "people/1", googleContactStatus: "saved" as const };
    expect(shouldSyncGoogleContact(saved, saved)).toBe(false);
    expect(shouldSyncGoogleContact(saved, { ...saved, phone: "+37121111111" })).toBe(true);
  });

  it("applies sync result without leftover error", () => {
    const rec = emptyIrissPasutijums("id", "2026-10-17T00:00:00.000Z");
    rec.googleContactError = "old";
    const next = applyGoogleContactSync(rec, { status: "saved", resourceName: "people/1" }, "2026-10-17T12:00:00.000Z");
    expect(next.googleContactStatus).toBe("saved");
    expect(next.googleContactResourceName).toBe("people/1");
    expect(next.googleContactError).toBeUndefined();
  });

  it("builds the Latvian badge", () => {
    expect(irissGoogleContactBadge({ configured: false, hasContact: true })?.text).toBe("Nav konfigurēts");
    expect(irissGoogleContactBadge({ configured: true, hasContact: true, status: "saved" })?.text).toBe(
      "Saglabāts Google kontaktos",
    );
    expect(irissGoogleContactBadge({ configured: true, hasContact: true, status: "error" })?.text).toBe("Kļūda");
    expect(irissGoogleContactBadge({ configured: true, hasContact: true })).toBeNull();
    expect(irissGoogleContactBadge({ configured: true, hasContact: false })).toBeNull();
  });
});
