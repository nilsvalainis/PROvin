import { describe, expect, it } from "vitest";
import {
  buildIrissPdClientMessage,
  IRISS_PD_MARK_SENT_LV,
  irissPdMailtoHref,
  irissPdWhatsAppHref,
} from "@/lib/iriss-piedavajumi";
import { emptyIrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

const URL_ = "https://www.provin.lv/p/d/AbCdEfGhIjKlMnOpQrStUvWx";

function rec(title = "Volvo XC70 2.4 D5 AWD", validUntil = "2026-11-02") {
  const r = emptyIrissPiedavajums("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "2026-10-26T10:00:00.000Z");
  return { ...r, validUntil, vehicle: { ...r.vehicle, title } };
}

describe("PD «Nosūtīt» = melnraksts (Nils 20.11, A)", () => {
  it("poga tikai atzīmē nosūtītu", () => {
    expect(IRISS_PD_MARK_SENT_LV).toBe("Atzīmēt nosūtītu un kopēt saiti");
  });

  it("teksts latviski, ar saiti, termiņu un Dzintarzeme Auto zīmolu; bez PROVIN, garās defises un «eksperts»", () => {
    const m = buildIrissPdClientMessage(rec(), URL_);
    expect(m.subject).toBe("Dzintarzeme Auto piedāvājums - Volvo XC70 2.4 D5 AWD");
    expect(m.text).toContain("Labdien!");
    expect(m.text).toContain("Nosūtām Jums piedāvājumu: Volvo XC70 2.4 D5 AWD.");
    expect(m.text).toContain(`\n${URL_}\n`);
    expect(m.text).toContain("Piedāvājums spēkā līdz 02.11.2026.");
    expect(m.text.trim().endsWith("Ar cieņu,\nDzintarzeme Auto")).toBe(true);
    const all = `${m.subject}\n${m.text}`;
    // Saitē domēns paliek, bet tekstā PROVIN zīmols neparādās.
    expect(all.replace(URL_, "")).not.toMatch(/provin/i);
    expect(all).not.toMatch(/[—–]/);
    expect(all).not.toMatch(/eksperts/i);
  });

  it("bez modeļa un termiņa - īsāks teksts, bez tukšām vietām", () => {
    const m = buildIrissPdClientMessage(rec("", ""), URL_);
    expect(m.subject).toBe("Dzintarzeme Auto piedāvājums");
    expect(m.text).toContain("Nosūtām Jums piedāvājumu.");
    expect(m.text).not.toContain("spēkā līdz");
  });

  it("WhatsApp: wa.me ar numuru (tikai cipari) vai bez numura; teksts kodēts", () => {
    const m = buildIrissPdClientMessage(rec(), URL_);
    const wa = irissPdWhatsAppHref("+371 20 000 000", m);
    expect(wa.startsWith("https://wa.me/37120000000?text=")).toBe(true);
    expect(decodeURIComponent(wa.split("?text=")[1]!)).toBe(m.text);
    expect(irissPdWhatsAppHref("", m).startsWith("https://wa.me/?text=")).toBe(true);
  });

  it("E-pasts: mailto ar tematu un tekstu (adrese var būt tukša)", () => {
    const m = buildIrissPdClientMessage(rec(), URL_);
    const href = irissPdMailtoHref(" klients@example.com ", m);
    expect(href.startsWith("mailto:klients@example.com?subject=")).toBe(true);
    const q = new URLSearchParams(href.split("?")[1]);
    expect(q.get("subject")).toBe(m.subject);
    expect(q.get("body")).toBe(m.text);
    expect(irissPdMailtoHref("", m).startsWith("mailto:?subject=")).toBe(true);
  });
});
