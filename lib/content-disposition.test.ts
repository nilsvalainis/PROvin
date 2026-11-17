import { describe, expect, it } from "vitest";
import { contentDispositionHeader } from "@/lib/content-disposition";

describe("contentDispositionHeader", () => {
  it("Škoda nosaukums der HTTP galvenei un saglabā pilno nosaukumu", () => {
    const h = contentDispositionHeader("P02846 Škoda Superb.pdf", "inline", "pavadzime.pdf");
    expect(() => new Headers({ "Content-Disposition": h })).not.toThrow();
    expect(h).toContain('filename="P02846_Skoda_Superb.pdf"');
    expect(decodeURIComponent(h.split("UTF-8''")[1]!)).toBe("P02846 Škoda Superb.pdf");
  });

  it("tukšs nosaukums - rezerves nosaukums", () => {
    expect(contentDispositionHeader("", "attachment", "pavadzime.pdf")).toContain('attachment; filename="pavadzime.pdf"');
  });
});
