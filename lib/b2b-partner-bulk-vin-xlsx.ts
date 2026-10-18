import "server-only";

import { inflateRawSync } from "node:zlib";
import { parseCsvFirstColumn, skipVinHeader } from "@/lib/b2b-partner-bulk-vin";

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

export function isXlsxBuffer(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07);
}

export function parseSpreadsheetFirstColumn(buf: Uint8Array, filename = ""): string[] {
  const name = filename.trim().toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt") || !isXlsxBuffer(buf)) {
    return parseCsvFirstColumn(Buffer.from(buf).toString("utf8"));
  }
  return parseXlsxFirstColumn(Buffer.from(buf));
}

export function parseXlsxFirstColumn(buf: Buffer): string[] {
  const files = unzipMemory(buf);
  const sheet =
    files.get("xl/worksheets/sheet1.xml") ??
    [...files.entries()].find(([key]) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(key))?.[1];
  if (!sheet) return [];
  const shared = files.get("xl/sharedStrings.xml");
  const strings = shared ? parseSharedStrings(shared.toString("utf8")) : [];
  return skipVinHeader(parseColumnA(sheet.toString("utf8"), strings));
}

function unzipMemory(buf: Buffer): Map<string, Buffer> {
  const eocd = findSigFromEnd(buf, EOCD_SIG, 22);
  if (eocd >= 0) {
    const count = buf.readUInt16LE(eocd + 10);
    const cdSize = buf.readUInt32LE(eocd + 12);
    const cdOff = buf.readUInt32LE(eocd + 16);
    const out = new Map<string, Buffer>();
    let i = cdOff;
    const end = Math.min(buf.length, cdOff + cdSize);
    for (let n = 0; n < count && i + 46 <= end; n += 1) {
      if (buf.readUInt32LE(i) !== CENTRAL_SIG) break;
      const method = buf.readUInt16LE(i + 10);
      const compSize = buf.readUInt32LE(i + 20);
      const nameLen = buf.readUInt16LE(i + 28);
      const extraLen = buf.readUInt16LE(i + 30);
      const commentLen = buf.readUInt16LE(i + 32);
      const localOff = buf.readUInt32LE(i + 42);
      const name = buf.subarray(i + 46, i + 46 + nameLen).toString("utf8");
      const data = readLocalPayload(buf, localOff, method, compSize);
      if (data && name) out.set(name, data);
      i += 46 + nameLen + extraLen + commentLen;
    }
    if (out.size > 0) return out;
  }
  return unzipLocalScan(buf);
}

function unzipLocalScan(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let i = 0;
  while (i + 30 <= buf.length) {
    if (buf.readUInt32LE(i) !== LOCAL_SIG) break;
    const method = buf.readUInt16LE(i + 8);
    const flags = buf.readUInt16LE(i + 6);
    const compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString("utf8");
    const start = i + 30 + nameLen + extraLen;
    if (flags & 0x08) break;
    const data = inflateEntry(buf.subarray(start, start + compSize), method);
    if (data && name) out.set(name, data);
    i = start + compSize;
  }
  return out;
}

function readLocalPayload(buf: Buffer, off: number, method: number, compSize: number): Buffer | null {
  if (off < 0 || off + 30 > buf.length || buf.readUInt32LE(off) !== LOCAL_SIG) return null;
  const nameLen = buf.readUInt16LE(off + 26);
  const extraLen = buf.readUInt16LE(off + 28);
  const start = off + 30 + nameLen + extraLen;
  if (start + compSize > buf.length) return null;
  return inflateEntry(buf.subarray(start, start + compSize), method);
}

function inflateEntry(slice: Buffer, method: number): Buffer | null {
  if (method === 0) return Buffer.from(slice);
  if (method === 8) {
    try {
      return inflateRawSync(slice);
    } catch {
      return null;
    }
  }
  return null;
}

function findSigFromEnd(buf: Buffer, sig: number, minLen: number): number {
  const last = buf.length - minLen;
  for (let i = last; i >= 0; i -= 1) {
    if (buf.readUInt32LE(i) === sig) return i;
  }
  return -1;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let match: RegExpExecArray | null = siRe.exec(xml);
  while (match) {
    out.push(xmlTextValues(match[1] ?? "").join(""));
    match = siRe.exec(xml);
  }
  return out;
}

function parseColumnA(sheetXml: string, strings: readonly string[]): string[] {
  const rows: string[] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null = rowRe.exec(sheetXml);
  while (rowMatch) {
    const rowXml = rowMatch[1] ?? "";
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let first: string | null = null;
    let cellMatch: RegExpExecArray | null = cellRe.exec(rowXml);
    while (cellMatch) {
      const attrs = cellMatch[1] ?? "";
      const body = cellMatch[2] ?? "";
      const ref = /(?:^|\s)r="([A-Z]+)(\d+)"/i.exec(attrs);
      const col = (ref?.[1] ?? "").toUpperCase();
      if (ref && col !== "A") {
        cellMatch = cellRe.exec(rowXml);
        continue;
      }
      first = readCellValue(attrs, body, strings);
      break;
    }
    if (first?.trim()) rows.push(first.trim());
    rowMatch = rowRe.exec(sheetXml);
  }
  return rows;
}

function readCellValue(attrs: string, body: string, strings: readonly string[]): string {
  const type = /(?:^|\s)t="([^"]+)"/.exec(attrs)?.[1] ?? "";
  if (type === "s") {
    const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(body)?.[1] ?? "";
    const idx = Number.parseInt(decodeXml(raw), 10);
    return Number.isFinite(idx) ? (strings[idx] ?? "") : "";
  }
  if (type === "inlineStr") return xmlTextValues(body).join("");
  const value = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(body)?.[1] ?? "";
  return decodeXml(value);
}

function xmlTextValues(xml: string): string[] {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((match) => decodeXml(match[1] ?? ""));
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}
