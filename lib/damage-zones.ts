/**
 * Bojājumu zonas — atpazīšana no AutoDNA / CarVertical tekstiem un PDF siluets no augšas.
 * PROVIN dizains (zils akcents), nevis vendoru grafiku kopija.
 */

import { PDF_BRAND_BLUE_HEX } from "@/lib/client-report-pdf-layout-draft";

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

/** Garākie vispirms, lai „labā sāna priekšpuse” nekrīt uz vispārīgo „priekšpuse”. */
const ZONE_KEYWORDS: { id: DamageZoneId; label: string; re: RegExp }[] = [
  { id: "front_right", label: "Labais priekšējais spārns", re: /lab(?:ais|[āa])\s+priek[šs]ējais\s+sp[āa]rns/i },
  { id: "front_left", label: "Kreisais priekšējais spārns", re: /kreis(?:ais|[āa])\s+priek[šs]ējais\s+sp[āa]rns/i },
  { id: "front_right", label: "Lukturis priekšā pa labi", re: /lukturis\s+priek[šs][āa]\s+pa\s+labi/i },
  { id: "front_left", label: "Lukturis priekšā pa kreisi", re: /lukturis\s+priek[šs][āa]\s+pa\s+kreisi/i },
  { id: "front_right", label: "Priekšpuse pa labi", re: /priek[šs]puse\s*(?:\(\s*)?pa\s+labi/i },
  { id: "front_left", label: "Priekšpuse pa kreisi", re: /priek[šs]puse\s*(?:\(\s*)?pa\s+kreisi/i },
  { id: "front_left", label: "Kreisā sāna priekšpuse", re: /kreis(?:ā|a)\s+(?:s[āa]na\s+)?priek[šs](?:ēj[āa]\s+da[ļl]a|puse)/i },
  { id: "front_right", label: "Labā sāna priekšpuse", re: /lab(?:ā|a)\s+(?:s[āa]na\s+)?priek[šs](?:ēj[āa]\s+da[ļl]a|puse)/i },
  { id: "rear_left", label: "Kreisā sāna aizmugure", re: /kreis(?:ā|a)\s+(?:s[āa]na\s+)?aizmugur/i },
  { id: "rear_right", label: "Labā sāna aizmugure", re: /lab(?:ā|a)\s+(?:s[āa]na\s+)?aizmugur/i },
  { id: "front_left", label: "Kreisā priekšējā daļa", re: /kreis(?:ā|a)\s+priek[šs]ēj/i },
  { id: "front_right", label: "Labā priekšējā daļa", re: /lab(?:ā|a)\s+priek[šs]ēj/i },
  { id: "left", label: "Kreisā puse", re: /kreis(?:ā|a)\s+(?:puse|s[āa]na)/i },
  { id: "right", label: "Labā puse", re: /lab(?:ā|a)\s+(?:puse|s[āa]na)/i },
  { id: "front", label: "Priekšpuse", re: /priek[šs]puse|priek[šs]ēj(?:ā|a)\s+da[ļl]a/i },
  { id: "rear", label: "Aizmugure", re: /aizmugure|aizmugurēj(?:ā|a)\s+da[ļl]a/i },
  { id: "roof", label: "Jumts", re: /jumts|virs-virsb[ūu]ve|virsvirsb[ūu]ve/i },
];

const ZONE_LIST_HEADING_RE =
  /Boj[āa]jumu\s+zonas?|Boj[āa]t[āa]s\s+(?:deta[ļl]as|zonas)|Boj[āa]t[āa]\s+puse|Fiks[eē]tie\s+boj[āa]jumi/i;

const GROUP_LIST_HEADING_RE = /Deta[ļl]u\s+grupa|Boj[āa]jumu\s+grupas/i;

export function parseDamageZoneHits(raw: string): DamageZoneHit[] {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return [];
  const hits: DamageZoneHit[] = [];
  const seen = new Set<DamageZoneId>();
  const consumed: { start: number; end: number }[] = [];
  for (const z of ZONE_KEYWORDS) {
    const re = new RegExp(z.re.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (consumed.some((c) => start < c.end && end > c.start)) continue;
      consumed.push({ start, end });
      if (seen.has(z.id)) continue;
      seen.add(z.id);
      hits.push({ id: z.id, label: z.label });
    }
  }
  return hits;
}

/** Saraksta etiķetes attēlošanai — atpazītās zonas, citādi dalīts izejas teksts. */
export function damageZoneDisplayLabels(raw: string): string[] {
  const hits = parseDamageZoneHits(raw);
  if (hits.length > 0) return hits.map((h) => h.label);
  return splitLooseLabels(raw);
}

export function damageGroupDisplayLabels(raw: string): string[] {
  return splitLooseLabels(raw);
}

function splitLooseLabels(raw: string): string[] {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t || t === "—") return [];
  const parts = t
    .split(/\s*(?:[•·;,]|\n|(?:\s+[-–—]\s+)|(?:\s+\/\s+))\s*/)
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

export function extractZoneListFromBlock(block: string): string {
  const m = block.match(
    /(?:Boj[āa]jumu\s+zonas?|Boj[āa]t[āa]s\s+(?:deta[ļl]as|zonas)|Boj[āa]t[āa]\s+puse)\s*[:\-–]?\s*([\s\S]{0,500}?)(?=Deta[ļl]u\s+grupa|Boj[āa]jumu\s+grupas|Valsts|Summa|Rezult[āa]ts|Aptuven|\d{1,2}\.\d{4}|$)/i,
  );
  return (m?.[1] ?? "").replace(/\s+/g, " ").trim();
}

export function extractGroupListFromBlock(block: string): string {
  const m = block.match(
    /(?:Deta[ļl]u\s+grupa|Boj[āa]jumu\s+grupas)\s*[:\-–]?\s*([\s\S]{0,400}?)(?=Boj[āa]jumu\s+zona|Boj[āa]t[āa]s\s+deta[ļl]as|Valsts|Summa|Rezult[āa]ts|Aptuven|\d{1,2}\.\d{4}|$)/i,
  );
  return (m?.[1] ?? "").replace(/\s+/g, " ").trim();
}

const ZONE_SHAPES: Record<DamageZoneId, { x: number; y: number; w: number; h: number; rx: number }> = {
  front: { x: 58, y: 16, w: 84, h: 54, rx: 22 },
  front_left: { x: 16, y: 36, w: 52, h: 66, rx: 18 },
  front_right: { x: 132, y: 36, w: 52, h: 66, rx: 18 },
  left: { x: 12, y: 106, w: 42, h: 108, rx: 16 },
  right: { x: 146, y: 106, w: 42, h: 108, rx: 16 },
  roof: { x: 70, y: 118, w: 60, h: 72, rx: 12 },
  rear_left: { x: 16, y: 216, w: 52, h: 66, rx: 18 },
  rear_right: { x: 132, y: 216, w: 52, h: 66, rx: 18 },
  rear: { x: 58, y: 248, w: 84, h: 54, rx: 22 },
};

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

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Top-down auto siluets; aktīvās zonas — zīmola zils ar slīpu šķērsējumu. */
export function buildDamageZoneSilhouetteSvg(active: Iterable<DamageZoneId>, uid: string): string {
  const on = new Set(active);
  const hatchId = `pdfDmgHatch-${uid}`;
  const zones = ZONE_ORDER.map((id) => {
    const s = ZONE_SHAPES[id]!;
    const activeZone = on.has(id);
    const fill = activeZone ? `url(#${hatchId})` : "#eef2f6";
    const stroke = activeZone ? PDF_BRAND_BLUE_HEX : "#d5dde6";
    const sw = activeZone ? "1.6" : "0.8";
    const opacity = activeZone ? "1" : "0.85";
    return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`;
  }).join("");

  return `<svg class="pdf-dmg-sil" viewBox="0 0 200 320" width="158" height="252" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <pattern id="${hatchId}" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(40)">
      <rect width="8" height="8" fill="${PDF_BRAND_BLUE_HEX}" fill-opacity="0.14"/>
      <path d="M0 0 H8" stroke="${PDF_BRAND_BLUE_HEX}" stroke-width="1.6" stroke-opacity="0.88"/>
    </pattern>
  </defs>
  ${zones}
  <path d="M74 44 C74 28 86 18 100 18 C114 18 126 28 126 44 L136 96 L138 214 C138 238 122 264 100 278 C78 264 62 238 62 214 L64 96 Z" fill="#f8fafc" fill-opacity="0.72" stroke="#475569" stroke-width="1.45"/>
  <rect x="74" y="108" width="52" height="86" rx="10" fill="#fff" fill-opacity="0.78" stroke="#94a3b8" stroke-width="1"/>
  <path d="M78 54 C84 48 92 44 100 44 C108 44 116 48 122 54 L118 82 C112 78 106 76 100 76 C94 76 88 78 82 82 Z" fill="#fff" fill-opacity="0.62" stroke="#94a3b8" stroke-width="0.85"/>
  <path d="M80 228 C86 236 93 242 100 242 C107 242 114 236 120 228 L116 214 C110 218 105 220 100 220 C95 220 90 218 84 214 Z" fill="#fff" fill-opacity="0.62" stroke="#94a3b8" stroke-width="0.85"/>
  <rect x="18" y="88" width="12" height="30" rx="5" fill="#1e293b"/>
  <rect x="170" y="88" width="12" height="30" rx="5" fill="#1e293b"/>
  <rect x="18" y="196" width="12" height="30" rx="5" fill="#1e293b"/>
  <rect x="170" y="196" width="12" height="30" rx="5" fill="#1e293b"/>
  <text x="100" y="156" text-anchor="middle" font-size="10" font-family="Inter,sans-serif" font-weight="700" fill="${PDF_BRAND_BLUE_HEX}">${escapeXml("PROVIN")}</text>
</svg>`;
}
