import { describe, expect, it } from "vitest";
import { irissPdAuto1MaxPhotoUrl } from "@/lib/iriss-piedavajumi-import";

const HASH = "0123456789abcdef0123456789abcdef";

describe("Auto1 bildes lielākais variants", () => {
  it("mazo vai vidējo variantu pārvērš par max-", () => {
    expect(irissPdAuto1MaxPhotoUrl(`https://img-pa.auto1.com/img/aa/bb/DE12345_${HASH}.jpg`)).toBe(
      `https://img-pa.auto1.com/img/aa/bb/max-DE12345_${HASH}.jpg`,
    );
    expect(irissPdAuto1MaxPhotoUrl(`https://img-pa.auto1.com/img/aa/sr-x2-DE12345_${HASH}.jpg?x=1`)).toBe(
      `https://img-pa.auto1.com/img/aa/max-DE12345_${HASH}.jpg?x=1`,
    );
  });

  it("neko nedara, ja jau ir max-, nav Auto1 vai nav atpazīstams fails", () => {
    expect(irissPdAuto1MaxPhotoUrl(`https://img-pa.auto1.com/img/max-DE12345_${HASH}.jpg`)).toBeNull();
    expect(irissPdAuto1MaxPhotoUrl(`https://images.openlane.eu/carimgs/1/DE12345_${HASH}.jpg`)).toBeNull();
    expect(irissPdAuto1MaxPhotoUrl("https://img-pa.auto1.com/a/1.jpg")).toBeNull();
    expect(irissPdAuto1MaxPhotoUrl("nav adrese")).toBeNull();
  });
});
