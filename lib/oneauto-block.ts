import {
  ONEAUTO_PRODUCT_IDS,
  ONEAUTO_SOURCE_TAG,
  buildOneautoDisplay,
  formatOneautoCostEur,
  oneautoDisplayHasRows,
  parseOneautoDisplay,
  parseOneautoProductIds,
  type OneautoDisplaySections,
  type OneautoProductId,
} from "@/lib/oneauto-catalog";
import {
  autoRecordsServiceWorkRowsToPlainText,
  PROVIN_SERVICE_WORKS_TABLE_TITLE,
} from "@/lib/auto-records-service-works";
import {
  OFFICIAL_DEALER_SECTION_TITLE,
  ONEAUTO_PDF_EQUIPMENT_TITLE,
  ONEAUTO_PDF_POWERTRAIN_TITLE,
  oneautoDisplayToServiceWorks,
} from "@/lib/oneauto-dealer";

export type OneautoProductResult = {
  ok: boolean;
  error?: string;
  payload: unknown;
};

export type OneautoBlockState = {
  vinOverride: string;
  lastFetchedVin: string;
  fetchedAt: string;
  selectedProducts: OneautoProductId[];
  lastCostEur: string;
  results: Partial<Record<OneautoProductId, OneautoProductResult>>;
  display: OneautoDisplaySections;
  comments: string;
  serviceHistoryNotes: string;
  oilChangeIntervalNotes: string;
  aiContextRaw: string;
  source: typeof ONEAUTO_SOURCE_TAG;
};

export function emptyOneautoDisplay(): OneautoDisplaySections {
  return { equipment: [], serviceTimeline: [], powertrain: [] };
}

export function emptyOneautoBlock(): OneautoBlockState {
  return {
    vinOverride: "",
    lastFetchedVin: "",
    fetchedAt: "",
    selectedProducts: [...ONEAUTO_PRODUCT_IDS],
    lastCostEur: "",
    results: {},
    display: emptyOneautoDisplay(),
    comments: "",
    serviceHistoryNotes: "",
    oilChangeIntervalNotes: "",
    aiContextRaw: "",
    source: ONEAUTO_SOURCE_TAG,
  };
}

export function oneautoBlockHasContent(b: OneautoBlockState | null | undefined): boolean {
  if (!b) return false;
  return Boolean(
    b.lastFetchedVin.trim() ||
      b.fetchedAt.trim() ||
      oneautoDisplayHasRows(b.display) ||
      b.comments.trim() ||
      b.serviceHistoryNotes.trim() ||
      b.oilChangeIntervalNotes.trim(),
  );
}

/** PDF: tikai tas, ko klients redz (tabulas + komentāri), ne tikai ielādes metadati. */
export function oneautoBlockHasPrintableContent(b: OneautoBlockState | null | undefined): boolean {
  if (!b) return false;
  return Boolean(
    oneautoDisplayHasRows(b.display) ||
      b.comments.trim() ||
      b.serviceHistoryNotes.trim() ||
      b.oilChangeIntervalNotes.trim(),
  );
}

export function oneautoBlockToPlainText(b: OneautoBlockState | null | undefined): string {
  if (!b) return "";
  const lines: string[] = [];
  lines.push(OFFICIAL_DEALER_SECTION_TITLE);
  if (b.lastFetchedVin.trim()) lines.push(`VIN ${b.lastFetchedVin.trim()}`);
  if (b.display.powertrain.length) {
    lines.push(ONEAUTO_PDF_POWERTRAIN_TITLE);
    for (const row of b.display.powertrain) lines.push(`${row.label}: ${row.value}`);
  }
  if (b.display.equipment.length) {
    lines.push(ONEAUTO_PDF_EQUIPMENT_TITLE);
    for (const row of b.display.equipment) lines.push(`${row.label}: ${row.value}`);
  }
  const serviceWorks = autoRecordsServiceWorkRowsToPlainText(oneautoDisplayToServiceWorks(b.display));
  if (serviceWorks) {
    lines.push(`${PROVIN_SERVICE_WORKS_TABLE_TITLE}\n${serviceWorks}`);
  }
  if ((b.serviceHistoryNotes ?? "").trim()) {
    lines.push(`Servisa vēsture\n${b.serviceHistoryNotes.trim()}`);
  }
  if ((b.oilChangeIntervalNotes ?? "").trim()) {
    lines.push(`Eļļas maiņas intervāli\n${b.oilChangeIntervalNotes.trim()}`);
  }
  if ((b.comments ?? "").trim()) lines.push(`Komentāri\n${b.comments.trim()}`);
  return lines.join("\n\n");
}

function parseResultMap(raw: unknown): Partial<Record<OneautoProductId, OneautoProductResult>> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<Record<OneautoProductId, OneautoProductResult>> = {};
  for (const id of ONEAUTO_PRODUCT_IDS) {
    const row = o[id];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    out[id] = {
      ok: r.ok === true,
      error: typeof r.error === "string" ? r.error.slice(0, 400) : undefined,
      payload: r.payload,
    };
  }
  return out;
}

export function parseOneautoBlockRaw(raw: unknown): OneautoBlockState {
  const d = emptyOneautoBlock();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const selected = parseOneautoProductIds(o.selectedProducts);
  const results = parseResultMap(o.results);
  const parsedDisplay = parseOneautoDisplay(o.display);
  const display = oneautoDisplayHasRows(parsedDisplay)
    ? parsedDisplay
    : buildOneautoDisplay(
        Object.fromEntries(ONEAUTO_PRODUCT_IDS.map((id) => [id, results[id]?.payload])) as Partial<
          Record<OneautoProductId, unknown>
        >,
      );
  return {
    vinOverride: typeof o.vinOverride === "string" ? o.vinOverride.slice(0, 24) : "",
    lastFetchedVin: typeof o.lastFetchedVin === "string" ? o.lastFetchedVin.slice(0, 24) : "",
    fetchedAt: typeof o.fetchedAt === "string" ? o.fetchedAt.slice(0, 40) : "",
    selectedProducts: selected.length > 0 ? selected : d.selectedProducts,
    lastCostEur:
      typeof o.lastCostEur === "string"
        ? o.lastCostEur.slice(0, 20)
        : typeof o.lastCostEur === "number"
          ? formatOneautoCostEur(Math.round(o.lastCostEur * 100))
          : "",
    results,
    display,
    comments: typeof o.comments === "string" ? o.comments.slice(0, 12000) : "",
    serviceHistoryNotes: typeof o.serviceHistoryNotes === "string" ? o.serviceHistoryNotes.slice(0, 12000) : "",
    oilChangeIntervalNotes:
      typeof o.oilChangeIntervalNotes === "string" ? o.oilChangeIntervalNotes.slice(0, 12000) : "",
    aiContextRaw: typeof o.aiContextRaw === "string" ? o.aiContextRaw.slice(0, 12000) : "",
    source: ONEAUTO_SOURCE_TAG,
  };
}
