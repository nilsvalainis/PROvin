/** Kopīgā lēcas ģeometrija — lieto `LensVariantDemos` un kustības alternatīvu demo. */

export const MOTION_PATH_D =
  "M 81.384 81.384 L 61.506 61.506 A 24.75 24.75 0 1 1 26.494 26.494 A 24.75 24.75 0 1 1 61.506 61.506 L 81.384 81.384";

export const HANDLE_RAIL_A = "M 61.5 62.268 L 80.5 81.268";
export const HANDLE_RAIL_B = "M 63.268 61.5 L 82.268 80.5";
export const HANDLE_SINGLE = "M 64 64 L 83 83";
export const REFLECT_Q = "M 29 37 Q 44 31 59 37";

function LensDefs({
  gid,
  lid,
  cid,
}: {
  gid: string;
  lid: string;
  cid: string;
}) {
  return (
    <defs>
      <clipPath id={cid}>
        <circle cx="44" cy="44" r="25.4" />
      </clipPath>
      <radialGradient id={lid} cx="44" cy="44" r="23" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="rgb(0 102 255)" stopOpacity="0.11" />
        <stop offset="40%" stopColor="rgb(0 102 255)" stopOpacity="0.042" />
        <stop offset="100%" stopColor="rgb(0 102 255)" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="rgb(230 235 245)" stopOpacity="0.253" />
        <stop offset="52%" stopColor="rgb(150 160 180)" stopOpacity="0.114" />
        <stop offset="100%" stopColor="rgb(210 218 232)" stopOpacity="0.202" />
      </linearGradient>
    </defs>
  );
}

export function LensBody({ gid, lid, cid }: { gid: string; lid: string; cid: string }) {
  return (
    <>
      <LensDefs gid={gid} lid={lid} cid={cid} />
      <circle cx="44" cy="44" r="26" fill={`url(#${lid})`} clipPath={`url(#${cid})`} />
      <circle cx="44" cy="44" r="26" stroke={`url(#${gid})`} strokeWidth="0.55" vectorEffect="non-scaling-stroke" />
      <circle cx="44" cy="44" r="23.5" stroke="rgb(255 255 255 / 0.2)" strokeWidth="0.58" vectorEffect="non-scaling-stroke" />
      <path
        d={REFLECT_Q}
        stroke="rgb(255 255 255 / 0.26)"
        strokeWidth="0.52"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

function LensDefsDemo2D({ gid, lid, cid }: { gid: string; lid: string; cid: string }) {
  return (
    <defs>
      <clipPath id={cid}>
        <circle cx="44" cy="44" r="25.4" />
      </clipPath>
      <radialGradient id={lid} cx="44" cy="44" r="23" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="rgb(0 102 255)" stopOpacity="0.05" />
        <stop offset="40%" stopColor="rgb(0 102 255)" stopOpacity="0.018" />
        <stop offset="100%" stopColor="rgb(0 102 255)" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="rgb(230 235 245)" stopOpacity="0.253" />
        <stop offset="52%" stopColor="rgb(150 160 180)" stopOpacity="0.114" />
        <stop offset="100%" stopColor="rgb(210 218 232)" stopOpacity="0.202" />
      </linearGradient>
    </defs>
  );
}

export function LensBodyDemo2D({ gid, lid, cid }: { gid: string; lid: string; cid: string }) {
  return (
    <>
      <LensDefsDemo2D gid={gid} lid={lid} cid={cid} />
      <circle cx="44" cy="44" r="26" fill={`url(#${lid})`} clipPath={`url(#${cid})`} />
      <circle cx="44" cy="44" r="26" stroke={`url(#${gid})`} strokeWidth="0.55" vectorEffect="non-scaling-stroke" />
      <circle cx="44" cy="44" r="23.5" fill="none" className="lens-variant-demos__2d-inner-ring" vectorEffect="non-scaling-stroke" />
      <path
        d={REFLECT_Q}
        stroke="rgb(255 255 255 / 0.26)"
        strokeWidth="0.52"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

/** Lēca ar vēsāku, „instrumenta” zilu — OBD / datu paneļa kontekstam. */
export function LensBodyInstrument({
  gid,
  lid,
  cid,
}: {
  gid: string;
  lid: string;
  cid: string;
}) {
  return (
    <>
      <defs>
        <clipPath id={cid}>
          <circle cx="44" cy="44" r="25.4" />
        </clipPath>
        <radialGradient id={lid} cx="44" cy="44" r="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgb(0 180 200)" stopOpacity="0.09" />
          <stop offset="45%" stopColor="rgb(0 120 160)" stopOpacity="0.035" />
          <stop offset="100%" stopColor="rgb(0 80 100)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(200 220 230)" stopOpacity="0.22" />
          <stop offset="50%" stopColor="rgb(120 150 170)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="rgb(160 190 205)" stopOpacity="0.16" />
        </linearGradient>
      </defs>
      <circle cx="44" cy="44" r="26" fill={`url(#${lid})`} clipPath={`url(#${cid})`} />
      <circle cx="44" cy="44" r="26" stroke={`url(#${gid})`} strokeWidth="0.55" vectorEffect="non-scaling-stroke" />
      <circle cx="44" cy="44" r="23.5" stroke="rgb(0 255 200 / 0.12)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <path
        d={REFLECT_Q}
        stroke="rgb(200 255 250 / 0.15)"
        strokeWidth="0.45"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}
