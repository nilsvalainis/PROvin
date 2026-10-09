import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FREE_EVAL_SECTION_ID, FREE_EVAL_SECTION_ID_LEGACY, freeEvalHref } from "@/lib/paths";

describe("freeEvalHref", () => {
  it("points at the homepage free-evaluation anchor", () => {
    expect(FREE_EVAL_SECTION_ID).toBe("bezmaksas-novertejums");
    expect(FREE_EVAL_SECTION_ID_LEGACY).toBe("riska-celvedis");
    expect(freeEvalHref()).toBe("/#bezmaksas-novertejums");
  });
});

describe("approved LV VIN-check copy", () => {
  it("uses the owner-approved Latvian strings and free-eval rich tag", () => {
    const vin = JSON.parse(readFileSync(join(process.cwd(), "messages/lv/vinCheck.json"), "utf8")) as {
      VinCheck: Record<string, string>;
    };
    const meta = JSON.parse(readFileSync(join(process.cwd(), "messages/lv/meta.json"), "utf8")) as {
      Meta: Record<string, string>;
    };
    const v = vin.VinCheck;
    expect(v.homeBody).toContain("<freeEval>bezmaksas VIN koda un sludinājuma novērtējumu</freeEval>");
    expect(v.homeBody).toContain("Ja meklē, kur veikt VIN koda pārbaudi");
    expect(v.h1).toBe("VIN koda pārbaude pirms auto pirkuma");
    expect(v.lead).toContain("VIN ir 17 zīmju rūpnīcas identifikācijas numurs.");
    expect(v.whatTitle).toBe("Kas ir VIN koda pārbaude?");
    expect(v.whatBody).toContain("Tas nav tas pats, kas viens PDF no datubāzes.");
    expect(v.whyTitle).toBe("Kāpēc nepietiek ar vienu auto atskaiti?");
    expect(v.whyBody).toContain("Katrā atskaitē redzams tikai tas, kas iegūts no vienas konkrētas datubāzes");
    expect(v.howTitle).toBe("Kā notiek pārbaude PROVIN");
    expect(v.howBody).toContain("24\u201372 stundu laikā");
    expect(meta.Meta.servicesIntro).toContain("Izvēlies, cik padziļinātu VIN koda pārbaudi vēlies");
  });
});
