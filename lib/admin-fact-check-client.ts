/**
 * Admin faktu pārbaudes klients: atslēgas, lauku vākšana, POST.
 * Tekstu nemaina. `useAi: true` sūta tikai poga «AI pārbaude» (28.11, Nils «jā») - nekad automātiski;
 * serverī AI darbojas tikai ar UNIT_FACT_CHECK_AI=1.
 */
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import {
  AI_SOURCE_COMMENT_BLOCK_KEYS,
  sourceBlockCommentsPlain,
  sourceCommentAiBusyKey,
} from "@/lib/admin-source-comment-blocks";
import { mergeSourceBlocksWithDefaults, SOURCE_BLOCK_LABELS, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import {
  ADMIN_INCIDENTS_SUMMARY_LABEL,
  ADMIN_MILEAGE_HISTORY_COMMENT_LABEL,
  ADMIN_SOURCES_COMPARISON_LABEL,
  ADMIN_SUMMARY_SECTION_INSPECTION_HEADING,
  ADMIN_SUMMARY_SECTION_RISK_HEADING,
  ADMIN_SUMMARY_SECTION_SUMMARY_HEADING,
} from "@/lib/admin-workspace-field-labels";
import { dealerSignalsPdfRows, type DealerSignalsState } from "@/lib/dealer-signals";
import type { ProvinManualBanner } from "@/lib/provin-alert-banners";
import type { FactCheckFlag, FactCheckResult } from "@/lib/unit-facts/types";

export function parseVehicleYear(modelYear?: string | null, firstRegistration?: string | null): number | null {
  const y = Number.parseInt(String(modelYear ?? "").trim(), 10);
  if (y > 1980 && y < 2100) return y;
  const m = String(firstRegistration ?? "").match(/\b(19[89]\d|20[0-4]\d)\b/);
  return m ? Number(m[1]) : null;
}

export type FactCheckFieldText = {
  field: string;
  label: string;
  text: string;
};

export function factCheckDismissKey(flag: Pick<FactCheckFlag, "id" | "sentence">): string {
  return `${flag.id}|${flag.sentence}`;
}

export function isIntervalWarningFlag(flag: FactCheckFlag): boolean {
  if (flag.level !== "W") return false;
  if (flag.id === "unsourced_interval") return true;
  const blob = `${flag.id} ${flag.factId ?? ""} ${flag.message}`.toLowerCase();
  return /intervāl|interval/.test(blob);
}

export function visibleFactCheckFlags(
  flags: readonly FactCheckFlag[] | undefined,
  dismissed: ReadonlySet<string> | readonly string[],
): FactCheckFlag[] {
  const skip = dismissed instanceof Set ? dismissed : new Set(dismissed);
  return (flags ?? []).filter((f) => !skip.has(factCheckDismissKey(f)));
}

export function openErrorFactCheckFlags(
  flags: readonly FactCheckFlag[] | undefined,
  dismissed: ReadonlySet<string> | readonly string[],
): FactCheckFlag[] {
  return visibleFactCheckFlags(flags, dismissed).filter((f) => f.level === "E");
}

export function collectFilledFactCheckFields(input: {
  tehniskoRiskuAnalize: string;
  iriss: string;
  apskatesPlāns: string;
  mileageComment: string;
  incidentsComment: string;
  sourcesComparisonComment: string;
  sourceBlocks: WorkspaceSourceBlocks;
}): FactCheckFieldText[] {
  const out: FactCheckFieldText[] = [];
  const push = (field: string, label: string, html: string) => {
    const text = adminRichHtmlToPlainText(html).trim();
    if (!text) return;
    out.push({ field, label, text });
  };

  push("technical_risks", ADMIN_SUMMARY_SECTION_RISK_HEADING, input.tehniskoRiskuAnalize);
  push("inspection", ADMIN_SUMMARY_SECTION_INSPECTION_HEADING, input.apskatesPlāns);
  push("summary", ADMIN_SUMMARY_SECTION_SUMMARY_HEADING, input.iriss);
  push("mileage", ADMIN_MILEAGE_HISTORY_COMMENT_LABEL, input.mileageComment);
  push("incidents", ADMIN_INCIDENTS_SUMMARY_LABEL, input.incidentsComment);
  push("sources_comparison", ADMIN_SOURCES_COMPARISON_LABEL, input.sourcesComparisonComment);

  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  for (const key of AI_SOURCE_COMMENT_BLOCK_KEYS) {
    if (key === "citi_avoti") {
      for (const [i, section] of blocks.citi_avoti.sections.entries()) {
        push(
          sourceCommentAiBusyKey("citi_avoti", "comments", i),
          `${SOURCE_BLOCK_LABELS.citi_avoti} ${i + 1}`,
          section.comments,
        );
      }
      continue;
    }
    push(sourceCommentAiBusyKey(key), SOURCE_BLOCK_LABELS[key], sourceBlockCommentsPlain(key, blocks));
    if (key === "auto_records") {
      push(
        sourceCommentAiBusyKey(key, "oilChangeIntervalNotes"),
        "Eļļas maiņas intervāli",
        blocks.auto_records.oilChangeIntervalNotes ?? "",
      );
      push(
        sourceCommentAiBusyKey(key, "serviceHistoryNotes"),
        "Servisa vēsture",
        blocks.auto_records.serviceHistoryNotes ?? "",
      );
    }
  }
  return out;
}

/**
 * Visi klienta PDF drukātie teksta lauki pirms PDF C10 pārbaudei: tie paši, ko faktu pārbaude
 * (AI kopsavilkumi, nobraukuma un negadījumu komentāri, visi avotu komentāri), plus
 * „Citi avoti” sadaļu nosaukumi, kas PDF drukājas kā apakšvirsraksti.
 */
export function collectPrePdfClientTextFields(
  input: Parameters<typeof collectFilledFactCheckFields>[0],
): FactCheckFieldText[] {
  const out = collectFilledFactCheckFields(input);
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  for (const [i, section] of blocks.citi_avoti.sections.entries()) {
    const label = adminRichHtmlToPlainText(section.label ?? "").trim();
    if (!label) continue;
    out.push({
      field: `citi_avoti.label.${i}`,
      label: `${SOURCE_BLOCK_LABELS.citi_avoti} ${i + 1} (nosaukums)`,
      text: label,
    });
  }
  return out;
}

/** Lauku atslēgu prefikss gatavā PDF tekstiem (signāli, kartīšu teksti, tulkojumi) - viens panelis pie PDF. */
export const PDF_TEXT_FACT_FIELD_PREFIX = "pdf:";

/**
 * 28.11 (Nils 2): gatavā PDF teksti ārpus komentāru laukiem - operatora kartīšu / baneru teksti un dīlera PDF
 * «Signāli». Tos pārbauda pret kanonisko faktu tabulu tāpat kā komentārus (tikai brīdinājumi).
 */
export function collectPdfExtraFactCheckFields(input: {
  manualBanners?: readonly ProvinManualBanner[] | null;
  dealerSignals?: DealerSignalsState | null;
}): FactCheckFieldText[] {
  const out: FactCheckFieldText[] = [];
  (input.manualBanners ?? []).forEach((b, i) => {
    if (b.includeInPdf === false) return;
    const text = [b.title, b.value, b.text]
      .map((x) => adminRichHtmlToPlainText(x ?? "").trim())
      .filter(Boolean)
      .map((x) => (/[.!?]$/.test(x) ? x : `${x}.`))
      .join(" ");
    if (text) out.push({ field: `${PDF_TEXT_FACT_FIELD_PREFIX}banner.${i}`, label: `PDF kartīte ${i + 1}`, text });
  });
  for (const row of dealerSignalsPdfRows(input.dealerSignals ?? null, "lv")) {
    const text = adminRichHtmlToPlainText(row.text ?? "").trim();
    if (text) out.push({ field: `${PDF_TEXT_FACT_FIELD_PREFIX}signal.${row.kind}`, label: `Signāls: ${row.title}`, text });
  }
  return out;
}

/** Visi «pdf:» lauku karodziņi vienā sarakstā (ar lauka nosaukumu ziņā). */
export function pdfTextFactFlags(
  byField: Readonly<Record<string, FactCheckResult | undefined>>,
  labels?: Readonly<Record<string, string>>,
): FactCheckFlag[] {
  const out: FactCheckFlag[] = [];
  for (const [field, res] of Object.entries(byField)) {
    if (!field.startsWith(PDF_TEXT_FACT_FIELD_PREFIX) || !res) continue;
    const label = labels?.[field];
    for (const f of res.flags) {
      out.push(label && f.kind !== "translation_mismatch" ? { ...f, message: `${label}: ${f.message}` } : f);
    }
  }
  return out;
}

/** AI pieprasīta, bet nav izpildīta - informatīva rinda (I), lai admins zina, ka otrā pārbaude nenotika. */
export function withAiSkippedNotice(result: FactCheckResult, requested: boolean): FactCheckResult {
  if (!requested || result.aiUsed || !result.aiSkipped) return result;
  const why = result.aiSkipped === "ai_disabled" ? "AI faktu pārbaude serverī nav ieslēgta" : "AI pārbaude šai sesijai nav atļauta";
  return {
    ...result,
    flags: [
      ...result.flags,
      { id: "ai_check_skipped", kind: "unsourced", level: "I", message: `${why} - pārbaudīts tikai bez AI.`, sentence: "AI pārbaude" },
    ],
  };
}

export async function postAdminFactCheck(body: Record<string, unknown>): Promise<FactCheckResult> {
  const res = await fetch("/api/admin/ai/fact-check", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<FactCheckResult> & { error?: string };
  if (!res.ok) {
    return { flags: [], appliedFactIds: [], checkedAt: new Date().toISOString() };
  }
  return {
    flags: Array.isArray(data.flags) ? data.flags : [],
    appliedFactIds: Array.isArray(data.appliedFactIds) ? data.appliedFactIds : [],
    checkedAt: typeof data.checkedAt === "string" ? data.checkedAt : new Date().toISOString(),
    ...(data.aiUsed === true ? { aiUsed: true } : {}),
    ...(typeof data.aiSkipped === "string" && data.aiSkipped ? { aiSkipped: data.aiSkipped } : {}),
  };
}
