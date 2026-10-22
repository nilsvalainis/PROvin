import { describe, expect, it } from "vitest";
import {
  autoparksDropboxFileName,
  autoparksDropboxRoot,
  autoparksStockFolderName,
  matchStockFolderByVin,
  sanitizeDropboxName,
} from "@/lib/iriss-autoparks-dropbox-path";

const SEP = " – ";
const stock = [
  `Volvo XC60 2013 sudrabs${SEP}439274${SEP}A1`,
  `VW T-Roc 2017 zils${SEP}005716${SEP}AB`,
  "Mercedes Sprinter 316 CDI 2012 sarkans - WDB9061331N534460 - Autobid 84073",
  "_ Arhīvs",
  "BMW IX40",
];

describe("autoparks /STOCK mapes", () => {
  it("jaunas mapes nosaukums pēc esošā parauga", () => {
    const name = autoparksStockFolderName({ make: "Volvo", model: "XC60", year: "2013", color: "Sudrabs", vin: "YV1DZ8256D2439274" }, "Auto1");
    expect(name).toBe(`Volvo XC60 2013 sudrabs${SEP}439274${SEP}A1`);
    expect(autoparksStockFolderName({ make: "Audi", model: "A4", year: "", color: "", vin: "" }, "cits")).toBe(`Audi A4${SEP}bez VIN`);
  });

  it("atrod esošu mapi pēc VIN pēdējiem 6 vai pilnā VIN", () => {
    expect(matchStockFolderByVin(stock, "YV1DZ8256D2439274")).toMatchObject({ kind: "found", index: 0 });
    expect(matchStockFolderByVin(stock, "WDB9061331N534460")).toMatchObject({ kind: "found", index: 2 });
    expect(matchStockFolderByVin(stock, "WVWZZZ1JZ3W111111")).toEqual({ kind: "none" });
    expect(matchStockFolderByVin(stock, "")).toEqual({ kind: "none" });
  });

  it("vairāki trāpījumi = neskaidrs, arhīva mapes ignorē", () => {
    const dup = [...stock, `Volvo XC60 balts${SEP}439274${SEP}A1`, `_ Arhīvs vecais${SEP}005716`];
    expect(matchStockFolderByVin(dup, "YV1DZ8256D2439274").kind).toBe("ambiguous");
    expect(matchStockFolderByVin(dup, "WVGZZZA1ZHV005716")).toMatchObject({ kind: "found", index: 1 });
  });

  it("saknes mapes pēc īpašnieka un env", () => {
    expect(autoparksDropboxRoot("IRISS", {} as NodeJS.ProcessEnv)).toBe("/STOCK");
    expect(autoparksDropboxRoot("DZA", {} as NodeJS.ProcessEnv)).toBe("/SIA DZINTARZEME AUTO/STOCK");
    expect(autoparksDropboxRoot("IRISS", { AUTOPARKS_DROPBOX_ROOT: "Test/STOCK/" } as unknown as NodeJS.ProcessEnv)).toBe("/Test/STOCK");
  });

  it("faila nosaukums bez aizliegtām zīmēm", () => {
    expect(autoparksDropboxFileName("service", 'Rēķins 12/3: "a"', "x.PDF", "application/pdf")).toBe("Serviss - Rēķins 12 3 a.pdf");
    expect(sanitizeDropboxName("  a.. ")).toBe("a");
  });
});
