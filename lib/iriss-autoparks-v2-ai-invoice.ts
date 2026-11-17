import "server-only";

import { aiGenerateJsonWithSchema, getAnthropicApiKeyFromEnv } from "@/lib/admin-ai";
import { readAutoparksFileBytes } from "@/lib/iriss-autoparks-store";
import { carV2Of } from "@/lib/iriss-autoparks-v2";
import { INVOICE_AI_MODEL, INVOICE_AI_SCHEMA, INVOICE_AI_SYSTEM, parseInvoiceAiResult } from "@/lib/iriss-autoparks-v2-ai-invoice-parse";
import { readAutoparksV2State, updateCarV2 } from "@/lib/iriss-autoparks-v2-store";

/**
 * F10: nolasa servisa rēķina kopsummu no PDF ar Claude un saglabā kā IETEIKUMU (`invoice.ai`).
 * `amountEur` netiek aiztikts - to apstiprina cilvēks ar Summu tiesību (1 pieskāriens).
 * Bez ANTHROPIC_API_KEY neko nedara.
 */
export async function readServiceInvoiceAmountWithAi(carId: string, invoiceId: string): Promise<"ok" | "skipped" | "not_found"> {
  if (!getAnthropicApiKeyFromEnv()) return "skipped";
  const v2 = carV2Of(await readAutoparksV2State(), carId);
  const inv = v2.service.invoices.find((i) => i.id === invoiceId);
  if (!inv) return "not_found";
  const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];
  for (const fileId of [inv.fileId, ...inv.extraFileIds]) {
    const got = await readAutoparksFileBytes(fileId).catch(() => null);
    if (got && got.car.id === carId) parts.push({ inlineData: { mimeType: "application/pdf", data: got.bytes.toString("base64") } });
  }
  if (parts.length === 0) return "not_found";
  parts.push({ text: "Nolasi šī servisa rēķina kopsummu bez PVN." });
  let ai;
  try {
    const raw = await aiGenerateJsonWithSchema({
      model: INVOICE_AI_MODEL,
      systemInstruction: INVOICE_AI_SYSTEM,
      parts,
      responseSchema: INVOICE_AI_SCHEMA,
      maxTokens: 4000,
    });
    ai = parseInvoiceAiResult(raw, INVOICE_AI_MODEL);
  } catch (e) {
    ai = parseInvoiceAiResult("", INVOICE_AI_MODEL);
    ai.error = (e instanceof Error ? e.message : "ai_failed").slice(0, 120);
  }
  await updateCarV2(
    carId,
    (c) => {
      const target = c.service.invoices.find((i) => i.id === invoiceId);
      if (target) target.ai = ai;
      return { result: null, write: true };
    },
    { id: "ai", name: "AI" },
  );
  return "ok";
}
