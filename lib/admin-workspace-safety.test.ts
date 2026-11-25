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

describe("mergeStaleLocalWithServer (409, novecojusi cilne)", () => {
  const serverSavedAt = 1_000_000;

  it("servera aizpildītais lauks paliek, ja lokāli nav mainīts pēc servera saglabāšanas", () => {
    const server = { ...emptyBody(), iriss: "Jaunais no B" };
    const local = { ...emptyBody(), iriss: "Vecais A", apskatesPlāns: "A plāns" };
    const m = mergeStaleLocalWithServer(local, server, { iriss: serverSavedAt - 5 }, serverSavedAt);
    expect(m.iriss).toBe("Jaunais no B");
    expect(m.apskatesPlāns).toBe("A plāns");
  });

  it("lokāli tikko mainīts lauks (jaunāks par servera saglabāšanu) uzvar", () => {
    const server = { ...emptyBody(), iriss: "B teksts" };
    const local = { ...emptyBody(), iriss: "A labojums" };
    const m = mergeStaleLocalWithServer(local, server, { iriss: serverSavedAt + 5 }, serverSavedAt);
    expect(m.iriss).toBe("A labojums");
  });

  it("veca lokālā notīrīšana neiztukšo servera datus", () => {
    const server = withVendor(emptyBody(), "autodna", "B AutoDNA");
    const local = { ...emptyBody(), clearedFields: { iriss: serverSavedAt - 100 }, sourceBlockWipes: ["autodna" as const] };
    const m = mergeStaleLocalWithServer({ ...local, iriss: "" }, { ...server, iriss: "B IRISS" }, {}, serverSavedAt);
    expect(m.iriss).toBe("B IRISS");
    expect(m.sourceBlocks.autodna.comments).toBe("B AutoDNA");
  });

  it("bloks: servera aizpildītais paliek, tukšo aizpilda lokālais", () => {
    const server = withVendor(emptyBody(), "autodna", "B AutoDNA");
    const local = withVendor(withVendor(emptyBody(), "autodna", "A vecais AutoDNA"), "carvertical", "A CarVertical");
    const m = mergeStaleLocalWithServer(local, server, {}, serverSavedAt);
    expect(m.sourceBlocks.autodna.comments).toBe("B AutoDNA");
    expect(m.sourceBlocks.carvertical.comments).toBe("A CarVertical");
  });
});

describe("divu pārlūku scenārijs", () => {
  it("A rediģē (nesaglabāts), B atver tukšu un saglabā -> A apvienojot neko nepazaudē", () => {
    const t0 = 1_000_000;
    // Serverī sākumā gandrīz tukšs (rev 1). A aizpilda laukus, bet PATCH neaiziet.
    const aLocal = richBody();
    const aStamps = { iriss: t0 + 10, apskatesPlāns: t0 + 20, tehniskoRiskuAnalize: t0 + 30, "block:autodna": t0 + 40, "block:carvertical": t0 + 50 } as const;
    // B atver tukšu un saglabā (rev 2) vēlāk.
    const bSavedAt = t0 + 1000;
    const serverAfterB = emptyBody();
    // A nākamais PATCH -> 409 -> apvienošana.
    const merged = mergeStaleLocalWithServer(aLocal, serverAfterB, aStamps, bSavedAt);
    expect(countWorkspaceFilled(merged)).toEqual(countWorkspaceFilled(aLocal));
    expect(merged.iriss).toBe(aLocal.iriss);
    expect(merged.sourceBlocks.carvertical.comments).toBe(aLocal.sourceBlocks.carvertical.comments);
  });

  it("A rediģē, B saglabā citu lauku -> paliek abu dati", () => {
    const aLocal = { ...emptyBody(), iriss: "A IRISS" };
    const serverAfterB = withVendor(emptyBody(), "autodna", "B AutoDNA");
    const merged = mergeStaleLocalWithServer(aLocal, serverAfterB, { iriss: 10 }, 20);
    expect(merged.iriss).toBe("A IRISS");
    expect(merged.sourceBlocks.autodna.comments).toBe("B AutoDNA");
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
