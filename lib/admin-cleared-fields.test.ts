import { describe, expect, it } from "vitest";
import { coalesceOrderWorkspacePersistBody, normalizeOrderWorkspacePersistBody, serializeOrderWorkspaceSnapshotFromRef, type OrderWorkspacePersistBody } from "@/lib/admin-order-workspace-persist";
import { createDefaultSourceBlocks, hydrateWorkspaceFromStorage } from "@/lib/admin-source-blocks";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
import { nextClearedFields } from "@/lib/admin-cleared-fields";
import { coalesceOrderDraftWorkspacePatch, orderDraftWorkspaceToPersistBody, persistBodyToOrderDraftWorkspace } from "@/lib/admin-order-draft-workspace-merge";

function body(x: { iriss?: string; csddRaw?: string; makeModel?: string } = {}, extra: Partial<OrderWorkspacePersistBody> = {}) {
  const blocks = createDefaultSourceBlocks();
  return normalizeOrderWorkspacePersistBody({
    sourceBlocks: { ...blocks, csdd: { ...blocks.csdd, rawUnprocessedData: x.csddRaw ?? "", makeModel: x.makeModel ?? "" } },
    iriss: x.iriss ?? "",
    apskatesPlāns: "<p>Plāns</p>",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
    vehicleAiExtraction: null,
    vehicleAiExtractionMeta: null,
    ...extra,
  });
}

describe("K2 cleared fields", () => {
  it("bez marķiera — vecā uzvedība (tukšs neiztukšo baseline)", () => {
    const m = coalesceOrderWorkspacePersistBody(body({ iriss: "" }), body({ iriss: "<p>Vecs</p>" }));
    expect(m.iriss).toBe("<p>Vecs</p>");
  });
  it("iztukšots IRISS ar marķieri paliek tukšs", () => {
    const m = coalesceOrderWorkspacePersistBody(body({ iriss: "" }, { clearedFields: { iriss: 5 } }), body({ iriss: "<p>Vecs</p>" }));
    expect(m.iriss).toBe("");
    expect(m.apskatesPlāns).toBe("<p>Plāns</p>");
    expect(m.clearedFields).toEqual({ iriss: 5 });
  });
  it("iztukšots bloka lauks paliek tukšs; raw un citi lauki nemainīti", () => {
    const m = coalesceOrderWorkspacePersistBody(
      body({ csddRaw: "CSDD RAW", makeModel: "" }, { clearedFields: { "block:csdd": 5 } }),
      body({ csddRaw: "CSDD RAW", makeModel: "Audi A6" }),
    );
    expect(m.sourceBlocks.csdd.makeModel).toBe("");
    expect(m.sourceBlocks.csdd.rawUnprocessedData).toBe("CSDD RAW");
  });
  it("nextClearedFields: iztukšošana ieliek, aizpildīšana noņem", () => {
    const a = body({ iriss: "<p>x</p>", makeModel: "Audi" });
    const b = body({ iriss: "", makeModel: "" });
    const c = nextClearedFields(a as never, b as never, {}, 7);
    expect(c).toEqual({ iriss: 7, "block:csdd": 7 });
    expect(nextClearedFields(b as never, a as never, c, 8)).toEqual({ "block:csdd": 7 });
  });
  it("marķieri izdzīvo localStorage un server draft apli", () => {
    const b = body({ iriss: "" }, { clearedFields: { iriss: 5 } });
    expect(hydrateWorkspaceFromStorage(serializeOrderWorkspaceSnapshotFromRef(b, mergePdfVisibility({}), {}))?.clearedFields).toEqual({ iriss: 5 });
    const res = coalesceOrderDraftWorkspacePatch(
      persistBodyToOrderDraftWorkspace(b, mergePdfVisibility({}), {}),
      persistBodyToOrderDraftWorkspace(body({ iriss: "<p>Vecs</p>" }), mergePdfVisibility({}), {}),
      "cs_t",
    );
    expect(orderDraftWorkspaceToPersistBody(res.workspace).iriss).toBe("");
  });
});
