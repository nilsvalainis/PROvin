import {
  ONEAUTO_PRODUCT_IDS,
  ONEAUTO_SOURCE_TAG,
  buildOneautoDisplay,
  formatOneautoCostEur,
  oneautoDisplayHasRows,
  parseOneautoProductIds,
  type OneautoDisplaySections,
  type OneautoProductId,
} from "@/lib/oneauto-catalog";

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
    aiContextRaw: "",
    source: ONEAUTO_SOURCE_TAG,
  };
}

export function oneautoBlockHasContent(b: OneautoBlockState | null | undefined): boolean {
  if (!b) return false;
  return Boolean(b.lastFetchedVin.trim() || b.fetchedAt.trim() || oneautoDisplayHasRows(b.display) || b.comments.trim());
}

export function oneautoBlockToPlainText(b: OneautoBlockState | null | undefined): string {
  if (!b) return "";
  const lines: string[] = [];
  if (b.lastFetchedVin.trim()) lines.push(`VIN ${b.lastFetchedVin.trim()}`);
  if (b.fetchedAt.trim()) lines.push(`Ielādēts ${b.fetchedAt.trim()}`);
  if (b.lastCostEur.trim()) lines.push(`Izmaksas ${b.lastCostEur.trim()}`);
  if (b.display.powertrain.length) {
    lines.push("Dzinēja / kārbas specifikācija");
    for (const row of b.display.powertrain) lines.push(`${row.label}: ${row.value}`);
  }
  if (b.display.equipment.length) {
    lines.push("Gatavā komplektācija");
    for (const row of b.display.equipment) lines.push(`${row.label}: ${row.value}`);
  }
  if (b.display.serviceTimeline.length) {
    lines.push("Servisu vēstures laika skala");
    for (const ev of b.display.serviceTimeline) {
      lines.push([ev.date, ev.odometer, ev.place, ev.works].filter(Boolean).join(" · "));
    }
  }
  if (b.comments.trim()) lines.push(b.comments.trim());
  return lines.join("\n");
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
  const displayFromRaw =
    o.display && typeof o.display === "object" ? (o.display as OneautoDisplaySections) : null;
  const display =
    displayFromRaw && oneautoDisplayHasRows(displayFromRaw)
      ? {
          equipment: Array.isArray(displayFromRaw.equipment) ? displayFromRaw.equipment : [],
          serviceTimeline: Array.isArray(displayFromRaw.serviceTimeline) ? displayFromRaw.serviceTimeline : [],
          powertrain: Array.isArray(displayFromRaw.powertrain) ? displayFromRaw.powertrain : [],
        }
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
    aiContextRaw: typeof o.aiContextRaw === "string" ? o.aiContextRaw.slice(0, 12000) : "",
    source: ONEAUTO_SOURCE_TAG,
  };
}
