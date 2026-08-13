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

const ZONE_SHAPES: Record<DamageZoneId, { x: number; y: number; w: number; h: number; rx: number }> = {
  front: { x: 54, y: 10, w: 92, h: 50, rx: 18 },
  front_left: { x: 12, y: 30, w: 52, h: 66, rx: 16 },
  front_right: { x: 136, y: 30, w: 52, h: 66, rx: 16 },
  left: { x: 8, y: 102, w: 40, h: 122, rx: 14 },
  right: { x: 152, y: 102, w: 40, h: 122, rx: 14 },
  roof: { x: 68, y: 126, w: 64, h: 90, rx: 10 },
  rear_left: { x: 12, y: 230, w: 52, h: 66, rx: 16 },
  rear_right: { x: 136, y: 230, w: 52, h: 66, rx: 16 },
  rear: { x: 54, y: 280, w: 92, h: 50, rx: 18 },
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

/** Top-down sedana siluets; aktīvās zonas — vienlaidus sarkans. */
export function buildDamageZoneSilhouetteSvg(active: Iterable<DamageZoneId>, uid: string): string {
  const on = new Set(active);
  const zones = ZONE_ORDER.map((id) => {
    const s = ZONE_SHAPES[id]!;
    const activeZone = on.has(id);
    const fill = activeZone ? "#ef4444" : "#eef2f6";
    const stroke = activeZone ? "#b91c1c" : "#d5dde6";
    const sw = activeZone ? "1.7" : "0.8";
    return `<rect class="pdf-dmg-zone${activeZone ? " pdf-dmg-zone--on" : ""}" data-zone="${id}" data-uid="${uid}" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  }).join("");

  return `<svg class="pdf-dmg-sil" viewBox="0 0 200 340" width="158" height="268" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  ${zones}
  <rect x="26" y="78" width="18" height="40" rx="9" fill="#1e293b"/>
  <rect x="156" y="78" width="18" height="40" rx="9" fill="#1e293b"/>
  <rect x="26" y="226" width="18" height="40" rx="9" fill="#1e293b"/>
  <rect x="156" y="226" width="18" height="40" rx="9" fill="#1e293b"/>
  <path d="M64 40 C64 26 80 20 100 20 C120 20 136 26 136 40 L150 90 L154 128 L154 216 L150 258 L136 300 C136 314 120 320 100 320 C80 320 64 314 64 300 L50 258 L46 216 L46 128 L50 90 Z" fill="#e8eef4" stroke="#334155" stroke-width="1.55"/>
  <ellipse cx="40" cy="120" rx="9" ry="6.5" fill="#334155"/>
  <ellipse cx="160" cy="120" rx="9" ry="6.5" fill="#334155"/>
  <path d="M72 86 L128 86 L122 128 L78 128 Z" fill="#c5d4e8" stroke="#64748b" stroke-width="0.9"/>
  <rect x="72" y="132" width="56" height="86" rx="8" fill="#f8fafc" stroke="#94a3b8" stroke-width="1"/>
  <path d="M78 224 L122 224 L128 262 L72 262 Z" fill="#c5d4e8" stroke="#64748b" stroke-width="0.9"/>
</svg>`;
}
