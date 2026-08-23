import type { DamageZoneId } from "@/lib/damage-zones";

/** Paneļi, ko var iekrāsot atsevišķi — tikai ja avots nosauc detaļu. */
export type DamagePanelId =
  | "front_bumper"
  | "hood"
  | "front_left_fender"
  | "front_right_fender"
  | "front_left_door"
  | "front_right_door"
  | "rear_left_door"
  | "rear_right_door"
  | "rear_left_fender"
  | "rear_right_fender"
  | "roof"
  | "trunk"
  | "rear_bumper";

export type DamageMarkStyle = "wash" | "solid" | "hatch" | "outline" | "stamp" | "pin";

/** PDF noklusējums — AutoDNA šķērssvītras, sarkanā. */
export const DAMAGE_MARK_STYLE: DamageMarkStyle = "hatch";

export const DAMAGE_PANEL_LABELS: Record<DamagePanelId, string> = {
  front_bumper: "Priekšējais buferis",
  hood: "Motora pārsegs",
  front_left_fender: "Kreisais priekšējais spārns",
  front_right_fender: "Labais priekšējais spārns",
  front_left_door: "Kreisās priekšējās durvis",
  front_right_door: "Labās priekšējās durvis",
  rear_left_door: "Kreisās aizmugurējās durvis",
  rear_right_door: "Labās aizmugurējās durvis",
  rear_left_fender: "Kreisais aizmugurējais spārns",
  rear_right_fender: "Labais aizmugurējais spārns",
  roof: "Jumts",
  trunk: "Bagāžnieka vāks",
  rear_bumper: "Aizmugurējais buferis",
};

const PANEL_IDS = new Set<string>(Object.keys(DAMAGE_PANEL_LABELS));

export function isDamagePanelId(id: string): id is DamagePanelId {
  return PANEL_IDS.has(id);
}

const PANEL_ORDER: DamagePanelId[] = [
  "front_bumper",
  "hood",
  "front_left_fender",
  "front_right_fender",
  "front_left_door",
  "front_right_door",
  "roof",
  "rear_left_door",
  "rear_right_door",
  "rear_left_fender",
  "rear_right_fender",
  "trunk",
  "rear_bumper",
];

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

/** AutoDNA sektori uz oriģinālā gaiši pelēkā sedana (viewBox 0 0 180 270). */
const ZONE_HATCH: Record<DamageZoneId, { x: number; y: number; w: number; h: number; rx: number }> = {
  front: { x: 52, y: 14, w: 76, h: 16, rx: 6 },
  front_left: { x: 28, y: 20, w: 56, h: 44, rx: 9 },
  front_right: { x: 96, y: 20, w: 56, h: 44, rx: 9 },
  left: { x: 26, y: 92, w: 38, h: 78, rx: 9 },
  right: { x: 116, y: 92, w: 38, h: 78, rx: 9 },
  roof: { x: 64, y: 110, w: 52, h: 62, rx: 8 },
  rear_left: { x: 28, y: 188, w: 56, h: 40, rx: 9 },
  rear_right: { x: 96, y: 188, w: 56, h: 40, rx: 9 },
  rear: { x: 52, y: 246, w: 76, h: 16, rx: 6 },
};

/** Precīzas detaļas — pikseli mērīti no oriģinālā sedana. */
const PANELS: Record<DamagePanelId, string> = {
  front_bumper: "M56 14 L124 14 L122 28 L58 28 Z",
  hood: "M62 28 L118 28 L116 68 L64 68 Z",
  front_left_fender: "M32 22 L64 22 L62 70 L30 70 Z",
  front_right_fender: "M116 22 L148 22 L150 70 L118 70 Z",
  front_left_door: "M30 94 L60 94 L58 158 L28 158 Z",
  front_right_door: "M120 94 L150 94 L152 158 L122 158 Z",
  roof: "M66 110 L114 110 L112 172 L68 172 Z",
  rear_left_door: "M28 156 L58 156 L56 190 L26 190 Z",
  rear_right_door: "M122 156 L152 156 L154 190 L124 190 Z",
  rear_left_fender: "M28 188 L58 188 L60 230 L30 230 Z",
  rear_right_fender: "M122 188 L152 188 L150 230 L120 230 Z",
  trunk: "M64 210 L116 210 L118 244 L62 244 Z",
  rear_bumper: "M56 244 L124 244 L122 262 L58 262 Z",
};

const PANEL_PIN: Record<DamagePanelId, { cx: number; cy: number }> = {
  front_bumper: { cx: 90, cy: 21 },
  hood: { cx: 90, cy: 48 },
  front_left_fender: { cx: 47, cy: 46 },
  front_right_fender: { cx: 133, cy: 46 },
  front_left_door: { cx: 44, cy: 126 },
  front_right_door: { cx: 136, cy: 126 },
  roof: { cx: 90, cy: 141 },
  rear_left_door: { cx: 42, cy: 173 },
  rear_right_door: { cx: 138, cy: 173 },
  rear_left_fender: { cx: 44, cy: 209 },
  rear_right_fender: { cx: 136, cy: 209 },
  trunk: { cx: 90, cy: 227 },
  rear_bumper: { cx: 90, cy: 253 },
};

const MARK_RED = "#DC2626";
const MARK_RED_DEEP = "#991B1B";
const MARK_RED_SOFT = "#FECACA";

function hasLeft(t: string): boolean {
  return /kreis/.test(t);
}
function hasRight(t: string): boolean {
  return /lab(?:ais|[āa])/.test(t) || /pa\s+labi/.test(t);
}
function hasFront(t: string): boolean {
  return /priek[šs]/.test(t);
}
function hasRear(t: string): boolean {
  return /aizmugur/.test(t);
}

/** Tikai tad, ja avots nosauc konkrētu detaļu. */
export function panelsFromOneLabel(raw: string): Set<DamagePanelId> {
  const out = new Set<DamagePanelId>();
  const t = raw.toLowerCase();
  if (!t.trim()) return out;
  const left = hasLeft(t);
  const right = hasRight(t);
  const front = hasFront(t);
  const rear = hasRear(t);

  if (/motora\s+p[āa]rsegs|kapote/.test(t)) out.add("hood");
  if (/bag[āa]žniek|bag[āa]žas\s+(?:nodal[īi]juma\s+)?v[āa]k|aizmugurējais\s+p[āa]rsegs/.test(t)) {
    out.add("trunk");
  }
  if (/bufer/.test(t)) {
    if (rear && !front) out.add("rear_bumper");
    else out.add("front_bumper");
  }
  if (/jumts/.test(t)) out.add("roof");
  if (/sp[āa]rns/.test(t)) {
    if (rear && left) out.add("rear_left_fender");
    else if (rear && right) out.add("rear_right_fender");
    else if (front && left) out.add("front_left_fender");
    else if (front && right) out.add("front_right_fender");
  }
  if (/durv/.test(t)) {
    if (rear && left) out.add("rear_left_door");
    else if (rear && right) out.add("rear_right_door");
    else if (front && left) out.add("front_left_door");
    else if (front && right) out.add("front_right_door");
    else if (left && !right) {
      out.add("front_left_door");
      out.add("rear_left_door");
    } else if (right && !left) {
      out.add("front_right_door");
      out.add("rear_right_door");
    }
  }
  return out;
}

export function panelsFromLabels(labels: Iterable<string>): Set<DamagePanelId> {
  const out = new Set<DamagePanelId>();
  for (const raw of labels) {
    for (const id of panelsFromOneLabel(raw)) out.add(id);
  }
  return out;
}

export type DamageSilhouetteMarks = {
  panels: Iterable<DamagePanelId | string>;
  zones: Iterable<DamageZoneId | string>;
};

function markDefs(uid: string): string {
  return `<pattern id="dmg-hatch-${uid}" width="4.2" height="4.2" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
      <rect width="4.2" height="4.2" fill="${MARK_RED}" fill-opacity="0.16"/>
      <line x1="0" y1="0" x2="0" y2="4.2" stroke="${MARK_RED}" stroke-width="2.4"/>
    </pattern>`;
}

function markShape(
  uid: string,
  style: DamageMarkStyle,
  zone: string,
  shape: { kind: "path"; d: string } | { kind: "rect"; x: number; y: number; w: number; h: number; rx: number },
): string {
  const cls = `class="pdf-dmg-zone pdf-dmg-zone--on" data-zone="${zone}" data-uid="${uid}"`;
  const geom =
    shape.kind === "path"
      ? `d="${shape.d}"`
      : `x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" rx="${shape.rx}"`;
  const tag = shape.kind === "path" ? "path" : "rect";
  if (style === "wash") return `<${tag} ${cls} ${geom} fill="${MARK_RED_SOFT}"/>`;
  if (style === "solid") return `<${tag} ${cls} ${geom} fill="${MARK_RED}" fill-opacity="0.72"/>`;
  if (style === "hatch") return `<${tag} ${cls} ${geom} fill="url(#dmg-hatch-${uid})"/>`;
  if (style === "outline") {
    return `<${tag} ${cls} ${geom} fill="${MARK_RED_SOFT}" fill-opacity="0.35" stroke="${MARK_RED}" stroke-width="2.4"/>`;
  }
  if (style === "stamp") {
    return `<${tag} ${cls} ${geom} fill="${MARK_RED}" fill-opacity="0.18" stroke="${MARK_RED_DEEP}" stroke-width="2.6"/>`;
  }
  return `<${tag} ${cls} ${geom} fill="${MARK_RED}" fill-opacity="0.14"/>`;
}

function pinMarks(panels: Iterable<DamagePanelId>): string {
  return [...panels]
    .map((id) => {
      const { cx, cy } = PANEL_PIN[id];
      return `<g data-zone-pin="${id}">
        <circle cx="${cx}" cy="${cy}" r="7.5" fill="${MARK_RED}" fill-opacity="0.22" stroke="${MARK_RED}" stroke-width="1.6"/>
        <circle cx="${cx}" cy="${cy}" r="3.1" fill="${MARK_RED_DEEP}"/>
      </g>`;
    })
    .join("");
}

function gridSvg(): string {
  return `<g fill="none" stroke="#94A3B8" stroke-width="0.5" stroke-dasharray="2.4 2.2" opacity="0.38">
    <line x1="90" y1="10" x2="90" y2="260"/>
    <line x1="20" y1="72" x2="160" y2="72"/>
    <line x1="20" y1="150" x2="160" y2="150"/>
    <line x1="20" y1="220" x2="160" y2="220"/>
  </g>`;
}

export function buildPanelDamageSilhouetteSvg(
  marks: DamageSilhouetteMarks,
  uid: string,
  opts?: { labeled?: boolean; mark?: DamageMarkStyle; carHref?: string },
): string {
  const style = opts?.mark ?? DAMAGE_MARK_STYLE;
  const carHref = opts?.carHref ?? "/brand/damage-car-top.jpg";
  const panels = PANEL_ORDER.filter((id) => new Set(marks.panels).has(id));
  const zones = ZONE_ORDER.filter((id) => new Set(marks.zones as Iterable<string>).has(id));
  const wash = [
    ...zones.map((id) => markShape(uid, style, id, { kind: "rect", ...ZONE_HATCH[id] })),
    ...panels.map((id) => markShape(uid, style, id, { kind: "path", d: PANELS[id] })),
  ].join("");
  const pins = style === "pin" ? pinMarks(panels) : "";
  const labels = opts?.labeled
    ? `<g font-family="ui-sans-serif,system-ui,sans-serif" font-size="6" fill="#64748B">
        <text x="90" y="28" text-anchor="middle">buferis</text>
        <text x="90" y="72" text-anchor="middle">pārsegs</text>
        <text x="90" y="150" text-anchor="middle">jumts</text>
        <text x="90" y="224" text-anchor="middle">bagāžn.</text>
        <text x="90" y="264" text-anchor="middle">buferis</text>
      </g>`
    : "";
  return `<svg class="pdf-dmg-sil" viewBox="0 0 180 270" width="132" height="198" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true">
  <defs>${markDefs(uid)}</defs>
  <rect x="0" y="0" width="180" height="270" fill="#F3F5F7"/>
  <image href="${carHref}" xlink:href="${carHref}" x="0" y="0" width="180" height="270" preserveAspectRatio="xMidYMid meet"/>
  ${gridSvg()}
  ${wash}
  ${pins}
  ${labels}
</svg>`;
}
