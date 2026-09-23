/**
 * Pārlūka puses palīgs: savāc pasūtījuma brīvo tekstu, sūta uz
 * /api/admin/report-translate, pielieto tulkoto tekstu atpakaļ payload.
 * Statiskais apvalks (virsraksti u.c.) tiek tulkots atsevišķi, tieši
 * `buildClientReportDocumentHtml({ lang })` iekšienē — bez AI.
 */
import type { ClientReportPayload } from "@/lib/client-report-html";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import {
  applyHtmlTextTranslations,
  collectHtmlTextsNeedingTranslation,
  maskHtmlProtectedRegions,
  unmaskHtmlProtectedRegions,
} from "@/lib/client-report-html-residue";
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

export type ClientReportTranslationCache = Partial<Record<"en" | "ru", ClientReportTranslationCacheEntry>> & {
  /** Atlikušais HTML teksts (CSDD, laikposms, kājene), atsevišķi no komentāru kartes. */
  html?: Partial<Record<"en" | "ru", ClientReportTranslationCacheEntry>>;
};

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

  const translated = await postClientReportTranslation(sessionId, lang, texts);

  if (cache) cache[lang] = { hash, texts: translated };

  return applyClientReportTranslatedTexts(payload, translated);
}

const HTML_TRANSLATE_CHUNK = 40;

async function postClientReportTranslation(
  sessionId: string,
  lang: "en" | "ru",
  texts: TranslatableFieldMap,
): Promise<TranslatableFieldMap> {
  const res = await fetch("/api/admin/report-translate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, lang, texts }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(
      `client_report_translate_failed:${res.status}${detail?.error ? `:${detail.error}` : ""}`,
    );
  }
  const data = (await res.json()) as { texts?: TranslatableFieldMap };
  return data.texts ?? {};
}

/**
 * Otrais gājiens: viss, kas HTML palicis latviski pēc komentāru tulkojuma un
 * statiskās vārdnīcas (CSDD defekti, laikposms, valstu nosaukumi, "N ieraksti").
 */
export async function translateClientReportHtmlResidue(
  html: string,
  sessionId: string,
  lang: ClientReportLang,
  cache?: ClientReportTranslationCache,
): Promise<string> {
  if (lang === "lv") return html;

  const masked = maskHtmlProtectedRegions(html);
  const segments = collectHtmlTextsNeedingTranslation(masked.html);
  if (segments.length === 0) return html;

  const source: TranslatableFieldMap = {};
  segments.forEach((text, index) => {
    source[`t${index}`] = text;
  });
  const hash = hashTranslatableTexts(source);
  const cached = cache?.html?.[lang];
  let byOriginal: TranslatableFieldMap;

  if (cached && cached.hash === hash) {
    byOriginal = cached.texts;
  } else {
    byOriginal = {};
    const ids = Object.keys(source);
    for (let i = 0; i < ids.length; i += HTML_TRANSLATE_CHUNK) {
      const slice: TranslatableFieldMap = {};
      for (const id of ids.slice(i, i + HTML_TRANSLATE_CHUNK)) slice[id] = source[id];
      const translated = await postClientReportTranslation(sessionId, lang, slice);
      for (const id of Object.keys(slice)) {
        const value = translated[id];
        if (typeof value === "string" && value.trim()) byOriginal[slice[id]] = value;
      }
    }
    if (cache) {
      if (!cache.html) cache.html = {};
      cache.html[lang] = { hash, texts: byOriginal };
    }
  }

  return unmaskHtmlProtectedRegions(applyHtmlTextTranslations(masked.html, byOriginal), masked.blocks);
}
