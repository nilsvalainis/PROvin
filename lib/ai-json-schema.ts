/**
 * JSON Schema tipi Claude Structured Outputs shēmām (`output_config.format`).
 * Normalizāciju uz Anthropic atbalstīto apakškopu dara `toClaudeJsonSchema`.
 */
export const JsonType = {
  OBJECT: "object",
  ARRAY: "array",
  STRING: "string",
  INTEGER: "integer",
  NUMBER: "number",
  BOOLEAN: "boolean",
} as const;

export type AiJsonSchema = Record<string, unknown>;

/** Atslēgas, ko Claude structured outputs neatbalsta — jānoņem pirms sūtīšanas. */
const UNSUPPORTED_SCHEMA_KEYS = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
  "format",
  "default",
  "example",
  "examples",
  "nullable",
  "multipleOf",
  "uniqueItems",
  "propertyOrdering",
]);

/**
 * Claude Structured Outputs shēmu profils: `additionalProperties: false` un visi
 * lauki `required`. Anthropic limits ir 24 neobligāti lauki un 16 union lauki uz
 * pieprasījumu, tāpēc lielās PDF ekstrakcijas shēmas citādi netiek nokompilētas.
 */
export function toClaudeJsonSchema(schema: AiJsonSchema): AiJsonSchema {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;

    const src = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) {
      if (UNSUPPORTED_SCHEMA_KEYS.has(k)) continue;
      out[k] = walk(v);
    }

    if (out.type === "object" && out.properties && typeof out.properties === "object") {
      out.additionalProperties = false;
      out.required = Object.keys(out.properties as Record<string, unknown>);
    }
    return out;
  };

  return walk(schema) as AiJsonSchema;
}
