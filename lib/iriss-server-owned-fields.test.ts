import { describe, expect, it } from "vitest";
import { mergeServerOwnedIrissFields } from "@/lib/iriss-server-owned-fields";
import type { IrissGeneratedDocument, IrissGoogleContactStatus } from "@/lib/iriss-pasutijumi-types";

describe("mergeServerOwnedIrissFields", () => {
  it("keeps server PDFs and google fields on the local draft", () => {
    const local: {
      workspaceRevision: number;
      generatedDocuments: IrissGeneratedDocument[];
      brand: string;
      googleContactStatus?: IrissGoogleContactStatus;
      googleContactResourceName?: string;
    } = {
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
      brand: "x",
    };
    const merged = mergeServerOwnedIrissFields(local, server);
    expect(merged.workspaceRevision).toBe(4);
    expect(merged.generatedDocuments).toHaveLength(1);
    expect(merged.googleContactStatus).toBe("saved");
    expect(merged.googleContactResourceName).toBe("people/1");
    expect(merged.brand).toBe("x");
  });
});

describe("mergeServerOwnedIrissFields - statuss (FABLE F3: klients apstiprina, cilne rāda «Aktīvs»)", () => {
  const approvedEntry = { from: "active", to: "reserved", at: "2026-10-26T06:38:36.452Z", by: "Klients (piedāvājuma saite)" };

  it("pārņem jaunāku servera statusu", () => {
    const local = { workspaceRevision: 3, listStatus: "active", statusHistory: [] as unknown[], note: "FABLE" };
    const server = {
      workspaceRevision: 5,
      listStatus: "reserved",
      statusChangedAt: approvedEntry.at,
      statusHistory: [approvedEntry],
      note: "servera",
    };
    const out = mergeServerOwnedIrissFields(local, server);
    expect(out.listStatus).toBe("reserved");
    expect(out.statusHistory).toEqual([approvedEntry]);
    expect(out.note).toBe("FABLE");
  });

  it("vietējā jaunākā statusa maiņa paliek", () => {
    const local = { listStatus: "completed", statusChangedAt: "2026-10-26T06:40:00.000Z", statusHistory: [] as unknown[] };
    const server = { listStatus: "reserved", statusChangedAt: approvedEntry.at, statusHistory: [approvedEntry] };
    expect(mergeServerOwnedIrissFields(local, server).listStatus).toBe("completed");
  });

  it("serveris bez statusChangedAt neko nemaina", () => {
    const local: { listStatus: string; statusChangedAt?: string } = { listStatus: "inactive", statusChangedAt: "2026-10-01T00:00:00.000Z" };
    expect(mergeServerOwnedIrissFields(local, { listStatus: "active" }).listStatus).toBe("inactive");
  });
});
