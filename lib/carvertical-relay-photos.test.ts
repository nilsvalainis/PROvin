import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
  CV_IMAGE_BASE,
  cvImageUrl,
  cvS3ZipUrl,
  imageContentType,
  parseCvPhotoSection,
  photosFromSetZip,
  readZipEntries,
  summarizeDataDict,
} from "@/relay/provin-carvertical/lib/cv-photos.mjs";

/** Mākslīgs ZIP (deflate / stored) testam. */
function makeZip(files: { name: string; data: Buffer; store?: boolean }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const comp = f.store ? f.data : deflateRawSync(f.data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(f.store ? 0 : 8, 8);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(f.data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(f.store ? 0 : 8, 10);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(f.data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const JPEG = (n: number) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, n)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);

describe("CarVertical relejs: dataDict.photo (kā viewer.carvertical.com)", () => {
  it("v2: records[].sets[].id -> komplekti pēc datuma; legacy id izlaists", () => {
    const res = parseCvPhotoSection({
      photo: {
        version: "2.1",
        records: [
          { date: "2020-07-01", sets: [{ id: "set-aaa111" }, { id: "set-bbb222" }] },
          { date: "2022-01-15T00:00:00Z", sets: [{ id: "legacy" }, { id: "set-ccc333" }] },
        ],
      },
    });
    expect(res.version).toBe("2.1");
    expect(res.items).toEqual([
      { date: "07.2020", kind: "set", setId: "set-aaa111" },
      { date: "07.2020", kind: "set", setId: "set-bbb222" },
      { date: "01.2022", kind: "set", setId: "set-ccc333" },
    ]);
  });

  it("v1: ZIP (setId vai S3 bucket/key) un JPEG (saite / bucket+key -> CloudFront oriģināls)", () => {
    const res = parseCvPhotoSection({
      photo: {
        version: "1.4",
        records: [
          { date: "2019-05-02", contentType: "application/zip", photos: [{ setId: "s1abc" }, { bucket: "cv-photos-eu", key: "a/b/c.zip" }] },
          {
            date: "2021-03-04",
            contentType: "image/jpeg",
            photos: ["https://img.example/1.jpg", { url: "https://img.example/2.jpg" }, { bucket: "cv-photos-eu", key: "p/3.jpg", size: 123 }, "http://x/4.jpg"],
          },
        ],
      },
    });
    const cf = `${CV_IMAGE_BASE}/${Buffer.from(JSON.stringify({ bucket: "cv-photos-eu", key: "p/3.jpg" })).toString("base64")}`;
    expect(res.items).toEqual([
      { date: "05.2019", kind: "set", setId: "s1abc" },
      { date: "05.2019", kind: "zip", url: "https://cv-photos-eu.s3.amazonaws.com/a/b/c.zip" },
      { date: "03.2021", kind: "url", url: "https://img.example/1.jpg" },
      { date: "03.2021", kind: "url", url: "https://img.example/2.jpg" },
      { date: "03.2021", kind: "url", url: cf },
    ]);
  });

  it("nederīgi bucket / key netiek likti saitē", () => {
    expect(cvS3ZipUrl("Bad_Bucket", "a.zip")).toBe("");
    expect(cvS3ZipUrl("ok-bucket", "../x.zip")).toBe("");
    expect(cvImageUrl({ bucket: "ok-bucket", key: "" })).toBe("");
    expect(parseCvPhotoSection({}).items).toEqual([]);
    expect(parseCvPhotoSection(null).items).toEqual([]);
  });

  it("ZIP: manifest.json secība (rank), tikai attēli; deflate un stored", () => {
    const zip = makeZip([
      { name: "manifest.json", data: Buffer.from(JSON.stringify([{ file: "b.jpg", rank: 2 }, { file: "a.png", rank: 1 }, { file: "nav.jpg", rank: 3 }, { file: "c.txt", rank: 4 }])) },
      { name: "b.jpg", data: JPEG(2), store: true },
      { name: "a.png", data: PNG },
      { name: "c.txt", data: Buffer.from("teksts") },
    ]);
    expect([...readZipEntries(zip).keys()]).toEqual(["manifest.json", "b.jpg", "a.png", "c.txt"]);
    const photos = photosFromSetZip(zip);
    expect(photos.map((p) => [p.file, p.contentType])).toEqual([
      ["a.png", "image/png"],
      ["b.jpg", "image/jpeg"],
    ]);
    expect(photos[1]!.buf.equals(JPEG(2))).toBe(true);
  });

  it("ZIP bez manifesta -> visi attēli pēc nosaukuma; bojāts ZIP -> tukšs", () => {
    const zip = makeZip([
      { name: "2.jpg", data: JPEG(2) },
      { name: "1.jpg", data: JPEG(1) },
    ]);
    expect(photosFromSetZip(zip).map((p) => p.file)).toEqual(["1.jpg", "2.jpg"]);
    expect(photosFromSetZip(Buffer.from("nav zip"))).toEqual([]);
    expect(imageContentType(Buffer.from("RIFF0000WEBPVP8 "))).toBe("image/webp");
  });

  it("debug kopsavilkums: atslēgu ceļi + saites / id paraugi, personas dati nekad", () => {
    const sum = summarizeDataDict({
      owner: { name: "Jānis Bērziņš", phone: "+37120000000" },
      photo: { version: "2.1", records: [{ date: "2020-07-01", sets: [{ id: "set-aaa111" }] }] },
      listing: { imageUrl: "https://img.example/1.jpg", sellerName: "Pārdevējs" },
    });
    expect(sum.topKeys).toEqual(["owner", "photo", "listing"]);
    expect(sum.paths).toContain("photo.records[].sets[].id: string");
    expect(sum.paths).toContain("owner.name: string");
    expect(sum.samples).toEqual({
      "photo.version": ["2.1"],
      "photo.records[].date": ["2020-07-01"],
      "photo.records[].sets[].id": ["set-aaa111"],
      "listing.imageUrl": ["https://img.example/1.jpg"],
    });
    expect(JSON.stringify(sum)).not.toContain("Jānis");
    expect(JSON.stringify(sum)).not.toContain("37120000000");
  });
});
