import { describe, expect, it } from "vitest";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import {
  IRISS_CONTRACT_SELLER,
  irissContractAdvanceLines,
  irissContractFooterLines,
  irissContractSellerPartyLines,
  irissContractSignerName,
} from "@/lib/iriss-contract-party";

describe("iriss-contract-party", () => {
  it("uses the approved SIA ĪRISS details and signer without a title", () => {
    expect(IRISS_CONTRACT_SELLER.legalName).toBe("SIA ĪRISS");
    expect(IRISS_CONTRACT_SELLER.brand).toBe("Dzintarzeme Auto");
    expect(IRISS_CONTRACT_SELLER.regNo).toBe("59202001191");
    expect(IRISS_CONTRACT_SELLER.vatNo).toBe("LV59202001191");
    expect(IRISS_CONTRACT_SELLER.iban).toBe("LV75UNLA0050005241769");
    expect(irissContractSignerName()).toBe("Nils Valainis");
    const blob = [...irissContractSellerPartyLines(), ...irissContractFooterLines()].join("\n");
    expect(blob).toContain("Smilšu iela 19");
    expect(blob).toContain("UNLALV2X");
    expect(blob).not.toMatch(/[\u2013\u2014]/);
    expect(blob.toLowerCase()).not.toContain("valdes");
  });

  it("lists a paid advance toward commission with short hyphens only", () => {
    const rec = emptyIrissPasutijums("adv-1", "2026-10-17T10:00:00.000Z");
    rec.advance = { amount: "200", paidAt: "2026-10-17", method: "transfer", invoiceNo: "DZA-1" };
    const offer = emptyIrissOfferRecord("o1", rec.createdAt);
    offer.commissionFee = "1190";
    rec.offers = [offer];
    const lines = irissContractAdvanceLines(rec);
    expect(lines.join("\n")).toContain("Avanss: 200 €");
    expect(lines.join("\n")).toContain("ieskaitāms komisijas maksā");
    expect(lines.join("\n")).toContain("990 €");
    expect(lines.join("\n")).not.toMatch(/[\u2013\u2014]/);
  });
});
