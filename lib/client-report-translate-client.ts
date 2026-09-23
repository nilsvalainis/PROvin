/**
 * Pārlūka puses palīgs: savāc pasūtījuma brīvo tekstu, sūta uz
 * /api/admin/report-translate, pielieto tulkoto tekstu atpakaļ payload.
 * Statiskais apvalks (virsraksti u.c.) tiek tulkots atsevišķi, tieši
 * `buildClientReportDocumentHtml({ lang })` iekšienē — bez AI.
 */
import type { ClientReportPayload } from "@/lib/client-report-html";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import {
  applyClientReportTranslatedTexts,
  collectClientReportTranslatableTexts,
  hashTranslatableTexts,
  type TranslatableFieldMap,
} from "@/lib/client-report-translatable-fields";

export type ClientReportTranslationCacheEntry = {
  hash: string;
  texts: TranslatableFieldMap;
};

export type ClientReportTranslationCache = Partial<Record<"en" | "ru", ClientReportTranslationCacheEntry>>;

/**
 * Iztulko payload dinamisko tekstu uz EN/RU. `lv` netiek pieskarts (atgriež to pašu payload).
 * `cache` (ja padots) tiek lasīts un rakstīts pa vietai (mutē objektu) — izsaucējam jāglabā `useRef`.
 */
export async function translateClientReportPayloadForPrint(
  payload: ClientReportPayload,
  sessionId: string,
  lang: ClientReportLang,
  cache?: ClientReportTranslationCache,
): Promise<ClientReportPayload> {
  if (lang === "lv") return payload;

  const texts = collectClientReportTranslatableTexts(payload);
  const hash = hashTranslatableTexts(texts);
  const cached = cache?.[lang];

  if (cached && cached.hash === hash) {
    return applyClientReportTranslatedTexts(payload, cached.texts);
  }

  const res = await fetch("/api/admin/report-translate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, lang, texts }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(
      `client_report_translate_failed:${res.status}${detail?.error ? `:${detail.error}` : ""}`,
    );
  }
  const data = (await res.json()) as { texts?: TranslatableFieldMap };
  const translated = data.texts ?? {};

  if (cache) cache[lang] = { hash, texts: translated };

  return applyClientReportTranslatedTexts(payload, translated);
}
