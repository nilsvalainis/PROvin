/** Admin Gemini UI — kopīga fetch kļūdu tulkošana latviski (client-safe). */

export type AdminGeminiApiErrorBody = {
  error?: string;
  detail?: string;
  message?: string;
};

const ERROR_MESSAGES_LV: Record<string, string> = {
  missing_gemini_key: "Nav GEMINI_API_KEY (.env.local / Vercel Environment Variables)",
  gemini_demo_only: "Gemini pieejams tikai DEMO pasūtījumiem (GEMINI_DEMO_ONLY=1)",
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
  gemini_empty_content: "Gemini atgrieza tukšu atbildi (iespējams satura filtrs)",
  gemini_invalid_json: "Gemini atgrieza nevalīdu JSON — mēģini vēlreiz",
  missing_files: "Pievieno vismaz vienu PDF",
  extraction_failed: "Neizdevās izvilkt datus no PDF",
  pdf_extract_failed: "Neizdevās nolasīt PDF tekstu",
  pdf_extract_empty:
    "PDF teksta slānis tukšs (skenēts dokuments) — izmanto „Analizēt ar Gemini” (PDF tiek nosūtīts tieši)",
  payload_too_large: "Augšupielāde pārāk liela — samazini PDF izmēru vai skaitu",
  no_pdf_input: "Neizdevās sagatavot PDF Gemini analīzei",
};

function humanizeGeminiDetail(raw: string): string {
  const detail = raw.trim();
  if (!detail) return "";

  if (/404.*models\/gemini|is not found for API version/i.test(detail)) {
    return "Gemini modelis nav pieejams šai API atslēgai — pārbaudi gemini-2.5-pro / gemini-2.5-flash un GEMINI_API_KEY";
  }
  if (/429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(detail)) {
    return "Gemini API kvota pārsniegta — uzgaidi vai pārbaudi Google AI Studio billing";
  }
  if (/503|high\s+demand|SERVICE_UNAVAILABLE|pārslogots/i.test(detail)) {
    return "Gemini īslaicīgi pārslogots — mēģini vēlreiz pēc brīža";
  }
  if (/API key not valid|API_KEY_INVALID|invalid.*api.?key/i.test(detail)) {
    return "Nederīga GEMINI_API_KEY — ģenerē jaunu atslēgu Google AI Studio";
  }
  if (detail === "missing_gemini_key") return ERROR_MESSAGES_LV.missing_gemini_key;
  if (ERROR_MESSAGES_LV[detail]) return ERROR_MESSAGES_LV[detail];

  return detail.startsWith("Gemini:") ? detail : `Gemini: ${detail}`;
}

export function formatAdminGeminiFetchError(
  data: AdminGeminiApiErrorBody | null | undefined,
  res: Pick<Response, "status">,
  fallback = "Gemini: neizdevās",
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
    return detailRaw ? humanizeGeminiDetail(detailRaw) : fallback;
  }

  if (detailRaw) return humanizeGeminiDetail(detailRaw);
  if (code) return humanizeGeminiDetail(code);

  if (res.status === 401) return ERROR_MESSAGES_LV.unauthorized;
  if (res.status === 503) return ERROR_MESSAGES_LV.missing_gemini_key;
  if (res.status === 404) return ERROR_MESSAGES_LV.not_found;
  if (res.status === 504 || res.status === 408) {
    return "Gemini: pieprasījums pārāk ilgs (timeout) — mēģini vēlreiz ar īsāku tekstu";
  }
  if (res.status >= 500) {
    return `Gemini: servera kļūda (HTTP ${res.status}) — pārbaudi Vercel logus un GEMINI_API_KEY`;
  }

  return fallback;
}

export async function parseAdminGeminiResponse(res: Response): Promise<{
  data: AdminGeminiApiErrorBody & { text?: string };
  parseFailed: boolean;
}> {
  try {
    const data = (await res.json()) as AdminGeminiApiErrorBody & { text?: string };
    return { data, parseFailed: false };
  } catch {
    return { data: {}, parseFailed: true };
  }
}
