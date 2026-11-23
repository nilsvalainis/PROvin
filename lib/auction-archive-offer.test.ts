import { describe, expect, it } from "vitest";
import {
  applyAuctionArchiveChoice,
  auctionArchiveAdminNotice,
  auctionArchiveOfferForAdmin,
  auctionArchiveRewritePath,
  buildAuctionArchiveSummary,
  formatEurCents,
  formatKm,
  isAuctionArchiveEligible,
  isAuctionArchivePath,
  isAuctionArchiveReminderDue,
  lvCount,
  markAuctionArchiveRefunded,
  markAuctionArchiveReminded,
  markAuctionArchiveSent,
  parseAuctionArchiveOfferDoc,
  sanitizeManualSources,
  withdrawAuctionArchiveOffer,
  type AuctionArchiveOfferDoc,
} from "@/lib/auction-archive-offer";
import { isPublicSiteAnalyticsPath } from "@/lib/analytics-public-scope";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

const TOKEN = "A".repeat(43);
const ph = (n: number) => `ih_ph_${String(n).padStart(24, "0")}`;

function rec(over: Partial<ThecarapiAdminRecord>): ThecarapiAdminRecord {
  return {
    site: "openlane",
    id: "1",
    date: "2026-10-21",
    venue: "Openlane",
    photoDate: "2026-10-21",
    photoUrls: [],
    fields: [],
    raw: null,
    rawHistory: null,
    rawDetail: null,
    rawImages: null,
    photos: [],
    ...over,
  };
}

const NOW = Date.parse("2026-11-23T09:14:00Z");

function doc(over: Partial<AuctionArchiveOfferDoc> = {}): AuctionArchiveOfferDoc {
  return {
    sessionId: "cs_test_1",
    status: "pending",
    tokenHash: "a".repeat(64),
    createdAt: new Date(NOW).toISOString(),
    expiresAt: new Date(NOW + 30 * 864e5).toISOString(),
    locale: "lv",
    channel: "email",
    paidCents: 2499,
    summary: { vin: "WAUZZZF43PA018831", title: "Audi A4 Avant 40 TDI", auctions: [], photoCount: 84, manualSources: [] },
    photos: [{ id: ph(1), auctionKey: "openlane:1", date: "2026-10-21", caption: "Openlane · 2026-10-21" }],
    photosMissing: 0,
    previewIds: [ph(1)],
    history: [],
    ...over,
  };
}

describe("izsoļu arhīva ceļi", () => {
  it("pārraksta publisko ceļu, nederīgs tokens → neitrālā lapa", () => {
    expect(auctionArchiveRewritePath(`/lv/izvele/${TOKEN}`)).toBe(`/izsoles-izvele/lv/${TOKEN}`);
    expect(auctionArchiveRewritePath(`/en/izvele/${TOKEN}/`)).toBe(`/izsoles-izvele/en/${TOKEN}`);
    expect(auctionArchiveRewritePath("/lv/izvele/../../admin")).toBeNull();
    expect(auctionArchiveRewritePath("/lv/izvele/short")).toBe("/izsoles-izvele/lv/x");
    expect(auctionArchiveRewritePath("/lv/izveles-lapa")).toBeNull();
    expect(auctionArchiveRewritePath("/xx/izvele/abc")).toBeNull();
  });

  it("tokens URL nenonāk analītikā", () => {
    expect(isAuctionArchivePath(`/lv/izvele/${TOKEN}`)).toBe(true);
    expect(isAuctionArchivePath(`/api/izvele/${TOKEN}/foto/0`)).toBe(true);
    expect(isAuctionArchivePath(`/izsoles-izvele/lv/${TOKEN}`)).toBe(true);
    expect(isPublicSiteAnalyticsPath(`/lv/izvele/${TOKEN}`)).toBe(false);
    expect(isPublicSiteAnalyticsPath("/lv")).toBe(true);
  });
});

describe("kopsavilkums no bloka", () => {
  it("izsoles hronoloģiski, km/cena/valsts, bildes bez dublikātiem", () => {
    const s = buildAuctionArchiveSummary({
      vin: "WAUZZZF43PA018831",
      title: "Audi A4 Avant 40 TDI",
      countryName: (c) => (c === "IT" ? "Itālija (IT)" : c),
      block: {
        thecarapiRecords: [
          rec({
            site: "bca",
            id: "b2",
            photoDate: "2026-10-22",
            fields: [
              { key: "mileage", label: "", value: "193320" },
              { key: "public_price_eur", label: "", value: "12410" },
              { key: "country", label: "", value: "IT" },
            ],
          }),
          rec({
            id: "o1",
            photoDate: "2026-10-21",
            photoUrls: ["https://cdn/a.jpg", "https://cdn/b.jpg"],
            photos: [{ id: ph(1), sourceUrl: "https://cdn/a.jpg", contentHash: "h1", date: "", venue: "", caption: "" }],
            fields: [
              { key: "odometer", label: "", value: "193.320 km" },
              { key: "final_price", label: "", value: "13 070,00" },
              { key: "country", label: "", value: "Itālija" },
            ],
          }),
        ],
        // Pasūtījuma kopija tai pašai TheCarApi bildei + viena manuāla (checkcar.vin).
        photoGroups: [
          { id: "g1", title: "TheCarApi · Openlane", photos: [{ id: ph(9), sourceUrl: "https://cdn/a.jpg", contentHash: "h1" }] },
          { id: "g2", title: "checkcar.vin 12.05.2024", photos: [{ id: ph(10) }] },
        ],
      },
    });
    expect(s.auctions.map((a) => a.platform)).toEqual(["Openlane", "BCA"]);
    expect(s.auctions[0]).toMatchObject({ date: "2026-10-21", km: 193320, priceEur: 13070, country: "Itālija", photos: 2 });
    expect(s.auctions[1]).toMatchObject({ km: 193320, priceEur: 12410, country: "Itālija", photos: 0 });
    expect(s.photoCount).toBe(3);
    expect(isAuctionArchiveEligible(s)).toBe(true);
  });

  it("tukšs bloks - situācija nav redzama; manuāls avots - ir", () => {
    const empty = buildAuctionArchiveSummary({ vin: "X", title: "", block: { thecarapiRecords: [], photoGroups: [] } });
    expect(isAuctionArchiveEligible(empty)).toBe(false);
    const manual = buildAuctionArchiveSummary({
      vin: "X",
      title: "",
      block: null,
      manualSources: sanitizeManualSources([{ kind: "link", url: "https://checkcar.vin/r/1" }]),
    });
    expect(isAuctionArchiveEligible(manual)).toBe(true);
    expect(manual.manualSources[0]).toEqual({ kind: "link", label: "checkcar.vin", url: "https://checkcar.vin/r/1" });
  });

  it("manuālie avoti: tikai https, bez HTML", () => {
    const out = sanitizeManualSources([
      { kind: "link", url: "javascript:alert(1)", label: "" },
      { kind: "pdf", label: "<b>CheckCar</b> PDF" },
      { kind: "x", label: "a" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe("pdf");
    expect(sanitizeManualSources([{ kind: "pdf", label: "<b>CheckCar</b> PDF" }])[0]!.label).not.toMatch(/[<>]/);
  });
});

describe("izvēles stāvokļi", () => {
  it("saite: izvēle → mainīt → tā pati vēlreiz bez izmaiņām", () => {
    const a = applyAuctionArchiveChoice(doc(), "archive", "link", NOW + 1000);
    expect(a.ok && a.changed && a.doc.status).toBe("chose_archive");
    if (!a.ok) throw new Error("x");
    expect(a.doc.history.at(-1)).toMatchObject({ event: "choice", choice: "archive" });
    const same = applyAuctionArchiveChoice(a.doc, "archive", "link", NOW + 2000);
    expect(same.ok && same.changed).toBe(false);
    const b = applyAuctionArchiveChoice(a.doc, "refund", "link", NOW + 3000);
    expect(b.ok && b.doc.status).toBe("chose_refund");
  });

  it("pēc PDF nosūtīšanas / atmaksas / atsaukšanas mainīt nevar", () => {
    expect(applyAuctionArchiveChoice(markAuctionArchiveSent(doc()), "refund", "link", NOW)).toEqual({ ok: false, error: "closed" });
    expect(applyAuctionArchiveChoice(markAuctionArchiveRefunded(doc()), "archive", "manual", NOW)).toEqual({ ok: false, error: "closed" });
    expect(applyAuctionArchiveChoice(withdrawAuctionArchiveOffer(doc()), "archive", "link", NOW)).toEqual({ ok: false, error: "closed" });
  });

  it("beigusies saite: klients nevar, Nils manuāli var", () => {
    const old = doc({ expiresAt: new Date(NOW - 1).toISOString() });
    expect(applyAuctionArchiveChoice(old, "archive", "link", NOW)).toEqual({ ok: false, error: "expired" });
    const m = applyAuctionArchiveChoice(old, "archive", "manual", NOW);
    expect(m.ok && m.doc.choiceVia).toBe("manual");
  });

  it("atgādinājums Nilam pēc 3 dienām, vienreiz, tikai «gaida»", () => {
    const d = doc();
    expect(isAuctionArchiveReminderDue(d, NOW + 2.9 * 864e5)).toBe(false);
    expect(isAuctionArchiveReminderDue(d, NOW + 3 * 864e5)).toBe(true);
    expect(isAuctionArchiveReminderDue(markAuctionArchiveReminded(d, NOW + 3 * 864e5), NOW + 5 * 864e5)).toBe(false);
    const chose = applyAuctionArchiveChoice(d, "archive", "link", NOW);
    expect(chose.ok && isAuctionArchiveReminderDue(chose.doc, NOW + 5 * 864e5)).toBe(false);
  });
});

describe("dokuments", () => {
  it("parse: cits sessionId / bojāts hešs → null; svešas bildes ID izmet", () => {
    const d = doc({ previewIds: [ph(1), "../x"] });
    const raw = JSON.parse(JSON.stringify(d));
    expect(parseAuctionArchiveOfferDoc(raw, "cs_cits")).toBeNull();
    expect(parseAuctionArchiveOfferDoc({ ...raw, tokenHash: "zz" }, d.sessionId)).toBeNull();
    const back = parseAuctionArchiveOfferDoc(raw, d.sessionId)!;
    expect(back.previewIds).toEqual([ph(1)]);
    expect(back.summary.title).toBe("Audi A4 Avant 40 TDI");
  });

  it("admin skatā nav tokena heša", () => {
    const pub = auctionArchiveOfferForAdmin(doc());
    expect(JSON.stringify(pub)).not.toContain("a".repeat(64));
    expect(pub.statusLabel).toBe("Gaida klienta izvēli");
    expect(auctionArchiveOfferForAdmin(doc({ status: "chose_refund" })).tone).toBe("alert");
  });

  it("paziņojumi Nilam", () => {
    expect(auctionArchiveAdminNotice({ kind: "choice", choice: "archive", title: "Audi A4", vin: "WAUZZZF43PA018831" })).toEqual({
      title: "Klients izvēlējās izsoļu arhīvu",
      body: "Audi A4 · WAUZZZF43PA018831 - jāsūta PDF",
    });
    expect(auctionArchiveAdminNotice({ kind: "choice", choice: "refund", title: "", vin: "V", refundLabel: "24,99 €" }).body).toBe(
      "V - jāatmaksā 24,99 €",
    );
    expect(auctionArchiveAdminNotice({ kind: "reminder", title: "", vin: "V" }).title).toBe("Klients 3 dienas nav izvēlējies");
  });

  it("formāti", () => {
    expect(formatEurCents(2499)).toBe("24,99 €");
    expect(formatKm(193320)).toBe("193 320 km");
    expect(lvCount(1, "izsole", "izsoles")).toBe("1 izsole");
    expect(lvCount(11, "izsole", "izsoles")).toBe("11 izsoles");
    expect(lvCount(21, "bilde", "bildes")).toBe("21 bilde");
  });
});
