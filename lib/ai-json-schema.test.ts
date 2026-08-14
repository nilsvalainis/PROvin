import { describe, expect, it } from "vitest";
import { JsonType, toClaudeJsonSchema } from "@/lib/ai-json-schema";
import { CSDD_AI_RESPONSE_SCHEMA } from "@/lib/csdd-ai-structured-map";
import { VENDOR_PDF_AGENT_SCHEMA } from "@/lib/vendor-pdf-agent-payload";

type SchemaNode = {
  type?: unknown;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  required?: string[];
  additionalProperties?: unknown;
};

/** Katrs objekts shēmā — Anthropic prasa `additionalProperties: false` un pilnu `required`. */
function eachObjectNode(node: SchemaNode, visit: (n: SchemaNode) => void): void {
  if (!node || typeof node !== "object") return;
  if (node.type === "object" && node.properties) {
    visit(node);
    for (const child of Object.values(node.properties)) eachObjectNode(child, visit);
  }
  if (node.items) eachObjectNode(node.items, visit);
}

describe("toClaudeJsonSchema", () => {
  it("marks every object closed and every property required", () => {
    const out = toClaudeJsonSchema({
      type: JsonType.OBJECT,
      properties: {
        name: { type: JsonType.STRING },
        nested: {
          type: JsonType.OBJECT,
          properties: { km: { type: JsonType.INTEGER } },
        },
      },
      required: ["name"],
    }) as SchemaNode;

    expect(out.additionalProperties).toBe(false);
    expect(out.required).toEqual(["name", "nested"]);
    expect(out.properties?.nested.additionalProperties).toBe(false);
    expect(out.properties?.nested.required).toEqual(["km"]);
  });

  it("strips keywords Claude structured outputs rejects", () => {
    const out = toClaudeJsonSchema({
      type: JsonType.OBJECT,
      properties: {
        km: { type: JsonType.INTEGER, minimum: 0, maximum: 1_000_000 },
        vin: { type: JsonType.STRING, pattern: "^[A-Z0-9]+$", minLength: 11, nullable: true },
        tags: { type: JsonType.ARRAY, items: { type: JsonType.STRING }, minItems: 1 },
      },
    }) as SchemaNode;

    const km = out.properties?.km as Record<string, unknown>;
    const vin = out.properties?.vin as Record<string, unknown>;
    const tags = out.properties?.tags as Record<string, unknown>;

    expect(km).toEqual({ type: "integer" });
    expect(vin).toEqual({ type: "string" });
    expect(tags).toEqual({ type: "array", items: { type: "string" } });
  });

  it("keeps enum and description, which the API supports", () => {
    const out = toClaudeJsonSchema({
      type: JsonType.OBJECT,
      properties: {
        vendor: { type: JsonType.STRING, enum: ["autodna", "carvertical"], description: "Avots" },
      },
    }) as SchemaNode;

    expect(out.properties?.vendor).toEqual({
      type: "string",
      enum: ["autodna", "carvertical"],
      description: "Avots",
    });
  });

  it("does not mutate the source schema", () => {
    const source = {
      type: JsonType.OBJECT,
      properties: { km: { type: JsonType.INTEGER, minimum: 0 } },
    };
    toClaudeJsonSchema(source);
    expect(source.properties.km).toEqual({ type: "integer", minimum: 0 });
  });

  it("normalizes the real CSDD and vendor PDF schemas end to end", () => {
    for (const schema of [CSDD_AI_RESPONSE_SCHEMA, VENDOR_PDF_AGENT_SCHEMA]) {
      const out = toClaudeJsonSchema(schema) as SchemaNode;
      let objectCount = 0;
      eachObjectNode(out, (node) => {
        objectCount++;
        expect(node.additionalProperties).toBe(false);
        expect(node.required).toEqual(Object.keys(node.properties ?? {}));
      });
      expect(objectCount).toBeGreaterThan(0);
      expect(JSON.stringify(out)).not.toMatch(/"(minimum|maxLength|pattern|nullable|format)"/);
    }
  });
});
