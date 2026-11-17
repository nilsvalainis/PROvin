import { describe, expect, it } from "vitest";
import { waybillPushMessage, waybillPushUserKey } from "@/lib/iriss-waybill-push";

const after = {
  id: "wbr_1",
  status: "issued" as const,
  vehicle: { brandModel: "BMW 216d", vin: "", plate: "B1937", orderId: "" },
  validUntil: "2026-10-25T10:00:00.000Z",
  errorReason: "",
};

describe("pavadzīmes push paziņojums", () => {
  it("izrakstīta: virsraksts, auto, numurs, derīgums; tikai pieprasītāja ierīcēm", () => {
    const msg = waybillPushMessage({ status: "in_progress" }, after);
    expect(msg).toEqual({
      title: "Pavadzīme izdota",
      body: "BMW 216d · B193-7 · derīga līdz 25.10.2026, 12:00. Atver PDF.",
      url: "/admin/iriss/pavadzimes",
      tag: "waybill-wbr_1",
      audience: "iriss",
    });
    expect(waybillPushUserKey("usr_7")).toBe("staff:usr_7");
    expect(waybillPushUserKey("env-admin")).toBe("admin");
  });

  it("kļūda un kļūda pēc saglabāšanas; bez statusa maiņas - nekā", () => {
    const err = waybillPushMessage({ status: "in_progress" }, { ...after, status: "error", errorReason: "CSDD nav pieejams" });
    expect(err?.title).toBe("Pavadzīme nav izdota");
    expect(err?.body).toBe('BMW 216d · B193-7: CSDD nav pieejams. Atver un spied "Atkārtot".');
    const check = waybillPushMessage(
      { status: "in_progress" },
      { ...after, status: "error", errorReason: "Automātika: x. Pārbaudi CSDD, vai pavadzīme izveidota." },
    );
    expect(check?.title).toBe("Pārbaudi pavadzīmi");
    expect(waybillPushMessage({ status: "issued" }, after)).toBeNull();
    const stopped = waybillPushMessage({ status: "in_progress" }, { ...after, kind: "stop" });
    expect(stopped?.title).toBe("Pavadzīme pārtraukta");
    expect(stopped?.body).toContain("Numurs atbrīvots");
    expect(waybillPushMessage({ status: "queued" }, { ...after, status: "in_progress" })).toBeNull();
  });
});

describe("14.11: atcelta, bet CSDD varbūt saglabāja", () => {
  it("atcelta pavadzīme tomēr izdota - sava ziņa, iet arī Nilam", async () => {
    const { waybillPushIsMaybeSaved, waybillPushRecipients } = await import("@/lib/iriss-waybill-push");
    const msg = waybillPushMessage({ status: "cancelled" }, after);
    expect(msg?.title).toBe("Atcelta pavadzīme tomēr izdota");
    expect(waybillPushIsMaybeSaved({ status: "cancelled" }, after)).toBe(true);
    expect(waybillPushIsMaybeSaved({ status: "in_progress" }, after)).toBe(false);
    expect(waybillPushRecipients("usr_7", true)).toEqual(["staff:usr_7", "admin"]);
    expect(waybillPushRecipients("usr_7", false)).toEqual(["staff:usr_7"]);
  });
  it("kļūda 'Pārbaudi CSDD' iet arī Nilam, parasta kļūda - nē", async () => {
    const { waybillPushIsMaybeSaved } = await import("@/lib/iriss-waybill-push");
    expect(waybillPushIsMaybeSaved({ status: "in_progress" }, { status: "error", errorReason: "Pārbaudi CSDD, vai izveidota." })).toBe(true);
    expect(waybillPushIsMaybeSaved({ status: "in_progress" }, { status: "error", errorReason: "CSDD nav pieejams" })).toBe(false);
  });
  it("atcelšana CSDD saglabāšanas solī - ziņa; gaidošam vai citā solī - nē", async () => {
    const { waybillCancelMaybeSavedMessage } = await import("@/lib/iriss-waybill-push");
    const v = after.vehicle;
    expect(waybillCancelMaybeSavedMessage({ id: "wbr_1", status: "in_progress", stage: "saving", vehicle: v })?.title).toBe(
      "Atcelta, bet varbūt jau saglabāta",
    );
    expect(waybillCancelMaybeSavedMessage({ id: "wbr_1", status: "in_progress", stage: "filling", vehicle: v })).toBeNull();
    expect(waybillCancelMaybeSavedMessage({ id: "wbr_1", status: "queued", stage: "", vehicle: v })).toBeNull();
  });
});
