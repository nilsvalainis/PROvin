import { describe, expect, it } from "vitest";
import {
  IRISS_CAR_SHARE_BADGE,
  IRISS_CAR_SHARE_CREATED_NOTE,
  IRISS_CAR_SHARE_PATH_PREFIX,
  assertCarShareViewHasNoPrice,
  autoparksSaitesHref,
  buildIrissCarShareAdminView,
  buildIrissCarShareMessage,
  buildIrissCarShareWhatsAppUrl,
  carShareTextHasPrice,
  formatIrissCarShareDisplayUrl,
  formatIrissCarShareSentNote,
  formatPasutijumsSaitesSubtitle,
  formatSaitesDotLine,
  irissCarShareAbsoluteUrl,
  irissCarShareNote,
  irissCarSharePublicPath,
  irissCarShareStatusLabel,
  isIrissCarSharePath,
  isSafeIrissCarShareToken,
  logistikaSaitesHref,
  autoparksCarIdsByLogisticsOrder,
  logisticsSaitesCity,
  logisticsSaitesStatusShort,
  pasutijumsSaitesHref,
} from "@/lib/iriss-car-share";

describe("IRISS auto saite bez cenas", () => {
  it("uses /a and does not swallow /admin or /p", () => {
    expect(irissCarSharePublicPath("k7Q2xAb1")).toBe("/a/k7Q2xAb1");
    expect(IRISS_CAR_SHARE_PATH_PREFIX).toBe("/a");
    expect(isIrissCarSharePath("/a")).toBe(true);
    expect(isIrissCarSharePath("/a/k7Q2xAb1")).toBe(true);
    expect(isIrissCarSharePath("/admin")).toBe(false);
    expect(isIrissCarSharePath("/p/abc")).toBe(false);
    expect(isIrissCarSharePath("/lv/a/abc")).toBe(false);
    expect(irissCarShareAbsoluteUrl("https://www.provin.lv/", "k7Q2xAb1")).toBe("https://www.provin.lv/a/k7Q2xAb1");
  });

  it("rejects short and dotted tokens", () => {
    expect(isSafeIrissCarShareToken("k7Q2xAb")).toBe(false);
    expect(isSafeIrissCarShareToken("k7Q2xAb1")).toBe(true);
    expect(isSafeIrissCarShareToken("../secret1")).toBe(false);
  });

  it("shows Saite izveidota and Nosūtīts, always Bez cenas", () => {
    expect(irissCarShareStatusLabel("created")).toBe("Saite izveidota");
    expect(irissCarShareStatusLabel("sent")).toBe("Nosūtīts");
    const created = buildIrissCarShareAdminView({
      token: "k7Q2xAb1",
      status: "created",
      origin: "https://www.provin.lv",
    });
    expect(created.statusLabel).toBe("Saite izveidota");
    expect(created.badge).toBe(IRISS_CAR_SHARE_BADGE);
    expect(created.badge).toBe("Bez cenas");
    expect(created.note).toBe(IRISS_CAR_SHARE_CREATED_NOTE);
    expect(created.displayUrl).toBe("provin.lv/a/k7Q2xAb1");
    expect(assertCarShareViewHasNoPrice(created)).toBe(true);

    const sent = buildIrissCarShareAdminView({
      token: "k7Q2xAb1",
      status: "sent",
      origin: "https://iriss.lv",
      clientName: "Evita",
      sentAt: "2026-10-26T09:42:00.000Z",
      channel: "whatsapp",
      nowMs: Date.parse("2026-10-26T09:50:00.000Z"),
    });
    expect(sent.statusLabel).toBe("Nosūtīts");
    expect(sent.badge).toBe("Bez cenas");
    expect(sent.note).toBe("Evita · šodien 11:42 · WhatsApp");
    expect(sent.displayUrl).toBe("iriss.lv/a/k7Q2xAb1");
    expect(assertCarShareViewHasNoPrice(sent)).toBe(true);
  });

  it("formats sent note with a date when it is not today", () => {
    expect(
      formatIrissCarShareSentNote({
        clientName: "Evita",
        sentAt: "2026-10-25T09:42:00.000Z",
        channel: "whatsapp",
        nowMs: Date.parse("2026-10-26T09:50:00.000Z"),
      }),
    ).toBe("Evita · 25.10 11:42 · WhatsApp");
  });

  it("builds WhatsApp text without price and keeps Copy as a user action", () => {
    const text = buildIrissCarShareMessage({
      url: "https://www.provin.lv/a/k7Q2xAb1",
      vehicle: "VW Passat Variant",
    });
    expect(text).toContain("VW Passat Variant");
    expect(text).toContain("https://www.provin.lv/a/k7Q2xAb1");
    expect(carShareTextHasPrice(text)).toBe(false);
    expect(buildIrissCarShareWhatsAppUrl("", text)).toContain("https://wa.me/?text=");
    expect(buildIrissCarShareWhatsAppUrl("+37120000000", text)).toContain("https://wa.me/37120000000?text=");
    expect(irissCarShareNote({ status: "created" })).toContain("Cena netiek iekļauta");
  });

  it("builds Autoparks / Loģistika / Pasūtījums hrefs and subtitles", () => {
    expect(autoparksSaitesHref("ap-1")).toBe("/admin/iriss/autoparks-v2/ap-1");
    expect(logistikaSaitesHref("lo-1")).toBe("/admin/iriss/logistika?car=lo-1&view=map");
    expect(pasutijumsSaitesHref("ord-1")).toBe("/admin/iriss/pasutijumi/ord-1");
    expect(formatSaitesDotLine(["Ceļā", "Rīga"])).toBe("Ceļā · Rīga");
    expect(formatPasutijumsSaitesSubtitle("Evita", "Piedāvājums 1")).toBe("Evita · Piedāvājums 1");
    expect(logisticsSaitesStatusShort("in_transit_to_warehouse")).toBe("Ceļā");
    expect(logisticsSaitesCity("Rīga, Latvija", "")).toBe("Rīga");
    expect(logisticsSaitesCity("", "Venlo")).toBe("Venlo");
    expect(formatIrissCarShareDisplayUrl("https://www.iriss.lv/", "abc12345")).toBe("iriss.lv/a/abc12345");
    expect(IRISS_CAR_SHARE_CREATED_NOTE).not.toMatch(/[\u2013\u2014]/);
    expect(buildIrissCarShareMessage({ url: "https://x.lv/a/k7Q2xAb1", vehicle: "VW" })).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("Loģistika -> Autoparka auto (kravu plāna saite Kartīte)", () => {
  it("sasaista pēc orderId, citādi pēc VIN; bez sasaistes saites nav", () => {
    const orders = [
      { id: "lo-1", vin: "" },
      { id: "lo-2", vin: "wauzzz8k0fa036715" },
      { id: "lo-3", vin: "YV1DZ8256D2439274" },
    ];
    const cars = [
      { id: "ap-1", orderId: "lo-1", vin: "" },
      { id: "ap-2", orderId: "", vin: "WAUZZZ8K0FA036715" },
    ];
    expect(autoparksCarIdsByLogisticsOrder(orders, cars)).toEqual({ "lo-1": "ap-1", "lo-2": "ap-2" });
  });
});
