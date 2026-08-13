/**
 * Bojājumu zonas — atpazīšana no AutoDNA / CarVertical tekstiem un PDF siluets no augšas.
 */

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

/** Virsbūves kontūra no augšas — priekšgals augšā, reālas proporcijas (garums:platums ~2,6:1). */
const CAR_BODY_PATH =
  "M70 8 C82 8 92 11 96 16 L104 34 C109 45 111 55 111 66 L111 164 C111 176 109 186 104 194 L97 213 C93 220 82 223 70 223 C58 223 47 220 43 213 L36 194 C31 186 29 176 29 164 L29 66 C29 55 31 45 36 34 L44 16 C48 11 58 8 70 8 Z";

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

/** Siluets no augšas; bojātās zonas — maigs zils tonis, apgriezts pēc virsbūves kontūras. */
export function buildDamageZoneSilhouetteSvg(active: Iterable<DamageZoneId>, uid: string): string {
  const on = new Set(active);
  const clipId = `dmg-body-${uid}`;
  const zones = ZONE_ORDER.filter((id) => on.has(id))
    .map((id) => {
      const s = ZONE_SHAPES[id]!;
      return `<rect class="pdf-dmg-zone pdf-dmg-zone--on" data-zone="${id}" data-uid="${uid}" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx}" fill="#B7D1F5"/>`;
    })
    .join("");

  return `<svg class="pdf-dmg-sil" viewBox="0 0 140 231" width="120" height="198" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs><clipPath id="${clipId}"><path d="${CAR_BODY_PATH}"/></clipPath></defs>
  <rect x="22" y="35" width="12" height="27" rx="5" fill="#334155"/>
  <rect x="106" y="35" width="12" height="27" rx="5" fill="#334155"/>
  <rect x="22" y="157" width="12" height="27" rx="5" fill="#334155"/>
  <rect x="106" y="157" width="12" height="27" rx="5" fill="#334155"/>
  <path d="M29 65 L22 69 L23 73 L30 70 Z" fill="#94A3B8"/>
  <path d="M111 65 L118 69 L117 73 L110 70 Z" fill="#94A3B8"/>
  <path d="${CAR_BODY_PATH}" fill="#F5F8FC"/>
  <g clip-path="url(#${clipId})">${zones}</g>
  <g clip-path="url(#${clipId})" fill="#E7EEF7" stroke="#C3D2E2" stroke-width="1">
    <rect x="34" y="9" width="24" height="9" rx="4"/>
    <rect x="82" y="9" width="24" height="9" rx="4"/>
    <rect x="32" y="211" width="26" height="10" rx="4"/>
    <rect x="82" y="211" width="26" height="10" rx="4"/>
  </g>
  <path d="M50 59 C60 56 80 56 90 59 L96 78 L44 78 Z" fill="#E7EEF7" stroke="#B9C8DA" stroke-width="1.1"/>
  <path d="M44 78 L96 78 L94 136 L46 136 Z" fill="none" stroke="#D5E0EC" stroke-width="1"/>
  <path d="M46 136 L94 136 L90 156 C80 159 60 159 50 156 Z" fill="#E7EEF7" stroke="#B9C8DA" stroke-width="1.1"/>
  <path d="${CAR_BODY_PATH}" fill="none" stroke="#8A9CB0" stroke-width="1.6"/>
</svg>`;
}
