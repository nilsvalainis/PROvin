import { describe, expect, it } from "vitest";
import { formatIrissCommDateLeft, irissCommBubbleSide, irissCommTypeMatches } from "@/lib/iriss-order-comm-view";

describe("iriss order communication view", () => {
  it("splits stamp, sides bubbles and type-filters", () => {
    expect(formatIrissCommDateLeft("20.10 13:36")).toEqual({ date: "20.10", time: "13:36" });
    expect(irissCommBubbleSide({ status: "sent", title: "Nosūtīts WhatsApp", kind: "whatsapp" })).toBe("ours");
    expect(irissCommBubbleSide({ status: "answered", title: "Klienta atbilde", kind: "call" })).toBe("client");
    expect(irissCommTypeMatches({ status: "missed", title: "Neatzīmēts zvans" }, "missed")).toBe(true);
    expect(irissCommTypeMatches({ status: "sent", title: "Nosūtīts WhatsApp" }, "answered")).toBe(false);
  });
});
