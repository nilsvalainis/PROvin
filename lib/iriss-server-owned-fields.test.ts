import { describe, expect, it } from "vitest";
import { mergeServerOwnedIrissFields } from "@/lib/iriss-server-owned-fields";

describe("mergeServerOwnedIrissFields", () => {
  it("keeps server PDFs and google fields on the local draft", () => {
    const local = {
      workspaceRevision: 1,
      generatedDocuments: [],
      brand: "x",
    };
    const server = {
      workspaceRevision: 4,
      generatedDocuments: [
        {
          id: "d1",
          kind: "contract" as const,
          name: "līgums.pdf",
          mimeType: "application/pdf",
          size: 10,
          createdAt: "2026-10-17T10:00:00.000Z",
          blobPath: "docs/d1.pdf",
        },
      ],
      googleContactStatus: "saved" as const,
      googleContactResourceName: "people/1",
      googleContactUpdatedAt: "2026-10-17T10:00:00.000Z",
    };
    const merged = mergeServerOwnedIrissFields(local, server);
    expect(merged.workspaceRevision).toBe(4);
    expect(merged.generatedDocuments).toHaveLength(1);
    expect(merged.googleContactStatus).toBe("saved");
    expect(merged.googleContactResourceName).toBe("people/1");
    expect(merged.brand).toBe("x");
  });
});
