/**
 * «Ātrā pārbaude»: maksas atskaišu bezmaksas priekšskatījums (Nils 23.11).
 * AutoDNA (ierakstu skaits sadaļās), CheckCar.vin (vai ir bildes), CARFAX.eu (vai ir dati).
 * Tīra loģika no VIN SCAN rindām - nekas netiek pirkts.
 */
import {
  AUTODNA_KEY_SECTIONS,
  AUTODNA_PENDING_SUMMARY,
  autodnaSectionCount,
  parseAutodnaPrecheckDetail,
  type AutodnaPrecheckSection,
} from "@/lib/vin-scan/autodna-precheck";

export type AtraPreviewTone = "ok" | "none" | "wait" | "error";

export type AtraPreviewItem = { label: string; value: string; key: boolean; tone: "ok" | "none" };

export type AtraPreview = {
  id: "autodna_precheck" | "checkcar_vin" | "carfax_eu";
  label: string;
  tone: AtraPreviewTone;
  /** Galvenais teksts, piem. «31 ieraksts», «Bildes: 12», «Dati ir». */
  headline: string;
  items: AtraPreviewItem[];
  openUrl: string;
  /** Skaitļi stāsta potenciālam. */
  photos: number;
};

export type AtraPreviewRow = {
  id: string;
  status: string;
  summary: string;
  detail?: string;
  openUrl?: string;
};

const LABEL: Record<AtraPreview["id"], string> = {
  autodna_precheck: "AutoDNA",
  checkcar_vin: "CheckCar.vin",
  carfax_eu: "CARFAX.eu",
};

const FALLBACK_URL: Record<AtraPreview["id"], (vin: string) => string> = {
  autodna_precheck: (vin) => `https://www.autodna.lv/vin/${encodeURIComponent(vin)}`,
  checkcar_vin: (vin) => `https://checkcar.vin/report/check/${encodeURIComponent(vin)}`,
  carfax_eu: (vin) => `https://www.carfax.eu/preview-page?vin=${encodeURIComponent(vin)}`,
};

export function ierakstiWord(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? "ieraksts" : "ieraksti";
}

function baseTone(row: AtraPreviewRow | undefined): AtraPreviewTone {
  if (!row) return "wait";
  switch (row.status) {
    case "found":
      return "ok";
    case "none":
    case "skipped":
    case "needs_input":
    case "manual":
      return "none";
    case "idle":
    case "checking":
    case "browser_only":
      return "wait";
    default:
      return row.summary === AUTODNA_PENDING_SUMMARY ? "wait" : "error";
  }
}

function notReadyHeadline(tone: AtraPreviewTone, row: AtraPreviewRow | undefined): string {
  if (tone === "wait") {
    if (row?.status === "browser_only") return "Gaida pārlūku";
    if (row?.summary === AUTODNA_PENDING_SUMMARY) return "Vēl nav sagatavots";
    return "Pārbauda…";
  }
  if (tone === "error") return "Kļūda";
  return "Nav";
}

function sectionItem(s: AutodnaPrecheckSection, key: boolean): AtraPreviewItem {
  const n = s.available ? (s.count ?? 0) : 0;
  const value = s.count == null ? (s.available ? "ir" : "nav") : s.of != null && s.available ? `${s.count}/${s.of}` : String(n);
  return { label: s.name, value, key, tone: s.available && (s.count == null || s.count > 0) ? "ok" : "none" };
}

function autodnaPreview(vin: string, row: AtraPreviewRow | undefined): AtraPreview {
  const openUrl = row?.openUrl || FALLBACK_URL.autodna_precheck(vin);
  const data = row?.status === "found" || row?.status === "none" ? parseAutodnaPrecheckDetail(row.detail) : null;
  if (!data) {
    const tone = baseTone(row);
    return { id: "autodna_precheck", label: LABEL.autodna_precheck, tone, headline: notReadyHeadline(tone, row), items: [], openUrl, photos: 0 };
  }
  const keys = AUTODNA_KEY_SECTIONS.map((k) => k.toLowerCase());
  const keyItems: AtraPreviewItem[] = AUTODNA_KEY_SECTIONS.map((name) => {
    const s = data.sections.find((x) => x.name.toLowerCase() === name.toLowerCase());
    return s ? sectionItem(s, true) : { label: name, value: "-", key: true, tone: "none" as const };
  });
  const rest = data.sections.filter((s) => !keys.includes(s.name.toLowerCase())).map((s) => sectionItem(s, false));
  const photos = autodnaSectionCount(data, AUTODNA_KEY_SECTIONS[1]) ?? 0;
  return {
    id: "autodna_precheck",
    label: LABEL.autodna_precheck,
    tone: data.total > 0 ? "ok" : "none",
    headline: data.total > 0 ? `${data.total} ${ierakstiWord(data.total)}` : "Ierakstu nav",
    items: [...keyItems, ...rest],
    openUrl,
    photos,
  };
}

function checkcarPreview(vin: string, row: AtraPreviewRow | undefined): AtraPreview {
  const openUrl = row?.openUrl || FALLBACK_URL.checkcar_vin(vin);
  const tone = baseTone(row);
  const base = { id: "checkcar_vin" as const, label: LABEL.checkcar_vin, openUrl, items: [] as AtraPreviewItem[] };
  if (row?.status === "found") {
    const n = Number(/(\d+)\s*foto/i.exec(row.summary)?.[1] ?? NaN);
    if (Number.isFinite(n) && n > 0) return { ...base, tone: "ok", headline: `Bildes ir: ${n}`, photos: n };
    return { ...base, tone: "ok", headline: "Atskaite ir", items: [{ label: "Bildes", value: "nav zināms", key: true, tone: "none" }], photos: 0 };
  }
  if (row?.status === "none") return { ...base, tone: "none", headline: "Bilžu nav", photos: 0 };
  return { ...base, tone, headline: notReadyHeadline(tone, row), photos: 0 };
}

/** Releja CARFAX.eu rindas detaļas («Valstis: SE 10», «Nobraukuma rādījumi: 3») -> banera punkti. */
const CARFAX_DETAIL_ITEMS: readonly { prefix: string; label: string; key: boolean }[] = [
  { prefix: "Valstis", label: "Valstis", key: true },
  { prefix: "Nobraukuma rādījumi", label: "Nobraukums", key: true },
  { prefix: "Tehniskās apskates", label: "Apskates", key: true },
  { prefix: "Serviss un remonti", label: "Serviss", key: false },
  { prefix: "ASV vēsture", label: "ASV", key: false },
  { prefix: "Auto", label: "Auto", key: false },
];

function carfaxItems(detail: string | undefined): AtraPreviewItem[] {
  const lines = String(detail ?? "").split("\n");
  const out: AtraPreviewItem[] = [];
  for (const d of CARFAX_DETAIL_ITEMS) {
    const line = lines.find((l) => l.startsWith(`${d.prefix}: `));
    const value = line?.slice(d.prefix.length + 2).trim();
    if (value) out.push({ label: d.label, value, key: d.key, tone: "ok" });
  }
  return out;
}

function carfaxPreview(vin: string, row: AtraPreviewRow | undefined): AtraPreview {
  const openUrl = row?.openUrl || FALLBACK_URL.carfax_eu(vin);
  const tone = baseTone(row);
  const base = { id: "carfax_eu" as const, label: LABEL.carfax_eu, openUrl, items: [] as AtraPreviewItem[], photos: 0 };
  if (row?.status === "found") {
    const n = Number(/(\d+)\s*ierakst/i.exec(row.summary)?.[1] ?? NaN);
    return {
      ...base,
      tone: "ok",
      headline: Number.isFinite(n) && n > 0 ? `Dati ir: ${n} ${ierakstiWord(n)}` : "Dati ir",
      items: carfaxItems(row.detail),
    };
  }
  if (row?.status === "none") return { ...base, tone: "none", headline: "Datu nav" };
  return { ...base, tone, headline: notReadyHeadline(tone, row) };
}

/** Baneri tikai tiem avotiem, kas ir šajā skenēšanā (neieķeksēts avots netiek rādīts). */
export function buildAtraPreviews(vin: string, rows: readonly AtraPreviewRow[]): AtraPreview[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: AtraPreview[] = [];
  if (byId.has("autodna_precheck")) out.push(autodnaPreview(vin, byId.get("autodna_precheck")));
  if (byId.has("checkcar_vin")) out.push(checkcarPreview(vin, byId.get("checkcar_vin")));
  if (byId.has("carfax_eu")) out.push(carfaxPreview(vin, byId.get("carfax_eu")));
  return out;
}

/** Stāsta potenciālam: AutoDNA arhīva foto + CheckCar bildes. */
export function atraPreviewPhotoSources(previews: readonly AtraPreview[]): string[] {
  return previews.filter((p) => p.photos > 0).map((p) => (p.id === "autodna_precheck" ? "AutoDNA arhīvs" : p.label));
}
