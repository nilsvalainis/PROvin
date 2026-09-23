import { describe, expect, it } from "vitest";

import { emptyVendorAvotuBlock } from "@/lib/admin-source-blocks";
import { fillVendorAiContextIfEmpty } from "@/lib/vendor-ai-context-fill";

describe("fillVendorAiContextIfEmpty", () => {
  it("stores the report text when the AI context is empty and keeps operator text", () => {
    const filled = fillVendorAiContextIfEmpty(emptyVendorAvotuBlock(), "AutoDNA report body");
    expect(filled.aiContextRaw).toBe("AutoDNA report body");
    const kept = fillVendorAiContextIfEmpty(
      { ...emptyVendorAvotuBlock(), aiContextRaw: "operatora piezīme" },
      "AutoDNA report body",
    );
    expect(kept.aiContextRaw).toBe("operatora piezīme");
  });
});
