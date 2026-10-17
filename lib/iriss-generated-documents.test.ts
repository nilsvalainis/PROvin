import { describe, expect, it } from "vitest";
import {
  formatGeneratedDocumentSize,
  generatedDocumentResponseHeader,
  IRISS_GENERATED_DOCUMENT_HEADER,
  mergeGeneratedDocuments,
  normalizeGeneratedDocuments,
  readGeneratedDocumentFromResponseHeader,
  sortGeneratedDocumentsNewestFirst,
} from "@/lib/iriss-generated-documents";

describe("generated documents", () => {
  it("sorts newest first and merges by id", () => {
    const older = {
      id: "a",
      kind: "contract" as const,
      name: "līgums.pdf",
      mimeType: "application/pdf",
      size: 100,
      createdAt: "2026-10-01T10:00:00.000Z",
      blobPath: "docs/a.pdf",
    };
    const newer = {
      id: "b",
      kind: "cost_estimate" as const,
      name: "tame.pdf",
      mimeType: "application/pdf",
      size: 200,
      createdAt: "2026-10-17T10:00:00.000Z",
      blobPath: "docs/b.pdf",
    };
    expect(sortGeneratedDocumentsNewestFirst([older, newer]).map((d) => d.id)).toEqual(["b", "a"]);
    const merged = mergeGeneratedDocuments([newer], [older, { ...newer, name: "old.pdf" }]);
    expect(merged.map((d) => d.id)).toEqual(["b", "a"]);
    expect(merged[0]?.name).toBe("tame.pdf");
  });

  it("drops unknown kinds and formats size", () => {
    expect(normalizeGeneratedDocuments([{ id: "x", kind: "other", name: "x", blobPath: "p" }])).toEqual([]);
    expect(formatGeneratedDocumentSize(500)).toBe("500 B");
    expect(formatGeneratedDocumentSize(2048)).toBe("2 KB");
  });

  it("round-trips the response header", () => {
    const doc = {
      id: "d1",
      kind: "contract" as const,
      name: "līgums.pdf",
      mimeType: "application/pdf",
      size: 12,
      createdAt: "2026-10-17T10:00:00.000Z",
      blobPath: "docs/d1.pdf",
    };
    const header = generatedDocumentResponseHeader(doc, 4)[IRISS_GENERATED_DOCUMENT_HEADER] ?? "";
    const read = readGeneratedDocumentFromResponseHeader(header);
    expect(read?.doc.id).toBe("d1");
    expect(read?.doc.name).toBe("līgums.pdf");
    expect(read?.workspaceRevision).toBe(4);
  });
});
