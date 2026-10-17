import { describe, expect, it } from "vitest";
import { isPraisingTechRisksIntro } from "@/lib/ai-praising-intro";
import { evaluateExpertCommentQuality } from "@/lib/ai-eval/comment-quality";

describe("isPraisingTechRisksIntro", () => {
  it("bans a praising opener", () => {
    expect(
      isPraisingTechRisksIntro(
        "Šī automašīna ir viens no veiksmīgākajiem BMW dīzeļiem ar uzticamu konstrukciju.\n\nĶēde paliek pārbaudes punkts.",
      ),
    ).toBe(true);
  });

  it("bans Dzinēja identifikācija as the first heading", () => {
    expect(
      isPraisingTechRisksIntro(
        "Dzinēja identifikācija\nDīlera datos dzinējs ir rindas sešinieka dīzelis.\n\nĶēde\nĶēde paliek pirkuma risks.",
      ),
    ).toBe(true);
  });

  it("bans Agregātu identifikācija as the first heading", () => {
    expect(
      isPraisingTechRisksIntro(
        "Agregātu identifikācija\nDīlera datos dzinējs ir rindas sešinieka dīzelis.\n\nĶēde\nĶēde paliek pirkuma risks.",
      ),
    ).toBe(true);
  });

  it("bans equipped-with used as brand presentation without a risk fact", () => {
    expect(
      isPraisingTechRisksIntro(
        "Šī automašīna ir aprīkota ar N57 dīzeļdzinēju un hidrotransformatora kārbu.\n\nKārba paliek pārbaudes punkts.",
      ),
    ).toBe(true);
  });

  it("allows equipped-with when the same paragraph states the component risk", () => {
    expect(
      isPraisingTechRisksIntro(
        "Šī automašīna ir aprīkota ar N47 sērijas dīzeļdzinēju, kura galvenais riska punkts ir sadales ķēde. Pie nobraukuma virs 200 000 km, ja nav dokumentu par maiņu, šis mezgls ir galvenais pirkuma risks.",
      ),
    ).toBe(false);
  });

  it("quality harness keeps factual equipment+risk and flags praise", () => {
    const praise = evaluateExpertCommentQuality(
      "Šī automašīna ir viens no veiksmīgākajiem BMW dīzeļiem.\n\nĶēde\nĶēde paliek pārbaudes punkts.",
      { field: "technical_risks" },
    );
    expect(praise.some((i) => i.code === "tech_risks_identity_intro")).toBe(true);

    const fact =
      "Šī automašīna ir aprīkota ar N47 sērijas dīzeļdzinēju, kura galvenais riska punkts ir sadales ķēde. Pie nobraukuma virs 200 000 km, ja nav dokumentu par maiņu, šis mezgls ir galvenais pirkuma risks.\n\n" +
      "Pneumatika\nUniversāļa rūpnīcas aizmugures pneimatika šajā vecumā ir galvenais rēķins: spilveni un kompresors. Ja diagnostikā tas jau fiksēts, tas ir pirmais jautājums pārdevējam, ne arguments pret pašu motoru.\n\n" +
      "Motora mehānika\nTipiski eļļas filtra korpusa un vāka blīves, dzesēšanas plastmasa un ventilatora hidromufte. Dokumentēta skriemeļa maiņa datos izskatās labi; trūkstošu ATF maiņu formulē kā nepierādītu.\n\n" +
      "Ieplūde un izplūde\nIeplūdes kolektors un EGR paliek ierasta uzturēšanas izmaksa; zema dūmainība tehniskajā apskatē ir labs rādījums datos par DPF un turbīnu.\n\n" +
      "Kārba\nHidrotransformators paliek ierasta uzturēšanas izmaksa šajā posmā, ne pirmais pirkuma šķērslis pēc pieejamajiem datiem. Testa braucienā jāizjūt palaišana bez raustīšanās.\n\n" +
      "Prioritātes\nGalvenais pirkuma punkts ir ķēde, ja maiņa datos nav fiksēta. Pēc pieejamajiem datiem auto izskatās kopts, ar atrunu ka PROVIN to fiziski nav apskatījis.";
    const ok = evaluateExpertCommentQuality(fact, { field: "technical_risks" });
    expect(ok.filter((i) => i.code === "tech_risks_identity_intro")).toEqual([]);
  });
});
