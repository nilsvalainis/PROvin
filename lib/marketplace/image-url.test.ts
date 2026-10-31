import { describe, expect, it } from "vitest";
import { mobileDeImageDisplayUrl } from "@/lib/marketplace/image-url";

const ID = "ba/ba59389f-daa4-41ad-bf02-99281586efe8";

describe("Nils 31.10: mobile.de bildes tieši no CDN, ne caur m.mobile.de", () => {
  it("yams-proxy saite -> img.classistatic.de ar izmēra noteikumu", () => {
    expect(mobileDeImageDisplayUrl(`https://m.mobile.de/yams-proxy/img.classistatic.de/api/v1/mo-prod/images/${ID}`)).toBe(
      `https://img.classistatic.de/api/v1/mo-prod/images/${ID}?rule=mo-1024.jpg`,
    );
    expect(mobileDeImageDisplayUrl(`https://m.mobile.de/yams-proxy/img.classistatic.de/api/v1/mo-prod/images/${ID}`, 640)).toContain("rule=mo-640.jpg");
  });

  it("tieša CDN saite bez noteikuma dabū noteikumu; esošais tiek nomainīts", () => {
    expect(mobileDeImageDisplayUrl(`https://img.classistatic.de/api/v1/mo-prod/images/${ID}`, 360)).toBe(
      `https://img.classistatic.de/api/v1/mo-prod/images/${ID}?rule=mo-360.jpg`,
    );
    expect(mobileDeImageDisplayUrl(`https://img.classistatic.de/api/v1/mo-prod/images/${ID}?rule=mo-160.jpg`, 1600)).toContain("rule=mo-1600.jpg");
  });

  it("citas saites paliek kā ir", () => {
    expect(mobileDeImageDisplayUrl("https://images.openlane.eu/x.jpg")).toBe("https://images.openlane.eu/x.jpg");
    expect(mobileDeImageDisplayUrl("")).toBe("");
  });
});
