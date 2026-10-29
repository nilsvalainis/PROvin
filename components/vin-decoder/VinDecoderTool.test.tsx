import { describe, expect, it } from "vitest";
import lv from "@/messages/lv/vinCheck.json";
import en from "@/messages/en/vinCheck.json";
import { VinDecoderTool, type VinDecoderLabels } from "@/components/vin-decoder/VinDecoderTool";
import { renderText } from "@/lib/test-render";

function text(vin: string, labels: VinDecoderLabels = lv.VinDecoder as VinDecoderLabels, locale = "lv") {
  return renderText(<VinDecoderTool locale={locale} labels={labels} auditHref="/lv" freeCheckHref="/lv#x" initialVin={vin} />);
}

describe("VIN dekoders - modelis no ražotāja koda", () => {
  it("Audi: modelis, paaudze un viens modeļa gads (nevis 2014 / 1984)", () => {
    const t = text("WAUZZZ4G5EN012345");
    expect(t).toContain("Audi A6 / A7");
    expect(t).toContain("2014. modeļa gads");
    expect(t).toContain("A6 / A7 (4G)");
    expect(t).toContain("2010-2018");
    expect(t).not.toContain("2014 / 1984");
    expect(t).toContain("vairākus vienas platformas modeļus");
  });

  it("Mercedes: klase pēc valodas, gads nav VIN kodā", () => {
    expect(text("WDD2130041A179362")).toContain("Mercedes-Benz E-klase");
    expect(text("WDD2130041A179362")).toContain("Šī ražotāja VIN kodā gada nav");
    expect(text("WDD2130041A179362", en.VinDecoder as VinDecoderLabels, "en")).toContain("Mercedes-Benz E-Class");
  });

  it("nezināms modelis: bez modeļa rindas, gada varianti ar paskaidrojumu", () => {
    const t = text("WF0MXXGBWMD012345");
    expect(t).not.toContain("Modelis pēc ražotāja koda");
    expect(t).toContain("2021 / 1991");
    expect(t).toContain("10. zīme atkārtojas");
  });
});
