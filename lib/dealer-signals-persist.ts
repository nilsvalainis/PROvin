/**
 * Dīlera PDF «Signāli ārpus dīlera datiem» (Nils 27.11) - persistences lauks pasūtījuma workspace.
 * Bez citu moduļu importa, lai admin-source-blocks hidratācija neieiet ciklā.
 * Vecie pasūtījumi bez lauka paliek `undefined` (nekāda migrācija, sadaļa izslēgta).
 */

/** Signālu tipi - viens ieraksts uz tipu neatkarīgi no avotu skaita. Secība = PDF secība. */
export const DEALER_SIGNAL_KINDS = [
  "mileage_mismatch",
  "special_status",
  "incidents",
  "us_history",
  "auction_photos",
  "foreign_registry",
] as const;
export type DealerSignalKind = (typeof DEALER_SIGNAL_KINDS)[number];

export type DealerSignalItem = {
  kind: DealerSignalKind;
  /** Ķeksis: vai rinda nonāk PDF. */
  checked: boolean;
  /** Admina labots secinājums (LV). Tukšs = standarta teksts klienta valodā. */
  text?: string;
  /**
   * Labotā teksta AI tulkojums (Nils 27.11): ko admins redzēja priekšskatā, tas nonāk PDF.
   * Derīgs tikai, kamēr `src` sakrīt ar pašreizējo `text`.
   */
  tr?: DealerSignalTranslations;
  /**
   * Admina pievienots ar «+ Pievienot signālu» (Nils 27.11), arī ja automātika to neatrada.
   * «Pārģenerēt no datiem» manuālos neizdzēš.
   */
  manual?: true;
};

export const DEALER_SIGNAL_TR_LANGS = ["en", "ru", "de"] as const;
export type DealerSignalTrLang = (typeof DEALER_SIGNAL_TR_LANGS)[number];
export type DealerSignalTranslations = Partial<Record<DealerSignalTrLang, { src: string; text: string }>>;

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
    const tr = text ? parseTranslations(r.tr) : undefined;
    byKind.set(r.kind, {
      kind: r.kind,
      checked: r.checked === true,
      ...(text ? { text } : {}),
      ...(tr ? { tr } : {}),
      ...(r.manual === true ? { manual: true as const } : {}),
    });
  }
  return {
    enabled: rec.enabled === true,
    items: DEALER_SIGNAL_KINDS.filter((k) => byKind.has(k)).map((k) => byKind.get(k)!),
  };
}

function parseTranslations(raw: unknown): DealerSignalTranslations | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  const out: DealerSignalTranslations = {};
  for (const lang of DEALER_SIGNAL_TR_LANGS) {
    const v = rec[lang];
    if (!v || typeof v !== "object") continue;
    const e = v as Record<string, unknown>;
    const src = typeof e.src === "string" ? e.src.trim().slice(0, DEALER_SIGNAL_TEXT_MAX) : "";
    const text = typeof e.text === "string" ? e.text.trim().slice(0, DEALER_SIGNAL_TEXT_MAX * 2) : "";
    if (src && text) out[lang] = { src, text };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Persistences lauks - tikai ja stāvoklis ir, lai esošie melnraksti paliek neskarti. */
export function dealerSignalsSnapshotField(
  state: DealerSignalsState | null | undefined,
): { dealerSignals?: DealerSignalsState } {
  return state != null ? { dealerSignals: state } : {};
}
