import { describe, expect, it, vi } from "vitest";
import type { DropboxClient } from "@/lib/dropbox-client";
import {
  deleteIegadeDocumentFromStock,
  iegadeDocDropboxFileName,
  iegadeStockDocFolder,
  renameIegadeDocumentInStock,
  uploadIegadeDocumentToStock,
} from "@/lib/iriss-autoparks-v2-iegade-dropbox";

describe("iegadeStockDocFolder", () => {
  it("auto ceļš + /doc", () => {
    expect(iegadeStockDocFolder({ dropboxFolderPath: "/STOCK/Audi SQ5 2019 melns – A1B2C3 – A1" })).toBe("/STOCK/Audi SQ5 2019 melns – A1B2C3 – A1/doc");
  });
  it("nesasaistīts auto - null", () => {
    expect(iegadeStockDocFolder({})).toBeNull();
    expect(iegadeStockDocFolder({ dropboxFolderPath: "" })).toBeNull();
  });
});

describe("iegadeDocDropboxFileName", () => {
  it("nosaukums no kartītes + oriģinālais paplašinājums", () => {
    expect(iegadeDocDropboxFileName("Car Invoice", "invoice (1).pdf", "application/pdf")).toBe("Car Invoice.pdf");
  });
  it("tukšs nosaukums - no faila vārda", () => {
    expect(iegadeDocDropboxFileName("", "rekins.pdf", "application/pdf")).toBe("rekins.pdf");
  });
  it("bez paplašinājuma failā - no content-type pdf", () => {
    expect(iegadeDocDropboxFileName("Dokuments", "blob", "application/pdf")).toBe("Dokuments.pdf");
  });
});

function fakeClient(impl: Partial<DropboxClient>): DropboxClient {
  return impl as DropboxClient;
}

describe("uploadIegadeDocumentToStock", () => {
  it("izveido mapi un augšupielādē, atgriež ceļu", async () => {
    const ensureFolder = vi.fn(async () => ({ tag: "folder" as const, id: "id:F", name: "doc", pathLower: "", pathDisplay: "", rev: "", size: 0, contentHash: "", serverModified: "" }));
    const upload = vi.fn(async () => ({ tag: "file" as const, id: "id:U", name: "x.pdf", pathLower: "", pathDisplay: "/STOCK/A/doc/x.pdf", rev: "", size: 1, contentHash: "", serverModified: "" }));
    const path = await uploadIegadeDocumentToStock("/STOCK/A/doc", "x.pdf", Buffer.from("x"), fakeClient({ ensureFolder, upload }));
    expect(path).toBe("/STOCK/A/doc/x.pdf");
    expect(ensureFolder).toHaveBeenCalledWith("/STOCK/A/doc");
    expect(upload).toHaveBeenCalledWith("/STOCK/A/doc/x.pdf", Buffer.from("x"), "add", { autorename: true });
  });
  it("klients nav konfigurēts - null, nekrīt", async () => {
    expect(await uploadIegadeDocumentToStock("/STOCK/A/doc", "x.pdf", Buffer.from("x"), null)).toBeNull();
  });
  it("Dropbox kļūda - null, nekrīt", async () => {
    const client = fakeClient({
      ensureFolder: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    expect(await uploadIegadeDocumentToStock("/STOCK/A/doc", "x.pdf", Buffer.from("x"), client)).toBeNull();
  });
});

describe("renameIegadeDocumentInStock", () => {
  it("pārvieto uz jauno nosaukumu tajā pašā mapē", async () => {
    const move = vi.fn(async () => ({ tag: "file" as const, id: "id:M", name: "y.pdf", pathLower: "", pathDisplay: "/STOCK/A/doc/y.pdf", rev: "", size: 1, contentHash: "", serverModified: "" }));
    const path = await renameIegadeDocumentInStock("/STOCK/A/doc/x.pdf", "y.pdf", fakeClient({ move }));
    expect(path).toBe("/STOCK/A/doc/y.pdf");
    expect(move).toHaveBeenCalledWith("/STOCK/A/doc/x.pdf", "/STOCK/A/doc/y.pdf", { autorename: true });
  });
  it("tukšs vecais ceļš - null", async () => {
    expect(await renameIegadeDocumentInStock("", "y.pdf", fakeClient({}))).toBeNull();
  });
  it("Dropbox kļūda - null, nekrīt", async () => {
    const move = vi.fn(async () => {
      throw new Error("boom");
    });
    expect(await renameIegadeDocumentInStock("/STOCK/A/doc/x.pdf", "y.pdf", fakeClient({ move }))).toBeNull();
  });
});

describe("deleteIegadeDocumentFromStock", () => {
  it("izsauc deleteFile", async () => {
    const deleteFile = vi.fn(async () => undefined);
    await deleteIegadeDocumentFromStock("/STOCK/A/doc/x.pdf", fakeClient({ deleteFile }));
    expect(deleteFile).toHaveBeenCalledWith("/STOCK/A/doc/x.pdf");
  });
  it("tukšs ceļš vai bez klienta - nekrīt", async () => {
    await expect(deleteIegadeDocumentFromStock("", fakeClient({}))).resolves.toBeUndefined();
    await expect(deleteIegadeDocumentFromStock("/x", null)).resolves.toBeUndefined();
  });
  it("Dropbox kļūda - apslāpēta", async () => {
    const deleteFile = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(deleteIegadeDocumentFromStock("/STOCK/A/doc/x.pdf", fakeClient({ deleteFile }))).resolves.toBeUndefined();
  });
});
