/**
 * Nils 21.11: «Dzēšot tiek izdzēsta nepareizā bilde». Cēlonis - bilde ielādēta pēc kārtas numura (`/foto/3`)
 * ar pārlūka kešu 1 h: pēc noņemšanas tas pats numurs = cita bilde, bet režģī redzama vecā.
 */
import { describe, expect, it } from "vitest";
import { applyIrissPdPatch, buildIrissPdPublicView } from "@/lib/iriss-piedavajumi";
import {
  irissPdAdminPhotoSrc,
  irissPdPhotoClientToken,
  irissPdPhotoQuery,
  irissPdPhotoToken,
  maskedIrissPdPhotoTokenUrl,
  resolveIrissPdPhotoIndex,
} from "@/lib/iriss-piedavajumi-photo-key";
import { emptyIrissPiedavajums, type IrissPdPhoto, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

const ID = "11111111-1111-4111-8111-111111111111";
const AT = "2026-11-21T10:00:00.000Z";
const P: IrissPdPhoto[] = ["a", "b", "c", "d", "e"].map((x) => ({ kind: "url", url: `https://img.example.com/${x}.jpg` }));

function rec(photos: IrissPdPhoto[] = P): IrissPiedavajums {
  return { ...emptyIrissPiedavajums(ID, AT), photos: [...photos] };
}

const tokenOf = (src: string) => new URL(src, "https://x.lv").searchParams.get("k");

describe("PD bilde pēc stabila žetona", () => {
  it("žetons stabils, atšķirīgs un neatklāj adresi", () => {
    const t = P.map(irissPdPhotoToken);
    expect(new Set(t).size).toBe(P.length);
    expect(irissPdPhotoToken({ ...P[2]! } as IrissPdPhoto)).toBe(t[2]);
    for (const x of t) expect(x).toMatch(/^[0-9a-z]{14}$/);
    expect(irissPdAdminPhotoSrc(ID, P[0]!)).not.toContain("img.example");
  });

  it("reprodukcija: pēc 1. bildes noņemšanas vecā adrese pēc numura rāda citu bildi, žetona adrese - to pašu", () => {
    const before = rec();
    const res = applyIrissPdPatch(before, { photos: [P[1]!, P[2]!, P[3]!, P[4]!] }, { by: "Nils", at: AT, nowMs: Date.parse(AT) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const after = res.record;
    // Vecais veids: «c» bija /foto/2; pēc noņemšanas /foto/2 ir «d» - bet pārlūks kešā rāda «c» -> noņem «d».
    expect(after.photos[resolveIrissPdPhotoIndex(after.photos, 2, null)]).toEqual(P[3]);
    // Jaunais: adrese bildei «c» nemainās un serveris atrod tieši «c».
    const src = irissPdAdminPhotoSrc(ID, P[2]!);
    expect(irissPdAdminPhotoSrc(ID, after.photos[1]!)).toBe(src);
    expect(after.photos[resolveIrissPdPhotoIndex(after.photos, 0, tokenOf(src))]).toEqual(P[2]);
  });

  it("noņemtas bildes žetons -> nav (404), nekad kaimiņš", () => {
    const left = [P[0]!, P[2]!];
    expect(resolveIrissPdPhotoIndex(left, 0, irissPdPhotoToken(P[1]!))).toBe(-1);
    expect(resolveIrissPdPhotoIndex(left, 0, "../x")).toBe(-1);
    expect(resolveIrissPdPhotoIndex(left, 5, null)).toBe(-1);
    expect(resolveIrissPdPhotoIndex(left, 1, "")).toBe(1);
  });

  it("vāka bilde: pārvietota uz beigām, tā pati adrese; vāks - jaunā pirmā", () => {
    const moved = [P[1]!, P[2]!, P[3]!, P[4]!, P[0]!];
    expect(resolveIrissPdPhotoIndex(moved, 0, irissPdPhotoToken(P[0]!))).toBe(4);
  });

  it("darbinieka maskētā bilde nes īstās bildes žetonu", () => {
    const masked: IrissPdPhoto = { kind: "url", url: maskedIrissPdPhotoTokenUrl(irissPdPhotoToken(P[3]!)) };
    expect(irissPdPhotoClientToken(masked)).toBe(irissPdPhotoToken(P[3]!));
    expect(resolveIrissPdPhotoIndex(P, 0, irissPdPhotoClientToken(masked))).toBe(3);
  });

  it("dublikāti PATCH izmesti (viena bilde nav divās vietās)", () => {
    const res = applyIrissPdPatch(rec(), { photos: [P[0]!, P[0]!, P[1]!] }, { by: "Nils", at: AT, nowMs: Date.parse(AT) });
    expect(res.ok && res.record.photos).toEqual([P[0], P[1]]);
  });

  it("klienta saitē secība un žetoni tieši kā adminā saliktā", () => {
    const order = [P[3]!, P[0]!, P[4]!];
    const view = buildIrissPdPublicView(rec(order), "link", Date.parse(AT));
    expect(view.photoCount).toBe(3);
    expect(view.photoTokens).toEqual(order.map(irissPdPhotoToken));
  });

  it("vaicājums", () => {
    expect(irissPdPhotoQuery("", "thumb")).toBe("");
    expect(irissPdPhotoQuery("", "full")).toBe("?s=full");
    expect(irissPdPhotoQuery("abc12345", "full")).toBe("?k=abc12345&s=full");
  });
});
