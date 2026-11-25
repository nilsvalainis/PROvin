import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks, emptyVendorAvotuBlock } from "@/lib/admin-source-blocks";
import {
  normalizeOrderWorkspacePersistBody,
  type OrderWorkspacePersistBody,
} from "@/lib/admin-order-workspace-persist";
import {
  changedWorkspaceEditKeys,
  countWorkspaceFilled,
  detectWorkspaceShrink,
  fillEmptyServerFieldsFromLocal,
  mergeStaleLocalWithServer,
  shouldWarnWorkspaceUnsaved,
  workspaceUnsavedReason,
} from "@/lib/admin-workspace-safety";

function emptyBody(): OrderWorkspacePersistBody {
  return normalizeOrderWorkspacePersistBody({
    sourceBlocks: createDefaultSourceBlocks(),
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
    vehicleAiExtraction: null,
    vehicleAiExtractionMeta: null,
  });
}

function withVendor(b: OrderWorkspacePersistBody, key: "autodna" | "carvertical" | "carfax", comments: string) {
  return normalizeOrderWorkspacePersistBody({
    ...b,
    sourceBlocks: { ...b.sourceBlocks, [key]: { ...emptyVendorAvotuBlock(), comments } },
  });
}

function richBody(): OrderWorkspacePersistBody {
  let b = emptyBody();
  b = { ...b, iriss: "<p>IRISS kopsavilkums par auto</p>", apskatesPlāns: "Apskatīt kreiso slieksni", tehniskoRiskuAnalize: "DSG risks" };
  b = withVendor(b, "autodna", "AutoDNA: 3 ieraksti, nobraukums sakrīt");
  b = withVendor(b, "carvertical", "CarVertical: bojājums 2021");
  return b;
}

describe("countWorkspaceFilled / detectWorkspaceShrink", () => {
  it("skaita teksta laukus un blokus", () => {
    const c = countWorkspaceFilled(richBody());
    expect(c.fields).toBe(3);
    expect(c.blocks).toBe(2);
    expect(countWorkspaceFilled(emptyBody()).total).toBe(0);
  });

  it("tukšs pār aizpildītu = shrink", () => {
    expect(detectWorkspaceShrink(richBody(), emptyBody()).shrink).toBe(true);
  });

  it("≥50 % kritums = shrink, neliels kritums nav", () => {
    const r = richBody(); // 5
    const two = { ...emptyBody(), iriss: r.iriss, apskatesPlāns: r.apskatesPlāns }; // 2
    expect(detectWorkspaceShrink(r, two).shrink).toBe(true);
    const four = { ...r, tehniskoRiskuAnalize: "" }; // 4
    expect(detectWorkspaceShrink(r, four).shrink).toBe(false);
  });

  it("nav shrink, ja iepriekš bija tukšs", () => {
    expect(detectWorkspaceShrink(emptyBody(), emptyBody()).shrink).toBe(false);
    expect(detectWorkspaceShrink(null, richBody()).shrink).toBe(false);
  });
});

describe("fillEmptyServerFieldsFromLocal (lokālās kopijas atjaunošana)", () => {
  it("aizpilda tikai tukšos servera laukus, aizpildītos nemaina", () => {
    const server = withVendor({ ...emptyBody(), iriss: "Servera IRISS" }, "autodna", "Servera AutoDNA");
    const local = richBody();
    const { body, filled } = fillEmptyServerFieldsFromLocal(server, local);
    expect(body.iriss).toBe("Servera IRISS");
    expect(body.sourceBlocks.autodna.comments).toBe("Servera AutoDNA");
    expect(body.apskatesPlāns).toBe(local.apskatesPlāns);
    expect(body.sourceBlocks.carvertical.comments).toBe(local.sourceBlocks.carvertical.comments);
    expect(filled).toEqual(expect.arrayContaining(["apskatesPlāns", "tehniskoRiskuAnalize", "block:carvertical"]));
    expect(filled).not.toContain("iriss");
  });
});

describe("mergeStaleLocalWithServer (409, trīspusēji, bez pulksteņiem)", () => {
  it("servera rakstītājs starp lietotāja labojumu un PATCH -> lietotāja teksts paliek, servera jaunums arī", () => {
    // Cilne redzēja bāzi; lietotājs laboja IRISS; pa to laiku CSDD/CARFAX rakstītājs serverī aizpildīja AutoDNA un pārrakstīja apskates plānu.
    const base = { ...emptyBody(), iriss: "Vecais IRISS", apskatesPlāns: "Vecais plāns" };
    const local = { ...base, iriss: "Nila jaunais IRISS" };
    const server = withVendor({ ...base, apskatesPlāns: "Servera plāns" }, "autodna", "Servera AutoDNA");
    const { body, localChanged } = mergeStaleLocalWithServer(local, server, base);
    expect(body.iriss).toBe("Nila jaunais IRISS");
    expect(body.apskatesPlāns).toBe("Servera plāns");
    expect(body.sourceBlocks.autodna.comments).toBe("Servera AutoDNA");
    expect(localChanged).toEqual(["iriss"]);
  });

  it("nemainīts lokālais lauks nepārraksta jaunāku servera vērtību", () => {
    const base = { ...emptyBody(), iriss: "A" };
    const { body } = mergeStaleLocalWithServer(base, { ...base, iriss: "B no cita pārlūka" }, base);
    expect(body.iriss).toBe("B no cita pārlūka");
  });

  it("dzēsums neatdzīvojas: lietotājs iztukšoja lauku un bloku", () => {
    const base = withVendor({ ...emptyBody(), iriss: "Vecais teksts" }, "autodna", "Vecais AutoDNA");
    const t = Date.now();
    const local = {
      ...withVendor({ ...base, iriss: "" }, "autodna", ""),
      clearedFields: { iriss: t, "block:autodna": t },
    };
    const { body } = mergeStaleLocalWithServer(local, { ...base, cenasAtbilstiba: "Servera cena" }, base);
    expect(body.iriss).toBe("");
    expect(body.sourceBlocks.autodna.comments).toBe("");
    expect(body.cenasAtbilstiba).toBe("Servera cena");
  });

  it("apakšlauki (riska karte, odometra/pretrunu/lielo darbu labojumi, AI ekstrakcija) - šeit mainītie paliek", () => {
    const base = emptyBody();
    const local = {
      ...base,
      technicalRiskMap: { identification: {}, risks: [{ id: "lokāls" }], damage_interpretation: [], recalls: [], strengths: [], unknowns: [] },
      odometerAnomalyOverrides: [{ id: "o1" }],
      contradictionFeedback: [{ fp: "c1" }],
      vehicleAiExtraction: { model: "lokālais" },
    } as unknown as OrderWorkspacePersistBody;
    const server = { ...base, dealerMajorWorkOverrides: [{ id: "servera" }] } as unknown as OrderWorkspacePersistBody;
    const { body } = mergeStaleLocalWithServer(local, server, base);
    expect(body.technicalRiskMap).toEqual(local.technicalRiskMap);
    expect(body.odometerAnomalyOverrides).toEqual(local.odometerAnomalyOverrides);
    expect(body.contradictionFeedback).toEqual(local.contradictionFeedback);
    expect(body.vehicleAiExtraction).toEqual(local.vehicleAiExtraction);
    expect(body.dealerMajorWorkOverrides).toEqual(server.dealerMajorWorkOverrides);
  });

  it("nemainīti apakšlauki ņem servera versiju", () => {
    const base = { ...emptyBody(), odometerAnomalyOverrides: [{ id: "vecs" }] } as unknown as OrderWorkspacePersistBody;
    const server = { ...base, odometerAnomalyOverrides: [{ id: "jauns" }] } as unknown as OrderWorkspacePersistBody;
    const { body } = mergeStaleLocalWithServer(base, server, base);
    expect(body.odometerAnomalyOverrides).toEqual([{ id: "jauns" }]);
  });

  it("abas puses mainīja vienu lauku -> uzvar šī cilne, atzīmēts bothChanged", () => {
    const base = { ...emptyBody(), iriss: "bāze" };
    const r = mergeStaleLocalWithServer({ ...base, iriss: "A" }, { ...base, iriss: "B" }, base);
    expect(r.body.iriss).toBe("A");
    expect(r.bothChanged).toEqual(["iriss"]);
  });

  it("bez bāzes: lokālais aizpildītais uzvar, tukšo aizpilda serveris", () => {
    const local = { ...emptyBody(), iriss: "A" };
    const server = withVendor({ ...emptyBody(), iriss: "B" }, "autodna", "B AutoDNA");
    const { body } = mergeStaleLocalWithServer(local, server, null);
    expect(body.iriss).toBe("A");
    expect(body.sourceBlocks.autodna.comments).toBe("B AutoDNA");
  });
});

describe("divu pārlūku scenārijs", () => {
  it("A rediģē (nesaglabāts), B atver tukšu un saglabā -> A apvienojot neko nepazaudē", () => {
    const base = { ...emptyBody(), cenasAtbilstiba: "x" }; // rev 1 - ko A redzēja atverot
    const aLocal = { ...richBody(), cenasAtbilstiba: "x" };
    const serverAfterB = { ...base }; // B saglabāja tukšu (serveris saglabāja "x")
    const { body } = mergeStaleLocalWithServer(aLocal, serverAfterB, base);
    expect(countWorkspaceFilled(body)).toEqual(countWorkspaceFilled(aLocal));
    expect(body.iriss).toBe(aLocal.iriss);
    expect(body.sourceBlocks.carvertical.comments).toBe(aLocal.sourceBlocks.carvertical.comments);
  });

  it("A rediģē, B saglabā citu lauku -> paliek abu dati", () => {
    const base = emptyBody();
    const { body } = mergeStaleLocalWithServer(
      { ...base, iriss: "A IRISS" },
      withVendor(base, "autodna", "B AutoDNA"),
      base,
    );
    expect(body.iriss).toBe("A IRISS");
    expect(body.sourceBlocks.autodna.comments).toBe("B AutoDNA");
  });
});

describe("changedWorkspaceEditKeys", () => {
  it("atrod mainītos laukus un blokus", () => {
    const a = richBody();
    const b = withVendor({ ...a, iriss: "cits" }, "carfax", "Carfax");
    expect(changedWorkspaceEditKeys(a, b).sort()).toEqual(["block:carfax", "iriss"]);
    expect(changedWorkspaceEditKeys(a, a)).toEqual([]);
  });

  it("jauns bloku objekts ar to pašu saturu nav izmaiņa", () => {
    const a = richBody();
    const b = { ...a, sourceBlocks: JSON.parse(JSON.stringify(a.sourceBlocks)) };
    expect(changedWorkspaceEditKeys(a, b)).toEqual([]);
  });
});

describe("beacon / brīdinājuma nosacījumi", () => {
  it("iemesls prioritārā secībā", () => {
    expect(workspaceUnsavedReason({ persistenceEnabled: false, hydrated: false, revisionConflict: true, saveError: true })).toBe("persistence_off");
    expect(workspaceUnsavedReason({ persistenceEnabled: true, hydrated: false, revisionConflict: true, saveError: true })).toBe("not_hydrated");
    expect(workspaceUnsavedReason({ persistenceEnabled: true, hydrated: true, revisionConflict: true, saveError: true })).toBe("revision_conflict");
    expect(workspaceUnsavedReason({ persistenceEnabled: true, hydrated: true, revisionConflict: false, saveError: true })).toBe("save_error");
    expect(workspaceUnsavedReason({ persistenceEnabled: true, hydrated: true, revisionConflict: false, saveError: false })).toBe("pending");
  });

  it("brīdina tikai pēc ≥10 s un ne saglabāšanas laikā", () => {
    expect(shouldWarnWorkspaceUnsaved({ unsavedSinceMs: null, nowMs: 50_000, saveInFlight: false })).toBe(false);
    expect(shouldWarnWorkspaceUnsaved({ unsavedSinceMs: 45_000, nowMs: 50_000, saveInFlight: false })).toBe(false);
    expect(shouldWarnWorkspaceUnsaved({ unsavedSinceMs: 40_000, nowMs: 50_000, saveInFlight: false })).toBe(true);
    expect(shouldWarnWorkspaceUnsaved({ unsavedSinceMs: 40_000, nowMs: 50_000, saveInFlight: true })).toBe(false);
  });
});
