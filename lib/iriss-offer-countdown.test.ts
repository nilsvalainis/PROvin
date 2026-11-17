import { describe, expect, it } from "vitest";
import {
  formatOfferDeadlineUntilLv,
  lvCountWord,
  offerClockSkewMs,
  offerCountdown,
  offerCountdownSpokenLv,
  offerCountdownTickMs,
} from "@/lib/iriss-offer-countdown";

const DEADLINE = Date.parse("2026-10-26T16:00:00.000Z"); // 26.10.2026 18:00 Rīgā

describe("offer countdown", () => {
  it("shows days / hours / minutes when 24 h or more is left", () => {
    const now = DEADLINE - (2 * 86_400_000 + 20 * 3_600_000 + 46 * 60_000 + 30_000);
    const c = offerCountdown(DEADLINE, now);
    expect(c.mode).toBe("days");
    expect(c.cells).toEqual([
      { value: "2", label: "dienas" },
      { value: "20", label: "stundas" },
      { value: "46", label: "minūtes" },
    ]);
  });

  it("switches to hours / minutes / seconds under 24 h", () => {
    const now = DEADLINE - (3 * 3_600_000 + 42 * 60_000 + 15_000);
    const c = offerCountdown(DEADLINE, now);
    expect(c.mode).toBe("hours");
    expect(c.cells.map((x) => x.value)).toEqual(["03", "42", "15"]);
    expect(offerCountdown(DEADLINE, DEADLINE - 86_400_000).mode).toBe("days");
    expect(offerCountdown(DEADLINE, DEADLINE - 86_400_000 + 1).mode).toBe("hours");
  });

  it("expires exactly at the deadline", () => {
    expect(offerCountdown(DEADLINE, DEADLINE - 1).mode).toBe("hours");
    expect(offerCountdown(DEADLINE, DEADLINE).mode).toBe("expired");
    expect(offerCountdownTickMs(DEADLINE, DEADLINE)).toBe(0);
  });

  it("uses Latvian singular for 1, 21 but not 11", () => {
    expect(lvCountWord(1, "diena", "dienas")).toBe("diena");
    expect(lvCountWord(21, "stunda", "stundas")).toBe("stunda");
    expect(lvCountWord(11, "minūte", "minūtes")).toBe("minūtes");
    expect(lvCountWord(0, "sekunde", "sekundes")).toBe("sekundes");
  });

  it("ticks once a minute in day mode and once a second near the end", () => {
    const dayNow = DEADLINE - (3 * 86_400_000 + 30_000);
    expect(offerCountdownTickMs(DEADLINE, dayNow)).toBe(30_000);
    const hourNow = DEADLINE - (5 * 3_600_000 + 400);
    expect(offerCountdownTickMs(DEADLINE, hourNow)).toBe(400);
  });

  it("says today or the date in Riga time", () => {
    expect(formatOfferDeadlineUntilLv("2026-10-26T16:00:00.000Z", Date.parse("2026-10-26T06:00:00.000Z"))).toBe("līdz šodien 18:00");
    expect(formatOfferDeadlineUntilLv("2026-10-26T16:00:00.000Z", Date.parse("2026-10-23T06:00:00.000Z"))).toBe("līdz 26.10.2026 18:00");
    // 22:30Z 25.10 jau ir 26.10 Rīgā
    expect(formatOfferDeadlineUntilLv("2026-10-26T16:00:00.000Z", Date.parse("2026-10-25T22:30:00.000Z"))).toBe("līdz šodien 18:00");
  });

  it("counts from the server clock, not the phone clock", () => {
    const skew = offerClockSkewMs("2026-10-26T12:00:00.000Z", Date.parse("2026-10-26T13:00:00.000Z"));
    expect(skew).toBe(-3_600_000);
    const c = offerCountdown(DEADLINE, Date.parse("2026-10-26T13:00:00.000Z") + skew);
    expect(c.cells.map((x) => x.value)).toEqual(["04", "00", "00"]);
    expect(offerClockSkewMs("", 123)).toBe(0);
  });

  it("speaks only minutes to screen readers", () => {
    const c = offerCountdown(DEADLINE, DEADLINE - (3 * 3_600_000 + 42 * 60_000 + 15_000));
    expect(offerCountdownSpokenLv(c)).toBe("Piedāvājums spēkā vēl 3 stundas 42 minūtes");
    expect(offerCountdownSpokenLv(offerCountdown(DEADLINE, DEADLINE))).toBe("Piedāvājuma termiņš beidzies");
  });
});
