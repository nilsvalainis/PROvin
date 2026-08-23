/** Paneļi, ko var iekrāsot atsevišķi. */
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

const COARSE_TO_PANELS: Record<string, DamagePanelId[]> = {
  front: ["front_bumper", "hood"],
  front_left: ["front_left_fender"],
  front_right: ["front_right_fender"],
  left: ["front_left_door", "rear_left_door"],
  right: ["front_right_door", "rear_right_door"],
  roof: ["roof"],
  rear_left: ["rear_left_fender"],
  rear_right: ["rear_right_fender"],
  rear: ["trunk", "rear_bumper"],
};

const PANEL_IDS = new Set<string>(Object.keys(DAMAGE_PANEL_LABELS));

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

/**
 * E-klase W214 no augšas — gluda kontūra, bez riteņu iedobēm.
 * 4949×1880, bāze 2961, pārkare 848 / 1140.
 */
const BODY =
  "M90 16 C112 15 128 19 136 30 C142 38 145 50 145 64 L145 250 C145 266 141 278 132 287 C122 295 102 297 90 297 C78 297 58 295 48 287 C39 278 35 266 35 250 L35 64 C35 50 38 38 44 30 C52 19 68 15 90 16 Z";

/** Paneļu laukumi — tikai iekrāsošanai; apgriezti pēc BODY. */
const PANELS: Record<DamagePanelId, string> = {
  front_bumper: "M30 14 L150 14 L150 39 L30 39 Z",
  hood: "M54 38 L126 38 L128 107 L52 107 Z",
  front_left_fender: "M18 28 L54 28 L54 108 L18 108 Z",
  front_right_fender: "M126 28 L162 28 L162 108 L126 108 Z",
  front_left_door: "M18 106 L54 106 L54 176 L18 176 Z",
  front_right_door: "M126 106 L162 106 L162 176 L126 176 Z",
  roof: "M58 118 L122 118 L122 198 L58 198 Z",
  rear_left_door: "M18 174 L54 174 L54 226 L18 226 Z",
  rear_right_door: "M126 174 L162 174 L162 226 L126 226 Z",
  rear_left_fender: "M18 214 L54 214 L54 276 L18 276 Z",
  rear_right_fender: "M126 214 L162 214 L162 276 L126 276 Z",
  trunk: "M52 200 L128 200 L130 266 L50 266 Z",
  rear_bumper: "M30 264 L150 264 L150 304 L30 304 Z",
};

export function expandDamageZonesToPanels(active: Iterable<string>): Set<DamagePanelId> {
  const out = new Set<DamagePanelId>();
  for (const id of active) {
    if (PANEL_IDS.has(id)) out.add(id as DamagePanelId);
    else {
      const mapped = COARSE_TO_PANELS[id];
      if (mapped) for (const panel of mapped) out.add(panel);
    }
  }
  return out;
}

function wheelsSvg(): string {
  const tires = [
    { x: 27, y: 51 },
    { x: 139, y: 51 },
    { x: 27, y: 215 },
    { x: 139, y: 215 },
  ];
  return tires
    .map(
      (t) =>
        `<rect x="${t.x}" y="${t.y}" width="14" height="34" rx="7" fill="#0F172A"/>`,
    )
    .join("");
}

function mirrorsSvg(): string {
  return [
    `<path d="M20 118 C16 119 15 123 17 126 C19 128 26 128 33 125 L34 121 Z" fill="#334155"/>`,
    `<path d="M160 118 C164 119 165 123 163 126 C161 128 154 128 147 125 L146 121 Z" fill="#334155"/>`,
  ].join("");
}

function seamsSvg(): string {
  return `<g fill="none" stroke="#64748B" stroke-width="0.7" opacity="0.55">
    <path d="M48 38 C70 36 110 36 132 38"/>
    <path d="M46 106 C70 104 110 104 134 106"/>
    <path d="M54 64 L54 104"/>
    <path d="M126 64 L126 104"/>
    <path d="M52 118 L52 174"/>
    <path d="M128 118 L128 174"/>
    <path d="M52 176 L52 214"/>
    <path d="M128 176 L128 214"/>
    <path d="M48 198 C70 196 110 196 132 198"/>
    <path d="M46 266 C70 264 110 264 134 266"/>
    <path d="M90 38 L90 106"/>
  </g>`;
}

export function buildPanelDamageSilhouetteSvg(
  active: Iterable<string>,
  uid: string,
  opts?: { labeled?: boolean },
): string {
  const on = expandDamageZonesToPanels(active);
  const wash = PANEL_ORDER.filter((id) => on.has(id))
    .map(
      (id) =>
        `<path class="pdf-dmg-zone pdf-dmg-zone--on" data-zone="${id}" data-uid="${uid}" d="${PANELS[id]}" fill="#B7D1F5"/>`,
    )
    .join("");
  const labels = opts?.labeled
    ? `<g font-family="ui-sans-serif,system-ui,sans-serif" font-size="6" fill="#64748B">
        <text x="90" y="28" text-anchor="middle">buferis</text>
        <text x="90" y="78" text-anchor="middle">pārsegs</text>
        <text x="90" y="158" text-anchor="middle">jumts</text>
        <text x="90" y="236" text-anchor="middle">bagāžn.</text>
        <text x="90" y="280" text-anchor="middle">buferis</text>
      </g>`
    : "";
  return `<svg class="pdf-dmg-sil" viewBox="0 0 180 320" width="132" height="234" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <clipPath id="dmg-body-${uid}"><path d="${BODY}"/></clipPath>
    <linearGradient id="dmg-paint-${uid}" x1="36" y1="16" x2="144" y2="294" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#F8FAFC"/>
      <stop offset="0.45" stop-color="#E8EEF4"/>
      <stop offset="1" stop-color="#CBD5E1"/>
    </linearGradient>
  </defs>
  <ellipse cx="90" cy="308" rx="40" ry="4" fill="#0F172A" opacity="0.1"/>
  ${wheelsSvg()}
  <path d="${BODY}" fill="url(#dmg-paint-${uid})"/>
  <g clip-path="url(#dmg-body-${uid})">${wash}${seamsSvg()}</g>
  <path d="M58 108 C72 100 108 100 122 108 L118 130 L62 130 Z" fill="#334155" opacity="0.22"/>
  <path d="M62 132 L118 132 L116 196 L64 196 Z" fill="#64748B" opacity="0.08"/>
  <path d="M64 198 L116 198 L110 220 L70 220 Z" fill="#334155" opacity="0.18"/>
  <path d="M54 108 L64 132 L62 130 Z" fill="#475569" opacity="0.28"/>
  <path d="M126 108 L116 132 L118 130 Z" fill="#475569" opacity="0.28"/>
  <path d="M70 18 C78 16 102 16 110 18 L108 26 L72 26 Z" fill="#E2E8F0" opacity="0.9"/>
  <path d="M74 18 L106 18 L104 22 L76 22 Z" fill="#334155" opacity="0.2"/>
  <path d="M68 286 C78 290 102 290 112 286 L108 278 L72 278 Z" fill="#FCA5A5" opacity="0.45"/>
  ${mirrorsSvg()}
  <path d="${BODY}" fill="none" stroke="#1E293B" stroke-width="1.35" stroke-linejoin="round"/>
  ${labels}
</svg>`;
}
