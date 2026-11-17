import { describe, expect, it } from "vitest";
import { servissPatchAddition, servissPushMessage, servissScanAddition } from "@/lib/iriss-autoparks-v2-serviss-notify";
import { servissFileIds } from "@/lib/iriss-autoparks-v2-serviss";
import { emptyCarV2 } from "@/lib/iriss-autoparks-v2";
import { autoparksV2PermsFor } from "@/lib/iriss-autoparks-v2-perms";
import { servissSums } from "@/lib/iriss-autoparks-v2-serviss-store";

describe("Servisa paziņojumi Nilam (27.10)", () => {
  it("tikai pievienošana: jauns rēķins, rēķins ar roku, problēma, foto", () => {
    expect(servissPatchAddition({ addInvoice: { amountEur: "100" } })).toBe("manual_invoice");
    expect(servissPatchAddition({ problem: { text: "Spogulis" } })).toBe("problem");
    expect(servissPatchAddition({ problem: { id: "p1", fixedByService: true } })).toBeNull();
    expect(servissPatchAddition({ problem: { id: "p1", remove: true } })).toBeNull();
    expect(servissPatchAddition({ invoice: { id: "i1", amountEur: "5" } })).toBeNull();
    expect(servissScanAddition("invoice")).toBe("invoice");
    expect(servissScanAddition("problem_photo")).toBe("problem_photo");
    expect(servissScanAddition("diag")).toBeNull();
  });

  it("ziņo tikai tad, ja to izdarīja darbinieks (ne pats administrators); tikai adminam", () => {
    const msg = servissPushMessage({ actorKind: "staff", actorName: "Jānis", carId: "ap-1", what: "problem" });
    expect(msg?.body).toBe("Jānis pievienoja problēmu");
    expect(msg?.url).toBe("/admin/iriss/autoparks-v2/ap-1?t=serviss");
    expect(msg?.audience).toBe("pro");
    expect(servissPushMessage({ actorKind: "admin", actorName: "Nils", carId: "ap-1", what: "problem" })).toBeNull();
  });

  it("problēmas foto ir Servisa faili (atver tikai šī auto)", () => {
    const v2 = emptyCarV2();
    v2.service.problems.push({ id: "p1", text: "x", fixedByService: false, confirmedByUs: false, confirmedBy: "", at: "", photoIds: ["f-photo"] });
    v2.service.invoices.push({ id: "i1", fileId: "", extraFileIds: [], pages: 0, date: "2026-10-27", amountEur: 100, amountBy: "", amountAt: "", ai: null });
    const ids = servissFileIds(v2);
    expect(ids.has("f-photo")).toBe(true);
    expect(ids.has("")).toBe(false);
  });
});

describe("Servisa summas (Nils 27.10: redz un ievada visi ar Servisa piekļuvi)", () => {
  it("darbinieks ar Servisu, bez «Summas» tiesības", () => {
    expect(servissSums(autoparksV2PermsFor({ kind: "staff", sections: ["ap_serviss"] }, true))).toBe(true);
    expect(servissSums(autoparksV2PermsFor({ kind: "staff", sections: ["ap_pamatdati"] }, true))).toBe(false);
  });
});
