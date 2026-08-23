/**
 * Bojājumu zonas — ielasīšana pēc avota SADALAS, nevis pēc konkrēta VIN detaļu saraksta.
 * Siluets: kreisā/labā × priekšpuse/aizmugure/jumts. Etiķetes: avota teksts kā ir (buferis, durvis, lukturi…).
 */
import {
  buildPanelDamageSilhouetteSvg,
  type DamagePanelId,
} from "@/lib/damage-silhouette-panels";
import { reattachLatvianPdfDiacritics } from "@/lib/pdf-text-normalize";

export type DamageZoneId =
  | "front"
  | "front_left"
  | "front_right"
  | "left"
  | "right"
  | "rear"
  | "rear_left"
  | "rear_right"
  | "roof";

export type DamageZoneHit = {
  id: DamageZoneId;
  label: string;
};

const ZONE_LABEL: Record<DamageZoneId, string> = {
  front: "Priekšpuse",
  front_left: "Kreisā sāna priekšpuse",
  front_right: "Labā sāna priekšpuse",
  left: "Kreisais sāns",
  right: "Labais sāns",
  rear: "Aizmugure",
  rear_left: "Kreisā sāna aizmugure",
  rear_right: "Labā sāna aizmugure",
  roof: "Jumts",
};

const LV_WORD = "A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž";
/** JS `\b` nestrādā pēc ā/č/… — tie nav ASCII `\w`. */
const LV_WORD_END = `(?![${LV_WORD}])`;

/** Jauns ieraksts: Labā/Kreisā/Aizmugure/Jumts; Priekšpuse — tikai ja tā nav „sāna priekšpuse”. */
const DAMAGE_AREA_SPLIT_RE = new RegExp(
  `(?=\\s+(?:Lab(?:ā|ais)|Kreis(?:ā|ais)|Aizmugure|Jumts)${LV_WORD_END})|(?<!s[āa]na)(?=\\s+Priekšpuse${LV_WORD_END})|(?:\\s+[-–—•]\\s+)`,
  "i",
);

const ZONE_LIST_HEADING_RE =
  /Boj[āa]jumu\s+zonas?|Boj[āa]t[āa]s\s+(?:deta[ļl]as|zonas)|Boj[āa]t[āa]\s+puse|Fiks[eē]tie\s+boj[āa]jumi/i;

const GROUP_LIST_HEADING_RE = /Deta[ļl]u\s+grupa|Boj[āa]jumu\s+grupas/i;

/** PDF kājene / leģenda — nav bojājumu grupa. */
const DAMAGE_META_CUT_RE =
  /VIN\s*numurs|Ģenerē[sš]anas\s+datums|Derīguma\s+termiņ|"?Boj[āa]jumu"?\s+sadaļas\s+skaidrojums|carVertical/i;

export function clipVendorDamageField(raw: string): string {
  let t = reattachLatvianPdfDiacritics(raw).replace(/\s+/g, " ").trim();
  if (!t) return "";
  const cut = t.search(DAMAGE_META_CUT_RE);
  if (cut >= 0) t = t.slice(0, cut);
  t = t.replace(/\b[A-HJ-NPR-Z0-9]{17}\b/g, " ");
  return t.replace(/\s+/g, " ").replace(/[;·,./:\s-]+$/g, "").trim();
}

function isDamageLabelNoise(s: string): boolean {
  const t = s.trim();
  if (t.length < 2) return true;
  return DAMAGE_META_CUT_RE.test(t) || /^[A-HJ-NPR-Z0-9]{11,17}$/.test(t.replace(/\s/g, ""));
}

function classifyDamageSegment(seg: string): DamageZoneId[] {
  const t = reattachLatvianPdfDiacritics(seg).replace(/\s+/g, " ").trim().toLowerCase();
  if (!t) return [];
  if (/jumts|virs-?virsb[ūu]ve/.test(t)) return ["roof"];

  const left = /kreis/.test(t);
  const right = new RegExp(`lab(?:ais|[āa])${LV_WORD_END}`).test(t) || /pa\s+labi/.test(t);
  const front = /priek[šs]/.test(t);
  const rear = /aizmugur|bag[āa]žniek/.test(t);

  const cornerFront =
    /s[āa]na\s+priek|priek[šs]ēj[āa]\s+da[ļl]a|priek[šs]ējais\s+sp[āa]rns|lukturis\s+priek/.test(t);
  const cornerRear = /s[āa]na\s+aizmugur|aizmugurēj[āa]\s+da[ļl]a|aizmugurējais\s+sp[āa]rns/.test(t);
  const sidePanel =
    new RegExp(`(?<![${LV_WORD}])(?:puse|s[āa]ns)${LV_WORD_END}`).test(t) && !cornerFront && !cornerRear;

  if (left && (rear || cornerRear)) return ["rear_left"];
  if (right && (rear || cornerRear)) return ["rear_right"];
  if (left && (front || cornerFront) && !sidePanel) return ["front_left"];
  if (right && (front || cornerFront) && !sidePanel) return ["front_right"];
  if (left) return ["left"];
  if (right) return ["right"];
  if (front) return ["front"];
  if (rear) return ["rear"];
  if (/motora\s+p[āa]rsegs/.test(t)) return ["front"];
  return [];
}

/** Avota birkas (CarVertical `Zona / Detaļa`, AutoDNA `- zona`) — jebkuras nākamās daļas, ne tikai šī VIN. */
export function splitDamageSegments(raw: string): string[] {
  const t = clipVendorDamageField(raw);
  if (!t || t === "—") return [];
  const parts = t
    .split(DAMAGE_AREA_SPLIT_RE)
    .map((s) => s.replace(/^[-–—•]\s*/, "").trim())
    .filter((s) => s.length > 1 && !ZONE_LIST_HEADING_RE.test(s) && !GROUP_LIST_HEADING_RE.test(s));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

export function parseDamageZoneHits(raw: string): DamageZoneHit[] {
  const t = reattachLatvianPdfDiacritics(raw).replace(/\s+/g, " ").trim();
  if (!t) return [];
  const hits: DamageZoneHit[] = [];
  const seen = new Set<DamageZoneId>();
  const push = (id: DamageZoneId) => {
    if (seen.has(id)) return;
    seen.add(id);
    hits.push({ id, label: ZONE_LABEL[id] });
  };
  const segs = splitDamageSegments(t);
  for (const seg of segs.length > 0 ? segs : [t]) {
    for (const id of classifyDamageSegment(seg)) push(id);
  }
  if (hits.length === 0) {
    for (const id of classifyDamageSegment(t)) push(id);
  }
  return hits;
}

/** Sarakstam — avota birkas (buferis, durvis, lukturi), siluetam — parseDamageZoneHits. */
export function damageZoneDisplayLabels(raw: string): string[] {
  const segs = splitDamageSegments(raw);
  if (segs.length > 0) return segs;
  return parseDamageZoneHits(raw).map((h) => h.label);
}

export function damageGroupDisplayLabels(raw: string): string[] {
  return splitLooseLabels(raw);
}

function splitLooseLabels(raw: string): string[] {
  const t = clipVendorDamageField(raw);
  if (!t || t === "—") return [];
  const parts = t
    .split(/\s*(?:[•·;,]|\n|(?:\s+[-–—]\s+)|(?:\s+\/\s+))\s*/)
    .map((s) => s.replace(/^[-–—•]\s*/, "").trim())
    .filter((s) => s.length > 1 && !ZONE_LIST_HEADING_RE.test(s) && !GROUP_LIST_HEADING_RE.test(s) && !isDamageLabelNoise(s));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

export function extractZoneListFromBlock(block: string): string {
  const m = block.match(
    /(?:Boj[āa]jumu\s+zonas?|Boj[āa]t[āa]s\s+(?:deta[ļl]as|zonas)|Boj[āa]t[āa]\s+puse)\s*[:\-–]?\s*([\s\S]{0,800}?)(?=Deta[ļl]u\s+grupa|Boj[āa]jumu\s+grupas|Valsts|Summa|Rezult[āa]ts|Aptuven|\d{1,2}\.\d{4}|$)/i,
  );
  return clipVendorDamageField(m?.[1] ?? "");
}

export function extractGroupListFromBlock(block: string): string {
  const m = block.match(
    /(?:Deta[ļl]u\s+grupa|Boj[āa]jumu\s+grupas)\s*[:\-–]?\s*([\s\S]{0,800}?)(?=Boj[āa]jumu\s+zona|Boj[āa]t[āa]s\s+deta[ļl]as|Valsts|Summa|Rezult[āa]ts|Aptuven|VIN\s*numurs|Ģenerē[sš]anas|\d{1,2}\.\d{4}|$)/i,
  );
  return clipVendorDamageField(m?.[1] ?? "");
}

/**
 * Zonu laukumi virsbūves koordinātēs (viewBox 0 0 140 231); tiek apgriezti pēc virsbūves kontūras,
 * tāpēc drīkst pārklāties un iziet ārpus siluetā redzamās formas.
 */
const ZONE_SHAPES: Record<DamageZoneId, { x: number; y: number; w: number; h: number; rx: number }> = {
  front: { x: 16, y: -8, w: 108, h: 54, rx: 10 },
  front_left: { x: 12, y: 19, w: 59, h: 56, rx: 10 },
  front_right: { x: 69, y: 19, w: 59, h: 56, rx: 10 },
  left: { x: 12, y: 71, w: 40, h: 88, rx: 10 },
  right: { x: 88, y: 71, w: 40, h: 88, rx: 10 },
  roof: { x: 44, y: 76, w: 52, h: 62, rx: 8 },
  rear_left: { x: 12, y: 153, w: 59, h: 58, rx: 10 },
  rear_right: { x: 69, y: 153, w: 59, h: 58, rx: 10 },
  rear: { x: 16, y: 186, w: 108, h: 45, rx: 10 },
};

export type DamageSilhouetteVariant = "capsule" | "panels";

/** PDF noklusējums — E-klases paneļu siluets. */
export const DAMAGE_SILHOUETTE_VARIANT: DamageSilhouetteVariant = "panels";

const ZONE_ORDER: DamageZoneId[] = [
  "front",
  "front_left",
  "front_right",
  "left",
  "right",
  "roof",
  "rear_left",
  "rear_right",
  "rear",
];

/** Rezerves kapsula — nav PDF noklusējums. */
const BODY_CAPSULE =
  "M70 8 C82 8 92 11 96 16 L104 34 C109 45 111 55 111 66 L111 164 C111 176 109 186 104 194 L97 213 C93 220 82 223 70 223 C58 223 47 220 43 213 L36 194 C31 186 29 176 29 164 L29 66 C29 55 31 45 36 34 L44 16 C48 11 58 8 70 8 Z";

function zoneRectsSvg(active: Set<DamageZoneId>, uid: string): string {
  return ZONE_ORDER.filter((id) => active.has(id))
    .map((id) => {
      const s = ZONE_SHAPES[id]!;
      return `<rect class="pdf-dmg-zone pdf-dmg-zone--on" data-zone="${id}" data-uid="${uid}" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx}" fill="#B7D1F5"/>`;
    })
    .join("");
}

function wheelsAndMirrors(yFront: number, yRear: number, xInner = 21): string {
  const xOuter = 140 - xInner - 13;
  return [
    `<rect x="${xInner}" y="${yFront}" width="13" height="29" rx="6" fill="#334155"/>`,
    `<rect x="${xOuter}" y="${yFront}" width="13" height="29" rx="6" fill="#334155"/>`,
    `<rect x="${xInner}" y="${yRear}" width="13" height="29" rx="6" fill="#334155"/>`,
    `<rect x="${xOuter}" y="${yRear}" width="13" height="29" rx="6" fill="#334155"/>`,
    `<path d="M28 66 L20 71 L21 76 L29 72 Z" fill="#94A3B8"/>`,
    `<path d="M112 66 L120 71 L119 76 L111 72 Z" fill="#94A3B8"/>`,
  ].join("");
}

function wrapSilhouette(
  uid: string,
  bodyPath: string,
  extrasBefore: string,
  zones: string,
  extrasAfter: string,
): string {
  const clipId = `dmg-body-${uid}`;
  return `<svg class="pdf-dmg-sil" viewBox="0 0 140 231" width="120" height="198" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs><clipPath id="${clipId}"><path d="${bodyPath}"/></clipPath></defs>
  ${extrasBefore}
  <path d="${bodyPath}" fill="#F5F8FC"/>
  <g clip-path="url(#${clipId})">${zones}</g>
  ${extrasAfter}
  <path d="${bodyPath}" fill="none" stroke="#8A9CB0" stroke-width="1.6"/>
</svg>`;
}

function capsuleChrome(clipId: string): string {
  return `<g clip-path="url(#${clipId})" fill="#E7EEF7" stroke="#C3D2E2" stroke-width="1">
    <rect x="34" y="9" width="24" height="9" rx="4"/>
    <rect x="82" y="9" width="24" height="9" rx="4"/>
    <rect x="32" y="211" width="26" height="10" rx="4"/>
    <rect x="82" y="211" width="26" height="10" rx="4"/>
  </g>
  <path d="M50 59 C60 56 80 56 90 59 L96 78 L44 78 Z" fill="#E7EEF7" stroke="#B9C8DA" stroke-width="1.1"/>
  <path d="M44 78 L96 78 L94 136 L46 136 Z" fill="none" stroke="#D5E0EC" stroke-width="1"/>
  <path d="M46 136 L94 136 L90 156 C80 159 60 159 50 156 Z" fill="#E7EEF7" stroke="#B9C8DA" stroke-width="1.1"/>`;
}

/** Siluets no augšas; bojātās zonas — maigs zils tonis, apgriezts pēc virsbūves kontūras. */
export function buildDamageZoneSilhouetteSvg(
  active: Iterable<DamageZoneId | DamagePanelId>,
  uid: string,
  variant: DamageSilhouetteVariant = DAMAGE_SILHOUETTE_VARIANT,
): string {
  if (variant === "panels") {
    return buildPanelDamageSilhouetteSvg(active, uid);
  }
  const on = new Set<DamageZoneId>();
  for (const id of active) {
    if ((ZONE_ORDER as readonly string[]).includes(id)) on.add(id as DamageZoneId);
  }
  const clipId = `dmg-body-${uid}`;
  return wrapSilhouette(uid, BODY_CAPSULE, wheelsAndMirrors(35, 157, 22), zoneRectsSvg(on, uid), capsuleChrome(clipId));
}
