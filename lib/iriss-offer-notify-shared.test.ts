import { describe, expect, it } from "vitest";
import {
  buildIrissOfferDecisionEmail,
  buildIrissOfferQuestionEmail,
  irissOfferClientShortName,
  irissOfferDecisionPushMessage,
  irissOfferExpiredPushMessage,
  irissOfferQuestionPushMessage,
} from "@/lib/iriss-offer-notify-shared";

const facts = {
  orderId: "11111111-1111-4111-8111-111111111111",
  offerId: "22222222-2222-4222-8222-222222222222",
  vehicle: "BMW X5 xDrive30d",
  vin: "WBA00000000A12345",
  clientFirstName: "Jānis",
  clientLastName: "Bērziņš",
  total: "38 900 €",
  deadlineAt: "2026-10-26T16:00:00.000Z",
};

describe("IRISS offer notifications", () => {
  it("builds the e-mail for Nils with decision, time, client, car, sum and deadline", () => {
    const mail = buildIrissOfferDecisionEmail(facts, "approve", "2026-10-23T19:15:00.000Z", "https://www.provin.lv/");
    expect(mail.subject).toBe("Piedāvājums apstiprināts: BMW X5 xDrive30d");
    expect(mail.lines).toEqual([
      { label: "Lēmums", value: "Apstiprināts" },
      { label: "Laiks", value: "23.10.2026 22:15" },
      { label: "Klients", value: "Jānis B." },
      { label: "Auto", value: "BMW X5 xDrive30d · VIN …A12345" },
      { label: "Summa", value: "38 900 €" },
      { label: "Termiņš", value: "26.10.2026 18:00" },
    ]);
    expect(mail.url).toBe("https://www.provin.lv/admin/iriss/pasutijumi/11111111-1111-4111-8111-111111111111");
    expect(mail.text).toContain("Atvērt pasūtījumu: https://www.provin.lv/admin/iriss/pasutijumi/");
    expect(mail.text).not.toMatch(/[–—]/);
  });

  it("skips empty lines for old offers without a deadline", () => {
    const mail = buildIrissOfferDecisionEmail({ ...facts, deadlineAt: "", total: "" }, "decline", "2026-10-23T19:15:00.000Z", "https://www.provin.lv");
    expect(mail.subject).toBe("Piedāvājums noraidīts: BMW X5 xDrive30d");
    expect(mail.lines.map((l) => l.label)).toEqual(["Lēmums", "Laiks", "Klients", "Auto"]);
  });

  it("keeps the client name and phone off the lock screen", () => {
    const approved = irissOfferDecisionPushMessage(facts, "approve");
    expect(approved).toEqual({
      title: "Piedāvājums apstiprināts",
      body: "BMW X5 xDrive30d · …A12345",
      url: "/admin/iriss/pasutijumi/11111111-1111-4111-8111-111111111111",
      tag: "offer-22222222-2222-4222-8222-222222222222",
      audience: "iriss",
    });
    const expired = irissOfferExpiredPushMessage(facts);
    expect(expired.title).toBe("Piedāvājuma termiņš beidzies");
    expect(JSON.stringify([approved, expired])).not.toContain("Jānis");
  });

  it("shortens the client name", () => {
    expect(irissOfferClientShortName("Jānis", "Bērziņš")).toBe("Jānis B.");
    expect(irissOfferClientShortName("", "Ēvalds")).toBe("Ē.");
    expect(irissOfferClientShortName(" Anna ", "")).toBe("Anna");
  });

  it("j41 F5: builds the e-mail for Nils with the question text, client, car and sum", () => {
    const mail = buildIrissOfferQuestionEmail(facts, "Vai iespējams piegādāt uz Liepāju?", "https://www.provin.lv/");
    expect(mail.subject).toBe("Jautājums par piedāvājumu: BMW X5 xDrive30d");
    expect(mail.question).toBe("Vai iespējams piegādāt uz Liepāju?");
    expect(mail.lines).toEqual([
      { label: "Klients", value: "Jānis B." },
      { label: "Auto", value: "BMW X5 xDrive30d · VIN …A12345" },
      { label: "Summa", value: "38 900 €" },
    ]);
    expect(mail.url).toBe("https://www.provin.lv/admin/iriss/pasutijumi/11111111-1111-4111-8111-111111111111");
    expect(mail.text).toContain("Vai iespējams piegādāt uz Liepāju?");
    expect(mail.text).toContain("Atvērt pasūtījumu: https://www.provin.lv/admin/iriss/pasutijumi/");
  });

  it("j41 F5: question push keeps the client name and question text off the lock screen", () => {
    const push = irissOfferQuestionPushMessage(facts);
    expect(push).toEqual({
      title: "Jautājums par piedāvājumu",
      body: "BMW X5 xDrive30d · …A12345",
      url: "/admin/iriss/pasutijumi/11111111-1111-4111-8111-111111111111",
      tag: "offer-22222222-2222-4222-8222-222222222222",
      audience: "iriss",
    });
  });
});
