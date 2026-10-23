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
    expect(waybillPushMessage({ status: "queued" }, { ...after, status: "in_progress" })).toBeNull();
  });
});
