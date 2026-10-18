import { describe, expect, it } from "vitest";
import { parseSpreadsheetFirstColumn, parseXlsxFirstColumn } from "@/lib/b2b-partner-bulk-vin-xlsx";
import { iso3779CheckDigit } from "@/lib/vin-scan/vin-check";

function vin17(template17: string): string {
  const proto = `${template17.slice(0, 8)}0${template17.slice(9)}`.padEnd(17, "0").slice(0, 17);
  const digit = iso3779CheckDigit(proto);
  if (!digit) throw new Error("check digit");
  return `${proto.slice(0, 8)}${digit}${proto.slice(9)}`;
}

const VALID_A = vin17("WVWZZZ3HZHE703058");
const VALID_B = vin17("WVWZZZ1JZXW000001");

function zipStore(entries: { name: string; data: string }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.data, "utf8");
    const local = Buffer.alloc(30 + name.length + data.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    data.copy(local, 30 + name.length);
    locals.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

describe("bulk VIN spreadsheet", () => {
  it("reads CSV bytes as the first column", () => {
    const csv = Buffer.from(`VIN\n${VALID_A}\n${VALID_B}\n`, "utf8");
    expect(parseSpreadsheetFirstColumn(csv, "list.csv")).toEqual([VALID_A, VALID_B]);
  });

  it("reads column A from a stored xlsx worksheet", () => {
    const xlsx = zipStore([
      {
        name: "xl/sharedStrings.xml",
        data: `<?xml version="1.0"?><sst><si><t>VIN</t></si><si><t>${VALID_A}</t></si><si><t>${VALID_B}</t></si></sst>`,
      },
      {
        name: "xl/worksheets/sheet1.xml",
        data:
          `<?xml version="1.0"?><worksheet><sheetData>` +
          `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>0</v></c></row>` +
          `<row r="2"><c r="A2" t="s"><v>1</v></c></row>` +
          `<row r="3"><c r="A3" t="inlineStr"><is><t>${VALID_B}</t></is></c></row>` +
          `</sheetData></worksheet>`,
      },
    ]);
    expect(parseXlsxFirstColumn(xlsx)).toEqual([VALID_A, VALID_B]);
  });
});
