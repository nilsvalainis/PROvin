/**
 * Dīlera PDF «Signāli ārpus dīlera datiem» (Nils 27.11) - persistences lauks pasūtījuma workspace.
 * Bez citu moduļu importa, lai admin-source-blocks hidratācija neieiet ciklā.
 * Vecie pasūtījumi bez lauka paliek `undefined` (nekāda migrācija, sadaļa izslēgta).
 */

/** Signālu tipi - viens ieraksts uz tipu neatkarīgi no avotu skaita. Secība = PDF secība. */
export const DEALER_SIGNAL_KINDS = ["mileage_mismatch", "incidents", "auction_photos", "foreign_registry"] as const;
export type DealerSignalKind = (typeof DEALER_SIGNAL_KINDS)[number];

export type DealerSignalItem = {
  kind: DealerSignalKind;
  /** Ķeksis: vai rinda nonāk PDF. */
  checked: boolean;
  /** Admina labots secinājums (LV). Tukšs = standarta teksts klienta valodā. */
  text?: string;
};

export type DealerSignalsState = {
  /** «Ir PDF» - noklusējums izslēgts, nekad neieslēdzas automātiski. */
  enabled: boolean;
  items: DealerSignalItem[];
};

const KIND_SET = new Set<string>(DEALER_SIGNAL_KINDS);

export function isDealerSignalKind(v: unknown): v is DealerSignalKind {
  return typeof v === "string" && KIND_SET.has(v);
}

export const DEALER_SIGNAL_TEXT_MAX = 300;

/** Tīrs stāvoklis: zināmie tipi, viens uz tipu, kanoniskā secībā. Nederīgs -> `undefined`. */
export function parseDealerSignals(raw: unknown): DealerSignalsState | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  const byKind = new Map<DealerSignalKind, DealerSignalItem>();
  for (const it of Array.isArray(rec.items) ? rec.items : []) {
    if (!it || typeof it !== "object") continue;
    const r = it as Record<string, unknown>;
    if (!isDealerSignalKind(r.kind) || byKind.has(r.kind)) continue;
    const text = typeof r.text === "string" ? r.text.trim().slice(0, DEALER_SIGNAL_TEXT_MAX) : "";
    byKind.set(r.kind, { kind: r.kind, checked: r.checked === true, ...(text ? { text } : {}) });
  }
  return {
    enabled: rec.enabled === true,
    items: DEALER_SIGNAL_KINDS.filter((k) => byKind.has(k)).map((k) => byKind.get(k)!),
  };
}

/** Persistences lauks - tikai ja stāvoklis ir, lai esošie melnraksti paliek neskarti. */
export function dealerSignalsSnapshotField(
  state: DealerSignalsState | null | undefined,
): { dealerSignals?: DealerSignalsState } {
  return state != null ? { dealerSignals: state } : {};
}
