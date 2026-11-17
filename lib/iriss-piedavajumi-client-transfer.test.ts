import { describe, expect, it } from "vitest";

import { applyIrissPdPatch } from "@/lib/iriss-piedavajumi";
import { emptyIrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

const ctx = { by: "Nils", at: "2026-10-30T18:00:00.000Z", nowMs: Date.parse("2026-10-30T18:00:00.000Z") };
const client = { name: "Jauns Klients", phone: "+371 20000000", email: "", orderId: "" };

describe("Nils 30.10: piedāvājumu var pārnest klientam arī pēc saglabāšanas / nosūtīšanas", () => {
  it("nosūtītam piedāvājumam klientu var nomainīt", () => {
    const rec = { ...emptyIrissPiedavajums("pd-1", ctx.at), status: "sent" as const };
    const out = applyIrissPdPatch(rec, { client }, ctx);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.record.client.name).toBe("Jauns Klients");
  });

  it("beigušam / noraidītam - klientu var pārnest, citus laukus ne", () => {
    for (const status of ["expired", "declined"] as const) {
      const rec = { ...emptyIrissPiedavajums("pd-1", ctx.at), status };
      expect(applyIrissPdPatch(rec, { client }, ctx).ok).toBe(true);
      expect(applyIrissPdPatch(rec, { client, price: "9000" }, ctx).ok).toBe(false);
    }
  });

  it("apstiprinātam klientu mainīt nevar (tam jau rezervēts pasūtījums)", () => {
    const rec = { ...emptyIrissPiedavajums("pd-1", ctx.at), status: "approved" as const };
    expect(applyIrissPdPatch(rec, { client }, ctx).ok).toBe(false);
  });
});
