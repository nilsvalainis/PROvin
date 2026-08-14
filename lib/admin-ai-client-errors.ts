/** Admin AI UI — kopīga fetch kļūdu tulkošana latviski (client-safe). */

export type AdminAiApiErrorBody = {
  error?: string;
  detail?: string;
  message?: string;
};

const ERROR_MESSAGES_LV: Record<string, string> = {
  missing_ai_key: "Nav ANTHROPIC_API_KEY (.env.local / Vercel Environment Variables)",
  ai_demo_only: "AI pieejams tikai DEMO pasūtījumiem (AI_DEMO_ONLY=1)",
  unauthorized: "Nav admin piekļuves — pārlogojies admin panelī",
  not_found: "Pasūtījums nav atrasts — pārbaudi sessionId un STRIPE_SECRET_KEY (Vercel)",
  missing_session_id: "Trūkst pasūtījuma ID (sessionId)",
  invalid_json: "Nederīgs pieprasījuma JSON",
  invalid_body: "Nederīgs pieprasījuma saturs",
  invalid_block_key: "Nederīgs avota bloka identifikators",
  empty_text: "Ievadi tekstu pirms gramatikas labošanas",
  empty_source_data: "Trūkst avota datu — aizpildi tabulas vai laukus",
  empty_order_context: "Trūkst avotu datu — ievadi sludinājuma saiti vai aizpildi avotu laukus",
  empty_mileage_data: "Trūkst nobraukuma datu — aizpildi CSDD vai avotu tabulas",
  empty_incident_data: "Trūkst negadījumu datu — aizpildi avotu tabulas",
  missing_expert_sections: "Vispirms aizpildi pārdevēja, ieteikumu vai cenas sadaļu",
  missing_seller_input: "Ievadi papildus nosaukumu vai sludinājuma aprakstu",
  listing_scrape_failed: "Neizdevās nolasīt ss.lv sludinājumu — pārbaudi saiti",
  ai_empty_content: "AI atgrieza tukšu atbildi (iespējams satura filtrs)",
  ai_invalid_json: "AI atgrieza nevalīdu JSON — mēģini vēlreiz",
  missing_files: "Pievieno vismaz vienu PDF",
  extraction_failed: "Neizdevās izvilkt datus no PDF",
  pdf_extract_failed: "Neizdevās nolasīt PDF tekstu",
  pdf_extract_empty:
    "PDF teksta slānis tukšs (skenēts dokuments) — izmanto „Analizēt ar AI” (PDF tiek nosūtīts tieši)",
  payload_too_large: "Augšupielāde pārāk liela — samazini PDF izmēru vai skaitu",
  no_pdf_input: "Neizdevās sagatavot PDF AI analīzei",
};

function humanizeAiDetail(raw: string): string {
  const detail = raw.trim();
  if (!detail) return "";

  if (/not_found_error|unknown model|model.*not.*found/i.test(detail)) {
    return "Claude modelis nav pieejams šai API atslēgai — pārbaudi claude-opus-5 / claude-sonnet-5 un ANTHROPIC_API_KEY";
  }
  if (/credit balance is too low|billing/i.test(detail)) {
    return "Anthropic kontā nepietiek kredīta — papildini Anthropic Console → Billing";
  }
  if (/429|quota|rate.?limit/i.test(detail)) {
    return "Anthropic API limits pārsniegts — uzgaidi vai palielini limitu Anthropic Console";
  }
  if (/529|overloaded|pārslogots/i.test(detail)) {
    return "Claude īslaicīgi pārslogots — mēģini vēlreiz pēc brīža";
  }
  if (/authentication_error|invalid x-api-key|invalid.*api.?key/i.test(detail)) {
    return "Nederīga ANTHROPIC_API_KEY — izveido jaunu atslēgu Anthropic Console";
  }
  if (/permission_error/i.test(detail)) {
    return "ANTHROPIC_API_KEY nav tiesību uz šo modeli — pārbaudi Anthropic Console";
  }
  if (detail === "missing_ai_key") return ERROR_MESSAGES_LV.missing_ai_key;
  if (ERROR_MESSAGES_LV[detail]) return ERROR_MESSAGES_LV[detail];

  return detail.startsWith("AI:") ? detail : `AI: ${detail}`;
}

export function formatAdminAiFetchError(
  data: AdminAiApiErrorBody | null | undefined,
  res: Pick<Response, "status">,
  fallback = "AI: neizdevās",
): string {
  const code = typeof data?.error === "string" ? data.error.trim() : "";
  const detailRaw =
    (typeof data?.detail === "string" ? data.detail.trim() : "") ||
    (typeof data?.message === "string" ? data.message.trim() : "");

  if (
    code &&
    ERROR_MESSAGES_LV[code] &&
    code !== "generation_failed" &&
    code !== "polish_failed" &&
    code !== "pdf_extract_failed"
  ) {
    return ERROR_MESSAGES_LV[code];
  }

  if (code === "pdf_extract_failed" && detailRaw) {
    return detailRaw;
  }

  if (code === "generation_failed" || code === "polish_failed") {
    return detailRaw ? humanizeAiDetail(detailRaw) : fallback;
  }

  if (detailRaw) return humanizeAiDetail(detailRaw);
  if (code) return humanizeAiDetail(code);

  if (res.status === 401) return ERROR_MESSAGES_LV.unauthorized;
  if (res.status === 503) return ERROR_MESSAGES_LV.missing_ai_key;
  if (res.status === 404) return ERROR_MESSAGES_LV.not_found;
  if (res.status === 504 || res.status === 408) {
    return "AI: pieprasījums pārāk ilgs (timeout) — mēģini vēlreiz ar īsāku tekstu";
  }
  if (res.status >= 500) {
    return `AI: servera kļūda (HTTP ${res.status}) — pārbaudi Vercel logus un ANTHROPIC_API_KEY`;
  }

  return fallback;
}

export async function parseAdminAiResponse(res: Response): Promise<{
  data: AdminAiApiErrorBody & { text?: string };
  parseFailed: boolean;
}> {
  try {
    const data = (await res.json()) as AdminAiApiErrorBody & { text?: string };
    return { data, parseFailed: false };
  } catch {
    return { data: {}, parseFailed: true };
  }
}
