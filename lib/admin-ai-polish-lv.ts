import "server-only";

/**
 * Groq OpenAI-saderīgais Chat API (server only).
 * `GROQ_API_KEY` no `process.env`; klienta komponenti izsauc tikai API maršrutus.
 */

/** Latviešu gramatikas / stila labošana (admin, ✨ `/api/admin/ai-polish-lv`). */
export const LV_POLISH_SYSTEM_PROMPT =
  "Tu esi latviešu valodas redaktors. Izlabo gramatikas un stila kļūdas šajā auto apskates atskaites tekstā, saglabājot profesionālu auto eksperta toni. Atgriez TIKAI laboto tekstu bez komentāriem.";

/** Sludinājuma iekopētais apraksts → pārdošanas konteksts eksperta atskaitei (admin). */
export const LV_LISTING_ANALYSIS_SYSTEM_PROMPT =
  "Tu esi auto tirgus un tehniskās atskaites asistents. Lietotājs iesniedz sludinājuma aprakstu (bieži neapkoptu, kopētu no portāla). Izveido īsu, profesionālu tekstu latviešu valodā laukam „Pārdošanas sludinājuma konteksts”: izcel galveno pārdošanas vēstījumu, būtiskās tehniskās norādes, cenu/ nobraukuma kontekstu (ja minēts), acīmredzamas pretrunas vai riskus. Saglabā objektīvu toni. Atgriez TIKAI gatavo tekstu bez ievada, kopsavilkuma virsraksta vai paskaidrojumiem par uzdevumu.";

const MAX_INPUT_CHARS = 48_000;

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Gramatikai — ātrs; analīzei — jaudīgāks. */
const GROQ_MODEL_POLISH = "llama3-8b-8192";
const GROQ_MODEL_ANALYZE = "llama3-70b-8192";

type GroqChatBody = {
  model: string;
  messages: { role: "system" | "user"; content: string }[];
  temperature?: number;
};

function extractContentFromOpenAIChatJson(json: unknown): string {
  if (!json || typeof json !== "object") throw new Error("groq_invalid_json");
  const r = json as Record<string, unknown>;
  const choices = r.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("groq_empty_choices");
  }
  const c0 = choices[0] as Record<string, unknown>;
  const message = c0.message as Record<string, unknown> | undefined;
  const content = typeof message?.content === "string" ? message.content.trim() : "";
  if (!content) throw new Error("groq_empty_content");
  return content;
}

async function groqChatComplete(
  model: string,
  systemPrompt: string,
  userText: string,
  temperature: number,
): Promise<string> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) {
    throw new Error("missing_groq_key");
  }
  const userContent = userText.slice(0, MAX_INPUT_CHARS);
  const body: GroqChatBody = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature,
  };

  const response = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status !== 200) {
    const errBody = await response.text();
    let payloadForLog: string;
    try {
      payloadForLog = JSON.stringify(JSON.parse(errBody) as unknown);
    } catch {
      payloadForLog = errBody;
    }
    console.error("[Groq] HTTP status nav 200:", {
      status: response.status,
      statusText: response.statusText,
      body: payloadForLog,
    });
    throw new Error(errBody);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error("groq_invalid_response_body");
  }
  return extractContentFromOpenAIChatJson(json);
}

/** Tikai servera API maršrutiem. Atslēga: `process.env.GROQ_API_KEY`. */
export function getGroqApiKeyFromEnv(): string | null {
  const k = process.env.GROQ_API_KEY?.trim();
  return k || null;
}

export async function polishLatvianTextWithGroq(raw: string): Promise<string> {
  return groqChatComplete(GROQ_MODEL_POLISH, LV_POLISH_SYSTEM_PROMPT, raw, 0.2);
}

export async function analyzeListingPasteForSalesContextWithGroq(raw: string): Promise<string> {
  return groqChatComplete(GROQ_MODEL_ANALYZE, LV_LISTING_ANALYSIS_SYSTEM_PROMPT, raw, 0.35);
}
